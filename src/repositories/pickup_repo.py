from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, distinct
from typing import List, Dict

from src.database.models import PickupPoint


async def get_countries(session: AsyncSession) -> List[str]:
    """Получает список всех стран с активными пунктами выдачи"""
    result = await session.execute(
        select(distinct(PickupPoint.country))
        .where(PickupPoint.is_active == True)
        .order_by(PickupPoint.country)
    )
    return [row[0] for row in result.all()]


async def get_regions(session: AsyncSession, country: str) -> List[str]:
    """Получает список всех областей/регионов для указанной страны"""
    result = await session.execute(
        select(distinct(PickupPoint.region))
        .where(
            PickupPoint.country == country,
            PickupPoint.is_active == True
        )
        .order_by(PickupPoint.region)
    )
    return [row[0] for row in result.all()]


async def get_cities(session: AsyncSession, country: str, region: str) -> List[str]:
    """Получает список всех городов для указанной страны и области"""
    result = await session.execute(
        select(distinct(PickupPoint.city))
        .where(
            PickupPoint.country == country,
            PickupPoint.region == region,
            PickupPoint.is_active == True
        )
        .order_by(PickupPoint.city)
    )
    return [row[0] for row in result.all()]


async def get_pickup_points(session: AsyncSession, country: str, region: str, city: str) -> List[PickupPoint]:
    """Получает список пунктов выдачи для указанной страны, области и города"""
    result = await session.execute(
        select(PickupPoint)
        .where(
            PickupPoint.country == country,
            PickupPoint.region == region,
            PickupPoint.city == city,
            PickupPoint.is_active == True
        )
        .order_by(PickupPoint.street, PickupPoint.house)
    )
    return list(result.scalars().all())


async def get_pickup_point_by_id(session: AsyncSession, pickup_point_id: int) -> PickupPoint:
    """Получает пункт выдачи по ID"""
    result = await session.execute(
        select(PickupPoint)
        .where(PickupPoint.pickup_point_id == pickup_point_id)
    )
    return result.scalar_one_or_none()

