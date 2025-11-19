from typing import Annotated

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import BIGINT, SMALLINT, DateTime, ForeignKeyConstraint, MetaData, ForeignKey, String, UniqueConstraint, select, text

from typing import List, Optional

from datetime import datetime

import enum

metadata = MetaData()