from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, update
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel
from typing import Optional
from io import BytesIO
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

from src.database.database import get_async_session
from src.auth.jwt import get_current_user_from_cookie
from src.database.models import User, Order, CarOrder, OrderItem, PaymentMethodEnum, UserAddress, AddressTypeEnum, UserStatusEnum, Car
from src.repositories.car_repo import get_car_by_id
from src.repositories.pickup_repo import get_pickup_point_by_id
from src.repositories.settings_repo import get_setting_float
from src.repositories.cart_repo import get_cart_items
from src.repositories.user_repo import get_user_address_by_id

router = APIRouter(prefix="/orders", tags=["orders"])
templates = Jinja2Templates(directory="src/templates")


@router.get("/payment")
async def payment_page(
    request: Request,
    order_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Страница оплаты заказа"""
    # Проверяем, что заказ существует и принадлежит пользователю
    from sqlalchemy import select
    stmt = select(Order).where(Order.order_id == order_id, Order.user_id == current_user.user_id)
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order.is_paid:
        # Заказ уже оплачен, перенаправляем в личный кабинет
        from fastapi.responses import RedirectResponse
        return RedirectResponse(url="/account", status_code=303)
    
    return templates.TemplateResponse(
        "payment.html",
        {
            "request": request,
            "title": "Оплата заказа",
            "order_id": order_id
        }
    )


@router.get("/api/order/{order_id}")
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Получить информацию о заказе"""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    
    stmt = (
        select(Order)
        .where(Order.order_id == order_id, Order.user_id == current_user.user_id)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.part),
            selectinload(Order.car_orders).selectinload(CarOrder.car)
        )
    )
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Рассчитываем общую сумму
    items_total = sum(float(item.part.price) * item.quantity for item in order.order_items if item.part.price)
    cars_total = sum(float(co.car_price) for co in order.car_orders if co.car_price)
    total_amount = items_total + cars_total + float(order.service_fee or 0) + float(order.shipping_cost or 0) - float(order.discount or 0)
    
    return {
        "order_id": order.order_id,
        "total_amount": total_amount,
        "is_paid": order.is_paid,
        "payment_method": order.payment_method.value if hasattr(order.payment_method, 'value') else str(order.payment_method),
        "status": order.status.value if hasattr(order.status, 'value') else str(order.status)
    }


class PayOrderRequest(BaseModel):
    pay: bool  # True - оплатить, False - отменить


