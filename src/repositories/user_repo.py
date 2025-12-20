from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update
from typing import Optional, List

from src.database.models import User, UserAddress, Order, OrderItem
from passlib.context import CryptContext

# Инициализация контекста для хеширования
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def get_user_by_id(session: AsyncSession, user_id: int) -> Optional[User]:
    """
    Получает пользователя по ID.
    """
    result = await session.execute(
        select(User).where(User.user_id == user_id)
    )
    return result.scalar()


async def get_user_by_email(session: AsyncSession, email: str) -> Optional[User]:
    """
    Находит пользователя по email.
    Используется при входе и регистрации.
    """
    result = await session.execute(
        select(User).where(User.email == email)
    )
    return result.scalar()


async def create_user(session: AsyncSession, user_data: dict) -> User:
    """
    Создаёт нового пользователя.
    Пароль хешируется.
    """
    # Хешируем пароль
    hashed_password = pwd_context.hash(user_data["password_hash"])
    
    user = User(
        email=user_data["email"],
        password_hash=hashed_password,
        first_name=user_data["first_name"],
        last_name=user_data["last_name"],
        middle_name=user_data.get("middle_name"),
        phone_number=user_data.get("phone_number")
    )
    
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user(session: AsyncSession, user_id: int, update_data: dict) -> Optional[User]:
    """
    Обновляет данные пользователя.
    Поддерживает partial-update (только указанные поля).
    """
    user = await get_user_by_id(session, user_id)
    if not user:
        return None

    for key, value in update_data.items():
        if value is not None and hasattr(user, key):
            if key == "password_hash":
                value = pwd_context.hash(value)  # хешируем новый пароль
            setattr(user, key, value)

    await session.commit()
    await session.refresh(user)
    return user


async def change_user_password(session: AsyncSession, user_id: int, new_password: str) -> bool:
    """
    Меняет пароль пользователя.
    """
    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    user.password_hash = pwd_context.hash(new_password)
    await session.commit()
    return True


async def activate_user(session: AsyncSession, user_id: int) -> bool:
    """
    Активирует пользователя (например, после верификации email).
    """
    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    user.status = "Активный"
    await session.commit()
    return True


async def set_email_verified(session: AsyncSession, user_id: int) -> bool:
    """
    Помечает email как подтверждённый.
    """
    user = await get_user_by_id(session, user_id)
    if not user:
        return False

    user.email_verified = True
    await session.commit()
    return True


async def get_user_with_orders(session: AsyncSession, user_id: int) -> Optional[User]:
    """
    Получает пользователя с его заказами и адресами.
    """
    result = await session.execute(
        select(User)
        .options(selectinload(User.orders).selectinload(Order.order_items).selectinload(OrderItem.part))
        .options(selectinload(User.addresses))
        .where(User.user_id == user_id)
    )
    return result.scalar()


async def get_user_addresses(session: AsyncSession, user_id: int) -> List[UserAddress]:
    """
    Возвращает все активные адреса пользователя.
    """
    result = await session.execute(
        select(UserAddress)
        .where(
            UserAddress.user_id == user_id,
            UserAddress.is_active == True
        )
    )
    return list(result.scalars().all())


async def get_user_default_address(session: AsyncSession, user_id: int) -> Optional[UserAddress]:
    """
    Возвращает основной адрес пользователя.
    """
    result = await session.execute(
        select(UserAddress)
        .where(
            UserAddress.user_id == user_id,
            UserAddress.is_default == True,
            UserAddress.is_active == True
        )
    )
    return result.scalar()


async def get_user_address_by_id(session: AsyncSession, address_id: int, user_id: int) -> Optional[UserAddress]:
    """
    Возвращает адрес пользователя по ID (с проверкой принадлежности пользователю).
    """
    result = await session.execute(
        select(UserAddress)
        .where(
            UserAddress.address_id == address_id,
            UserAddress.user_id == user_id,
            UserAddress.is_active == True
        )
    )
    return result.scalar_one_or_none()
