import re
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple

from src.database.models import Car, CarTrim, Image


def normalize_text(text: str) -> str:
    return re.sub(r'\s+', ' ', text.strip().lower())


def extract_vin(query: str) -> Optional[str]:
    cleaned = re.sub(r'[^A-HJ-NPR-Z0-9]', '', query.upper())
    return cleaned if len(cleaned) == 17 else None

async def get_car_by_id(session: AsyncSession, car_id: int) -> Optional[Car]:
    """
    Получить автомобиль по ID.
    """
    stmt = (
        select(Car)
        .where(Car.car_id == car_id)
        .options(selectinload(Car.trim))
        .options(selectinload(Car.images))
    )
    result = await session.execute(stmt)
    return result.scalar()

async def get_car_ids_by_search(
    session: AsyncSession,
    query: str,
    limit: int = 200
) -> List[int]:
    """
    Возвращает список car_id, найденных по текстовому запросу.
    Можно использовать для дальнейшей фильтрации.
    """
    query = normalize_text(query)
    if not query:
        return []

    # 1. VIN
    vin = extract_vin(query)
    if vin:
        result = await session.execute(
            select(Car.car_id).where(Car.vin == vin)
        )
        car_id = result.scalar()
        return [car_id] if car_id else []

    # 2. По словам
    keywords = query.split()
    conditions = []

    for word in keywords:
        if len(word) < 2:
            continue

        conditions.append(CarTrim.brand_name.ilike(f"%{word}%"))
        conditions.append(CarTrim.model_name.ilike(f"%{word}%"))
        conditions.append(Car.color.ilike(f"%{word}%"))

        try:
            cleaned = re.sub(r'[^\d.]', '', word)
            if not cleaned or cleaned.count('.') > 1 or cleaned == '.':
                continue
            value = float(cleaned)

            if value.is_integer():
                int_value = int(value)
                if 0 <= int_value <= 2030:
                    conditions.append(Car.production_year == int_value)
                elif 0 <= int_value <= 1000:
                    conditions.append(CarTrim.engine_power >= int_value)
            else:
                if 0.1 <= value <= 10.0:
                    conditions.append(CarTrim.engine_volume >= value)
        except (ValueError, OverflowError):
            continue

    if not conditions:
        return []

    stmt = select(Car.car_id).join(Car.trim).where(or_(*conditions)).limit(limit)
    result = await session.execute(stmt)
    return list(result.scalars().all())


def build_filter_conditions(
    colors: Optional[List[str]] = None,
    min_mileage: Optional[int] = None,
    max_mileage: Optional[int] = None,
    min_production_year: Optional[int] = None,
    max_production_year: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    conditions: Optional[List[str]] = None,
    min_engine_volume: Optional[float] = None,
    max_engine_volume: Optional[float] = None,
    min_engine_power: Optional[int] = None,
    max_engine_power: Optional[int] = None,
    min_engine_torque: Optional[int] = None,
    max_engine_torque: Optional[int] = None,
    transmissions: Optional[List[str]] = None,
    drive_types: Optional[List[str]] = None,
    body_types: Optional[List[str]] = None,
    brands: Optional[List[str]] = None,
    fuel_types: Optional[List[str]] = None,
) -> List:
    """
    Строит список условий для фильтрации.
    Не зависит от сессии или stmt.
    """
    conditions_list = []

    if colors:
        conditions_list.append(Car.color.in_(colors))
    if min_mileage is not None:
        conditions_list.append(Car.mileage >= min_mileage)
    if max_mileage is not None:
        conditions_list.append(Car.mileage <= max_mileage)
    if min_production_year is not None:
        conditions_list.append(Car.production_year >= min_production_year)
    if max_production_year is not None:
        conditions_list.append(Car.production_year <= max_production_year)
    if min_price is not None:
        conditions_list.append(Car.price >= min_price)
    if max_price is not None:
        conditions_list.append(Car.price <= max_price)
    if conditions:
        conditions_list.append(Car.condition.in_(conditions))

    if brands:
        conditions_list.append(CarTrim.brand_name.in_(brands))
    if fuel_types:
        conditions_list.append(CarTrim.fuel_type.in_(fuel_types))
    if min_engine_volume is not None:
        conditions_list.append(CarTrim.engine_volume >= min_engine_volume)
    if max_engine_volume is not None:
        conditions_list.append(CarTrim.engine_volume <= max_engine_volume)
    if min_engine_power is not None:
        conditions_list.append(CarTrim.engine_power >= min_engine_power)
    if max_engine_power is not None:
        conditions_list.append(CarTrim.engine_power <= max_engine_power)
    if min_engine_torque is not None:
        conditions_list.append(CarTrim.engine_torque >= min_engine_torque)
    if max_engine_torque is not None:
        conditions_list.append(CarTrim.engine_torque <= max_engine_torque)
    if transmissions:
        conditions_list.append(CarTrim.transmission.in_(transmissions))
    if drive_types:
        conditions_list.append(CarTrim.drive_type.in_(drive_types))
    if body_types:
        conditions_list.append(CarTrim.body_type.in_(body_types))

    return conditions_list


