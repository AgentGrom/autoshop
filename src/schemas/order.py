from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from .user import UserAddressBase

class OrderItemBase(BaseModel):
    order_item_id: int
    part_id: int
    quantity: int

class OrderItemResponse(OrderItemBase):
    part_name: str
    part_price: float
    total_price: float

class OrderBase(BaseModel):
    order_id: int
    user_id: int
    shipping_address_id: int
    payment_method: str
    is_paid: bool
    status: str
    order_date: datetime
    shipping_cost: float
    discount: float
    tracking_number: Optional[str] = None
    estimated_delivery: Optional[datetime] = None
    customer_notes: Optional[str] = None
    admin_notes: Optional[str] = None

class OrderCreate(BaseModel):
    user_id: int
    shipping_address_id: int
    payment_method: str
    items: List[dict]  # { part_id: int, quantity: int }

class OrderUpdate(BaseModel):
    status: Optional[str] = None
    is_paid: Optional[bool] = None
    tracking_number: Optional[str] = None
    estimated_delivery: Optional[datetime] = None

class OrderResponse(OrderBase):
    shipping_address: UserAddressBase
    items: List[OrderItemResponse]

    class Config:
        from_attributes = True
