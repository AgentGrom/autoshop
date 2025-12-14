from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime

class UserAddressBase(BaseModel):
    address_id: int
    address_type: str
    postal_code: Optional[str] = None
    country: str
    city: str
    street: str
    house: str
    apartment: Optional[str] = None
    recipient_name: str
    recipient_phone: str
    is_default: bool
    is_active: bool

class UserBase(BaseModel):
    user_id: int
    email: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: str
    status: str
    email_verified: bool
    phone_verified: bool

class UserCreate(BaseModel):
    email: str
    password: str
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None

class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None

class UserResponse(UserBase):
    addresses: List[UserAddressBase] = []

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    user_id: int
    email: EmailStr
    first_name: str
    last_name: str
    middle_name: Optional[str] = None
    phone_number: Optional[str] = None
    role: str
    status: str
    email_verified: bool
    phone_verified: bool
    registration_date: datetime

    class Config:
        from_attributes = True