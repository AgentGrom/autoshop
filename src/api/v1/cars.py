from fastapi import APIRouter, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.database import get_async_session
from src.repositories.car_repo import search_cars

# Создаём роутер для автомобилей
router = APIRouter(prefix="/cars", tags=["cars"])

@router.get("/")  # /api/cars/
async def get_cars(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5, ge=1, le=20),
    session: AsyncSession = Depends(get_async_session)
):
    """
    Получить список автомобилей с пагинацией
    """
    cars = await search_cars(session, query="", limit=limit, offset=offset)
    
    # Проверяем, есть ли ещё автомобили для следующей страницы
    next_batch = await search_cars(session, query="", limit=limit, offset=offset + limit)
    has_more = len(next_batch) > 0
    
    cars_data = []
    for car in cars:
        car_data = {
            "car_id": car.car_id,
            "vin": car.vin,
            "production_year": car.production_year,
            "condition": car.condition.value if hasattr(car.condition, 'value') else str(car.condition),
            "mileage": car.mileage,
            "color": car.color,
            "price": float(car.price) if car.price else None,
            "trim": {
                "brand_name": car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "",
                "model_name": car.trim.model_name if car.trim.model_name else "",
                "trim_name": car.trim.trim_name if car.trim.trim_name else ""
            },
            "images": [{"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order} for img in sorted(car.images, key=lambda x: x.sort_order)] if car.images else []
        }
        cars_data.append(car_data)
    
    return {
        "cars": cars_data,
        "offset": offset,
        "limit": limit,
        "has_more": has_more,
        "total": len(cars_data)
    }

@router.get("/more")  # /api/cars/more?offset=5
async def get_more_cars(
    offset: int = Query(default=5, ge=0),
    limit: int = Query(default=5, ge=1, le=20),
    session: AsyncSession = Depends(get_async_session)
):
    """
    API endpoint для подгрузки дополнительных автомобилей
    """
    # Получаем автомобили по смещению и лимиту
    cars = await search_cars(session, query="", limit=limit, offset=offset)
    
    # Проверяем, есть ли ещё автомобили
    next_batch = await search_cars(session, query="", limit=limit, offset=offset + limit)
    has_more = len(next_batch) > 0
    
    # Подготавливаем данные для JSON ответа
    cars_data = []
    for car in cars:
        car_data = {
            "car_id": car.car_id,
            "vin": car.vin,
            "production_year": car.production_year,
            "condition": car.condition.value if hasattr(car.condition, 'value') else str(car.condition),
            "mileage": car.mileage,
            "color": car.color,
            "price": float(car.price) if car.price else None,
            "trim": {
                "brand_name": car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "",
                "model_name": car.trim.model_name if car.trim.model_name else "",
                "trim_name": car.trim.trim_name if car.trim.trim_name else ""
            },
            "images": [{"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order} for img in sorted(car.images, key=lambda x: x.sort_order)] if car.images else []
        }
        cars_data.append(car_data)
    
    return {
        "cars": cars_data,
        "has_more": has_more,
        "next_offset": offset + limit,
        "limit": limit
    }
