# src/auth/verification_codes.py
"""
Временное хранилище кодов верификации в памяти.
В production следует использовать Redis или базу данных.
"""
import time
from typing import Dict, Optional, Tuple

# Хранилище: {user_id: {type: (code, timestamp), ...}}
_verification_codes: Dict[int, Dict[str, Tuple[str, float]]] = {}

# Время жизни кода в секундах (10 минут)
CODE_TTL = 600


def store_verification_code(user_id: int, verification_type: str, code: str) -> None:
    """Сохранить код верификации для пользователя"""
    if user_id not in _verification_codes:
        _verification_codes[user_id] = {}
    
    _verification_codes[user_id][verification_type] = (code, time.time())


def verify_code(user_id: int, verification_type: str, code: str) -> bool:
    """
    Проверить код верификации.
    Возвращает True если код верный и не истек, False в противном случае.
    """
    if user_id not in _verification_codes:
        return False
    
    if verification_type not in _verification_codes[user_id]:
        return False
    
    stored_code, timestamp = _verification_codes[user_id][verification_type]
    
    # Проверяем, не истек ли код
    if time.time() - timestamp > CODE_TTL:
        # Удаляем истекший код
        del _verification_codes[user_id][verification_type]
        if not _verification_codes[user_id]:
            del _verification_codes[user_id]
        return False
    
    # Проверяем код
    if stored_code != code:
        return False
    
    # Код верный - удаляем его (одноразовое использование)
    del _verification_codes[user_id][verification_type]
    if not _verification_codes[user_id]:
        del _verification_codes[user_id]
    
    return True


def clear_verification_code(user_id: int, verification_type: str) -> None:
    """Удалить код верификации (например, после успешной верификации)"""
    if user_id in _verification_codes:
        if verification_type in _verification_codes[user_id]:
            del _verification_codes[user_id][verification_type]
        if not _verification_codes[user_id]:
            del _verification_codes[user_id]

