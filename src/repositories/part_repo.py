import json
from typing import Dict, List, Optional, Set, Union, Literal, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, select, or_, and_, func, insert, case, cast
from sqlalchemy import Float
from sqlalchemy.orm import selectinload
from dataclasses import asdict

from src.database.models import Part, PartCategory, PartSpecification, Image

import re

FilterType = Literal["range", "options"]


# --- КЭШИРОВАНИЕ СПЕЦИФИКАЦИЙ ПО КАТЕГОРИИ ---
# Важно: нельзя использовать lru_cache на async-функциях с параметром session.
# Делаем простой in-memory cache по category_id и очищаем его при CRUD.
_SPECS_CACHE: Dict[int, Dict[str, List[Tuple[str, Optional[str]]]]] = {}
_FILTERS_CACHE: Dict[int, Dict[str, Dict]] = {}


def clear_parts_filters_cache() -> None:
    _SPECS_CACHE.clear()
    _FILTERS_CACHE.clear()


async def get_specs_for_category(
    session: AsyncSession,
    category_id: int
) -> Dict[str, List[Tuple[str, Optional[str]]]]:
    """
    Возвращает уникальные спецификации для ТОЛЬКО ЭТОЙ категории (без подкатегорий):
    spec_name -> list[(spec_value, spec_unit)]
    """
    if category_id in _SPECS_CACHE:
        return _SPECS_CACHE[category_id]

    result = await session.execute(
        select(PartSpecification.spec_name, PartSpecification.spec_value, PartSpecification.spec_unit)
        .join(Part)
        .where(Part.category_id == category_id)
        .distinct()
    )
    rows = result.fetchall()

    specs: Dict[str, Set[Tuple[str, Optional[str]]]] = {}
    for name, value, unit in rows:
        if not name or value is None:
            continue
        if name not in specs:
            specs[name] = set()
        specs[name].add((str(value), str(unit) if unit else None))

    normalized = {name: sorted(values) for name, values in specs.items()}
    _SPECS_CACHE[category_id] = normalized
    return normalized

def detect_spec_type(values: List[str]) -> FilterType:
    if not values:
        return "options"
    numeric_count = 0
    for val in values:
        cleaned = re.sub(r'[^\d.,]', '', val.replace(',', '.'))
        if not cleaned:
            continue
        try:
            float(cleaned)
            numeric_count += 1
        except (ValueError, OverflowError):
            continue
    ratio = numeric_count / len(values)
    return "range" if ratio >= 0.5 else "options"


async def get_filters_config_for_category(
    session: AsyncSession,
    category_id: int
) -> Dict[str, Dict]:
    """
    Возвращает типы фильтров по категории: диапазон или выбор.
    Фильтры строятся ТОЛЬКО по спецификациям товаров в этой категории (без детей).
    """
    if category_id in _FILTERS_CACHE:
        return _FILTERS_CACHE[category_id]

    specs = await get_specs_for_category(session, category_id)
    config = {}
    for name, values in specs.items():
        only_values = [v for (v, _u) in values]
        spec_type = detect_spec_type(only_values)

        if spec_type == "options":
            # Склеиваем value + unit в одну строку (если unit есть) и делаем уникальными
            rendered = []
            for v, u in values:
                rendered.append(f"{v} {u}".strip() if u else v)
            config[name] = {"type": "options", "values": sorted(set(rendered))}
            continue

        # range: пытаемся извлечь числа
        nums = []
        units = []
        for v, u in values:
            cleaned = re.sub(r"[^\d.,-]", "", v.replace(",", "."))
            if not cleaned:
                continue
            try:
                nums.append(float(cleaned))
                if u:
                    units.append(u)
            except (ValueError, OverflowError):
                continue

        if not nums:
            # fallback
            config[name] = {"type": "options", "values": sorted(set([vv for (vv, _uu) in values]))}
        else:
            unit = None
            if units:
                # самый частый unit
                unit = max(set(units), key=units.count)
            config[name] = {"type": "range", "min": min(nums), "max": max(nums), "unit": unit}

    _FILTERS_CACHE[category_id] = config
    return config


