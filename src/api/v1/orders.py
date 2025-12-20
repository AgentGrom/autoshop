from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User, Order, CarOrder, OrderItem, PaymentMethodEnum, UserAddress, AddressTypeEnum
from src.repositories.car_repo import get_car_by_id
from src.repositories.pickup_repo import get_pickup_point_by_id
from src.repositories.settings_repo import get_setting_float
from src.repositories.cart_repo import get_cart_items
from src.repositories.user_repo import get_user_address_by_id

router = APIRouter(prefix="/orders", tags=["orders"])
templates = Jinja2Templates(directory="src/templates")


class CreateCarOrderRequest(BaseModel):
    car_id: int
    pickup_point_id: int
    payment_method: str
    customer_notes: Optional[str] = None


@router.get("/car/{car_id}")
async def car_order_page(
    request: Request,
    car_id: int,
    session: AsyncSession = Depends(get_async_session)
):
    """Страница оформления заказа автомобиля"""
    car = await get_car_by_id(session, car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    return templates.TemplateResponse(
        "car_order.html",
        {
            "request": request,
            "title": "Оформление заказа",
            "car_id": car_id
        }
    )


@router.post("/api/create-car-order")
async def create_car_order(
    request: Request,
    order_data: CreateCarOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Создание заказа автомобиля"""
    # Проверяем автомобиль
    car = await get_car_by_id(session, order_data.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    if not car.price:
        raise HTTPException(status_code=400, detail="Автомобиль не доступен для заказа (нет цены)")
    
    # Проверяем пункт выдачи
    pickup_point = await get_pickup_point_by_id(session, order_data.pickup_point_id)
    if not pickup_point:
        raise HTTPException(status_code=404, detail="Пункт выдачи не найден")
    
    if not pickup_point.is_active:
        raise HTTPException(status_code=400, detail="Пункт выдачи неактивен")
    
    # Проверяем способ оплаты
    try:
        payment_method = PaymentMethodEnum(order_data.payment_method)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный способ оплаты")
    
    # Получаем настройки сборов
    car_service_fee = await get_setting_float(session, "car_service_fee", 5000.0)
    car_delivery_cost = await get_setting_float(session, "car_delivery_cost", 0.0)
    
    # Рассчитываем итоговую сумму
    car_price = float(car.price)
    total_amount = car_price + car_service_fee + car_delivery_cost
    
    # Создаём заказ
    order = Order(
        user_id=current_user.user_id,
        pickup_point_id=pickup_point.pickup_point_id,
        payment_method=payment_method,
        shipping_cost=car_delivery_cost,
        service_fee=car_service_fee,
        customer_notes=order_data.customer_notes
    )
    session.add(order)
    await session.flush()  # Получаем order_id
    
    # Создаём запись о заказанном автомобиле
    car_order = CarOrder(
        order_id=order.order_id,
        car_id=car.car_id,
        car_price=car_price
    )
    session.add(car_order)
    
    await session.commit()
    await session.refresh(order)
    
    return {
        "success": True,
        "order_id": order.order_id,
        "message": "Заказ успешно создан",
        "total_amount": total_amount
    }


class AddressData(BaseModel):
    country: str
    region: str
    city: str
    street: str
    house: str
    apartment: Optional[str] = None
    entrance: Optional[str] = None
    floor: Optional[str] = None


class CreatePartOrderRequest(BaseModel):
    shipping_address_id: Optional[int] = None  # Для доставки на дом (если используется сохраненный адрес)
    pickup_point_id: Optional[int] = None  # Для самовывоза
    address_data: Optional[AddressData] = None  # Для доставки на дом (если создается новый адрес)
    save_address: bool = False  # Сохранить новый адрес
    payment_method: str
    delivery_method: str  # "home" или "pickup"
    customer_notes: Optional[str] = None


@router.get("/parts")
async def parts_order_page(
    request: Request,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Страница оформления заказа запчастей"""
    # Проверяем, что в корзине есть товары
    cart_items = await get_cart_items(session, current_user.user_id)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Корзина пуста")
    
    return templates.TemplateResponse(
        "parts_order.html",
        {
            "request": request,
            "title": "Оформление заказа"
        }
    )


@router.post("/api/create-part-order")
async def create_part_order(
    request: Request,
    order_data: CreatePartOrderRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Создание заказа запчастей"""
    # Проверяем способ доставки
    if order_data.delivery_method not in ["home", "pickup"]:
        raise HTTPException(status_code=400, detail="Неверный способ доставки")
    
    # Проверяем адрес или пункт выдачи
    shipping_address_id = None
    pickup_point_id = None
    
    if order_data.delivery_method == "home":
        if order_data.shipping_address_id:
            # Используем сохраненный адрес
            address = await get_user_address_by_id(session, order_data.shipping_address_id, current_user.user_id)
            if not address:
                raise HTTPException(status_code=404, detail="Адрес не найден")
            if not address.is_active:
                raise HTTPException(status_code=400, detail="Адрес неактивен")
            shipping_address_id = address.address_id
        elif order_data.address_data:
            # Создаем новый адрес
            new_address = UserAddress(
                user_id=current_user.user_id,
                address_type=AddressTypeEnum.EXACT,
                country=order_data.address_data.country,
                region=order_data.address_data.region,
                city=order_data.address_data.city,
                street=order_data.address_data.street,
                house=order_data.address_data.house,
                apartment=order_data.address_data.apartment,
                entrance=order_data.address_data.entrance,
                floor=order_data.address_data.floor,
                recipient_name=f"{current_user.first_name} {current_user.last_name}",
                recipient_phone=current_user.phone_number or "",
                is_active=order_data.save_address  # Сохраняем для будущего использования, если пользователь выбрал
            )
            session.add(new_address)
            await session.flush()
            shipping_address_id = new_address.address_id
        else:
            raise HTTPException(status_code=400, detail="Необходимо указать адрес доставки")
    else:  # pickup
        if not order_data.pickup_point_id:
            raise HTTPException(status_code=400, detail="Необходимо указать пункт выдачи")
        pickup_point = await get_pickup_point_by_id(session, order_data.pickup_point_id)
        if not pickup_point:
            raise HTTPException(status_code=404, detail="Пункт выдачи не найден")
        if not pickup_point.is_active:
            raise HTTPException(status_code=400, detail="Пункт выдачи неактивен")
        pickup_point_id = pickup_point.pickup_point_id
    
    # Проверяем способ оплаты
    try:
        payment_method = PaymentMethodEnum(order_data.payment_method)
    except ValueError:
        raise HTTPException(status_code=400, detail="Неверный способ оплаты")
    
    # Получаем товары из корзины
    cart_items = await get_cart_items(session, current_user.user_id)
    if not cart_items:
        raise HTTPException(status_code=400, detail="Корзина пуста")
    
    # Получаем настройки сборов
    part_service_fee = await get_setting_float(session, "part_service_fee", 500.0)
    part_delivery_cost = await get_setting_float(session, "part_delivery_cost", 500.0) if order_data.delivery_method == "home" else 0.0
    
    # Рассчитываем сумму товаров
    items_total = sum(float(item.part.price) * item.quantity for item in cart_items if item.part.price)
    total_amount = items_total + part_service_fee + part_delivery_cost
    
    # Создаём заказ
    order = Order(
        user_id=current_user.user_id,
        shipping_address_id=shipping_address_id,
        pickup_point_id=pickup_point_id,
        payment_method=payment_method,
        shipping_cost=part_delivery_cost,
        service_fee=part_service_fee,
        customer_notes=order_data.customer_notes
    )
    session.add(order)
    await session.flush()  # Получаем order_id
    
    # Создаём записи о заказанных товарах
    for cart_item in cart_items:
        order_item = OrderItem(
            order_id=order.order_id,
            part_id=cart_item.part_id,
            quantity=cart_item.quantity
        )
        session.add(order_item)
    
    # Очищаем корзину после создания заказа
    from src.repositories.cart_repo import clear_cart
    await clear_cart(session, current_user.user_id)
    
    await session.commit()
    await session.refresh(order)
    
    return {
        "success": True,
        "order_id": order.order_id,
        "message": "Заказ успешно создан",
        "total_amount": total_amount
    }

