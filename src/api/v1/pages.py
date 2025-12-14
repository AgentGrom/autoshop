from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates  

router = APIRouter()
templates = Jinja2Templates(directory="src/templates")

@router.get("/")
async def home(request: Request):
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "message": "Добро пожаловать!"}
    )

@router.get("/about")
async def about(request: Request):
    return templates.TemplateResponse(
        "about.html",
        {"request": request, "title": "О нас"}
    )
