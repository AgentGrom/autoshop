from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User
from src.repositories.user_repo import get_user_addresses

router = APIRouter(prefix="/api/addresses", tags=["addresses"])


@router.get("/")
async def get_user_addresses_list(
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Получает список адресов пользователя"""
    addresses = await get_user_addresses(session, current_user.user_id)
    
    addresses_data = []
    for addr in addresses:
        addresses_data.append({
            "address_id": addr.address_id,
            "address_type": addr.address_type.value if hasattr(addr.address_type, 'value') else str(addr.address_type),
            "postal_code": addr.postal_code,
            "country": addr.country,
            "region": addr.region,
            "city": addr.city,
            "street": addr.street,
            "house": addr.house,
            "apartment": addr.apartment,
            "entrance": addr.entrance,
            "floor": addr.floor,
            "recipient_name": addr.recipient_name,
            "recipient_phone": addr.recipient_phone,
            "is_default": addr.is_default,
            "full_address": f"{addr.country}" + (f", {addr.region}" if addr.region else "") + f", {addr.city}, {addr.street}, {addr.house}" + (f", кв. {addr.apartment}" if addr.apartment else "")
        })
    
    return {
        "addresses": addresses_data
    }

