# src/auth/jwt.py
from datetime import datetime, timedelta
from typing import Optional
import jwt
from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer

from src.config import JWT_KEY
from src.database.database import get_async_session
from src.repositories.user_repo import get_user_by_email
from src.database.models import User

from sqlalchemy.ext.asyncio import AsyncSession

# Алгоритм и ключ
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 дней

# OAuth2 схема
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """
    Создаёт JWT-токен.
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": int(expire.timestamp())})  # exp должен быть timestamp (int)
    return jwt.encode(to_encode, JWT_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_async_session)
) -> dict:
    """
    Получает текущего пользователя из токена.
    Используется как зависимость.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учётные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, JWT_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = await get_user_by_email(session, email=email)
    if user is None:
        raise credentials_exception
    return user


async def get_current_user_from_cookie(
    request: Request,
    session: AsyncSession = Depends(get_async_session)
):
    """
    Получает текущего пользователя из cookie (для веб-интерфейса).
    Используется как зависимость для роутеров, которые работают с cookie.
    """
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не авторизован",
    )
    
    token = request.cookies.get("access_token")
    if not token:
        raise credentials_exception
    
    try:
        payload = jwt.decode(token, JWT_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    
    user = await get_user_by_email(session, email=email)
    if user is None:
        raise credentials_exception
    return user


async def get_optional_user_from_cookie(
    request: Request,
    session: AsyncSession = Depends(get_async_session)
) -> Optional[User]:
    """
    Получает текущего пользователя из cookie (для веб-интерфейса).
    Возвращает None, если пользователь не авторизован (не выбрасывает исключение).
    Используется для опциональной авторизации.
    """
    token = request.cookies.get("access_token")
    if not token:
        return None
    
    try:
        payload = jwt.decode(token, JWT_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
    except jwt.PyJWTError:
        return None
    
    user = await get_user_by_email(session, email=email)
    return user
