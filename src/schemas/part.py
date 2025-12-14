from pydantic import BaseModel
from typing import List, Optional
from .image import ImageBase

class PartSpecificationBase(BaseModel):
    spec_name: str
    spec_value: str
    spec_unit: Optional[str] = None

class PartCategoryBase(BaseModel):
    category_id: int
    category_name: str
    parent_id: Optional[int] = None

class PartBase(BaseModel):
    part_id: int
    part_name: str
    part_article: Optional[str] = None
    description: str
    price: float
    stock_count: int
    manufacturer: str

class PartCreate(PartBase):
    category_id: int

class PartUpdate(BaseModel):
    part_name: Optional[str] = None
    part_article: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    stock_count: Optional[int] = None
    manufacturer: Optional[str] = None
    category_id: Optional[int] = None

class PartResponse(PartBase):
    category: PartCategoryBase
    specifications: List[PartSpecificationBase] = []
    images: List[ImageBase] = []

    class Config:
        from_attributes = True
