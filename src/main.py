from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

# Импортируем роутеры
from src.api.v1.pages import router as pages_router
from src.api.v1.auth import router as auth_router
from src.api.v1.cars import router as cars_router
from src.api.v1.parts import router as parts_router
from src.api.v1.cart import router as cart_router
from src.api.v1.pickup import router as pickup_router
from src.api.v1.settings import router as settings_router
from src.api.v1.orders import router as orders_router
from src.api.v1.addresses import router as addresses_router
from src.api.v1.account import router as account_router

app = FastAPI(title="Автомагазин")

# Подключаем статику и шаблоны
app.mount("/static", StaticFiles(directory="src/static"), name="static")
templates = Jinja2Templates(directory="src/templates")

# Подключаем роуты
app.include_router(pages_router)      # /, /about и т.д.
app.include_router(auth_router, prefix="/api")  # /api/auth/register, /api/auth/login
app.include_router(cars_router, prefix="/api")  # /api/cars/
app.include_router(parts_router, prefix="/api")  # /api/parts/
app.include_router(cart_router)  # /cart/, /cart/api/...
app.include_router(pickup_router)  # /api/pickup/...
app.include_router(settings_router)  # /api/settings/...
app.include_router(orders_router)  # /orders/...
app.include_router(addresses_router)  # /api/addresses/...
app.include_router(account_router)  # /account/...

# Кастомный 404
@app.exception_handler(404)
async def not_found_handler(request, exc):
    return templates.TemplateResponse(
        "404.html",
        {"request": request, "title": "Страница не найдена"},
        status_code=404
    )
