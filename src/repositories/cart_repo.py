from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, update
from sqlalchemy.orm import selectinload
from typing import List, Optional

from src.database.models import CartItem, Part, Image, User


async def get_cart_items(session: AsyncSession, user_id: int) -> List[CartItem]:
    """Получает все товары в корзине пользователя"""
    result = await session.execute(
        select(CartItem)
        .options(
            selectinload(CartItem.part).selectinload(Part.images),
            selectinload(CartItem.part).selectinload(Part.category)
        )
        .where(CartItem.user_id == user_id)
        .order_by(CartItem.created_at.desc())
    )
    return list(result.scalars().all())


async def get_cart_item(session: AsyncSession, user_id: int, part_id: int) -> Optional[CartItem]:
    """Получает конкретный товар в корзине пользователя"""
    result = await session.execute(
        select(CartItem)
        .where(CartItem.user_id == user_id, CartItem.part_id == part_id)
    )
    return result.scalar_one_or_none()


async def add_to_cart(session: AsyncSession, user_id: int, part_id: int, quantity: int = 1) -> CartItem:
    """Добавляет товар в корзину или увеличивает количество, если уже есть"""
    from src.database.models import Part
    from sqlalchemy import select
    
    # Получаем информацию о товаре и проверяем наличие на складе
    part_stmt = select(Part).where(Part.part_id == part_id)
    part_result = await session.execute(part_stmt)
    part = part_result.scalar_one_or_none()
    
    if not part:
        raise ValueError(f"Товар с ID {part_id} не найден")
    
    # Получаем текущее количество в корзине
    existing_item = await get_cart_item(session, user_id, part_id)
    current_cart_quantity = existing_item.quantity if existing_item else 0
    
    # Проверяем, что после добавления не превысим количество на складе
    stock_count = part.stock_count or 0
    total_quantity = current_cart_quantity + quantity
    
    if total_quantity > stock_count:
        available = stock_count - current_cart_quantity
        if available <= 0:
            raise ValueError(f"Товар отсутствует на складе. В наличии: {stock_count} шт., в корзине: {current_cart_quantity} шт.")
        else:
            raise ValueError(f"Недостаточно товара на складе. Доступно для добавления: {available} шт. (в наличии: {stock_count} шт., в корзине: {current_cart_quantity} шт.)")
    
    if existing_item:
        # Увеличиваем количество
        existing_item.quantity += quantity
    else:
        # Создаём новый элемент корзины
        cart_item = CartItem(
            user_id=user_id,
            part_id=part_id,
            quantity=quantity
        )
        session.add(cart_item)
        existing_item = cart_item
    
    try:
        await session.commit()
        await session.refresh(existing_item)
        return existing_item
    except Exception as e:
        # Если возникла ошибка уникальности, значит товар был добавлен параллельно
        # Обновляем существующий товар
        await session.rollback()
        existing_item = await get_cart_item(session, user_id, part_id)
        if existing_item:
            # Повторно проверяем наличие перед обновлением
            part_result = await session.execute(part_stmt)
            part = part_result.scalar_one_or_none()
            if part:
                stock_count = part.stock_count or 0
                total_quantity = existing_item.quantity + quantity
                if total_quantity > stock_count:
                    available = stock_count - existing_item.quantity
                    if available <= 0:
                        raise ValueError(f"Товар отсутствует на складе. В наличии: {stock_count} шт., в корзине: {existing_item.quantity} шт.")
                    else:
                        raise ValueError(f"Недостаточно товара на складе. Доступно для добавления: {available} шт. (в наличии: {stock_count} шт., в корзине: {existing_item.quantity} шт.)")
            
            existing_item.quantity += quantity
            await session.commit()
            await session.refresh(existing_item)
            return existing_item
        else:
            raise


async def update_cart_item_quantity(session: AsyncSession, user_id: int, part_id: int, quantity: int) -> Optional[CartItem]:
    """Обновляет количество товара в корзине"""
    cart_item = await get_cart_item(session, user_id, part_id)
    if not cart_item:
        return None
    
    if quantity <= 0:
        # Удаляем товар, если количество <= 0
        await session.delete(cart_item)
        await session.commit()
        return None
    
    cart_item.quantity = quantity
    await session.commit()
    await session.refresh(cart_item)
    return cart_item


async def remove_from_cart(session: AsyncSession, user_id: int, part_id: int) -> bool:
    """Удаляет товар из корзины"""
    cart_item = await get_cart_item(session, user_id, part_id)
    if not cart_item:
        return False
    
    await session.delete(cart_item)
    await session.commit()
    return True


async def clear_cart(session: AsyncSession, user_id: int) -> int:
    """Очищает всю корзину пользователя. Возвращает количество удалённых элементов"""
    result = await session.execute(
        delete(CartItem).where(CartItem.user_id == user_id)
    )
    await session.commit()
    return result.rowcount


async def get_cart_count(session: AsyncSession, user_id: int) -> int:
    """Получает общее количество товаров в корзине (сумма всех quantity)"""
    result = await session.execute(
        select(CartItem.quantity)
        .where(CartItem.user_id == user_id)
    )
    quantities = result.scalars().all()
    return sum(quantities) if quantities else 0


async def sync_cart_from_local_storage(session: AsyncSession, user_id: int, cart_data: dict) -> int:
    """
    Синхронизирует корзину из localStorage с БД.
    cart_data: {part_id: quantity, ...}
    Возвращает количество добавленных/обновлённых элементов
    
    Важно: заменяет количество в БД на количество из localStorage, а не добавляет к существующему
    """
    count = 0
    for part_id_str, quantity in cart_data.items():
        try:
            part_id = int(part_id_str)
            quantity = int(quantity)
            if quantity > 0:
                # Проверяем, есть ли уже товар в корзине
                existing_item = await get_cart_item(session, user_id, part_id)
                if existing_item:
                    # Заменяем количество на значение из localStorage
                    existing_item.quantity = quantity
                else:
                    # Создаём новый элемент
                    cart_item = CartItem(
                        user_id=user_id,
                        part_id=part_id,
                        quantity=quantity
                    )
                    session.add(cart_item)
                count += 1
        except (ValueError, TypeError):
            continue
    
    await session.commit()
    return count

