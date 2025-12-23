# src/api/v1/account.py
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, Query, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update, distinct, func
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, List
import os
import uuid
from pathlib import Path

try:
    from PIL import Image as PILImage
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User, Order, OrderItem, CarOrder, Part, Car, CarTrim, PickupPoint, UserAddress, UserRoleEnum, UserStatusEnum, OrderStatusEnum, Image, ConditionEnum, ColorEnum, CarBrandEnum, FuelTypeEnum, TransmissionEnum, DriveTypeEnum, BodyTypeEnum, PartCategory, PartSpecification, ManufacturerEnum
from src.repositories.user_repo import update_user, change_user_password, get_user_by_id
from src.repositories.part_repo import get_categories_tree, get_specs_for_category, create_part, update_part
from src.repositories.user_repo import get_user_by_id, get_user_by_email

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
    from sqlalchemy import case
    from src.database.models import OrderStatusEnum
    
    # Создаем приоритеты для статусов: Отправлен (1) → В обработке (2) → Доставлен (3) → Отменен (4)
    status_priority = case(
        (Order.status == OrderStatusEnum.SHIPPED.value, 1),
        (Order.status == OrderStatusEnum.PROCESSING.value, 2),
        (Order.status == OrderStatusEnum.DELIVERED.value, 3),
        (Order.status == OrderStatusEnum.CANCELLED.value, 4),
        else_=5  # Для неизвестных статусов
    )
    
    result = await session.execute(
        select(Order)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.part).selectinload(Part.images),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.images),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.trim),
            selectinload(Order.pickup_point),
            selectinload(Order.shipping_address)
        )
        .where(Order.user_id == current_user.user_id)
        .order_by(status_priority.asc(), Order.order_date.desc())
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
                "image": item.part.images[0].url if item.part.images else "/static/images/parts/base.png"
            })
        
        # Сумма за автомобили
        cars_total = 0.0
        car_orders_data = []
        for car_order in order.car_orders:
            car_price = float(car_order.car_price)
            cars_total += car_price
            car = car_order.car
            brand = car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "—"
            model = car.trim.model_name if car.trim.model_name else "—"
            year = car.production_year if car.production_year else None
            car_orders_data.append({
                "car_id": car_order.car_id,
                "brand": brand,
                "model": model,
                "year": year,
                "price": car_price,
                "image": car.images[0].url if car.images else "/static/images/cars/base.jpeg"
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
        # Валидация формата телефона
        import re
        phone = update_data.phone_number.strip()
        if phone:
            # Удаляем все пробелы, дефисы, скобки и другие символы для проверки
            cleaned = re.sub(r'[\s\-\(\)\+]', '', phone)
            
            # Проверяем, что остались только цифры
            if not re.match(r'^\d+$', cleaned):
                raise HTTPException(
                    status_code=400,
                    detail="Телефон должен содержать только цифры, пробелы, дефисы, скобки и знак +"
                )
            
            # Проверяем длину (должно быть 10 или 11 цифр)
            if len(cleaned) < 10 or len(cleaned) > 11:
                raise HTTPException(
                    status_code=400,
                    detail="Телефон должен содержать 10 или 11 цифр"
                )
            
            # Если 11 цифр, проверяем что начинается с 7 или 8
            if len(cleaned) == 11:
                if not cleaned.startswith('7') and not cleaned.startswith('8'):
                    raise HTTPException(
                        status_code=400,
                        detail="Телефон из 11 цифр должен начинаться с 7 или 8"
                    )
        
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


@router.get("/api/management/orders")
async def get_management_orders(
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить заказы для управления (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    from sqlalchemy import case
    
    # Для администраторов показываем все заказы, для менеджеров - только активные
    is_admin = current_user.role == UserRoleEnum.ADMIN.value
    
    # Создаем приоритеты для статусов: Отправлен (1) → В обработке (2) → Доставлен (3) → Отменен (4)
    status_priority = case(
        (Order.status == OrderStatusEnum.SHIPPED.value, 1),
        (Order.status == OrderStatusEnum.PROCESSING.value, 2),
        (Order.status == OrderStatusEnum.DELIVERED.value, 3),
        (Order.status == OrderStatusEnum.CANCELLED.value, 4),
        else_=5
    )
    
    # Условия фильтрации
    where_conditions = []
    if not is_admin:
        # Менеджеры видят только активные заказы
        where_conditions.extend([
            Order.status != OrderStatusEnum.DELIVERED.value,
            Order.status != OrderStatusEnum.CANCELLED.value
        ])
    # Администраторы видят все заказы
    
    stmt = (
        select(Order)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.part).selectinload(Part.images),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.images),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.trim),
            selectinload(Order.pickup_point),
            selectinload(Order.shipping_address),
            selectinload(Order.user)
        )
    )
    
    if where_conditions:
        stmt = stmt.where(*where_conditions)
    
    result = await session.execute(
        stmt.order_by(status_priority.asc(), Order.order_date.desc())
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
                "image": item.part.images[0].url if item.part.images else "/static/images/parts/base.png"
            })
        
        # Сумма за автомобили
        cars_total = 0.0
        car_orders_data = []
        for car_order in order.car_orders:
            car_price = float(car_order.car_price)
            cars_total += car_price
            car = car_order.car
            brand = car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "—"
            model = car.trim.model_name if car.trim.model_name else "—"
            year = car.production_year if car.production_year else None
            car_orders_data.append({
                "car_id": car_order.car_id,
                "brand": brand,
                "model": model,
                "year": year,
                "price": car_price,
                "image": car.images[0].url if car.images else "/static/images/cars/base.jpeg"
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
        
        # Информация о пользователе
        user_info = {
            "user_id": order.user.user_id,
            "email": order.user.email,
            "first_name": order.user.first_name,
            "last_name": order.user.last_name,
            "phone_number": order.user.phone_number
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
            "admin_notes": order.admin_notes,
            "order_items": order_items_data,
            "car_orders": car_orders_data,
            "delivery_info": delivery_info,
            "user": user_info
        })
    
    return {"orders": orders_data}


class UpdateOrderStatusRequest(BaseModel):
    status: Optional[str] = None
    is_paid: Optional[bool] = None
    admin_notes: Optional[str] = None


@router.put("/api/management/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    status_data: UpdateOrderStatusRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Изменить статус заказа (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем, что заказ существует (загружаем order_items и car_orders для возможной отмены заказа)
    stmt = (
        select(Order)
        .where(Order.order_id == order_id)
        .options(
            selectinload(Order.order_items),
            selectinload(Order.car_orders)
        )
    )
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Проверяем, что заказ не доставлен и не отменен (их нельзя менять)
    if order.status == OrderStatusEnum.DELIVERED.value:
        raise HTTPException(status_code=400, detail="Нельзя изменить статус доставленного заказа")
    
    if order.status == OrderStatusEnum.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Нельзя изменить статус отмененного заказа")
    
    # Формируем словарь для обновления
    update_values = {}
    
    # Если изменяется статус
    if status_data.status is not None:
        # Валидация нового статуса
        valid_statuses = [OrderStatusEnum.PROCESSING.value, OrderStatusEnum.SHIPPED.value, OrderStatusEnum.DELIVERED.value, OrderStatusEnum.CANCELLED.value]
        if status_data.status not in valid_statuses:
            raise HTTPException(status_code=400, detail=f"Неверный статус. Допустимые значения: {', '.join(valid_statuses)}")
        
        # Проверяем логику переходов статусов
        current_status = order.status
        
        # Если пытаемся установить "Доставлен", проверяем что текущий статус "Отправлен"
        if status_data.status == OrderStatusEnum.DELIVERED.value:
            if current_status != OrderStatusEnum.SHIPPED.value:
                raise HTTPException(status_code=400, detail="Можно установить статус 'Доставлен' только для заказов со статусом 'Отправлен'")
        
        # Если пытаемся установить "Отправлен", проверяем что текущий статус "В обработке"
        if status_data.status == OrderStatusEnum.SHIPPED.value:
            if current_status != OrderStatusEnum.PROCESSING.value:
                raise HTTPException(status_code=400, detail="Можно установить статус 'Отправлен' только для заказов со статусом 'В обработке'")
        
        # Если отменяем заказ, возвращаем товары на склад и автомобили в список
        if status_data.status == OrderStatusEnum.CANCELLED.value:
            if order.order_items:
                from src.database.models import Part
                for item in order.order_items:
                    part_stmt = select(Part).where(Part.part_id == item.part_id)
                    part_result = await session.execute(part_stmt)
                    part = part_result.scalar_one_or_none()
                    if part:
                        new_stock = (part.stock_count or 0) + item.quantity
                        await session.execute(
                            update(Part)
                            .where(Part.part_id == item.part_id)
                            .values(stock_count=new_stock)
                        )
            
            # Возвращаем автомобили в список (делаем видимыми)
            if order.car_orders:
                for car_order in order.car_orders:
                    await session.execute(
                        update(Car)
                        .where(Car.car_id == car_order.car_id)
                        .values(is_visible=True)
                    )
        
        update_values["status"] = status_data.status
    
    # Если изменяется статус оплаты
    if status_data.is_paid is not None:
        update_values["is_paid"] = status_data.is_paid
    
    # Если изменяются комментарии администратора
    if status_data.admin_notes is not None:
        update_values["admin_notes"] = status_data.admin_notes
    
    # Проверяем, что есть что обновлять
    if not update_values:
        raise HTTPException(status_code=400, detail="Не указано, что нужно обновить (status, is_paid или admin_notes)")
    
    await session.execute(
        update(Order)
        .where(Order.order_id == order_id)
        .values(**update_values)
    )
    await session.commit()
    
    # Формируем сообщение об успехе
    messages = []
    if status_data.status is not None:
        messages.append(f"Статус изменен на '{status_data.status}'")
    if status_data.is_paid is not None:
        messages.append(f"Статус оплаты изменен на {'оплачен' if status_data.is_paid else 'не оплачен'}")
    if status_data.admin_notes is not None:
        messages.append("Комментарии обновлены")
    
    return {
        "success": True,
        "message": ". ".join(messages),
        "order_id": order_id,
        "new_status": status_data.status if status_data.status else order.status,
        "is_paid": status_data.is_paid if status_data.is_paid is not None else order.is_paid,
        "admin_notes": status_data.admin_notes if status_data.admin_notes is not None else order.admin_notes
    }


@router.get("/api/car-models")
async def get_car_models(
    brand_name: Optional[str] = Query(None),
    query: Optional[str] = Query(None, description="Поисковый запрос для фильтрации моделей"),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить список уникальных моделей автомобилей (для автодополнения)"""
    # Проверяем права доступа (только менеджер или администратор)
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Получаем уникальные модели
    stmt = select(distinct(CarTrim.model_name)).where(CarTrim.model_name.isnot(None))
    
    if brand_name:
        stmt = stmt.where(CarTrim.brand_name == brand_name)
    
    if query:
        stmt = stmt.where(CarTrim.model_name.ilike(f"%{query}%"))
    
    stmt = stmt.order_by(CarTrim.model_name).limit(20)
    result = await session.execute(stmt)
    models = [row[0] for row in result.all() if row[0]]
    
    return {"models": models}


@router.get("/api/car-trims")
async def get_car_trims(
    brand_name: Optional[str] = Query(None),
    model_name: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить список комплектаций автомобилей по марке и модели"""
    # Проверяем права доступа (только менеджер или администратор)
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Если указаны марка и модель, фильтруем по ним
    stmt = select(CarTrim)
    if brand_name:
        stmt = stmt.where(CarTrim.brand_name == brand_name)
    if model_name:
        stmt = stmt.where(CarTrim.model_name == model_name)
    
    stmt = stmt.order_by(CarTrim.brand_name, CarTrim.model_name, CarTrim.trim_name)
    result = await session.execute(stmt)
    trims = result.scalars().all()
    
    trims_data = []
    for trim in trims:
        trim_data = {
            "trim_id": trim.trim_id,
            "trim_name": trim.trim_name if trim.trim_name else "",
            "brand_name": trim.brand_name.value if hasattr(trim.brand_name, 'value') else str(trim.brand_name),
            "model_name": trim.model_name if trim.model_name else "",
            "display_name": f"{trim.brand_name.value if hasattr(trim.brand_name, 'value') else str(trim.brand_name)} {trim.model_name or ''} {trim.trim_name or ''}".strip()
        }
        trims_data.append(trim_data)
    
    return {"trims": trims_data}


@router.get("/api/car-trim/{trim_id}")
async def get_car_trim_detail(
    trim_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить детальную информацию о комплектации по ID"""
    # Проверяем права доступа (только менеджер или администратор)
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    result = await session.execute(
        select(CarTrim).where(CarTrim.trim_id == trim_id)
    )
    trim = result.scalar_one_or_none()
    
    if not trim:
        raise HTTPException(status_code=404, detail="Комплектация не найдена")
    
    return {
        "trim_id": trim.trim_id,
        "trim_name": trim.trim_name if trim.trim_name else None,
        "brand_name": trim.brand_name.value if hasattr(trim.brand_name, 'value') else str(trim.brand_name),
        "model_name": trim.model_name if trim.model_name else None,
        "engine_volume": float(trim.engine_volume) if trim.engine_volume else None,
        "engine_power": trim.engine_power if trim.engine_power else None,
        "engine_torque": trim.engine_torque if trim.engine_torque else None,
        "fuel_type": trim.fuel_type.value if hasattr(trim.fuel_type, 'value') else str(trim.fuel_type) if trim.fuel_type else None,
        "transmission": trim.transmission.value if hasattr(trim.transmission, 'value') else str(trim.transmission) if trim.transmission else None,
        "drive_type": trim.drive_type.value if hasattr(trim.drive_type, 'value') else str(trim.drive_type) if trim.drive_type else None,
        "body_type": trim.body_type.value if hasattr(trim.body_type, 'value') else str(trim.body_type) if trim.body_type else None,
        "doors": trim.doors if trim.doors else None,
        "seats": trim.seats if trim.seats else None
    }


class CreateCarRequest(BaseModel):
    # Для готовой комплектации
    trim_id: Optional[int] = None
    
    # Для новой комплектации
    new_trim: Optional[dict] = None  # {"brand_name": "...", "model_name": "...", ...}
    
    # Данные автомобиля
    vin: str
    production_year: int
    condition: str
    mileage: int
    color: str
    price: Optional[float] = None
    image_urls: Optional[List[dict]] = None  # [{"url": "...", "alt_text": "...", "sort_order": 0}]


@router.post("/api/cars")
async def create_car(
    car_data: CreateCarRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Создать новый автомобиль (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Валидация VIN (должен быть 17 символов)
    if len(car_data.vin) != 17:
        raise HTTPException(status_code=400, detail="VIN должен содержать 17 символов")
    
    # Валидация condition
    valid_conditions = [ConditionEnum.NEW.value, ConditionEnum.USED.value]
    if car_data.condition not in valid_conditions:
        raise HTTPException(status_code=400, detail=f"Неверное состояние. Допустимые значения: {', '.join(valid_conditions)}")
    
    # Валидация color
    valid_colors = [c.value for c in ColorEnum]
    if car_data.color not in valid_colors:
        raise HTTPException(status_code=400, detail=f"Неверный цвет. Допустимые значения: {', '.join(valid_colors)}")
    
    # Определяем, какую комплектацию использовать
    trim_id = None
    
    if car_data.trim_id:
        # Используем существующую комплектацию
        trim_result = await session.execute(
            select(CarTrim).where(CarTrim.trim_id == car_data.trim_id)
        )
        trim = trim_result.scalar_one_or_none()
        if not trim:
            raise HTTPException(status_code=404, detail="Комплектация не найдена")
        trim_id = car_data.trim_id
    elif car_data.new_trim:
        # Создаем новую комплектацию
        new_trim_data = car_data.new_trim
        
        # Валидация обязательных полей для новой комплектации
        if not new_trim_data.get("brand_name"):
            raise HTTPException(status_code=400, detail="Марка обязательна для новой комплектации")
        if not new_trim_data.get("model_name"):
            raise HTTPException(status_code=400, detail="Модель обязательна для новой комплектации")
        if not new_trim_data.get("fuel_type"):
            raise HTTPException(status_code=400, detail="Тип топлива обязателен для новой комплектации")
        if not new_trim_data.get("transmission"):
            raise HTTPException(status_code=400, detail="КПП обязательна для новой комплектации")
        if not new_trim_data.get("drive_type"):
            raise HTTPException(status_code=400, detail="Привод обязателен для новой комплектации")
        if not new_trim_data.get("body_type"):
            raise HTTPException(status_code=400, detail="Тип кузова обязателен для новой комплектации")
        
        # Валидация enum значений
        valid_brands = [b.value for b in CarBrandEnum]
        if new_trim_data.get("brand_name") not in valid_brands:
            raise HTTPException(status_code=400, detail=f"Неверная марка. Допустимые значения: {', '.join(valid_brands)}")
        
        valid_fuel_types = [f.value for f in FuelTypeEnum]
        if new_trim_data.get("fuel_type") not in valid_fuel_types:
            raise HTTPException(status_code=400, detail=f"Неверный тип топлива. Допустимые значения: {', '.join(valid_fuel_types)}")
        
        valid_transmissions = [t.value for t in TransmissionEnum]
        if new_trim_data.get("transmission") not in valid_transmissions:
            raise HTTPException(status_code=400, detail=f"Неверная КПП. Допустимые значения: {', '.join(valid_transmissions)}")
        
        valid_drive_types = [d.value for d in DriveTypeEnum]
        if new_trim_data.get("drive_type") not in valid_drive_types:
            raise HTTPException(status_code=400, detail=f"Неверный привод. Допустимые значения: {', '.join(valid_drive_types)}")
        
        valid_body_types = [b.value for b in BodyTypeEnum]
        if new_trim_data.get("body_type") not in valid_body_types:
            raise HTTPException(status_code=400, detail=f"Неверный тип кузова. Допустимые значения: {', '.join(valid_body_types)}")
        
        # Создаем новую комплектацию
        trim_dict = {
            "brand_name": new_trim_data.get("brand_name"),
            "model_name": new_trim_data.get("model_name"),
            "trim_name": new_trim_data.get("trim_name"),
            "engine_volume": new_trim_data.get("engine_volume"),
            "engine_power": new_trim_data.get("engine_power"),
            "engine_torque": new_trim_data.get("engine_torque"),
            "fuel_type": new_trim_data.get("fuel_type"),
            "transmission": new_trim_data.get("transmission"),
            "drive_type": new_trim_data.get("drive_type"),
            "body_type": new_trim_data.get("body_type"),
            "doors": new_trim_data.get("doors"),
            "seats": new_trim_data.get("seats")
        }
        
        new_trim = CarTrim(**trim_dict)
        session.add(new_trim)
        await session.flush()  # чтобы получить trim_id
        trim_id = new_trim.trim_id
    else:
        raise HTTPException(status_code=400, detail="Необходимо указать либо trim_id, либо new_trim")
    
    # Проверяем уникальность VIN
    vin_check = await session.execute(
        select(Car).where(Car.vin == car_data.vin)
    )
    if vin_check.scalar_one_or_none():
        raise HTTPException(status_code=400, detail=f"Автомобиль с VIN {car_data.vin} уже существует")
    
    # Создаём автомобиль
    car_dict = {
        "trim_id": trim_id,
        "vin": car_data.vin,
        "production_year": car_data.production_year,
        "condition": car_data.condition,
        "mileage": car_data.mileage,
        "color": car_data.color,
        "price": car_data.price,
        "is_visible": True  # По умолчанию автомобиль видим
    }
    
    car = Car(**car_dict)
    session.add(car)
    await session.flush()  # чтобы получить car_id
    
    # Создаем папку для изображений автомобиля
    car_images_dir = Path(f"src/static/images/cars/{car.car_id}")
    car_images_dir.mkdir(parents=True, exist_ok=True)
    
    # Обрабатываем изображения: перемещаем из uploads/ в папку автомобиля и переименовываем
    # ВАЖНО: После rename() файл автоматически удаляется из uploads, поэтому дополнительная очистка не нужна
    if car_data.image_urls:
        for img_data in car_data.image_urls:
            original_url = img_data.get("url", "")
            sort_order = img_data.get("sort_order", 0)
            
            # Проверяем, что URL указывает на папку uploads
            if original_url.startswith("/static/images/cars/uploads/"):
                # Извлекаем имя файла из URL
                filename = original_url.replace("/static/images/cars/uploads/", "")
                upload_path = Path(f"src/static/images/cars/uploads/{filename}")
                
                # Определяем расширение файла
                file_ext = upload_path.suffix.lower()
                if file_ext not in {'.jpg', '.jpeg', '.png'}:
                    file_ext = '.jpg'  # По умолчанию jpg
                
                # Новое имя файла: car_{car_id}_{sort_order}.{ext}
                new_filename = f"car_{car.car_id}_{sort_order}{file_ext}"
                new_path = car_images_dir / new_filename
                
                # Перемещаем и переименовываем файл
                # ВАЖНО: rename() атомарно перемещает файл, поэтому он автоматически исчезает из uploads
                # Это безопасно для параллельных запросов - каждый файл перемещается только один раз
                if upload_path.exists():
                    try:
                        upload_path.rename(new_path)
                        # Новый URL для базы данных
                        new_url = f"/static/images/cars/{car.car_id}/{new_filename}"
                    except Exception as e:
                        # Если не удалось переместить (например, файл уже перемещен другим запросом), используем оригинальный URL
                        new_url = original_url
                else:
                    # Если файл не найден, используем оригинальный URL
                    new_url = original_url
            else:
                # Если URL не из uploads, используем как есть
                new_url = original_url
            
            # Создаем запись об изображении в базе данных
            img = Image(
                car_id=car.car_id,
                url=new_url,
                alt_text=img_data.get("alt_text"),
                sort_order=sort_order
            )
            session.add(img)
    
    await session.commit()
    await session.refresh(car)
    
    # Очищаем папку uploads от перемещенных файлов
    # Файлы уже перемещены (rename), поэтому они больше не существуют в uploads
    # Но на случай, если что-то пошло не так, проверяем наличие файлов
    # Остальные файлы в uploads могут быть загружены, но еще не использованы (например, если пользователь загрузил, но не отправил форму)
    
    return {
        "success": True,
        "message": "Автомобиль успешно добавлен",
        "car_id": car.car_id
    }


@router.post("/api/upload-image")
async def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Загрузка изображения для автомобиля (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем тип файла
    allowed_extensions = {'.jpg', '.jpeg', '.png'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Недопустимый формат файла. Разрешены только JPG, JPEG и PNG.")
    
    # Проверяем размер файла (максимум 10 МБ)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10 МБ
        raise HTTPException(status_code=400, detail="Файл слишком большой. Максимальный размер: 10 МБ.")
    
    # Создаем уникальное имя файла
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Путь для сохранения (в папке static/images/cars/uploads/)
    upload_dir = Path("src/static/images/cars/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / unique_filename
    
    # Сохраняем файл
    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Проверяем, что это действительно изображение (если PIL доступен)
        if HAS_PIL:
            try:
                img = PILImage.open(file_path)
                img.verify()
            except Exception:
                # Если файл не является изображением, удаляем его
                os.remove(file_path)
                raise HTTPException(status_code=400, detail="Файл не является корректным изображением.")
        
        # Возвращаем URL для доступа к файлу
        image_url = f"/static/images/cars/uploads/{unique_filename}"
        
        return JSONResponse({
            "success": True,
            "url": image_url,
            "filename": unique_filename
        })
    except Exception as e:
        # Если произошла ошибка при сохранении, удаляем файл если он был создан
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении файла: {str(e)}")


@router.post("/api/upload-part-image")
async def upload_part_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Загрузка изображения для запчасти (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем тип файла
    allowed_extensions = {'.jpg', '.jpeg', '.png'}
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail="Недопустимый формат файла. Разрешены только JPG, JPEG и PNG.")
    
    # Проверяем размер файла (максимум 10 МБ)
    file_content = await file.read()
    if len(file_content) > 10 * 1024 * 1024:  # 10 МБ
        raise HTTPException(status_code=400, detail="Файл слишком большой. Максимальный размер: 10 МБ.")
    
    # Создаем уникальное имя файла
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    
    # Путь для сохранения (в папке static/images/parts/uploads/)
    upload_dir = Path("src/static/images/parts/uploads")
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    file_path = upload_dir / unique_filename
    
    # Сохраняем файл
    try:
        with open(file_path, "wb") as f:
            f.write(file_content)
        
        # Проверяем, что это действительно изображение (если PIL доступен)
        if HAS_PIL:
            try:
                img = PILImage.open(file_path)
                img.verify()
            except Exception:
                # Если файл не является изображением, удаляем его
                os.remove(file_path)
                raise HTTPException(status_code=400, detail="Файл не является корректным изображением.")
        
        # Возвращаем URL для доступа к файлу
        image_url = f"/static/images/parts/uploads/{unique_filename}"
        
        return JSONResponse({
            "success": True,
            "url": image_url,
            "filename": unique_filename
        })
    except Exception as e:
        # Если произошла ошибка при сохранении, удаляем файл если он был создан
        if file_path.exists():
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"Ошибка при сохранении файла: {str(e)}")


# ========== API для работы с запчастями ==========

@router.get("/api/part-categories")
async def get_part_categories(
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить дерево категорий запчастей (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    tree = await get_categories_tree(session)
    return {"categories": tree}


class CreateCategoryRequest(BaseModel):
    category_name: str
    parent_id: Optional[int] = None


@router.post("/api/part-categories")
async def create_part_category(
    category_data: CreateCategoryRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Создать новую категорию или подкатегорию (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Валидация названия категории
    if not category_data.category_name or len(category_data.category_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Название категории не может быть пустым")
    
    if len(category_data.category_name) > 50:
        raise HTTPException(status_code=400, detail="Название категории не может быть длиннее 50 символов")
    
    # Если указан parent_id, проверяем что родительская категория существует
    if category_data.parent_id:
        parent_result = await session.execute(
            select(PartCategory).where(PartCategory.category_id == category_data.parent_id)
        )
        parent = parent_result.scalar_one_or_none()
        if not parent:
            raise HTTPException(status_code=404, detail="Родительская категория не найдена")
    
    # Проверяем уникальность названия в рамках одного уровня (одного родителя)
    stmt = select(PartCategory).where(PartCategory.category_name == category_data.category_name.strip())
    if category_data.parent_id:
        stmt = stmt.where(PartCategory.parent_id == category_data.parent_id)
    else:
        stmt = stmt.where(PartCategory.parent_id.is_(None))
    
    existing = await session.execute(stmt)
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Категория с таким названием уже существует на этом уровне")
    
    # Создаём категорию
    category = PartCategory(
        category_name=category_data.category_name.strip(),
        parent_id=category_data.parent_id
    )
    session.add(category)
    await session.commit()
    await session.refresh(category)
    
    return {
        "category_id": category.category_id,
        "category_name": category.category_name,
        "parent_id": category.parent_id
    }


@router.get("/api/part-specs/{category_id}")
async def get_part_specs_for_category(
    category_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить существующие спецификации для категории (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Проверяем, что категория существует
    category_result = await session.execute(
        select(PartCategory).where(PartCategory.category_id == category_id)
    )
    if not category_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Получаем спецификации для этой категории
    specs = await get_specs_for_category(session, category_id)
    
    # Преобразуем в удобный формат для фронтенда
    specs_list = []
    for spec_name, values in specs.items():
        for value, unit in values:
            specs_list.append({
                "spec_name": spec_name,
                "spec_value": value,
                "spec_unit": unit
            })
    
    return {"specifications": specs_list}


@router.get("/api/part-spec-autocomplete")
async def get_part_spec_autocomplete(
    field: str = Query(..., description="Поле для автодополнения: name, value, unit"),
    query: str = Query("", description="Поисковый запрос"),
    category_id: Optional[int] = Query(None, description="ID категории для фильтрации"),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить варианты автодополнения для спецификаций (без учета регистра)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    if field not in ["name", "value", "unit"]:
        raise HTTPException(status_code=400, detail="Поле должно быть: name, value или unit")
    
    # Строим запрос
    query_lower = query.lower().strip() if query else ""
    
    if field == "name":
        stmt = select(PartSpecification.spec_name).distinct()
        if query_lower:
            stmt = stmt.where(func.lower(PartSpecification.spec_name).like(f"%{query_lower}%"))
    elif field == "value":
        stmt = select(PartSpecification.spec_value).distinct()
        if query_lower:
            stmt = stmt.where(func.lower(PartSpecification.spec_value).like(f"%{query_lower}%"))
    else:  # unit
        stmt = select(PartSpecification.spec_unit).distinct()
        stmt = stmt.where(PartSpecification.spec_unit.is_not(None))
        if query_lower:
            stmt = stmt.where(func.lower(PartSpecification.spec_unit).like(f"%{query_lower}%"))
    
    # Фильтруем по категории, если указана
    if category_id:
        stmt = stmt.join(Part).where(Part.category_id == category_id)
    
    stmt = stmt.limit(20)
    
    result = await session.execute(stmt)
    values = [row[0] for row in result.fetchall() if row[0]]
    
    # Сортируем и возвращаем
    values.sort(key=lambda x: x.lower())
    
    return {"suggestions": values}


class CreatePartRequest(BaseModel):
    part_name: str
    part_article: Optional[str] = None
    description: str
    price: float
    stock_count: int = 0
    manufacturer: str
    category_id: Optional[int] = None  # Может быть None, если создаются новые категории
    specifications: List[dict] = []  # [{"spec_name": "...", "spec_value": "...", "spec_unit": "..."}]
    image_urls: Optional[List[dict]] = None  # [{"url": "...", "alt_text": "...", "sort_order": 0}]
    new_categories: Optional[List[dict]] = None  # [{"category_name": "...", "parent_id": ...}]


@router.post("/api/parts")
async def create_part_endpoint(
    part_data: CreatePartRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Создать новую запчасть (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Валидация обязательных полей
    if not part_data.part_name or len(part_data.part_name.strip()) == 0:
        raise HTTPException(status_code=400, detail="Название запчасти не может быть пустым")
    
    if len(part_data.part_name) > 50:
        raise HTTPException(status_code=400, detail="Название запчасти не может быть длиннее 50 символов")
    
    if not part_data.description or len(part_data.description.strip()) == 0:
        raise HTTPException(status_code=400, detail="Описание не может быть пустым")
    
    if part_data.price < 0:
        raise HTTPException(status_code=400, detail="Цена не может быть отрицательной")
    
    if part_data.stock_count < 0:
        raise HTTPException(status_code=400, detail="Количество на складе не может быть отрицательным")
    
    # Валидация производителя
    valid_manufacturers = [m.value for m in ManufacturerEnum]
    if part_data.manufacturer not in valid_manufacturers:
        raise HTTPException(status_code=400, detail=f"Неверный производитель. Допустимые значения: {', '.join(valid_manufacturers)}")
    
    # Обрабатываем новые категории, если они есть
    final_category_id = part_data.category_id
    
    if part_data.new_categories and len(part_data.new_categories) > 0:
        # Создаем новые категории последовательно
        current_parent_id = part_data.category_id  # Начальный parent_id (может быть None)
        
        for new_cat_data in part_data.new_categories:
            category_name = new_cat_data.get("category_name", "").strip()
            parent_id = new_cat_data.get("parent_id")
            
            if not category_name:
                raise HTTPException(status_code=400, detail="Название категории не может быть пустым")
            
            if len(category_name) > 50:
                raise HTTPException(status_code=400, detail="Название категории не может быть длиннее 50 символов")
            
            # Используем current_parent_id, если parent_id не указан явно
            if parent_id is None:
                parent_id = current_parent_id
            
            # Если указан parent_id, проверяем что родительская категория существует
            if parent_id is not None:
                parent_result = await session.execute(
                    select(PartCategory).where(PartCategory.category_id == parent_id)
                )
                parent = parent_result.scalar_one_or_none()
                if not parent:
                    raise HTTPException(status_code=404, detail=f"Родительская категория с ID {parent_id} не найдена")
            
            # Проверяем уникальность названия в рамках одного уровня
            stmt = select(PartCategory).where(PartCategory.category_name == category_name)
            if parent_id is not None:
                stmt = stmt.where(PartCategory.parent_id == parent_id)
            else:
                stmt = stmt.where(PartCategory.parent_id.is_(None))
            
            existing = await session.execute(stmt)
            if existing.scalar_one_or_none():
                raise HTTPException(status_code=400, detail=f"Категория '{category_name}' уже существует на этом уровне")
            
            # Создаём категорию
            category = PartCategory(
                category_name=category_name,
                parent_id=parent_id
            )
            session.add(category)
            await session.flush()  # Получаем ID новой категории
            await session.refresh(category)
            
            # Обновляем current_parent_id для следующей категории
            current_parent_id = category.category_id
        
        # Используем ID последней созданной категории
        final_category_id = current_parent_id
    else:
        # Если новых категорий нет, проверяем, что указанная категория существует
        if part_data.category_id is None:
            raise HTTPException(status_code=400, detail="Не указана категория")
        
        category_result = await session.execute(
            select(PartCategory).where(PartCategory.category_id == part_data.category_id)
        )
        if not category_result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail="Категория не найдена")
    
    # Проверяем уникальность артикула (если указан)
    if part_data.part_article:
        article_check = await session.execute(
            select(Part).where(Part.part_article == part_data.part_article.strip())
        )
        if article_check.scalar_one_or_none():
            raise HTTPException(status_code=400, detail=f"Запчасть с артикулом {part_data.part_article} уже существует")
    
    # Подготавливаем данные для создания запчасти
    part_dict = {
        "part_name": part_data.part_name.strip(),
        "part_article": part_data.part_article.strip() if part_data.part_article else None,
        "description": part_data.description.strip(),
        "price": part_data.price,
        "stock_count": part_data.stock_count,
        "manufacturer": part_data.manufacturer,
        "category_id": final_category_id
    }
    
    # Подготавливаем спецификации
    specifications = []
    for spec in part_data.specifications:
        if spec.get("spec_name") and spec.get("spec_value"):
            specifications.append({
                "spec_name": spec["spec_name"].strip(),
                "spec_value": spec["spec_value"].strip(),
                "spec_unit": spec.get("spec_unit", "").strip() if spec.get("spec_unit") else None
            })
    
    # Создаём запчасть через репозиторий (без изображений, добавим их после перемещения)
    try:
        part = await create_part(
            session=session,
            part_data=part_dict,
            specifications=specifications,
            image_urls=None  # Изображения добавим после перемещения файлов
        )
        
        # Создаем папку для изображений запчасти
        part_images_dir = Path(f"src/static/images/parts/{part.part_id}")
        part_images_dir.mkdir(parents=True, exist_ok=True)
        
        # Обрабатываем изображения: перемещаем из uploads/ в папку запчасти и переименовываем
        if part_data.image_urls:
            for idx, img_data in enumerate(part_data.image_urls):
                original_url = img_data.get("url", "")
                sort_order = img_data.get("sort_order", idx)
                alt_text = img_data.get("alt_text", "")
                
                # Проверяем, что URL указывает на папку uploads
                if original_url.startswith("/static/images/parts/uploads/"):
                    # Извлекаем имя файла из URL
                    filename = original_url.replace("/static/images/parts/uploads/", "")
                    upload_path = Path(f"src/static/images/parts/uploads/{filename}")
                    
                    # Определяем расширение файла
                    file_ext = upload_path.suffix.lower()
                    if file_ext not in {'.jpg', '.jpeg', '.png'}:
                        file_ext = '.jpg'  # По умолчанию jpg
                    
                    # Новое имя файла: part_{part_id}_{sort_order}.{ext}
                    new_filename = f"part_{part.part_id}_{sort_order}{file_ext}"
                    new_path = part_images_dir / new_filename
                    
                    # Перемещаем и переименовываем файл
                    if upload_path.exists():
                        try:
                            upload_path.rename(new_path)
                            # Новый URL для базы данных
                            new_url = f"/static/images/parts/{part.part_id}/{new_filename}"
                            
                            # Создаем запись изображения в базе данных
                            img = Image(
                                part_id=part.part_id,
                                url=new_url,
                                alt_text=alt_text if alt_text else None,
                                sort_order=sort_order
                            )
                            session.add(img)
                        except Exception as e:
                            # Если не удалось переместить, пропускаем это изображение
                            print(f"Ошибка перемещения файла {filename}: {e}")
                            pass
        
        await session.commit()
        
        return {
            "success": True,
            "message": "Запчасть успешно создана",
            "part_id": part.part_id
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        await session.rollback()
        raise HTTPException(status_code=500, detail=f"Ошибка при создании запчасти: {str(e)}")


class UpdatePartStockRequest(BaseModel):
    stock_count: int


@router.patch("/api/parts/{part_id}/stock")
async def update_part_stock(
    part_id: int,
    stock_data: UpdatePartStockRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить количество товара на складе (только для менеджеров и администраторов)"""
    # Проверяем права доступа
    if current_user.role not in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль менеджера или администратора.")
    
    # Валидация
    if stock_data.stock_count < 0:
        raise HTTPException(status_code=400, detail="Количество на складе не может быть отрицательным")
    
    # Проверяем, что запчасть существует
    part_result = await session.execute(
        select(Part).where(Part.part_id == part_id)
    )
    part = part_result.scalar_one_or_none()
    if not part:
        raise HTTPException(status_code=404, detail="Запчасть не найдена")
    
    # Обновляем количество
    part.stock_count = stock_data.stock_count
    await session.commit()
    await session.refresh(part)
    
    # Сброс кэша
    from src.repositories.part_repo import clear_parts_filters_cache
    clear_parts_filters_cache()
    
    return {
        "success": True,
        "message": "Количество товара обновлено",
        "part_id": part.part_id,
        "stock_count": part.stock_count
    }


# ========== АДМИН-ПАНЕЛЬ: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только для администраторов) ==========

class SearchUserRequest(BaseModel):
    query: str  # ID или email


@router.get("/api/admin/search-user")
async def search_user(
    query: str = Query(..., description="ID пользователя или email"),
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Поиск пользователя по ID или email (только для администраторов)"""
    # Проверяем права доступа
    if current_user.role != UserRoleEnum.ADMIN.value:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль администратора.")
    
    # Пытаемся найти по ID (если query - число)
    user = None
    try:
        user_id = int(query)
        user = await get_user_by_id(session, user_id)
    except ValueError:
        # Если не число, ищем по email
        user = await get_user_by_email(session, query)
    
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    return {
        "user_id": user.user_id,
        "email": user.email,
        "phone_number": user.phone_number,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "middle_name": user.middle_name,
        "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
        "status": user.status.value if hasattr(user.status, 'value') else str(user.status),
        "email_verified": user.email_verified,
        "phone_verified": user.phone_verified,
        "registration_date": user.registration_date.isoformat() if user.registration_date else None
    }


class UpdateUserRequest(BaseModel):
    email: Optional[str] = None
    phone_number: Optional[str] = None
    email_verified: Optional[bool] = None
    phone_verified: Optional[bool] = None
    role: Optional[str] = None
    status: Optional[str] = None


@router.put("/api/admin/update-user/{user_id}")
async def update_user(
    user_id: int,
    update_data: UpdateUserRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Обновить данные пользователя (только для администраторов)"""
    # Проверяем права доступа
    if current_user.role != UserRoleEnum.ADMIN.value:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль администратора.")
    
    # Получаем пользователя
    user = await get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Обновляем поля
    if update_data.email is not None:
        # Проверяем уникальность email (если он изменился)
        if update_data.email != user.email:
            existing_user = await get_user_by_email(session, update_data.email)
            if existing_user and existing_user.user_id != user_id:
                raise HTTPException(status_code=400, detail="Пользователь с таким email уже существует")
        user.email = update_data.email
    
    if update_data.phone_number is not None:
        user.phone_number = update_data.phone_number
    
    if update_data.email_verified is not None:
        user.email_verified = update_data.email_verified
    
    if update_data.phone_verified is not None:
        user.phone_verified = update_data.phone_verified
    
    if update_data.role is not None:
        try:
            user.role = UserRoleEnum(update_data.role).value
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверное значение роли")
    
    if update_data.status is not None:
        try:
            user.status = UserStatusEnum(update_data.status).value
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверное значение статуса")
    
    await session.commit()
    await session.refresh(user)
    
    return {
        "success": True,
        "message": "Данные пользователя обновлены",
        "user": {
            "user_id": user.user_id,
            "email": user.email,
            "phone_number": user.phone_number,
            "email_verified": user.email_verified,
            "phone_verified": user.phone_verified,
            "role": user.role.value if hasattr(user.role, 'value') else str(user.role),
            "status": user.status.value if hasattr(user.status, 'value') else str(user.status)
        }
    }


@router.delete("/api/admin/delete-user/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Удалить пользователя (только для администраторов)"""
    # Проверяем права доступа
    if current_user.role != UserRoleEnum.ADMIN.value:
        raise HTTPException(status_code=403, detail="Доступ запрещен. Требуется роль администратора.")
    
    # Нельзя удалить самого себя
    if user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Нельзя удалить свой собственный аккаунт")
    
    # Получаем пользователя
    user = await get_user_by_id(session, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")
    
    # Удаляем пользователя (каскадное удаление обработается через relationships)
    await session.delete(user)
    await session.commit()
    
    return {
        "success": True,
        "message": "Пользователь успешно удален"
    }

