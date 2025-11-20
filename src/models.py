from typing import Annotated

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import (
    Integer, 
    DateTime, 
    ForeignKeyConstraint, 
    MetaData, 
    ForeignKey, 
    String, 
    UniqueConstraint, 
    Text, 
    DECIMAL
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
    PENDING = "Ожидание оплаты"
    PAID = "Оплачен"
    SHIPPED = "Отправлен"
    DELIVERED = "Доставлен"
    CANCELLED = "Отменен"

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
    category: Mapped['PartCategory'] = relationship('part_categories', back_populates="part") 

    # Связь с таблицей спецификаций
    specifications: Mapped[List['PartSpecification']] = relationship('part_specification', back_populates="part") 


class PartSpecification(Base):
    __tablename__ = 'part_specifications'

    spec_id: Mapped[intpk]
    part_id: Mapped[int] = mapped_column(ForeignKey('parts.part_id'))  # Внешний ключ с таблицей запчастей
    spec_name: Mapped[str] = mapped_column(String(50))
    spec_value: Mapped[str] = mapped_column(String(100))               # Значение спецификации
    spec_unit: Mapped[str] = mapped_column(String(20), nullable=True)  # Единица измерения
    
    # Связь с таблицей запчастей
    part: Mapped['Part'] = relationship('parts', back_populates='specifications')


class PartCategory(Base):
    __tablename__ = 'part_categories'

    category_id: Mapped[intpk]
    category_name: Mapped[str] = mapped_column(String(50))

    parent_id: Mapped[int] = mapped_column(ForeignKey('part_categories.category_id'), nullable=True)

    parent: Mapped['PartCategory'] = relationship(
        'part_categories', 
        remote_side=lambda: PartCategory.category_id, 
        back_populates='childrens'
    )

    childrens: Mapped[List['PartCategory']] = relationship(
        'part_categories', 
        back_populates='parent', 
        cascade='all, delete-orphan'
    )

    part: Mapped[List['Part']] = relationship('parts', back_populates='category')
