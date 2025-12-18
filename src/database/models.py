from typing import Annotated

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    Integer, 
    MetaData, 
    ForeignKey, 
    String,
    Text, 
    DECIMAL,
    func
)

from typing import List, Optional

from datetime import datetime

from enum import Enum

# Марки авто
class CarBrandEnum(Enum):
    TOYOTA = "Toyota"
    BMW = "BMW"
    MERCEDES = "Mercedes-Benz"
    AUDI = "Audi"
    VOLKSWAGEN = "Volkswagen"
    HONDA = "Honda"
    FORD = "Ford"
    HYUNDAI = "Hyundai"
    KIA = "Kia"
    NISSAN = "Nissan"
    LADA = "Lada"

# Состояния авто
class ConditionEnum(Enum):
    NEW = "Новый"
    USED = "С пробегом"


# Цвета авто (пока может использоваться только для метаданных фильтров)
class ColorEnum(Enum):
    WHITE = "Белый"
    BLACK = "Черный"
    SILVER = "Серебристый"
    GREY = "Серый"
    BLUE = "Синий"
    RED = "Красный"
    GREEN = "Зеленый"
    BROWN = "Коричневый"
    BEIGE = "Бежевый"
    YELLOW = "Желтый"
    ORANGE = "Оранжевый"

# Тип используемого топлива
class FuelTypeEnum(Enum):
    PETROL = "Бензин"
    DIESEL = "Дизель"
    HYBRID = "Гибрид"
    ELECTRIC = "Электрический"
    GAS = "Газ"

# Тип КПП
class TransmissionEnum(Enum):
    MANUAL = "Механическая"
    AUTOMATIC = "Автоматическая"
    ROBOT = "Роботизированная"
    CVT = "Вариатор"

# Тип привода
class DriveTypeEnum(Enum):
    FWD = "Передний"
    RWD = "Задний"
    AWD = "Полный"
    FOUR_WD = "4WD"

# Тип кузова
class BodyTypeEnum(Enum):
    SEDAN = "Седан"
    HATCHBACK = "Хэтчбек"
    UNIVERSAL = "Универсал"
    COUPE = "Купе"
    SUV = "Внедорожник"
    MINIVAN = "Минивэн"
    PICKUP = "Пикап"
    VAN = "Фургон"

# Производители запчастей
class ManufacturerEnum(Enum):
    BOSCH = "Bosch"
    MANN_FILTER = "Mann-Filter"
    KYB = "KYB"
    BREMBO = "Brembo"
    CONTINENTAL = "Continental"
    DELPHI = "Delphi"
    MAGNETI_MARELLI = "Magneti Marelli"
    VALEО = "Valeo"
    ZF = "Zf"
    LUK = "LUK"

# Статусы заказа
class OrderStatusEnum(Enum):
    PROCESSING = "В обработке"
    SHIPPED = "Отправлен"
    DELIVERED = "Доставлен"
    CANCELLED = "Отменен"

# Роли пользователей
class UserRoleEnum(Enum):
    CUSTOMER = "Покупатель"
    MANAGER = "Менеджер"
    ADMIN = "Администратор"

# Статус аккаунта пользователя
class UserStatusEnum(Enum):
    ACTIVE = "Активный"
    SUSPENDED = "Заблокирован"
    PENDING_VERIFICATION = "Ожидает верификации"

# Типы адресов пользователя
class AddressTypeEnum(Enum):
    EXACT = "Точный"
    PICKUP = "Пункт выдачи"

# Типы оплаты
class PaymentMethodEnum(Enum):
    CARD = "Онлайн"
    CARD_ON_RESIEVE = "Картой при получении"
    CASH = "Наличные"

# Добавление метаданных для работы alembic
metadata = MetaData()

# Создание своего типа для использования в виде первичного ключа для удобства
intpk = Annotated[int, mapped_column(primary_key=True, autoincrement=True)]

# Базовый класс таблиц
class Base(DeclarativeBase):
    metadata = metadata

