from pydantic import BaseModel
from typing import Optional

class ImageBase(BaseModel):
    url: str
    alt_text: Optional[str] = None
    sort_order: int
