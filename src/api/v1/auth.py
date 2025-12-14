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
    phone_number: Annotated[str, Form()],
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
        "phone_number": phone_number
    }
    user = await create_user(session, user_data)

    # 4. Перенаправляем на вход (можно сделать redirect, но пока — через шаблон)
    return RedirectResponse(
        "/login"
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

    # 3. Успешный вход — Генерируем токен
    access_token = create_access_token(data={"sub": user.email})
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }
