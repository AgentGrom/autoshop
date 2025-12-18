// Глобальная переменная для хранения данных автомобиля
let carData = null;

function getCarIdFromDom() {
    const container = document.querySelector('.car-detail-container');
    const raw = container?.getAttribute('data-car-id');
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await loadCarData();
});

// Загрузка данных автомобиля
async function loadCarData() {
    const loader = document.getElementById('loader');
    const carContent = document.getElementById('car-content');
    const errorMessage = document.getElementById('error-message');

    try {
        const carId = getCarIdFromDom();
        if (!carId) {
            throw new Error('Некорректный идентификатор автомобиля');
        }

        const response = await fetch(`/api/cars/${carId}`);
        
        if (!response.ok) {
            throw new Error('Автомобиль не найден');
        }

        carData = await response.json();
        
        // Скрываем лоадер и показываем контент
        loader.style.display = 'none';
        carContent.style.display = 'block';
        
        // Заполняем страницу данными
        renderCarDetails();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loader.style.display = 'none';
        errorMessage.style.display = 'block';
    }
}

// Отображение деталей автомобиля
function renderCarDetails() {
    // Заголовок - марка и модель в одну строку
    const title = document.getElementById('car-title');
    const brand = carData.trim.brand_name || '';
    const model = carData.trim.model_name || '';
    title.textContent = `${brand} ${model}`.trim() || 'Автомобиль';

    // Карусель изображений
    renderCarousel();

    // Цена
    const priceElement = document.getElementById('car-price');
    if (carData.price) {
        priceElement.textContent = `${formatPrice(carData.price)} ₽`;
    } else {
        priceElement.textContent = 'Цена по запросу';
    }

    // Обработчик кнопки "Купить"
    const buyBtn = document.getElementById('buy-btn');
    buyBtn.addEventListener('click', () => {
        alert('Функция покупки будет реализована позже');
    });

    // Характеристики
    renderSpecifications();
}

// Отображение карусели изображений (полностью как в cars.js)
function renderCarousel() {
    const carouselContainer = document.getElementById('car-carousel');
    
    let imagesHtml = '';
    
    if (!carData.images || carData.images.length === 0) {
        imagesHtml = `
            <div class="carousel-wrapper">
                <img src="/static/images/cars/base.jpeg" alt="Фото отсутствует" class="carousel-image">
            </div>
            <div class="carousel-controls">
                <button class="carousel-btn carousel-prev">‹</button>
                <button class="carousel-btn carousel-next">›</button>
            </div>
        `;
    } else {
        const imagesList = carData.images.map(image =>
            `<img src="${image.url}" alt="${image.alt_text || 'Изображение автомобиля'}" class="carousel-image">`
        ).join('');

        imagesHtml = `
            <div class="carousel-wrapper">
                ${imagesList}
            </div>
            <div class="carousel-controls">
                <button class="carousel-btn carousel-prev">‹</button>
                <button class="carousel-btn carousel-next">›</button>
            </div>
        `;
    }
    
    carouselContainer.innerHTML = imagesHtml;
    
    // Инициализация карусели
    initializeCarousel(carouselContainer);
}

