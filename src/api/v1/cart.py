from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse

from src.database.database import get_async_session
from src.repositories.cart_repo import (
    get_cart_items,
    add_to_cart,
    update_cart_item_quantity,
    remove_from_cart,
    clear_cart,
    get_cart_count,
    sync_cart_from_local_storage
)
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User
from fastapi import Request

router = APIRouter(prefix="/cart", tags=["cart"])
templates = Jinja2Templates(directory="src/templates")


@router.get("/")
async def cart_page(request: Request):
    """Страница корзины"""
    return templates.TemplateResponse("cart.html", {"request": request})


@router.get("/api/items")
async def get_cart(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Получает все товары в корзине пользователя"""
    cart_items = await get_cart_items(session, current_user.user_id)
    
    items_data = []
    total_price = 0
    
    for item in cart_items:
        part = item.part
        item_price = float(part.price) if part.price else 0
        item_total = item_price * item.quantity
        total_price += item_total
        
        items_data.append({
            "cart_item_id": item.cart_item_id,
            "part_id": part.part_id,
            "part_name": part.part_name,
            "part_article": part.part_article,
            "manufacturer": str(part.manufacturer) if part.manufacturer else None,
            "price": item_price,
            "quantity": item.quantity,
            "total": item_total,
            "stock_count": part.stock_count,
            "image": part.images[0].url if part.images else "/static/images/parts/base.png"
        })
    
    return {
        "items": items_data,
        "total_price": total_price,
        "total_items": sum(item["quantity"] for item in items_data)
    }


@router.post("/api/add")
async def add_item_to_cart(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Добавляет товар в корзину"""
    from pydantic import BaseModel
    
    class AddToCartRequest(BaseModel):
        part_id: int
        quantity: int = 1
    
    try:
        body = await request.json()
        req = AddToCartRequest(**body)
        
        cart_item = await add_to_cart(session, current_user.user_id, req.part_id, req.quantity)
        cart_count = await get_cart_count(session, current_user.user_id)
        return {
            "success": True,
            "message": "Товар добавлен в корзину",
            "cart_count": cart_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка при добавлении товара: {str(e)}"
        )


@router.put("/api/update")
async def update_item_quantity(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Обновляет количество товара в корзине"""
    from pydantic import BaseModel
    
    class UpdateCartRequest(BaseModel):
        part_id: int
        quantity: int
    
    try:
        body = await request.json()
        req = UpdateCartRequest(**body)
        
        if req.quantity < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Количество не может быть отрицательным"
            )
        
        cart_item = await update_cart_item_quantity(session, current_user.user_id, req.part_id, req.quantity)
        
        if cart_item is None and req.quantity == 0:
            # Товар был удалён
            cart_count = await get_cart_count(session, current_user.user_id)
            return {
                "success": True,
                "message": "Товар удалён из корзины",
                "cart_count": cart_count
            }
        
        cart_count = await get_cart_count(session, current_user.user_id)
        return {
            "success": True,
            "message": "Количество обновлено",
            "cart_count": cart_count
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ошибка обновления количества: {str(e)}"
        )


@router.delete("/api/remove/{part_id}")
async def remove_item_from_cart(
    request: Request,
    part_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Удаляет товар из корзины"""
    success = await remove_from_cart(session, current_user.user_id, part_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Товар не найден в корзине"
        )
    
    cart_count = await get_cart_count(session, current_user.user_id)
    return {
        "success": True,
        "message": "Товар удалён из корзины",
        "cart_count": cart_count
    }


@router.delete("/api/clear")
async def clear_user_cart(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Очищает всю корзину пользователя"""
    count = await clear_cart(session, current_user.user_id)
    return {
        "success": True,
        "message": f"Корзина очищена. Удалено товаров: {count}",
        "cart_count": 0
    }


@router.post("/api/sync")
async def sync_cart(
    request: Request,
    cart_data: dict,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Синхронизирует корзину из localStorage с БД"""
    count = await sync_cart_from_local_storage(session, current_user.user_id, cart_data)
    cart_count = await get_cart_count(session, current_user.user_id)
    return {
        "success": True,
        "message": f"Корзина синхронизирована. Добавлено товаров: {count}",
        "cart_count": cart_count
    }


@router.get("/api/count")
async def get_cart_items_count(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Получает количество товаров в корзине"""
    count = await get_cart_count(session, current_user.user_id)
    return {"count": count}

