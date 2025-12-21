# src/api/v1/account.py
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from typing import Optional

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User, Order, OrderItem, CarOrder, Part, Car, PickupPoint, UserAddress
from src.repositories.user_repo import update_user, change_user_password, get_user_by_id

router = APIRouter(prefix="/account", tags=["account"])
templates = Jinja2Templates(directory="src/templates")


@router.get("/")
async def account_page(
    request: Request,
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Страница личного кабинета"""
    return templates.TemplateResponse("account.html", {"request": request})


@router.get("/api/profile")
async def get_profile(
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить информацию о профиле пользователя"""
    return {
        "user_id": current_user.user_id,
        "email": current_user.email,
        "first_name": current_user.first_name,
        "last_name": current_user.last_name,
        "middle_name": current_user.middle_name,
        "phone_number": current_user.phone_number,
        "role": current_user.role.value if hasattr(current_user.role, 'value') else str(current_user.role),
        "status": current_user.status.value if hasattr(current_user.status, 'value') else str(current_user.status),
        "registration_date": current_user.registration_date.isoformat() if current_user.registration_date else None,
        "email_verified": current_user.email_verified,
        "phone_verified": current_user.phone_verified
    }


@router.get("/api/orders")
async def get_user_orders(
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить все заказы пользователя с полной информацией"""
    result = await session.execute(
        select(Order)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.part).selectinload(Part.images),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.images),
            selectinload(Order.pickup_point),
            selectinload(Order.shipping_address)
        )
        .where(Order.user_id == current_user.user_id)
        .order_by(Order.order_date.desc())
    )
    orders = result.scalars().all()
    
    orders_data = []
    for order in orders:
        # Подсчитываем общую сумму заказа
        total_amount = float(order.service_fee or 0) + float(order.shipping_cost or 0) - float(order.discount or 0)
        
        # Сумма за товары (запчасти)
        parts_total = 0.0
        order_items_data = []
        for item in order.order_items:
            part_price = float(item.part.price)
            item_total = part_price * item.quantity
            parts_total += item_total
            order_items_data.append({
                "part_id": item.part_id,
                "part_name": item.part.part_name,
                "manufacturer": item.part.manufacturer,
                "quantity": item.quantity,
                "price": part_price,
                "total": item_total,
                "image": item.part.images[0].image_path if item.part.images else None
            })
        
        # Сумма за автомобили
        cars_total = 0.0
        car_orders_data = []
        for car_order in order.car_orders:
            car_price = float(car_order.car_price)
            cars_total += car_price
            car_orders_data.append({
                "car_id": car_order.car_id,
                "brand": car_order.car.brand.value if hasattr(car_order.car.brand, 'value') else str(car_order.car.brand),
                "model": car_order.car.model,
                "year": car_order.car.year,
                "price": car_price,
                "image": car_order.car.images[0].image_path if car_order.car.images else None
            })
        
        total_amount += parts_total + cars_total
        
        # Адрес доставки или пункт выдачи
        delivery_info = None
        if order.shipping_address:
            addr = order.shipping_address
            delivery_info = {
                "type": "address",
                "full_address": f"{addr.country}" + 
                               (f", {addr.region}" if addr.region else "") + 
                               f", {addr.city}, {addr.street}, {addr.house}" + 
                               (f", кв. {addr.apartment}" if addr.apartment else "")
            }
        elif order.pickup_point:
            pp = order.pickup_point
            delivery_info = {
                "type": "pickup",
                "full_address": f"{pp.country}, {pp.region}, {pp.city}, {pp.street}, {pp.house}"
            }
        
        orders_data.append({
            "order_id": order.order_id,
            "order_date": order.order_date.isoformat() if order.order_date else None,
            "status": order.status.value if hasattr(order.status, 'value') else str(order.status),
            "status_updated": order.status_updated.isoformat() if order.status_updated else None,
            "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else str(order.payment_method),
            "is_paid": order.is_paid,
            "service_fee": float(order.service_fee or 0),
            "shipping_cost": float(order.shipping_cost or 0),
            "discount": float(order.discount or 0),
            "total_amount": total_amount,
            "tracking_number": order.tracking_number,
            "estimated_delivery": order.estimated_delivery.isoformat() if order.estimated_delivery else None,
            "customer_notes": order.customer_notes,
            "order_items": order_items_data,
            "car_orders": car_orders_data,
            "delivery_info": delivery_info
        })
    
    return {"orders": orders_data}


class UpdateProfileRequest(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


@router.put("/api/profile")
async def update_profile(
    update_data: UpdateProfileRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить данные профиля пользователя"""
    # Получаем актуальные данные пользователя из БД
    user = await get_user_by_id(session, current_user.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    update_dict = {}
    
    # Обновляем имя, фамилию, отчество
    if update_data.first_name is not None:
        update_dict["first_name"] = update_data.first_name
    if update_data.last_name is not None:
        update_dict["last_name"] = update_data.last_name
    if update_data.middle_name is not None:
        update_dict["middle_name"] = update_data.middle_name
    
    # Обновляем телефон только если его не было при регистрации
    if update_data.phone_number is not None:
        # Проверяем, был ли телефон изначально (при регистрации)
        # Если phone_number был None или пустой строкой, можно обновить
        if not user.phone_number or user.phone_number == "":
            update_dict["phone_number"] = update_data.phone_number
        else:
            raise HTTPException(
                status_code=400, 
                detail="Телефон можно изменить только если он не был указан при регистрации"
            )
    
    # Обновляем пароль
    if update_data.new_password:
        if not update_data.current_password:
            raise HTTPException(status_code=400, detail="Для смены пароля необходимо указать текущий пароль")
        
        # Проверяем текущий пароль
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        if not pwd_context.verify(update_data.current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        
        # Хешируем новый пароль
        update_dict["password_hash"] = update_data.new_password
    
    # Применяем обновления
    if update_dict:
        updated_user = await update_user(session, current_user.user_id, update_dict)
        if not updated_user:
            raise HTTPException(status_code=500, detail="Ошибка обновления профиля")
    
    return {
        "success": True,
        "message": "Профиль успешно обновлен"
    }


@router.get("/verification")
async def verification_page(
    request: Request,
    type: Optional[str] = Query(None, description="Тип подтверждения: email или phone"),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Страница подтверждения email или телефона"""
    if type not in ["email", "phone"]:
        # Определяем тип автоматически на основе того, что не подтверждено
        if not current_user.email_verified:
            type = "email"
        elif current_user.phone_number and not current_user.phone_verified:
            type = "phone"
        else:
            # Если всё подтверждено, перенаправляем в личный кабинет
            return RedirectResponse(url="/account", status_code=303)
    
    return templates.TemplateResponse("verification.html", {
        "request": request,
        "verification_type": type
    })


@router.post("/verification/send-code")
async def send_verification_code(
    request: Request,
    type: str = Query(..., description="Тип подтверждения: email или phone"),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Отправить код подтверждения (заглушка - возвращает тестовый код)"""
    import random
    from src.auth.verification_codes import store_verification_code
    
    # Генерируем тестовый код (6 цифр)
    code = str(random.randint(100000, 999999))
    
    if type == "email":
        if current_user.email_verified:
            raise HTTPException(status_code=400, detail="Email уже подтвержден")
        # Сохраняем код для проверки
        store_verification_code(current_user.user_id, "email", code)
        # В реальности здесь должна быть отправка email
        return {
            "success": True,
            "message": "Код отправлен на email",
            "test_code": code  # Только для разработки
        }
    elif type == "phone":
        if not current_user.phone_number:
            raise HTTPException(status_code=400, detail="Телефон не указан")
        if current_user.phone_verified:
            raise HTTPException(status_code=400, detail="Телефон уже подтвержден")
        # Сохраняем код для проверки
        store_verification_code(current_user.user_id, "phone", code)
        # В реальности здесь должна быть отправка SMS
        return {
            "success": True,
            "message": "Код отправлен на телефон",
            "test_code": code  # Только для разработки
        }
    else:
        raise HTTPException(status_code=400, detail="Неверный тип подтверждения")


@router.post("/verification/verify")
async def verify_code(
    request: Request,
    type: str = Query(..., description="Тип подтверждения: email или phone"),
    code: str = Query(..., description="Код подтверждения"),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Проверить код подтверждения"""
    from src.auth.verification_codes import verify_code as check_verification_code
    
    # Проверяем код
    if not check_verification_code(current_user.user_id, type, code):
        raise HTTPException(
            status_code=400, 
            detail="Неверный код подтверждения или код истек. Запросите новый код."
        )
    
    # Код верный - подтверждаем email или телефон
    if type == "email":
        if current_user.email_verified:
            raise HTTPException(status_code=400, detail="Email уже подтвержден")
        from src.repositories.user_repo import set_email_verified
        await set_email_verified(session, current_user.user_id)
        return {
            "success": True,
            "message": "Email успешно подтвержден"
        }
    elif type == "phone":
        if not current_user.phone_number:
            raise HTTPException(status_code=400, detail="Телефон не указан")
        if current_user.phone_verified:
            raise HTTPException(status_code=400, detail="Телефон уже подтвержден")
        from sqlalchemy import update
        await session.execute(
            update(User)
            .where(User.user_id == current_user.user_id)
            .values(phone_verified=True)
        )
        await session.commit()
        return {
            "success": True,
            "message": "Телефон успешно подтвержден"
        }
    else:
        raise HTTPException(status_code=400, detail="Неверный тип подтверждения")

