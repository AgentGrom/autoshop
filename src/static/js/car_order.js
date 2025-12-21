// src/static/js/car_order.js
// Логика оформления заказа автомобиля

let carData = null;
let orderFees = null;

// Получение ID автомобиля из URL
function getCarIdFromUrl() {
    const path = window.location.pathname;
    const match = path.match(/\/orders\/car\/(\d+)/);
    return match ? parseInt(match[1]) : null;
}

// Загрузка данных автомобиля и настроек
async function loadOrderData() {
    const loader = document.getElementById('order-loader');
    const error = document.getElementById('order-error');
    const formContainer = document.getElementById('order-form-container');
    
    const carId = getCarIdFromUrl();
    if (!carId) {
        loader.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('order-error-message').textContent = 'Некорректный идентификатор автомобиля';
        return;
    }
    
    try {
        // Загружаем данные автомобиля
        const carResponse = await fetch(`/api/cars/${carId}`, {
            credentials: 'include'
        });
        if (!carResponse.ok) {
            if (carResponse.status === 403) {
                // Аккаунт не активирован
                loader.style.display = 'none';
                error.style.display = 'block';
                document.getElementById('order-error-message').innerHTML = `
                    <strong>Аккаунт не активирован</strong><br>
                    Для оформления заказа необходимо подтвердить ваш email.<br>
                    <a href="/account" style="color: #1976d2; text-decoration: underline; margin-top: 10px; display: inline-block;">Перейти в личный кабинет</a>
                `;
                return;
            }
            throw new Error('Автомобиль не найден');
        }
        carData = await carResponse.json();
        
        // Загружаем настройки сборов
        const feesResponse = await fetch('/api/settings/order-fees');
        if (feesResponse.ok) {
            orderFees = await feesResponse.json();
        } else {
            orderFees = { car_service_fee: 5000, car_delivery_cost: 0 };
        }
        
        // Загружаем список стран
        await loadCountries();
        
        // Отображаем данные
        renderCarInfo();
        updateOrderSummary();
        
        loader.style.display = 'none';
        formContainer.style.display = 'block';
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('order-error-message').textContent = err.message || 'Ошибка загрузки данных';
    }
}

// Отображение информации об автомобиле
function renderCarInfo() {
    const container = document.getElementById('car-info-card');
    if (!carData) return;
    
    const car = carData;
    const price = car.price ? formatPrice(car.price) : 'Цена по запросу';
    const mileage = car.mileage ? `${formatPrice(car.mileage)} км` : '—';
    const color = car.color || '—';
    const condition = car.condition || '—';
    
    // Карусель изображений
    let imagesHtml = '';
    if (car.images && car.images.length > 0) {
        const imagesList = car.images.map(image =>
            `<img src="${image.url}" alt="${car.trim.brand_name} ${car.trim.model_name}" class="carousel-image" onerror="this.onerror=null;this.src='/static/images/cars/base.jpeg';">`
        ).join('');
        
        imagesHtml = `
            <div class="image-carousel">
                <div class="carousel-wrapper">
                    ${imagesList}
                </div>
                <div class="carousel-controls">
                    <button class="carousel-btn carousel-prev">‹</button>
                    <button class="carousel-btn carousel-next">›</button>
                </div>
                <div class="carousel-indicators"></div>
            </div>
        `;
    } else {
        imagesHtml = `
            <div class="image-carousel">
                <div class="carousel-wrapper">
                    <img src="/static/images/cars/base.jpeg" alt="Фото отсутствует" class="carousel-image">
                </div>
            </div>
        `;
    }
    
    container.innerHTML = `
        <div class="car-info-image">
            ${imagesHtml}
        </div>
        <div class="car-info-details">
            <h4>${car.trim.brand_name} ${car.trim.model_name}</h4>
            <div class="car-info-item">
                <span>Год:</span>
                <span>${car.production_year}</span>
            </div>
            <div class="car-info-item">
                <span>Пробег:</span>
                <span>${mileage}</span>
            </div>
            <div class="car-info-item">
                <span>Цвет:</span>
                <span>${color}</span>
            </div>
            <div class="car-info-item">
                <span>Состояние:</span>
                <span>${condition}</span>
            </div>
            <div class="car-info-price">
                <span>Цена:</span>
                <span>${price} ₽</span>
            </div>
        </div>
    `;
    
    // Инициализируем карусель
    initializeCarousel(container.querySelector('.image-carousel'));
}

