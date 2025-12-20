from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.database import get_async_session
from src.repositories.settings_repo import get_setting_float

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/order-fees")
async def get_order_fees(session: AsyncSession = Depends(get_async_session)):
    """Получает настройки сборов для заказов"""
    return {
        "car_service_fee": await get_setting_float(session, "car_service_fee", 5000.0),
        "part_service_fee": await get_setting_float(session, "part_service_fee", 500.0),
        "car_delivery_cost": await get_setting_float(session, "car_delivery_cost", 0.0),  # Для автомобилей доставка обычно не используется
        "part_delivery_cost": await get_setting_float(session, "part_delivery_cost", 500.0),  # Стоимость доставки запчастей
    }