@router.post("/api/pay/{order_id}")
async def pay_order(
    order_id: int,
    pay_data: PayOrderRequest,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Оплатить или отменить оплату заказа"""
    from sqlalchemy import select, update
    from src.database.models import OrderStatusEnum
    
    # Проверяем, что заказ существует и принадлежит пользователю
    stmt = select(Order).where(Order.order_id == order_id, Order.user_id == current_user.user_id)
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if order.is_paid and pay_data.pay:
        raise HTTPException(status_code=400, detail="Заказ уже оплачен")
    
    # Обновляем статус оплаты
    if pay_data.pay:
        # Оплачиваем заказ
        await session.execute(
            update(Order)
            .where(Order.order_id == order_id)
            .values(is_paid=True)
        )
        await session.commit()
        return {
            "success": True,
            "message": "Заказ успешно оплачен"
        }
    else:
        # Отменяем оплату (заказ остается неоплаченным)
        # Заказ уже создан с is_paid=False, просто подтверждаем
        await session.commit()
        return {
            "success": True,
            "message": "Оплата отменена. Заказ создан, но не оплачен."
        }


@router.get("/api/order/{order_id}/receipt")
async def get_order_receipt(
    order_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Скачать чек заказа в формате PDF (только для оплаченных заказов)"""
    from src.database.models import UserRoleEnum
    
    # Проверяем, является ли пользователь менеджером или администратором
    is_manager_or_admin = current_user.role in [UserRoleEnum.MANAGER.value, UserRoleEnum.ADMIN.value]
    
    # Получаем заказ с полной информацией
    # Менеджеры и администраторы могут скачивать чеки для любых заказов
    # Обычные пользователи - только для своих заказов
    stmt = (
        select(Order)
        .where(Order.order_id == order_id)
        .options(
            selectinload(Order.order_items).selectinload(OrderItem.part),
            selectinload(Order.car_orders).selectinload(CarOrder.car).selectinload(Car.trim),
            selectinload(Order.shipping_address),
            selectinload(Order.pickup_point),
            selectinload(Order.user)
        )
    )
    
    # Для обычных пользователей добавляем проверку на принадлежность заказа
    if not is_manager_or_admin:
        stmt = stmt.where(Order.user_id == current_user.user_id)
    
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    if not order.is_paid:
        raise HTTPException(status_code=400, detail="Чек доступен только для оплаченных заказов")
    
    # Регистрируем шрифт с поддержкой кириллицы
    # Пытаемся использовать системный шрифт DejaVu Sans, если доступен
    try:
        # Попробуем найти DejaVu Sans в стандартных местах
        font_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/TTF/DejaVuSans.ttf',
            '/System/Library/Fonts/Helvetica.ttc',  # macOS
            'C:/Windows/Fonts/arial.ttf',  # Windows
        ]
        bold_paths = [
            '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
            '/usr/share/fonts/TTF/DejaVuSans-Bold.ttf',
            '/System/Library/Fonts/Helvetica-Bold.ttc',  # macOS
            'C:/Windows/Fonts/arialbd.ttf',  # Windows
        ]
        font_path = None
        bold_font_path = None
        for path in font_paths:
            if os.path.exists(path):
                font_path = path
                break
        
        for path in bold_paths:
            if os.path.exists(path):
                bold_font_path = path
                break
        
        if font_path:
            pdfmetrics.registerFont(TTFont('DejaVuSans', font_path))
            font_name = 'DejaVuSans'
            if bold_font_path:
                pdfmetrics.registerFont(TTFont('DejaVuSans-Bold', bold_font_path))
                font_bold = 'DejaVuSans-Bold'
            else:
                font_bold = 'DejaVuSans'  # Используем обычный шрифт для жирного
        else:
            # Если системный шрифт не найден, используем встроенный Helvetica
            font_name = 'Helvetica'
            font_bold = 'Helvetica-Bold'
    except Exception as e:
        # В случае ошибки используем стандартный шрифт
        import logging
        logging.getLogger(__name__).warning(f"Не удалось загрузить шрифт с поддержкой кириллицы: {e}")
        font_name = 'Helvetica'
        font_bold = 'Helvetica-Bold'
    
    # Создаем PDF в памяти
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=20*mm, leftMargin=20*mm, topMargin=20*mm, bottomMargin=20*mm)
    story = []
    
    # Стили с поддержкой кириллицы
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontName=font_bold,
        fontSize=18,
        textColor=colors.HexColor('#0066cc'),
        spaceAfter=12,
        alignment=TA_CENTER
    )
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontName=font_bold,
        fontSize=14,
        textColor=colors.HexColor('#333333'),
        spaceAfter=8
    )
    normal_style = ParagraphStyle(
        'CustomNormal',
        parent=styles['Normal'],
        fontName=font_name,
        fontSize=10
    )
    
    # Заголовок
    story.append(Paragraph("ЧЕК О ПРОДАЖЕ", title_style))
    story.append(Spacer(1, 12))
    
    # Информация о заказе
    order_date = order.order_date.strftime("%d.%m.%Y %H:%M") if order.order_date else "—"
    story.append(Paragraph(f"<b>Заказ №{order.order_id}</b>", heading_style))
    story.append(Paragraph(f"Дата: {order_date}", normal_style))
    story.append(Spacer(1, 6))
    
    # Информация о покупателе
    user_name = f"{order.user.first_name or ''} {order.user.last_name or ''}".strip() or "Покупатель"
    story.append(Paragraph(f"<b>Покупатель:</b> {user_name}", normal_style))
    if order.user.email:
        story.append(Paragraph(f"Email: {order.user.email}", normal_style))
    if order.user.phone_number:
        story.append(Paragraph(f"Телефон: {order.user.phone_number}", normal_style))
    story.append(Spacer(1, 12))
    
    # Товары
    story.append(Paragraph("<b>Товары:</b>", heading_style))
    
    # Подготавливаем данные для таблицы
    table_data = [["Наименование", "Кол-во", "Цена", "Сумма"]]
    
    # Запчасти
    for item in order.order_items:
        part_name = item.part.part_name
        manufacturer = item.part.manufacturer.value if hasattr(item.part.manufacturer, 'value') else str(item.part.manufacturer) if item.part.manufacturer else ""
        full_name = f"{part_name}" + (f" ({manufacturer})" if manufacturer else "")
        quantity = item.quantity
        price = float(item.part.price) if item.part.price else 0
        total = price * quantity
        table_data.append([
            full_name,
            str(quantity),
            f"{price:,.2f} ₽".replace(',', ' '),
            f"{total:,.2f} ₽".replace(',', ' ')
        ])
    
    # Автомобили
    for car_order in order.car_orders:
        car = car_order.car
        if not car:
            # Если автомобиль был удален, используем информацию из заказа
            car_name = "Автомобиль (удален)"
            price = float(car_order.car_price) if car_order.car_price else 0
        elif not car.trim:
            # Если комплектация была удалена, используем базовую информацию
            car_name = f"Автомобиль ID: {car.car_id}"
            if car.production_year:
                car_name += f" ({car.production_year})"
            price = float(car_order.car_price) if car_order.car_price else 0
        else:
            brand = car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "—"
            model = car.trim.model_name if car.trim.model_name else "—"
            year = car.production_year if car.production_year else ""
            car_name = f"{brand} {model}" + (f" {year}" if year else "")
            price = float(car_order.car_price) if car_order.car_price else 0
        
        table_data.append([
            car_name,
            "1",
            f"{price:,.2f} ₽".replace(',', ' '),
            f"{price:,.2f} ₽".replace(',', ' ')
        ])
    
    # Создаем таблицу с правильными ширинами колонок
    # Ширина страницы A4: 210mm, отступы: 20mm слева и справа = 170mm доступно
    # Распределяем: Наименование (90mm), Кол-во (15mm), Цена (32mm), Сумма (33mm)
    table = Table(table_data, colWidths=[90*mm, 15*mm, 32*mm, 33*mm])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0066cc')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'CENTER'),
        ('ALIGN', (2, 0), (2, -1), 'RIGHT'),
        ('ALIGN', (3, 0), (3, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, 0), font_bold),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('TOPPADDING', (0, 0), (-1, 0), 8),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ('FONTNAME', (0, 1), (-1, -1), font_name),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f9f9f9')]),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 1), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))
    
    # Итоги
    items_total = sum(float(item.part.price) * item.quantity for item in order.order_items if item.part.price)
    cars_total = sum(float(co.car_price) for co in order.car_orders if co.car_price)
    service_fee = float(order.service_fee or 0)
    shipping_cost = float(order.shipping_cost or 0)
    discount = float(order.discount or 0)
    total_amount = items_total + cars_total + service_fee + shipping_cost - discount
    
    totals_data = []
    if items_total + cars_total > 0:
        totals_data.append(["Сумма товаров:", f"{items_total + cars_total:,.2f} ₽".replace(',', ' ')])
    # Всегда показываем сервисный сбор и доставку, даже если они равны 0
    totals_data.append(["Сервисный сбор:", f"{service_fee:,.2f} ₽".replace(',', ' ')])
    totals_data.append(["Доставка:", f"{shipping_cost:,.2f} ₽".replace(',', ' ')])
    if discount > 0:
        totals_data.append(["Скидка:", f"-{discount:,.2f} ₽".replace(',', ' ')])
    # Для итоговой строки используем обычный текст, жирный шрифт применится через стиль
    totals_data.append(["ИТОГО:", f"{total_amount:,.2f} ₽".replace(',', ' ')])
    
    # Ширина страницы A4: 210mm, отступы: 20mm слева и справа = 170mm доступно
    # Для таблицы итогов используем всю доступную ширину
    totals_table = Table(totals_data, colWidths=[120*mm, 50*mm])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (0, -1), 'LEFT'),
        ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
        ('FONTNAME', (0, 0), (-1, -2), font_name),
        ('FONTSIZE', (0, 0), (-1, -2), 10),
        ('FONTNAME', (0, -1), (-1, -1), font_bold),
        ('FONTSIZE', (0, -1), (-1, -1), 12),
        ('TOPPADDING', (0, -1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, -1), (-1, -1), 8),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
    ]))
    story.append(totals_table)
    story.append(Spacer(1, 12))
    
    # Способ оплаты и доставки
    payment_method_map = {
        "CARD": "Банковская карта",
        "CASH": "Наличные",
        "ONLINE": "Онлайн оплата"
    }
    payment_method = payment_method_map.get(order.payment_method.value if hasattr(order.payment_method, 'value') else str(order.payment_method), str(order.payment_method))
    story.append(Paragraph(f"<b>Способ оплаты:</b> {payment_method}", normal_style))
    
    if order.shipping_address:
        addr = order.shipping_address
        address = f"{addr.country}" + (f", {addr.region}" if addr.region else "") + f", {addr.city}, {addr.street}, {addr.house}" + (f", кв. {addr.apartment}" if addr.apartment else "")
        story.append(Paragraph(f"<b>Адрес доставки:</b> {address}", normal_style))
    elif order.pickup_point:
        pp = order.pickup_point
        address = f"{pp.country}, {pp.region}, {pp.city}, {pp.street}, {pp.house}"
        story.append(Paragraph(f"<b>Пункт выдачи:</b> {address}", normal_style))
    
    story.append(Spacer(1, 12))
    story.append(Paragraph(f"<i>Чек сгенерирован: {datetime.now().strftime('%d.%m.%Y %H:%M')}</i>", normal_style))
    
    # Собираем PDF
    doc.build(story)
    buffer.seek(0)
    
    # Возвращаем PDF как ответ
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="receipt_{order_id}.pdf"'
        }
    )


