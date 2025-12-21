from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User, UserAddress, AddressTypeEnum
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
            "full_address": f"{addr.country}" + (f", {addr.region}" if addr.region else "") + f", {addr.city}, {addr.street}, {addr.house}" + (f", кв. {addr.apartment}" if addr.apartment else ""),
            "short_address": f"{addr.city}, {addr.street}, {addr.house}"  # Название адреса
        })
    
    return {
        "addresses": addresses_data
    }


class CreateAddressRequest(BaseModel):
    country: str
    region: Optional[str] = None
    city: str
    street: str
    house: str
    apartment: Optional[str] = None
    entrance: Optional[str] = None
    floor: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    is_default: bool = False


@router.post("/")
async def create_address(
    address_data: CreateAddressRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Создать новый адрес пользователя"""
    # Валидация данных
    address_dict = address_data.model_dump()
    errors = validate_address_data(address_dict)
    
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors)
        )
    
    # Если это адрес по умолчанию, снимаем флаг с других адресов
    if address_data.is_default:
        from sqlalchemy import update
        await session.execute(
            update(UserAddress)
            .where(UserAddress.user_id == current_user.user_id)
            .values(is_default=False)
        )
        await session.flush()
    
    new_address = UserAddress(
        user_id=current_user.user_id,
        address_type=AddressTypeEnum.EXACT.value,
        country=address_data.country,
        region=address_data.region,
        city=address_data.city,
        street=address_data.street,
        house=address_data.house,
        apartment=address_data.apartment,
        entrance=address_data.entrance,
        floor=address_data.floor,
        postal_code=address_data.postal_code,
        recipient_name=address_data.recipient_name,
        recipient_phone=address_data.recipient_phone,
        is_default=address_data.is_default,
        is_active=True
    )
    
    session.add(new_address)
    await session.commit()
    await session.refresh(new_address)
    
    return {
        "success": True,
        "address_id": new_address.address_id,
        "message": "Адрес успешно добавлен"
    }


class UpdateAddressRequest(BaseModel):
    country: str
    region: Optional[str] = None
    city: str
    street: str
    house: str
    apartment: Optional[str] = None
    entrance: Optional[str] = None
    floor: Optional[str] = None
    postal_code: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    is_default: bool = False


def validate_address_data(address_data: dict) -> list:
    """Валидация данных адреса. Возвращает список ошибок."""
    errors = []
    
    country = address_data.get('country', '')
    region = address_data.get('region')
    city = address_data.get('city', '')
    street = address_data.get('street', '')
    house = address_data.get('house', '')
    apartment = address_data.get('apartment')
    entrance = address_data.get('entrance')
    floor = address_data.get('floor')
    postal_code = address_data.get('postal_code')
    recipient_name = address_data.get('recipient_name', '')
    recipient_phone = address_data.get('recipient_phone', '')
    
    if len(country) > 50:
        errors.append("Страна не может быть длиннее 50 символов")
    
    if region and len(region) > 100:
        errors.append("Область/регион не может быть длиннее 100 символов")
    
    if len(city) > 50:
        errors.append("Город не может быть длиннее 50 символов")
    
    if len(street) > 100:
        errors.append("Улица не может быть длиннее 100 символов")
    
    if len(house) > 10:
        errors.append("Дом не может быть длиннее 10 символов")
    
    if apartment and len(apartment) > 10:
        errors.append("Квартира не может быть длиннее 10 символов")
    
    if entrance and len(entrance) > 10:
        errors.append("Подъезд не может быть длиннее 10 символов")
    
    if floor and len(floor) > 10:
        errors.append("Этаж не может быть длиннее 10 символов")
    
    if postal_code and len(postal_code) > 20:
        errors.append("Почтовый индекс не может быть длиннее 20 символов")
    
    if len(recipient_name) > 100:
        errors.append("Имя получателя не может быть длиннее 100 символов")
    
    if len(recipient_phone) > 20:
        errors.append("Телефон получателя не может быть длиннее 20 символов")
    
    # Проверка обязательных полей
    if not country or not country.strip():
        errors.append("Страна обязательна для заполнения")
    
    if not city or not city.strip():
        errors.append("Город обязателен для заполнения")
    
    if not street or not street.strip():
        errors.append("Улица обязательна для заполнения")
    
    if not house or not house.strip():
        errors.append("Дом обязателен для заполнения")
    
    if not recipient_name or not recipient_name.strip():
        errors.append("Имя получателя обязательно для заполнения")
    
    if not recipient_phone or not recipient_phone.strip():
        errors.append("Телефон получателя обязателен для заполнения")
    
    return errors


@router.put("/{address_id}")
async def update_address(
    address_id: int,
    address_data: UpdateAddressRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить адрес пользователя"""
    from src.repositories.user_repo import get_user_address_by_id
    from sqlalchemy import update
    
    # Проверяем, что адрес принадлежит пользователю
    address = await get_user_address_by_id(session, address_id, current_user.user_id)
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Адрес не найден"
        )
    
    # Валидация данных
    address_dict = address_data.model_dump()
    errors = validate_address_data(address_dict)
    
    if errors:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="; ".join(errors)
        )
    
    # Если это адрес по умолчанию, снимаем флаг с других адресов
    if address_data.is_default:
        await session.execute(
            update(UserAddress)
            .where(
                UserAddress.user_id == current_user.user_id,
                UserAddress.address_id != address_id
            )
            .values(is_default=False)
        )
        await session.flush()
    
    # Обновляем адрес
    await session.execute(
        update(UserAddress)
        .where(UserAddress.address_id == address_id)
        .values(
            country=address_data.country,
            region=address_data.region,
            city=address_data.city,
            street=address_data.street,
            house=address_data.house,
            apartment=address_data.apartment,
            entrance=address_data.entrance,
            floor=address_data.floor,
            postal_code=address_data.postal_code,
            recipient_name=address_data.recipient_name,
            recipient_phone=address_data.recipient_phone,
            is_default=address_data.is_default
        )
    )
    
    await session.commit()
    
    return {
        "success": True,
        "message": "Адрес успешно обновлен"
    }

