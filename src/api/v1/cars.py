from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import update
from typing import List, Optional

from src.database.database import get_async_session
from src.repositories.car_repo import search_cars, filter_cars, search_and_filter_cars, get_car_by_id
from src.auth.jwt import get_current_user_from_cookie, get_optional_user_from_cookie
from src.database.models import User, UserRoleEnum, Car
from src.database.models import (
    CarBrandEnum,
    ConditionEnum,
    FuelTypeEnum,
    TransmissionEnum,
    DriveTypeEnum,
    BodyTypeEnum,
    ColorEnum,
)

# Создаём роутер для автомобилей
router = APIRouter(prefix="/cars", tags=["cars"])


@router.get("/filters-meta")
async def get_cars_filters_meta():
    """
    Метаданные для фильтров по автомобилям (ENUM-ы).
    Используется на фронте, чтобы не дублировать значения в шаблонах/JS.
    """
    return {
        "brands": [b.value for b in CarBrandEnum],
        "conditions": [c.value for c in ConditionEnum],
        "fuel_types": [f.value for f in FuelTypeEnum],
        "transmissions": [t.value for t in TransmissionEnum],
        "drive_types": [d.value for d in DriveTypeEnum],
        "body_types": [b.value for b in BodyTypeEnum],
        "colors": [c.value for c in ColorEnum],
    }

@router.get("/")  # /api/cars/
async def get_cars(
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=5, ge=1, le=20),
    # Фильтры
    colors: Optional[List[str]] = Query(None),
    min_mileage: Optional[int] = Query(None),
    max_mileage: Optional[int] = Query(None),
    min_production_year: Optional[int] = Query(None),
    max_production_year: Optional[int] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    conditions: Optional[List[str]] = Query(None),
    min_engine_volume: Optional[float] = Query(None),
    max_engine_volume: Optional[float] = Query(None),
    min_engine_power: Optional[int] = Query(None),
    max_engine_power: Optional[int] = Query(None),
    min_engine_torque: Optional[int] = Query(None),
    max_engine_torque: Optional[int] = Query(None),
    transmissions: Optional[List[str]] = Query(None),
    drive_types: Optional[List[str]] = Query(None),
    body_types: Optional[List[str]] = Query(None),
    brands: Optional[List[str]] = Query(None),
    fuel_types: Optional[List[str]] = Query(None),
    query: str = Query(""),
    session: AsyncSession = Depends(get_async_session),
    current_user: Optional[User] = Depends(get_optional_user_from_cookie)
):
    """
    Получить список автомобилей с пагинацией и фильтрами
    Для администраторов показываются все автомобили, включая невидимые
    """
    # Проверяем, является ли пользователь администратором
    is_admin = current_user and current_user.role == UserRoleEnum.ADMIN.value
    
    cars = await search_and_filter_cars(
        session=session,
        query=query if query else None,
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
        fuel_types=fuel_types,
        limit=limit,
        offset=offset,
        show_all=is_admin  # Для администраторов показываем все
    )

    # Проверяем, есть ли ещё автомобили для следующей страницы
    next_batch = await search_and_filter_cars(
        session=session,
        query=query if query else None,
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
        fuel_types=fuel_types,
        limit=limit,
        offset=offset + limit
    )
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
            "is_visible": car.is_visible,  # Добавляем поле видимости
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


@router.get("/{car_id}")  # /api/cars/{car_id}
async def get_car_detail(
    car_id: int,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Получить детальную информацию об автомобиле по ID
    """
    car = await get_car_by_id(session, car_id)
    
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    # Проверяем видимость автомобиля (невидимые автомобили недоступны для просмотра)
    if not car.is_visible:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    # Формируем полные данные об автомобиле
    car_data = {
        "car_id": car.car_id,
        "vin": car.vin,
        "production_year": car.production_year,
        "condition": car.condition.value if hasattr(car.condition, 'value') else str(car.condition),
        "mileage": car.mileage,
        "color": car.color,
        "price": float(car.price) if car.price else None,
        "trim": {
            "trim_id": car.trim.trim_id,
            "trim_name": car.trim.trim_name if car.trim.trim_name else None,
            "brand_name": car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else None,
            "model_name": car.trim.model_name if car.trim.model_name else None,
            "engine_volume": float(car.trim.engine_volume) if car.trim.engine_volume else None,
            "engine_power": car.trim.engine_power if car.trim.engine_power else None,
            "engine_torque": car.trim.engine_torque if car.trim.engine_torque else None,
            "fuel_type": car.trim.fuel_type.value if hasattr(car.trim.fuel_type, 'value') else str(car.trim.fuel_type) if car.trim.fuel_type else None,
            "transmission": car.trim.transmission.value if hasattr(car.trim.transmission, 'value') else str(car.trim.transmission) if car.trim.transmission else None,
            "drive_type": car.trim.drive_type.value if hasattr(car.trim.drive_type, 'value') else str(car.trim.drive_type) if car.trim.drive_type else None,
            "body_type": car.trim.body_type.value if hasattr(car.trim.body_type, 'value') else str(car.trim.body_type) if car.trim.body_type else None,
            "doors": car.trim.doors if car.trim.doors else None,
            "seats": car.trim.seats if car.trim.seats else None,
        },
        "images": [
            {"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order} 
            for img in sorted(car.images, key=lambda x: x.sort_order)
        ] if car.images else []
    }
    
    return car_data


@router.post("/{car_id}/remove-from-sale")
async def remove_car_from_sale(
    car_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Снять автомобиль с продажи (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем, что автомобиль существует
    car = await get_car_by_id(session, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    # Проверяем, что автомобиль еще видим (не снят с продажи)
    if not car.is_visible:
        raise HTTPException(status_code=400, detail="Автомобиль уже снят с продажи")
    
    # Снимаем автомобиль с продажи
    await session.execute(
        update(Car)
        .where(Car.car_id == car_id)
        .values(is_visible=False)
    )
    await session.commit()
    
    return {
        "success": True,
        "message": "Автомобиль успешно снят с продажи"
    }


@router.post("/{car_id}/return-to-sale")
async def return_car_to_sale(
    car_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Вернуть автомобиль в продажу (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем, что автомобиль существует
    car = await get_car_by_id(session, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    # Проверяем, что автомобиль снят с продажи
    if car.is_visible:
        raise HTTPException(status_code=400, detail="Автомобиль уже в продаже")
    
    # Возвращаем автомобиль в продажу
    await session.execute(
        update(Car)
        .where(Car.car_id == car_id)
        .values(is_visible=True)
    )
    await session.commit()
    
    return {
        "success": True,
        "message": "Автомобиль успешно возвращен в продажу"
    }