# --- КАТЕГОРИИ / ПОДКАТЕГОРИИ ---
async def get_categories_tree(session: AsyncSession) -> List[dict]:
    """
    Возвращает дерево категорий: parent -> children, с флагом is_leaf.
    """
    res = await session.execute(select(PartCategory.category_id, PartCategory.category_name, PartCategory.parent_id))
    rows = res.fetchall()

    nodes = {cid: {"category_id": cid, "category_name": name, "parent_id": pid, "children": [], "is_leaf": True} for cid, name, pid in rows}
    for cid, name, pid in rows:
        if pid is not None and pid in nodes:
            nodes[pid]["children"].append(nodes[cid])
            nodes[pid]["is_leaf"] = False

    # top-level
    top = [n for n in nodes.values() if n["parent_id"] is None]
    # сортировка
    def sort_children(n):
        n["children"].sort(key=lambda x: x["category_name"])
        for c in n["children"]:
            sort_children(c)

    top.sort(key=lambda x: x["category_name"])
    for n in top:
        sort_children(n)
    return top


async def is_leaf_category(session: AsyncSession, category_id: int) -> bool:
    """
    Категория leaf, если у неё нет дочерних категорий.
    """
    res = await session.execute(
        select(func.count(PartCategory.category_id)).where(PartCategory.parent_id == category_id)
    )
    return (res.scalar() or 0) == 0


# --- РЕКУРСИВНЫЙ ПОИСК ПОДКАТЕГОРИЙ ---
async def get_all_subcategories(
    session: AsyncSession,
    parent_ids: List[int]
) -> List[int]:
    """
    Рекурсивно находит все подкатегории.
    """
    result_ids = set(parent_ids)
    queue = list(parent_ids)

    while queue:
        parent_id = queue.pop(0)
        subq = select(PartCategory.category_id).where(PartCategory.parent_id == parent_id)
        subcats = await session.execute(subq)
        new_ids = subcats.scalars().all()
        for cid in new_ids:
            if cid not in result_ids:
                result_ids.add(cid)
                queue.append(cid)

    return list(result_ids)