async def apply_filters_and_execute(
    session: AsyncSession,
    base_stmt,
    conditions: List,
    limit: int = 20,
    offset: int = 0,
    load_options: bool = True
) -> List[Car]:
    """
    Применяет условия, лимиты, загружает связи и выполняет запрос.
    """
    if conditions:
        base_stmt = base_stmt.where(and_(*conditions))

    base_stmt = base_stmt.limit(limit).offset(offset)

    if load_options:
        base_stmt = base_stmt.options(
            selectinload(Car.trim),
            selectinload(Car.images)
        )

    result = await session.execute(base_stmt)
    return result.scalars().all()


# Публичные функции

async def search_cars(
    session: AsyncSession,
    query: str,
    limit: int = 20,
    offset: int = 0
) -> List[Car]:
    """
    Поиск по тексту — возвращает объекты Car.
    """
    from src.database.models import CarOrder, Order, OrderStatusEnum
    
    # Исключаем автомобили, которые уже заказаны
    ordered_car_ids_subquery = (
        select(CarOrder.car_id)
        .join(Order, CarOrder.order_id == Order.order_id)
        .where(Order.status != OrderStatusEnum.CANCELLED.value)
    )
    
    car_ids = await get_car_ids_by_search(session, query, limit=200)
    if not car_ids:
        # Если нет — возвращаем первые авто (исключая заказанные)
        stmt = select(Car).where(~Car.car_id.in_(ordered_car_ids_subquery))
        return await apply_filters_and_execute(session, stmt, [], limit, offset)

    stmt = (
        select(Car)
        .where(
            Car.car_id.in_(car_ids),
            ~Car.car_id.in_(ordered_car_ids_subquery)
        )
    )
    return await apply_filters_and_execute(session, stmt, [], limit, offset)


async def filter_cars(
    session: AsyncSession,
    colors: Optional[List[str]] = None,
    min_mileage: Optional[int] = None,
    max_mileage: Optional[int] = None,
    min_production_year: Optional[int] = None,
    max_production_year: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    conditions: Optional[List[str]] = None,
    min_engine_volume: Optional[float] = None,
    max_engine_volume: Optional[float] = None,
    min_engine_power: Optional[int] = None,
    max_engine_power: Optional[int] = None,
    min_engine_torque: Optional[int] = None,
    max_engine_torque: Optional[int] = None,
    transmissions: Optional[List[str]] = None,
    drive_types: Optional[List[str]] = None,
    body_types: Optional[List[str]] = None,
    brands: Optional[List[str]] = None,
    fuel_types: Optional[List[str]] = None,
    limit: int = 20,
    offset: int = 0,
) -> List[Car]:
    """
    Только фильтрация — без поиска.
    """
    conditions_list = build_filter_conditions(
        colors=colors,
        min_mileage=min_mileage,
        max_mileage=max_mileage,
        min_production_year=min_production_year,
        max_production_year=max_production_year,
        min_price=min_price,
        max_price=max_price,
        conditions=conditions,
        min_engine_volume=min_engine_volume,
        max_engine_volume=max_engine_volume,
        min_engine_power=min_engine_power,
        max_engine_power=max_engine_power,
        min_engine_torque=min_engine_torque,
        max_engine_torque=max_engine_torque,
        transmissions=transmissions,
        drive_types=drive_types,
        body_types=body_types,
        brands=brands,
        fuel_types=fuel_types
    )

    from src.database.models import CarOrder, Order, OrderStatusEnum
    
    # Исключаем автомобили, которые уже заказаны
    ordered_car_ids_subquery = (
        select(CarOrder.car_id)
        .join(Order, CarOrder.order_id == Order.order_id)
        .where(Order.status != OrderStatusEnum.CANCELLED.value)
    )
    
    stmt = (
        select(Car)
        .join(Car.trim)
        .where(~Car.car_id.in_(ordered_car_ids_subquery))
    )
    return await apply_filters_and_execute(session, stmt, conditions_list, limit, offset)


