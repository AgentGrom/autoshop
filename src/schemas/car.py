from pydantic import BaseModel
from typing import List, Optional
from .image import ImageBase

# Отдельно — данные из CarTrim (комплектация)
class CarTrimBase(BaseModel):
    trim_name: Optional[str] = None
    brand_name: str
    model_name: Optional[str] = None
    engine_volume: Optional[float] = None
    engine_power: Optional[int] = None
    engine_torque: Optional[int] = None
    fuel_type: str
    transmission: str
    drive_type: str
    body_type: str
    doors: Optional[int] = None
    seats: Optional[int] = None

# Основная схема автомобиля
class CarBase(BaseModel):
    car_id: int
    vin: str
    production_year: int
    condition: str
    mileage: int
    color: str
    price: float

class CarCreate(CarBase):
    trim_id: int  # при создании

class CarUpdate(BaseModel):
    trim_id: Optional[int] = None
    vin: Optional[str] = None
    production_year: Optional[int] = None
    condition: Optional[str] = None
    mileage: Optional[int] = None
    color: Optional[str] = None
    price: Optional[float] = None

class CarResponse(CarBase):
    trim: CarTrimBase
    images: List[ImageBase] = []

    class Config:
        from_attributes = True  # было: orm_mode = True
