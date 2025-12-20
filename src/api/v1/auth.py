# src/api/v1/auth.py
from fastapi import APIRouter, Request, Depends, HTTPException, status, Form
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse

from src.database.database import get_async_session
from src.schemas.user import UserCreate, UserLogin
from src.repositories.user_repo import get_user_by_email, create_user
from src.auth.jwt import create_access_token

from typing import Annotated

router = APIRouter(prefix="/auth", tags=["auth"])
templates = Jinja2Templates(directory="src/templates")

@router.get("/register")
async def register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", {"request": request})


@router.post("/register")
async def register(
    request: Request,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    confirm_password: Annotated[str, Form()],
    first_name: Annotated[str, Form()],
    last_name: Annotated[str, Form()],
    phone_number: Annotated[str, Form()] = "",  # Необязательное поле
    middle_name: Annotated[str, Form()] = "",   # Необязательное поле
    session: AsyncSession = Depends(get_async_session)
):
    # 1. Проверка: пароли совпадают
    if password != confirm_password:
        return templates.TemplateResponse(
            "auth/register.html",
            {
                "request": request,
                "error": "Пароли не совпадают"
            },
            status_code=400
        )

    # 2. Проверка: email уже существует
    existing_user = await get_user_by_email(session, email)
    if existing_user:
        return templates.TemplateResponse(
            "auth/register.html",
            {
                "request": request,
                "error": "Пользователь с таким email уже существует"
            },
            status_code=400
        )

    # 3. Создаём пользователя
    user_data = {
        "email": email,
        "password_hash": password,
        "first_name": first_name,
        "last_name": last_name,
        "middle_name": middle_name if middle_name else None,
        "phone_number": phone_number if phone_number else None
    }
    user = await create_user(session, user_data)

    # 4. Перенаправляем на вход
    return RedirectResponse(
        url="/api/auth/login",
        status_code=303
    )


@router.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@router.post("/login")
async def login(
    request: Request,
    email: Annotated[str, Form()],
    password: Annotated[str, Form()],
    session: AsyncSession = Depends(get_async_session)
):
    # 1. Ищем пользователя
    user = await get_user_by_email(session, email)
    if not user:
        raise HTTPException(status_code=401, detail="Неверный email или пароль")

    if not user.password_hash:
        raise HTTPException(status_code=401, detail="Ошибка сервера")

    # 2. Проверяем пароль
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if not pwd_context.verify(password, user.password_hash):
        return templates.TemplateResponse(
            "auth/login.html",
            {"request": request, "error": "Неверный email или пароль"},
            status_code=401
        )

    # 3. Успешный вход — Генерируем токен и сохраняем в cookie
    access_token = create_access_token(data={"sub": user.email})
    response = RedirectResponse(url="/", status_code=303)
    # Сохраняем токен в HTTP-only cookie для безопасности
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        max_age=60 * 60 * 24 * 7,  # 7 дней
        samesite="lax",
        secure=False  # Установите True in production с HTTPS
    )
    return response


@router.get("/logout")
async def logout(request: Request):
    """Выход из аккаунта - удаляет токен из cookie"""
    response = RedirectResponse(url="/", status_code=303)
    response.delete_cookie(key="access_token")
    return response


@router.get("/me")
async def get_current_user_info(
    request: Request,
    session: AsyncSession = Depends(get_async_session)
):
    """Получает информацию о текущем пользователе"""
    from src.repositories.user_repo import get_user_by_email
    import jwt
    from src.config import JWT_KEY
    
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Не авторизован")
    
    try:
        payload = jwt.decode(token, JWT_KEY, algorithms=["HS256"])
        email = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Неверный токен")
        
        user = await get_user_by_email(session, email)
        if not user:
            raise HTTPException(status_code=401, detail="Пользователь не найден")
        
        return {
            "user_id": user.user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "middle_name": user.middle_name,
            "role": user.role
        }
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Неверный токен")