// Инициализация карусели (адаптировано из cars.js)
function initializeCarousel(carousel) {
    if (!carousel) return;
    
    const images = Array.from(carousel.querySelectorAll('.carousel-image'));
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const controls = carousel.querySelector('.carousel-controls');
    const indicatorsContainer = carousel.querySelector('.carousel-indicators');

    // Если изображений меньше 2, скрываем элементы управления
    if (images.length <= 1) {
        if (controls) controls.style.display = 'none';
        if (indicatorsContainer) indicatorsContainer.style.display = 'none';
        return;
    }

    // Показываем элементы управления
    if (controls) {
        controls.style.display = 'flex';
    }

    let currentIndex = 0;
    let isAnimating = false;

    // Устанавливаем стили для обертки
    const wrapper = carousel.querySelector('.carousel-wrapper');
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    wrapper.style.width = '100%';
    wrapper.style.height = '300px';

    // Устанавливаем стили для изображений
    images.forEach((img, index) => {
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '300px';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.opacity = index === 0 ? '1' : '0';
        img.style.transition = 'opacity 0.5s ease-in-out';
    });

    // Создаем индикаторы внутри wrapper для правильного позиционирования
    const indicatorsWrapper = document.createElement('div');
    indicatorsWrapper.className = 'carousel-indicators';
    indicatorsWrapper.style.position = 'absolute';
    indicatorsWrapper.style.bottom = '20px';
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
    
    // Скрываем старый контейнер индикаторов, если он есть
    if (indicatorsContainer) {
        indicatorsContainer.style.display = 'none';
    }

    // Добавляем кнопки навигации внутрь wrapper
    if (prevBtn && nextBtn) {
        prevBtn.style.position = 'absolute';
        prevBtn.style.left = '10px';
        prevBtn.style.top = '50%';
        prevBtn.style.transform = 'translateY(-50%)';
        prevBtn.style.zIndex = '30';
        prevBtn.style.pointerEvents = 'auto';
        prevBtn.style.opacity = '0';

        nextBtn.style.position = 'absolute';
        nextBtn.style.right = '10px';
        nextBtn.style.top = '50%';
        nextBtn.style.transform = 'translateY(-50%)';
        nextBtn.style.zIndex = '30';
        nextBtn.style.pointerEvents = 'auto';
        nextBtn.style.opacity = '0';
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

    // Функция перехода к слайду
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

// Обновление итоговой суммы
function updateOrderSummary() {
    if (!carData || !orderFees) return;
    
    const carPrice = carData.price ? parseFloat(carData.price) : 0;
    const serviceFee = orderFees.car_service_fee || 0;
    const deliveryCost = orderFees.car_delivery_cost || 0;
    const total = carPrice + serviceFee + deliveryCost;
    
    document.getElementById('car-price').textContent = `${formatPrice(carPrice)} ₽`;
    document.getElementById('service-fee').textContent = `${formatPrice(serviceFee)} ₽`;
    document.getElementById('delivery-cost').textContent = `${formatPrice(deliveryCost)} ₽`;
    document.getElementById('total-amount').textContent = `${formatPrice(total)} ₽`;
}

// Загрузка списка стран
async function loadCountries() {
    try {
        const response = await fetch('/api/pickup/countries');
        const data = await response.json();
        
        const select = document.getElementById('country-select');
        select.innerHTML = '<option value="">Выберите страну</option>';
        data.countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            select.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки стран:', err);
    }
}

// Загрузка списка областей
async function loadRegions(country) {
    const select = document.getElementById('region-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/regions?country=${encodeURIComponent(country)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите область</option>';
        data.regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            select.appendChild(option);
        });
        select.disabled = false;
        
        // Сбрасываем зависимые поля
        document.getElementById('city-select').innerHTML = '<option value="">Сначала выберите область</option>';
        document.getElementById('city-select').disabled = true;
        document.getElementById('pickup-point-select').innerHTML = '<option value="">Сначала выберите город</option>';
        document.getElementById('pickup-point-select').disabled = true;
    } catch (err) {
        console.error('Ошибка загрузки областей:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Загрузка списка городов
async function loadCities(country, region) {
    const select = document.getElementById('city-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/cities?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите город</option>';
        data.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            select.appendChild(option);
        });
        select.disabled = false;
        
        // Сбрасываем пункты выдачи
        document.getElementById('pickup-point-select').innerHTML = '<option value="">Сначала выберите город</option>';
        document.getElementById('pickup-point-select').disabled = true;
    } catch (err) {
        console.error('Ошибка загрузки городов:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Загрузка списка пунктов выдачи
async function loadPickupPoints(country, region, city) {
    const select = document.getElementById('pickup-point-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/points?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите пункт выдачи</option>';
        data.points.forEach(point => {
            const option = document.createElement('option');
            option.value = point.pickup_point_id;
            option.textContent = point.address;
            select.appendChild(option);
        });
        select.disabled = false;
    } catch (err) {
        console.error('Ошибка загрузки пунктов выдачи:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Оформление заказа
async function submitOrder() {
    const carId = getCarIdFromUrl();
    const pickupPointId = document.getElementById('pickup-point-select').value;
    const paymentMethod = document.getElementById('payment-method-select').value;
    const customerNotes = document.getElementById('customer-notes').value;
    
    if (!pickupPointId || !paymentMethod) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    const submitBtn = document.getElementById('submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Оформление...';
    
    try {
        const response = await fetch('/orders/api/create-car-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                car_id: carId,
                pickup_point_id: parseInt(pickupPointId),
                payment_method: paymentMethod,
                customer_notes: customerNotes || null
            })
        });
        
        if (!response.ok) {
            if (response.status === 403) {
                // Аккаунт не активирован
                alert('Для оформления заказа необходимо активировать аккаунт. Пожалуйста, подтвердите ваш email в личном кабинете.');
                window.location.href = '/account';
                return;
            }
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        alert(`Заказ успешно оформлен! Номер заказа: ${data.order_id}`);
        window.location.href = '/';
    } catch (err) {
        console.error('Ошибка оформления заказа:', err);
        await showError(err, 'Ошибка оформления заказа');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить заказ';
    }
}

// Утилиты
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadOrderData();
    
    // Обработчики для каскадных списков
    document.getElementById('country-select').addEventListener('change', (e) => {
        if (e.target.value) {
            loadRegions(e.target.value);
        }
    });
    
    document.getElementById('region-select').addEventListener('change', (e) => {
        const country = document.getElementById('country-select').value;
        if (country && e.target.value) {
            loadCities(country, e.target.value);
        }
    });
    
    document.getElementById('city-select').addEventListener('change', (e) => {
        const country = document.getElementById('country-select').value;
        const region = document.getElementById('region-select').value;
        if (country && region && e.target.value) {
            loadPickupPoints(country, region, e.target.value);
        }
    });
    
    // Обработчик кнопки оформления заказа
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
});