# Таблица с автомобильными частями
class Part(Base):
    __tablename__ = 'parts'

    part_id: Mapped[intpk]
    part_name: Mapped[str] = mapped_column(String(50))
    part_article: Mapped[str] = mapped_column(String(70), nullable=True)
    description: Mapped[str] = mapped_column(Text)

    price: Mapped[float] = mapped_column(DECIMAL(10, 2))
    stock_count: Mapped[int] = mapped_column(Integer, default=0)

    manufacturer: Mapped[ManufacturerEnum] = mapped_column(String(50))                              # Производитель 
    
    category_id: Mapped[int] = mapped_column(ForeignKey('part_categories.category_id'))             # id категориии
    
    # Связь с таблицей категорий
    category: Mapped['PartCategory'] = relationship('PartCategory', back_populates="part") 

    # Связь с таблицей спецификаций
    specifications: Mapped[List['PartSpecification']] = relationship('PartSpecification', back_populates="part") 

    order_items: Mapped[List["OrderItem"]] = relationship("OrderItem", back_populates="part")

    # Связь с таблицей изображений
    images: Mapped[List["Image"]] = relationship(
        "Image", 
        back_populates="part", 
        cascade="all, delete-orphan"
    )

# Таблица спецификаций запчастей
class PartSpecification(Base):
    __tablename__ = 'part_specifications'

    spec_id: Mapped[intpk]
    part_id: Mapped[int] = mapped_column(ForeignKey('parts.part_id', ondelete="CASCADE"))  # Внешний ключ с таблицей запчастей
    spec_name: Mapped[str] = mapped_column(String(50))
    spec_value: Mapped[str] = mapped_column(String(100))               # Значение спецификации
    spec_unit: Mapped[str] = mapped_column(String(20), nullable=True)  # Единица измерения
    
    # Связь с таблицей запчастей
    part: Mapped['Part'] = relationship('Part', back_populates='specifications')

# Таблица категорий запчастей
class PartCategory(Base):
    __tablename__ = 'part_categories'

    category_id: Mapped[intpk]
    category_name: Mapped[str] = mapped_column(String(50))

    parent_id: Mapped[int] = mapped_column(ForeignKey('part_categories.category_id'), nullable=True)

    parent: Mapped['PartCategory'] = relationship(
        'PartCategory', 
        remote_side=lambda: PartCategory.category_id, 
        back_populates='childrens'
    )

    childrens: Mapped[List['PartCategory']] = relationship(
        'PartCategory', 
        back_populates='parent', 
        cascade='all, delete-orphan'
    )

    part: Mapped[List['Part']] = relationship('Part', back_populates='category')

# Таблица автомобилей
class Car(Base):
    __tablename__ = "cars"
    
    car_id: Mapped[intpk]
    trim_id: Mapped[int] = mapped_column(ForeignKey("car_trims.trim_id"))
    vin: Mapped[str] = mapped_column(String(17), unique=True)
    production_year: Mapped[int] = mapped_column(Integer)
    condition: Mapped[ConditionEnum] = mapped_column(String(20)) # Состояния
    mileage: Mapped[int] = mapped_column(Integer)  # пробег в км
    color: Mapped[ColorEnum] = mapped_column(String(30))
    price: Mapped[float] = mapped_column(DECIMAL(12, 2), nullable=True)  # цена для продажи
    
    # Связь с таблицей комплектаций
    trim: Mapped["CarTrim"] = relationship("CarTrim", back_populates="cars")

    # Связь с таблицей изображений
    images: Mapped[List["Image"]] = relationship(
        "Image", 
        back_populates="car", 
        cascade="all, delete-orphan"
    )

# Таблица комплектаций авто
class CarTrim(Base):
    __tablename__ = "car_trims"
    
    trim_id: Mapped[intpk]
    trim_name: Mapped[str] = mapped_column(String(100), nullable=True)

    brand_name: Mapped[CarBrandEnum] = mapped_column(String(50))
    model_name: Mapped[str] = mapped_column(String(100), nullable=True)

    engine_volume: Mapped[float] = mapped_column(DECIMAL(3, 1), nullable=True)  # Литры
    engine_power: Mapped[int] = mapped_column(Integer, nullable=True)  # Лошадиные силы
    engine_torque: Mapped[int] = mapped_column(Integer, nullable=True)  # Крутящий момент

    fuel_type: Mapped[FuelTypeEnum] = mapped_column(String(20), nullable=True)
    transmission: Mapped[TransmissionEnum] = mapped_column(String(20), nullable=True)
    drive_type: Mapped[DriveTypeEnum] = mapped_column(String(20), nullable=True) # тип привода
    body_type: Mapped[BodyTypeEnum] = mapped_column(String(20), nullable=True) # тип кузова

    doors: Mapped[int] = mapped_column(Integer, nullable=True)
    seats: Mapped[int] = mapped_column(Integer, nullable=True)
    
    # Связь с таблицей автомобилей
    cars: Mapped[List["Car"]] = relationship("Car", back_populates="trim")

