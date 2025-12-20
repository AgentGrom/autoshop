from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Union, List
import json

from src.database.database import get_async_session
from src.repositories.part_repo import (
    search_and_filter_parts,
    get_categories_tree,
    is_leaf_category,
    get_filters_config_for_category,
    get_part_by_id,
)

router = APIRouter(prefix="/parts", tags=["parts"])

@router.get("/categories")
async def parts_categories(session: AsyncSession = Depends(get_async_session)):
    """
    Дерево категорий/подкатегорий для фильтра.
    """
    tree = await get_categories_tree(session)
    return {"categories": tree}


@router.get("/specs-meta")
async def parts_specs_meta(
    category_id: int = Query(..., ge=1),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Метаданные фильтров по спецификациям.
    Доступно ТОЛЬКО для leaf категории (последней подкатегории без детей).
    """
    leaf = await is_leaf_category(session, category_id)
    if not leaf:
        raise HTTPException(status_code=400, detail="specs-meta доступен только для leaf подкатегории")
    config = await get_filters_config_for_category(session, category_id)
    return {"category_id": category_id, "filters": config}


@router.get("/{part_id}")  # /api/parts/{part_id}
async def get_part_detail(
    part_id: int,
    session: AsyncSession = Depends(get_async_session),
):
    """
    Получить одну запчасть с фото, категорией и спецификациями.
    """
    part = await get_part_by_id(session, part_id)
    if not part:
        raise HTTPException(status_code=404, detail="Запчасть не найдена")

    return {
        "part_id": part.part_id,
        "part_name": part.part_name,
        "part_article": part.part_article,
        "description": part.description,
        "price": float(part.price) if part.price is not None else None,
        "stock_count": part.stock_count,
        "manufacturer": str(part.manufacturer) if part.manufacturer is not None else None,
        "category": {
            "category_id": part.category.category_id if part.category else None,
            "category_name": part.category.category_name if part.category else None,
            "parent_id": part.category.parent_id if part.category else None,
        },
        "images": [
            {"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order}
            for img in sorted(part.images or [], key=lambda x: x.sort_order)
        ],
        "specifications": [
            {"spec_name": s.spec_name, "spec_value": s.spec_value, "spec_unit": s.spec_unit}
            for s in (part.specifications or [])
            if (s.spec_name and s.spec_value)
        ],
    }


@router.get("/")  # /api/parts/
async def get_parts(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=12, ge=1, le=50),
    query: str = Query(""),
    category_id: Optional[int] = Query(default=None, ge=1),
    specs: Optional[str] = Query(default=None, description="JSON: {\"SpecName\": [\"Value1\", ...] } or {\"SpecName\": \"Value\"}"),
    session: AsyncSession = Depends(get_async_session),
):
    """
    Получить список запчастей с пагинацией и (опционально) текстовым поиском.
    Фильтры: category_id (включая подкатегории) и specs (JSON).
    """
    specs_filter: Optional[Dict[str, Union[str, List[str]]]] = None
    if specs:
        try:
            parsed = json.loads(specs)
            if isinstance(parsed, dict):
                specs_filter = parsed
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Некорректный JSON в параметре specs")

    category_ids = [category_id] if category_id else None

    parts = await search_and_filter_parts(
        session=session,
        query=query if query else None,
        category_ids=category_ids,
        specs_filter=specs_filter,
        limit=limit,
        offset=offset,
    )
    next_batch = await search_and_filter_parts(
        session=session,
        query=query if query else None,
        category_ids=category_ids,
        specs_filter=specs_filter,
        limit=limit,
        offset=offset + limit,
    )
    has_more = len(next_batch) > 0

    parts_data = []
    for part in parts:
        parts_data.append(
            {
                "part_id": part.part_id,
                "part_name": part.part_name,
                "part_article": part.part_article,
                "description": part.description,
                "price": float(part.price) if part.price is not None else None,
                "stock_count": part.stock_count,
                "manufacturer": str(part.manufacturer) if part.manufacturer is not None else None,
                "category": {
                    "category_id": part.category.category_id if part.category else None,
                    "category_name": part.category.category_name if part.category else None,
                    "parent_id": part.category.parent_id if part.category else None,
                },
                "images": [
                    {"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order}
                    for img in sorted(part.images or [], key=lambda x: x.sort_order)
                ],
            }
        )

    return {
        "parts": parts_data,
        "offset": offset,
        "limit": limit,
        "has_more": has_more,
        "total": len(parts_data),
    }