// Инициализация карусели (полностью скопировано из cars.js, только высота изменена)
function initializeCarousel(carousel) {
    const images = Array.from(carousel.querySelectorAll('.carousel-image'));
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const controls = carousel.querySelector('.carousel-controls');

    // Если изображений меньше 2, скрываем элементы управления
    if (images.length <= 1) {
        if (controls) controls.style.display = 'none';
        return;
    }

    // Показываем элементы управления
    if (controls) {
        controls.style.display = 'flex';
    }

    let currentIndex = 0;
    let isAnimating = false;

    // Определяем высоту карусели (600px для детальной страницы вместо 300px)
    const carouselHeight = window.innerWidth <= 768 ? '350px' : '600px';

    // Устанавливаем стили для обертки
    const wrapper = carousel.querySelector('.carousel-wrapper');
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';

    // Устанавливаем стили для изображений
    images.forEach((img, index) => {
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '100%'; // Leave space for indicators
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.opacity = index === 0 ? '1' : '0';
        img.style.transition = 'opacity 0.5s ease-in-out';
    });

    // Создаем индикаторы внутри wrapper
    const indicatorsWrapper = document.createElement('div');
    indicatorsWrapper.className = 'carousel-indicators';
    indicatorsWrapper.style.position = 'absolute';
    indicatorsWrapper.style.bottom = '20px';  // Align with CSS
    indicatorsWrapper.style.left = '50%';
    indicatorsWrapper.style.transform = 'translateX(-50%)';
    indicatorsWrapper.style.display = 'flex';
    indicatorsWrapper.style.gap = '6px';
    indicatorsWrapper.style.zIndex = '30';
    indicatorsWrapper.style.pointerEvents = 'auto';

    images.forEach((img, index) => {
        const indicator = document.createElement('div');
        indicator.classList.add('indicator');
        if (index === 0) indicator.classList.add('active');

        indicator.addEventListener('click', () => {
            goToSlide(index);
        });

        indicatorsWrapper.appendChild(indicator);
    });

    // Добавляем индикаторы в wrapper
    wrapper.appendChild(indicatorsWrapper);

    // Добавляем кнопки навигации внутрь wrapper
    if (prevBtn && nextBtn) {
        prevBtn.style.position = 'absolute';
        prevBtn.style.left = '10px';
        prevBtn.style.top = '50%';
        prevBtn.style.transform = 'translateY(-50%)';
        prevBtn.style.zIndex = '30';
        prevBtn.style.pointerEvents = 'auto';
        prevBtn.style.opacity = '0'; // Скрыты по умолчанию

        nextBtn.style.position = 'absolute';
        nextBtn.style.right = '10px';
        nextBtn.style.top = '50%';
        nextBtn.style.transform = 'translateY(-50%)';
        nextBtn.style.zIndex = '30';
        nextBtn.style.pointerEvents = 'auto';
        nextBtn.style.opacity = '0'; // Скрыты по умолчанию
    }

    // Обработчики наведения для появления/скрытия кнопок
    carousel.addEventListener('mouseenter', () => {
        if (prevBtn && nextBtn) {
            prevBtn.style.opacity = '1';
            nextBtn.style.opacity = '1';
        }
    });

    carousel.addEventListener('mouseleave', () => {
        if (prevBtn && nextBtn) {
            prevBtn.style.opacity = '0';
            nextBtn.style.opacity = '0';
        }
    });

    // Обработчики кнопок
    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newIndex = (currentIndex - 1 + images.length) % images.length;
            goToSlide(newIndex);
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newIndex = (currentIndex + 1) % images.length;
            goToSlide(newIndex);
        });
    }

    // Функция переключения слайдов
    function goToSlide(targetIndex) {
        if (isAnimating) {
            return;
        }

        if (targetIndex >= images.length) {
            targetIndex = 0;
        }
        if (targetIndex < 0) {
            targetIndex = images.length - 1;
        }

        if (targetIndex === currentIndex) {
            return;
        }

        isAnimating = true;

        images[currentIndex].style.transition = 'opacity 0.5s ease-in-out';
        images[currentIndex].style.opacity = '0';
        images[targetIndex].style.opacity = '1';

        const indicators = carousel.querySelectorAll('.indicator');
        indicators.forEach((ind, i) => {
            ind.classList.toggle('active', i === targetIndex);
        });

        setTimeout(() => {
            isAnimating = false;
            currentIndex = targetIndex;
        }, 500);
    }

    // Инициализация
    goToSlide(0);

    // Автопрокрутка
    if (images.length > 1) {
        let intervalId;
        let isPaused = false;

        function startAutoplay() {
            intervalId = setInterval(() => {
                if (!isPaused) {
                    const newIndex = (currentIndex + 1) % images.length;
                    goToSlide(newIndex);
                }
            }, 5000);
        }

        carousel.addEventListener('mouseenter', () => {
            isPaused = true;
        });

        carousel.addEventListener('mouseleave', () => {
            isPaused = false;
        });

        startAutoplay();
    }
}

// Отображение характеристик
function renderSpecifications() {
    const specsContainer = document.getElementById('car-specs');
    const specs = [];

    // Основные характеристики автомобиля
    if (carData.vin) {
        specs.push({ label: 'VIN', value: carData.vin });
    }
    if (carData.production_year) {
        specs.push({ label: 'Год выпуска', value: carData.production_year });
    }
    if (carData.condition) {
        specs.push({ label: 'Состояние', value: carData.condition });
    }
    if (carData.mileage !== null && carData.mileage !== undefined) {
        specs.push({ label: 'Пробег', value: `${formatNumber(carData.mileage)} км` });
    }
    if (carData.color) {
        specs.push({ label: 'Цвет', value: carData.color });
    }

    // Характеристики комплектации
    if (carData.trim.trim_name) {
        specs.push({ label: 'Комплектация', value: carData.trim.trim_name });
    }
    if (carData.trim.body_type) {
        specs.push({ label: 'Тип кузова', value: carData.trim.body_type });
    }
    if (carData.trim.engine_volume) {
        specs.push({ label: 'Объем двигателя', value: `${carData.trim.engine_volume} л` });
    }
    if (carData.trim.engine_power) {
        specs.push({ label: 'Мощность', value: `${carData.trim.engine_power} л.с.` });
    }
    if (carData.trim.engine_torque) {
        specs.push({ label: 'Крутящий момент', value: `${carData.trim.engine_torque} Н·м` });
    }
    if (carData.trim.fuel_type) {
        specs.push({ label: 'Тип топлива', value: carData.trim.fuel_type });
    }
    if (carData.trim.transmission) {
        specs.push({ label: 'Коробка передач', value: carData.trim.transmission });
    }
    if (carData.trim.drive_type) {
        specs.push({ label: 'Привод', value: carData.trim.drive_type });
    }
    if (carData.trim.doors) {
        specs.push({ label: 'Количество дверей', value: carData.trim.doors });
    }
    if (carData.trim.seats) {
        specs.push({ label: 'Количество мест', value: carData.trim.seats });
    }

    // Создаём HTML для характеристик
    let specsHtml = '';
    specs.forEach(spec => {
        specsHtml += `
            <div class="car-spec-item">
                <span class="car-spec-label">${spec.label}:</span>
                <span class="car-spec-value">${spec.value}</span>
            </div>
        `;
    });

    specsContainer.innerHTML = specsHtml;
}

// Вспомогательные функции форматирования
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

function formatNumber(number) {
    return new Intl.NumberFormat('ru-RU').format(number);
}
