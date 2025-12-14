from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Импортируем роутеры
from src.api.v1.pages import router as pages_router
from src.api.v1.auth import router as auth_router

app = FastAPI(title="Автомагазин")

# Подключаем статику и шаблоны
app.mount("/static", StaticFiles(directory="src/static"), name="static")
templates = Jinja2Templates(directory="src/templates")

# Подключаем роуты
app.include_router(pages_router)      # /, /about и т.д.
app.include_router(auth_router, prefix="/api")  # /api/auth/register, /api/auth/login

# Кастомный 404
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return templates.TemplateResponse(
        "404.html",
        {"request": request, "title": "Страница не найдена"},
        status_code=404
    )
