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

@router.get("/api/home-cars")
async def get_home_cars():
    from src.database.database import async_session_maker
    from src.repositories.car_repo import search_cars

    async with async_session_maker() as session:
        cars = await search_cars(session, query="", limit=3, offset=0)

    # Подготовка данных для JSON ответа (аналогично cars API)
    cars_data = []
    for car in cars:
        car_data = {
            "car_id": car.car_id,
            "vin": car.vin,
            "production_year": car.production_year,
            "condition": car.condition.value if hasattr(car.condition, 'value') else str(car.condition),
            "mileage": car.mileage,
            "color": car.color,
            "price": float(car.price) if car.price else None,
            "trim": {
                "brand_name": car.trim.brand_name.value if hasattr(car.trim.brand_name, 'value') else str(car.trim.brand_name) if car.trim.brand_name else "",
                "model_name": car.trim.model_name if car.trim.model_name else "",
                "trim_name": car.trim.trim_name if car.trim.trim_name else ""
            },
            "images": [
                {"url": img.url, "alt_text": img.alt_text, "sort_order": img.sort_order}
                for img in sorted(car.images, key=lambda x: x.sort_order)
            ] if car.images else []
        }
        cars_data.append(car_data)

    return {
        "cars": cars_data,
        "total": len(cars_data)
    }

@router.get("/cars")
async def cars_page(request: Request):
    return templates.TemplateResponse(
        "cars.html",
        {"request": request, "title": "Автомобили в продаже"}
    )

@router.get("/cars/{car_id}")
async def car_detail_page(request: Request, car_id: int):
    return templates.TemplateResponse(
        "car_detail.html",
        {"request": request, "title": "Детали автомобиля", "car_id": car_id}
    )