@router.post("/api/cancel/{order_id}")
async def cancel_order(
    order_id: int,
    current_user: User = Depends(get_current_user_from_cookie),
    session: AsyncSession = Depends(get_async_session)
):
    """Отменить заказ"""
    from sqlalchemy import select, update, delete
    from sqlalchemy.orm import selectinload
    from src.database.models import OrderStatusEnum
    
    # Проверяем, что заказ существует и принадлежит пользователю
    stmt = (
        select(Order)
        .where(Order.order_id == order_id, Order.user_id == current_user.user_id)
        .options(
            selectinload(Order.order_items),
            selectinload(Order.car_orders)
        )
    )
    result = await session.execute(stmt)
    order = result.scalar_one_or_none()
    
    if not order:
        raise HTTPException(status_code=404, detail="Заказ не найден")
    
    # Проверяем, можно ли отменить заказ (нельзя отменить уже доставленный или уже отмененный)
    if order.status == OrderStatusEnum.DELIVERED.value:
        raise HTTPException(status_code=400, detail="Нельзя отменить доставленный заказ")
    
    if order.status == OrderStatusEnum.CANCELLED.value:
        raise HTTPException(status_code=400, detail="Заказ уже отменен")
    
    # Возвращаем товары на склад (вручную обновляем stock_count, не удаляя order_items для истории)
    if order.order_items:
        from src.database.models import Part
        for item in order.order_items:
            # Получаем текущее количество на складе
            part_stmt = select(Part).where(Part.part_id == item.part_id)
            part_result = await session.execute(part_stmt)
            part = part_result.scalar_one_or_none()
            if part:
                # Увеличиваем количество на складе на количество из отмененного заказа
                new_stock = (part.stock_count or 0) + item.quantity
                await session.execute(
                    update(Part)
                    .where(Part.part_id == item.part_id)
                    .values(stock_count=new_stock)
                )
    
    # Возвращаем автомобили в список (делаем видимыми)
    if order.car_orders:
        from src.database.models import Car
        for car_order in order.car_orders:
            await session.execute(
                update(Car)
                .where(Car.car_id == car_order.car_id)
                .values(is_visible=True)
            )
    
    # Отменяем заказ (order_items остаются для истории заказа)
    await session.execute(
        update(Order)
        .where(Order.order_id == order_id)
        .values(status=OrderStatusEnum.CANCELLED.value)
    )
    await session.commit()
    
    # Формируем сообщение
    message = "Заказ успешно отменен."
    if order.order_items:
        message += " Товары возвращены на склад."
    if order.car_orders:
        message += " Автомобиль возвращен в список."
    
    return {
        "success": True,
        "message": message
    }