# Таблица пользователей
class User(Base):
    __tablename__ = "users"
    
    user_id: Mapped[intpk]
    email: Mapped[str] = mapped_column(String(255), unique=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    first_name: Mapped[str] = mapped_column(String(50)) # Имя
    last_name: Mapped[str] = mapped_column(String(50)) # Фамилия
    middle_name: Mapped[str] = mapped_column(String(50), nullable=True) # Отвечство
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True)
    
    role: Mapped[UserRoleEnum] = mapped_column(String(20), default=UserRoleEnum.CUSTOMER.value)
    status: Mapped[UserStatusEnum] = mapped_column(String(20), default=UserStatusEnum.PENDING_VERIFICATION.value)
    
    registration_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    phone_verified: Mapped[bool] = mapped_column(Boolean, default=False)
        
    # Связи
    addresses: Mapped[list["UserAddress"]] = relationship("UserAddress", back_populates="user")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")

# Адреса пользователей
class UserAddress(Base):
    __tablename__ = "user_addresses"
    
    address_id: Mapped[intpk]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    address_type: Mapped[AddressTypeEnum] = mapped_column(String(30))
    
    # Адресные данные
    postal_code: Mapped[str] = mapped_column(String(20), nullable=True)
    country: Mapped[str] = mapped_column(String(50))
    city: Mapped[str] = mapped_column(String(50))
    street: Mapped[str] = mapped_column(String(100))
    house: Mapped[str] = mapped_column(String(10))
    apartment: Mapped[str] = mapped_column(String(10), nullable=True)
    
    # Контактная информация для доставки
    recipient_name: Mapped[str] = mapped_column(String(100))
    recipient_phone: Mapped[str] = mapped_column(String(20))
    
    # Флаги
    is_default: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    
    # Связи
    user: Mapped["User"] = relationship("User", back_populates="addresses")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="shipping_address")

# Таблица заказов пользователей
class Order(Base):
    __tablename__ = "orders"
    
    order_id: Mapped[intpk]
    user_id: Mapped[int] = mapped_column(ForeignKey("users.user_id"))
    shipping_address_id: Mapped[int] = mapped_column(ForeignKey("user_addresses.address_id"))
    payment_method: Mapped[PaymentMethodEnum] = mapped_column(String(20))

    is_paid: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[OrderStatusEnum] = mapped_column(String(20), default=OrderStatusEnum.PROCESSING.value)
    order_date: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    status_updated: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=func.now())
    
    shipping_cost: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    discount: Mapped[float] = mapped_column(DECIMAL(10, 2), default=0)
    
    tracking_number: Mapped[str] = mapped_column(String(100), nullable=True)
    estimated_delivery: Mapped[datetime] = mapped_column(TIMESTAMP, nullable=True)
    
    customer_notes: Mapped[str] = mapped_column(Text, nullable=True)
    admin_notes: Mapped[str] = mapped_column(Text, nullable=True)
    
    user: Mapped["User"] = relationship("User", back_populates="orders")
    shipping_address: Mapped["UserAddress"] = relationship("UserAddress", back_populates="orders")
    order_items: Mapped[list["OrderItem"]] = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")

# Таблица заказанных предметов
class OrderItem(Base):
    __tablename__ = "order_items"
    
    order_item_id: Mapped[intpk]
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.order_id"))
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.part_id"))
    
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    
    order: Mapped["Order"] = relationship("Order", back_populates="order_items")
    part: Mapped["Part"] = relationship("Part", back_populates="order_items")


# Таблица изображений
class Image(Base):
    __tablename__ = "images"

    image_id: Mapped[intpk]
    url: Mapped[str] = mapped_column(String(500))       # полный путь: /static/images/cars/1/car_1_1.jpg
    alt_text: Mapped[str] = mapped_column(String(200), nullable=True)  # альтернативный текст
    sort_order: Mapped[int] = mapped_column(Integer, default=1)   # положение фото

    # Внешние ключи
    car_id: Mapped[int] = mapped_column(ForeignKey("cars.car_id", ondelete="CASCADE"), nullable=True)
    part_id: Mapped[int] = mapped_column(ForeignKey("parts.part_id", ondelete="CASCADE"), nullable=True)

    # Связи
    car: Mapped["Car"] = relationship("Car", back_populates="images")
    part: Mapped["Part"] = relationship("Part", back_populates="images")