from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from src.database.database import get_async_session
from src.repositories.pickup_repo import (
    get_countries,
    get_regions,
    get_cities,
    get_pickup_points,
    get_pickup_point_by_id
)

router = APIRouter(prefix="/api/pickup", tags=["pickup"])


@router.get("/countries")
async def get_pickup_countries(session: AsyncSession = Depends(get_async_session)):
    """Получает список всех стран с пунктами выдачи"""
    countries = await get_countries(session)
    return {"countries": countries}


@router.get("/regions")
async def get_pickup_regions(
    country: str = Query(..., description="Название страны"),
    session: AsyncSession = Depends(get_async_session)
):
    """Получает список областей/регионов для указанной страны"""
    regions = await get_regions(session, country)
    return {"regions": regions}


@router.get("/cities")
async def get_pickup_cities(
    country: str = Query(..., description="Название страны"),
    region: str = Query(..., description="Название области/региона"),
    session: AsyncSession = Depends(get_async_session)
):
    """Получает список городов для указанной страны и области"""
    cities = await get_cities(session, country, region)
    return {"cities": cities}


@router.get("/points")
async def get_pickup_points_list(
    country: str = Query(..., description="Название страны"),
    region: str = Query(..., description="Название области/региона"),
    city: str = Query(..., description="Название города"),
    session: AsyncSession = Depends(get_async_session)
):
    """Получает список пунктов выдачи для указанной страны, области и города"""
    points = await get_pickup_points(session, country, region, city)
    return {
        "points": [
            {
                "pickup_point_id": point.pickup_point_id,
                "country": point.country,
                "region": point.region,
                "city": point.city,
                "street": point.street,
                "house": point.house,
                "address": f"{point.street}, {point.house}"
            }
            for point in points
        ]
    }


@router.get("/point/{pickup_point_id}")
async def get_pickup_point(
    pickup_point_id: int,
    session: AsyncSession = Depends(get_async_session)
):
    """Получает информацию о пункте выдачи по ID"""
    point = await get_pickup_point_by_id(session, pickup_point_id)
    if not point:
        raise HTTPException(status_code=404, detail="Пункт выдачи не найден")
    
    return {
        "pickup_point_id": point.pickup_point_id,
        "country": point.country,
        "region": point.region,
        "city": point.city,
        "street": point.street,
        "house": point.house,
        "address": f"{point.street}, {point.house}",
        "full_address": f"{point.country}, {point.region}, {point.city}, {point.street}, {point.house}"
    }