class CreateCarOrderRequest(BaseModel):
    car_id: int
    pickup_point_id: int
    payment_method: str
    customer_notes: Optional[str] = None


@router.get("/car/{car_id}")
async def car_order_page(
    request: Request,
    car_id: int,
    session: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(get_current_user_from_cookie)
):
    """Страница оформления заказа автомобиля"""
    # Проверяем статус аккаунта
    if current_user.status != UserStatusEnum.ACTIVE.value:
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "title": "Доступ запрещен",
                "error_code": 403,
                "error_message": "Аккаунт не активирован",
                "error_description": "Для оформления заказа необходимо активировать аккаунт. Пожалуйста, подтвердите ваш email в личном кабинете.",
                "action_url": "/account",
                "action_text": "Перейти в личный кабинет"
            },
            status_code=403
        )
    
    car = await get_car_by_id(session, car_id)
    if not car:
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "title": "Автомобиль не найден",
                "error_code": 404,
                "error_message": "Автомобиль не найден",
                "error_description": "Запрашиваемый автомобиль не существует или был удален.",
                "action_url": "/cars",
                "action_text": "Вернуться к списку автомобилей"
            },
            status_code=404
        )
    
    # Проверяем видимость автомобиля
    if not car.is_visible:
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "title": "Автомобиль недоступен",
                "error_code": 400,
                "error_message": "Автомобиль недоступен",
                "error_description": "Этот автомобиль больше не доступен для заказа.",
                "action_url": "/cars",
                "action_text": "Вернуться к списку автомобилей"
            },
            status_code=400
        )
    
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
    # Проверяем статус аккаунта
    if current_user.status != UserStatusEnum.ACTIVE.value:
        raise HTTPException(
            status_code=403,
            detail="Для оформления заказа необходимо активировать аккаунт. Пожалуйста, подтвердите ваш email в личном кабинете."
        )
    
    # Проверяем автомобиль
    car = await get_car_by_id(session, order_data.car_id)
    if not car:
        raise HTTPException(status_code=404, detail="Автомобиль не найден")
    
    # Проверяем видимость автомобиля
    if not car.is_visible:
        raise HTTPException(status_code=400, detail="Автомобиль недоступен для заказа")
    
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
    
    # Определяем, нужно ли перебрасывать на оплату
    # payment_method уже является PaymentMethodEnum после парсинга
    is_online_payment = (payment_method == PaymentMethodEnum.CARD)
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Car order: payment_method={payment_method}, PaymentMethodEnum.CARD={PaymentMethodEnum.CARD}, is_online_payment={is_online_payment}")
    
    # Создаём заказ (всегда с is_paid=False, оплата происходит отдельно)
    order = Order(
        user_id=current_user.user_id,
        pickup_point_id=pickup_point.pickup_point_id,
        payment_method=payment_method.value,  # Используем .value для получения строки
        shipping_cost=car_delivery_cost,
        service_fee=car_service_fee,
        customer_notes=order_data.customer_notes,
        is_paid=False  # Всегда создаем неоплаченным, оплата происходит отдельно
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
    
    # Помечаем автомобиль как невидимый (скрываем из списка)
    await session.execute(
        update(Car)
        .where(Car.car_id == car.car_id)
        .values(is_visible=False)
    )
    
    await session.commit()
    await session.refresh(order)
    
    # Если онлайн-оплата, перебрасываем на страницу оплаты
    if is_online_payment:
        return {
            "success": True,
            "order_id": order.order_id,
            "message": "Заказ создан, требуется оплата",
            "total_amount": total_amount,
            "redirect_to_payment": True
        }
    
    # Для наличных и карты при получении - заказ создан, оплата при получении
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
    # Проверяем статус аккаунта
    if current_user.status != UserStatusEnum.ACTIVE.value:
        return templates.TemplateResponse(
            "error.html",
            {
                "request": request,
                "title": "Доступ запрещен",
                "error_code": 403,
                "error_message": "Аккаунт не активирован",
                "error_description": "Для оформления заказа необходимо активировать аккаунт. Пожалуйста, подтвердите ваш email в личном кабинете.",
                "action_url": "/account",
                "action_text": "Перейти в личный кабинет"
            },
            status_code=403
        )
    
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
    # Проверяем статус аккаунта
    if current_user.status != UserStatusEnum.ACTIVE.value:
        raise HTTPException(
            status_code=403,
            detail="Для оформления заказа необходимо активировать аккаунт. Пожалуйста, подтвердите ваш email в личном кабинете."
        )
    
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
                address_type=AddressTypeEnum.EXACT.value,
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
    
    # Определяем, нужно ли перебрасывать на оплату
    # payment_method уже является PaymentMethodEnum после парсинга
    is_online_payment = (payment_method == PaymentMethodEnum.CARD)
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"Part order: payment_method={payment_method}, PaymentMethodEnum.CARD={PaymentMethodEnum.CARD}, is_online_payment={is_online_payment}")
    
    # Рассчитываем сумму товаров
    items_total = sum(float(item.part.price) * item.quantity for item in cart_items if item.part.price)
    total_amount = items_total + part_service_fee + part_delivery_cost
    
    # Создаём заказ (всегда с is_paid=False, оплата происходит отдельно)
    order = Order(
        user_id=current_user.user_id,
        shipping_address_id=shipping_address_id,
        pickup_point_id=pickup_point_id,
        payment_method=payment_method.value,  # Используем .value для получения строки
        shipping_cost=part_delivery_cost,
        service_fee=part_service_fee,
        customer_notes=order_data.customer_notes,
        is_paid=False  # Всегда создаем неоплаченным, оплата происходит отдельно
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
    
    # Если онлайн-оплата, перебрасываем на страницу оплаты
    if is_online_payment:
        return {
            "success": True,
            "order_id": order.order_id,
            "message": "Заказ создан, требуется оплата",
            "total_amount": total_amount,
            "redirect_to_payment": True
        }
    
    # Для наличных и карты при получении - заказ создан, оплата при получении
    return {
        "success": True,
        "order_id": order.order_id,
        "message": "Заказ успешно создан",
        "total_amount": total_amount
    }