async def search_and_filter_cars(
    session: AsyncSession,
    query: str = None,
    # Все фильтры
    colors: Optional[List[str]] = None,
    min_mileage: Optional[int] = None,
    max_mileage: Optional[int] = None,
    min_production_year: Optional[int] = None,
    max_production_year: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    conditions: Optional[List[str]] = None,
    min_engine_volume: Optional[float] = None,
    max_engine_volume: Optional[float] = None,
    min_engine_power: Optional[int] = None,
    max_engine_power: Optional[int] = None,
    min_engine_torque: Optional[int] = None,
    max_engine_torque: Optional[int] = None,
    transmissions: Optional[List[str]] = None,
    drive_types: Optional[List[str]] = None,
    body_types: Optional[List[str]] = None,
    brands: Optional[List[str]] = None,
    fuel_types: Optional[List[str]] = None,
    limit: int = 20,
    offset: int = 0,
) -> List[Car]:
    """
    Сначала ищет, потом фильтрует.
    """
    conditions_list = build_filter_conditions(
        colors=colors,
        min_mileage=min_mileage,
        max_mileage=max_mileage,
        min_production_year=min_production_year,
        max_production_year=max_production_year,
        min_price=min_price,
        max_price=max_price,
        conditions=conditions,
        min_engine_volume=min_engine_volume,
        max_engine_volume=max_engine_volume,
        min_engine_power=min_engine_power,
        max_engine_power=max_engine_power,
        min_engine_torque=min_engine_torque,
        max_engine_torque=max_engine_torque,
        transmissions=transmissions,
        drive_types=drive_types,
        body_types=body_types,
        brands=brands,
        fuel_types=fuel_types
    )

    from src.database.models import CarOrder, Order, OrderStatusEnum
    
    # Исключаем автомобили, которые уже заказаны (имеют активные заказы, не отмененные)
    # Подзапрос для получения car_id автомобилей с активными заказами
    ordered_car_ids_subquery = (
        select(CarOrder.car_id)
        .join(Order, CarOrder.order_id == Order.order_id)
        .where(Order.status != OrderStatusEnum.CANCELLED.value)
    )
    
    if query and query.strip():
        car_ids = await get_car_ids_by_search(session, query)
        if not car_ids:
            return []
        stmt = (
            select(Car)
            .join(Car.trim)
            .where(
                Car.car_id.in_(car_ids),
                ~Car.car_id.in_(ordered_car_ids_subquery)  # Исключаем автомобили с активными заказами
            )
        )
    else:
        stmt = (
            select(Car)
            .join(Car.trim)
            .where(~Car.car_id.in_(ordered_car_ids_subquery))  # Исключаем автомобили с активными заказами
        )

    return await apply_filters_and_execute(session, stmt, conditions_list, limit, offset)

# === CRUD: АВТОМОБИЛИ ===

async def create_car(
    session: AsyncSession,
    car_data: dict
) -> Car:
    """
    Создаёт новый автомобиль.
    Проверяет:
    - Существует ли CarTrim с trim_id
    - Уникальность VIN
    """
    trim_id = car_data["trim_id"]

    # Проверка: существует ли комплектация
    trim_result = await session.execute(
        select(CarTrim).where(CarTrim.trim_id == trim_id)
    )
    if not trim_result.scalar():
        raise ValueError(f"CarTrim с trim_id={trim_id} не найден")

    # Проверка: уникальность VIN
    vin = car_data["vin"]
    vin_check = await session.execute(
        select(Car).where(Car.vin == vin)
    )
    if vin_check.scalar():
        raise ValueError(f"Автомобиль с VIN {vin} уже существует")

    # Создаём объект
    car = Car(**car_data)
    session.add(car)
    await session.commit()
    await session.refresh(car)  # получаем ID и свежие данные
    return car


async def update_car(
    session: AsyncSession,
    car_id: int,
    car_data: dict
) -> Optional[Car]:
    """
    Обновляет автомобиль.
    Пропускает None-поля.
    """
    car = await get_car_by_id(session, car_id)
    if not car:
        return None

    # Обновляем поля
    for key, value in car_data.items():
        if value is not None:
            setattr(car, key, value)

    await session.commit()
    await session.refresh(car)
    return car


async def delete_car(
    session: AsyncSession,
    car_id: int
) -> bool:
    """
    Удаляет автомобиль по ID.
    """
    car = await get_car_by_id(session, car_id)
    if not car:
        return False

    await session.delete(car)
    await session.commit()
    return True