# --- ПОИСК ЗАПЧАСТЕЙ ---
async def search_parts(
    session: AsyncSession,
    query: str,
    limit: int = 20,
    offset: int = 0
) -> List[Part]:
    """
    Поиск по: названию, артикулу, производителю, спецификациям.
    """
    query = query.strip()
    if not query:
        stmt = (
            select(Part)
            .options(selectinload(Part.category))
            .options(selectinload(Part.specifications))
            .options(selectinload(Part.images))
            .limit(limit)
            .offset(offset)
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    keywords = query.split()
    conditions = []

    for word in keywords:
        if len(word) < 2:
            continue
        word = f"%{word}%"
        conditions.append(Part.part_name.ilike(word))
        conditions.append(Part.part_article.ilike(word))
        conditions.append(Part.manufacturer.ilike(word))

        # Поиск в спецификациях
        subq = select(PartSpecification.part_id).where(
            or_(
                PartSpecification.spec_name.ilike(word),
                PartSpecification.spec_value.ilike(word)
            )
        )
        conditions.append(Part.part_id.in_(subq))

    if not conditions:
        stmt = select(Part)
    else:
        stmt = select(Part).where(or_(*conditions))

    stmt = (
        stmt
        .options(selectinload(Part.category))
        .options(selectinload(Part.specifications))
        .options(selectinload(Part.images))
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(stmt)
    return result.scalars().all()


# --- ФИЛЬТРАЦИЯ ПО СПЕЦИФИКАЦИЯМ ---
def _numeric_value_expr():
    """
    SQL выражение для безопасного извлечения числа из PartSpecification.spec_value (PostgreSQL).
    Возвращает float или NULL, если распарсить нельзя.
    """
    # 1) оставляем только цифры/знак/запятую/точку
    cleaned = func.regexp_replace(PartSpecification.spec_value, r"[^0-9,\\.\\-]", "", "g")
    # 2) заменяем запятую на точку
    cleaned = func.replace(cleaned, ",", ".")
    # 3) NULL если пусто
    cleaned = func.nullif(cleaned, "")
    # 4) кастуем только если это валидное число вида -12.34
    # Используем класс [0-9], чтобы не зависеть от поддержки \d в postgres regex
    is_number = cleaned.op("~")(r"^-?[0-9]+(\\.[0-9]+)?$")
    return case((is_number, cast(cleaned, Float)), else_=None)


def build_spec_conditions(specs_filter: Dict[str, Union[str, List[str], Dict]]) -> List:
    """
    Строит условия:
    - options: у запчасти есть спецификация с таким именем и значением (IN)
    - range: у запчасти есть спецификация с таким именем и числовым значением в диапазоне
    """
    conditions = []
    for spec_name, spec_values in specs_filter.items():
        # range: {"min": 10, "max": 20}
        if isinstance(spec_values, dict):
            min_v = spec_values.get("min", None)
            max_v = spec_values.get("max", None)
            num_expr = _numeric_value_expr()

            range_conds = [PartSpecification.spec_name == spec_name, num_expr.is_not(None)]
            if min_v is not None:
                range_conds.append(num_expr >= float(min_v))
            if max_v is not None:
                range_conds.append(num_expr <= float(max_v))

            subq = select(PartSpecification.part_id).where(and_(*range_conds))
            conditions.append(Part.part_id.in_(subq))
            continue

        # options: "X" или ["X","Y"]
        if isinstance(spec_values, str):
            spec_values = [spec_values]

        if not isinstance(spec_values, list) or len(spec_values) == 0:
            continue

        subq = select(PartSpecification.part_id).where(
            and_(PartSpecification.spec_name == spec_name, PartSpecification.spec_value.in_(spec_values))
        )
        conditions.append(Part.part_id.in_(subq))
    return conditions


# --- ОСНОВНАЯ ФИЛЬТРАЦИЯ ---
async def filter_parts(
    session: AsyncSession,
    category_ids: Optional[List[int]] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_stock: Optional[int] = None,
    manufacturer: Optional[str] = None,
    specs_filter: Optional[Dict[str, Union[str, List[str]]]] = None,
    limit: int = 20,
    offset: int = 0,
) -> List[Part]:
    """
    Фильтрация запчастей.
    """
    stmt = select(Part)
    conditions = []

    # Категории и подкатегории
    if category_ids:
        all_category_ids = await get_all_subcategories(session, category_ids)
        conditions.append(Part.category_id.in_(all_category_ids))

    if min_price is not None:
        conditions.append(Part.price >= min_price)
    if max_price is not None:
        conditions.append(Part.price <= max_price)
    if min_stock is not None:
        conditions.append(Part.stock_count >= min_stock)
    if manufacturer:
        conditions.append(Part.manufacturer == manufacturer)

    # Спецификации
    if specs_filter:
        spec_conditions = build_spec_conditions(specs_filter)
        conditions.extend(spec_conditions)

    # Применяем условия
    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = (
        stmt
        .options(selectinload(Part.category))
        .options(selectinload(Part.specifications))
        .options(selectinload(Part.images))
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(stmt)
    return result.scalars().all()


# --- ПОИСК + ФИЛЬТРАЦИЯ ---
async def search_and_filter_parts(
    session: AsyncSession,
    query: str = None,
    category_ids: Optional[List[int]] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_stock: Optional[int] = None,
    manufacturer: Optional[str] = None,
    specs_filter: Optional[Dict[str, Union[str, List[str]]]] = None,
    limit: int = 20,
    offset: int = 0,
) -> List[Part]:
    """
    Сначала ищет, потом фильтрует.
    """
    stmt = select(Part)
    conditions = []

    # Поиск
    if query and query.strip():
        found_parts = await search_parts(session, query, limit=200)
        if not found_parts:
            return []
        found_ids = [p.part_id for p in found_parts]
        conditions.append(Part.part_id.in_(found_ids))

    # Категории
    if category_ids:
        all_category_ids = await get_all_subcategories(session, category_ids)
        conditions.append(Part.category_id.in_(all_category_ids))

    # Остальные фильтры
    if min_price is not None:
        conditions.append(Part.price >= min_price)
    if max_price is not None:
        conditions.append(Part.price <= max_price)
    if min_stock is not None:
        conditions.append(Part.stock_count >= min_stock)
    if manufacturer:
        conditions.append(Part.manufacturer == manufacturer)

    if specs_filter:
        spec_conditions = build_spec_conditions(specs_filter)
        conditions.extend(spec_conditions)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    stmt = (
        stmt
        .options(selectinload(Part.category))
        .options(selectinload(Part.specifications))
        .options(selectinload(Part.images))
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(stmt)
    return result.scalars().all()


# === CRUD: ЗАПЧАСТИ ===

async def create_part(
    session: AsyncSession,
    part_data: dict,
    specifications: List[dict],  # [{"spec_name": "Диаметр", "spec_value": "280 мм"}]
    image_urls: List[str] = None  # [{"url": "...", "alt_text": "...", "sort_order": 0}]
) -> Part:
    """
    Создаёт запчасть, связывает с категорией, добавляет спецификации и фото.
    """
    # Проверка: существует ли категория
    category_id = part_data["category_id"]
    category_result = await session.execute(
        select(PartCategory).where(PartCategory.category_id == category_id)
    )
    if not category_result.scalar():
        raise ValueError(f"Категория с ID={category_id} не найдена")

    # Проверка: уникальность артикула
    article = part_data.get("part_article")
    if article:
        exists = await session.execute(
            select(Part).where(Part.part_article == article)
        )
        if exists.scalar():
            raise ValueError(f"Запчасть с артикулом {article} уже существует")

    # Создаём запчасть
    part = Part(**part_data)
    session.add(part)
    await session.flush()  # чтобы получить part_id

    # Добавляем спецификации
    for spec in specifications:
        spec_obj = PartSpecification(
            part_id=part.part_id,
            spec_name=spec["spec_name"].strip(),
            spec_value=spec["spec_value"].strip()
        )
        session.add(spec_obj)

    # Добавляем фото
    if image_urls:
        for img_data in image_urls:
            img = Image(
                part_id=part.part_id,
                url=img_data["url"],
                alt_text=img_data.get("alt_text"),
                sort_order=img_data.get("sort_order", 0)
            )
            session.add(img)

    # Инвалидируем кэш спецификаций для этой категории
    clear_parts_filters_cache()

    await session.commit()
    await session.refresh(part)
    return part


async def get_part_by_id(session: AsyncSession, part_id: int) -> Optional[Part]:
    """
    Возвращает одну запчасть по part_id вместе с category, specifications и images.
    """
    stmt = (
        select(Part)
        .where(Part.part_id == part_id)
        .options(selectinload(Part.category))
        .options(selectinload(Part.specifications))
        .options(selectinload(Part.images))
    )
    res = await session.execute(stmt)
    return res.scalars().first()


async def update_part(
    session: AsyncSession,
    part_id: int,
    part_data: dict = None,
    specifications: List[dict] = None,
    image_urls: List[dict] = None
) -> Optional[Part]:
    """
    Обновляет запчасть. Перезаписывает спецификации и фото.
    """
    part = await session.get(Part, part_id)
    if not part:
        return None

    # Обновляем основные поля
    if part_data:
        for key, value in part_data.items():
            if value is not None:
                setattr(part, key, value)

    # Обновляем спецификации: удаляем старые, добавляем новые
    if specifications is not None:
        await session.execute(
            delete(PartSpecification).where(PartSpecification.part_id == part_id)
        )
        for spec in specifications:
            spec_obj = PartSpecification(
                part_id=part.part_id,
                spec_name=spec["spec_name"].strip(),
                spec_value=spec["spec_value"].strip()
            )
            session.add(spec_obj)

    # Обновляем фото
    if image_urls is not None:
        await session.execute(
            delete(Image).where(Image.part_id == part_id)
        )
        for img_data in image_urls:
            img = Image(
                part_id=part.part_id,
                url=img_data["url"],
                alt_text=img_data.get("alt_text"),
                sort_order=img_data.get("sort_order", 0)
            )
            session.add(img)

    # Сброс кэша
    clear_parts_filters_cache()

    await session.commit()
    await session.refresh(part)
    return part


async def delete_part(
    session: AsyncSession,
    part_id: int
) -> bool:
    """
    Удаляет запчасть и всё связанное.
    """
    part = await session.get(Part, part_id)
    if not part:
        return False

    # Удаляем связанные данные
    await session.execute(
        delete(PartSpecification).where(PartSpecification.part_id == part_id)
    )
    await session.execute(
        delete(Image).where(Image.part_id == part_id)
    )
    await session.delete(part)

    # Сброс кэша
    clear_parts_filters_cache()

    await session.commit()
    return True