"""add_is_visible_to_cars

Revision ID: 349a655aefa4
Revises: e8f6e34becef
Create Date: 2025-12-22 01:33:51.375950

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '349a655aefa4'
down_revision: Union[str, Sequence[str], None] = 'e8f6e34becef'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('cars', sa.Column('is_visible', sa.Boolean(), nullable=False, server_default='true'))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('cars', 'is_visible')
