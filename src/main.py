from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
import asyncio


app = FastAPI(title = 'Автомагазин')

app.mount("/static", StaticFiles(directory="src/static"), name="static")
templates = Jinja2Templates(directory="src/templates")
# app.include_router(api_router, prefix="/api")

@app.get('/')
async def main(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "message": "Привет!"}
    )

@app.exception_handler(404)
async def not_found_handler(request: Request, exc):
    """Кастомный обработчик для ошибки 404"""
    return templates.TemplateResponse(
        "404.html",  # Можно создать позже
        {
            "request": request,
            "title": "Страница не найдена"
        },
        status_code=404
    )