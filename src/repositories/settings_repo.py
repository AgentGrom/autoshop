from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from src.database.models import Setting


async def get_setting(session: AsyncSession, key: str) -> Optional[Setting]:
    """Получает настройку по ключу"""
    result = await session.execute(
        select(Setting)
        .where(Setting.key == key)
    )
    return result.scalar_one_or_none()


async def get_setting_value(session: AsyncSession, key: str, default: str = "0") -> str:
    """Получает значение настройки по ключу, возвращает default если не найдено"""
    setting = await get_setting(session, key)
    return setting.value if setting else default


async def get_setting_float(session: AsyncSession, key: str, default: float = 0.0) -> float:
    """Получает значение настройки как float"""
    value = await get_setting_value(session, key, str(default))
    try:
        return float(value)
    except (ValueError, TypeError):
        return default


async def set_setting(session: AsyncSession, key: str, value: str, description: Optional[str] = None) -> Setting:
    """Устанавливает значение настройки (создаёт, если не существует)"""
    setting = await get_setting(session, key)
    
    if setting:
        setting.value = value
        if description:
            setting.description = description
    else:
        setting = Setting(
            key=key,
            value=value,
            description=description
        )
        session.add(setting)
    
    await session.commit()
    await session.refresh(setting)
    return setting

