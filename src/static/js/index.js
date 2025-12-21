document.addEventListener('DOMContentLoaded', function () {
    const switchElement = document.querySelector('.search-switch');
    const switchButtons = document.querySelectorAll('.switch-btn');
    const searchInput = document.querySelector('.search-input');
    const clearBtn = document.querySelector('.clear-btn');
    const hintText = document.getElementById('search-hint-text');

    // Храним поисковые строки отдельно
    let queries = {
        cars: '',
        parts: ''
    };

    let activeType = 'cars';

    // Обновление плейсхолдера и подсказки
    function updateSearchPlaceholder(type) {
        if (type === 'cars') {
            searchInput.placeholder = "Введите марку, модель или VIN код...";
            hintText.textContent = "Ищите автомобили по марке, модели или VIN коду";
        } else {
            searchInput.placeholder = "Введите название запчасти или артикул...";
            hintText.textContent = "Ищите запчасти по названию, артикулу или характеристикам";
        }
    }

    // Переключение типа поиска
    switchButtons.forEach(button => {
        button.addEventListener('click', function () {
            const type = this.getAttribute('data-type');

            // Сохраняем текущий запрос перед переключением
            queries[activeType] = searchInput.value;

            // Переключаем UI
            switchButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            switchElement.setAttribute('data-active', type);
            activeType = type;

            // Подставляем сохранённый запрос
            searchInput.value = queries[type] || '';

            // Обновляем подсказку
            updateSearchPlaceholder(type);

            // Управляем видимостью крестика
            toggleClearButton();

            // Фокус
            searchInput.focus();
        });
    });

    // Кнопка "очистить"
    clearBtn.addEventListener('click', function () {
        searchInput.value = '';
        queries[activeType] = '';
        toggleClearButton();
        searchInput.focus();
    });

    // Показать/скрыть крестик
    function toggleClearButton() {
        if (searchInput.value) {
            clearBtn.style.opacity = '0.6';
        } else {
            clearBtn.style.opacity = '0';
        }
    }

    // Отслеживаем ввод
    searchInput.addEventListener('input', toggleClearButton);
    searchInput.addEventListener('focus', toggleClearButton);
    searchInput.addEventListener('blur', () => {
        setTimeout(() => {
            if (!searchInput.value) {
                clearBtn.style.opacity = '0';
            }
        }, 100);
    });

    // Обработка отправки формы
    document.querySelector('.search-form').addEventListener('submit', function (e) {
        e.preventDefault();
        const query = searchInput.value.trim();

        if (!query) {
            alert('Пожалуйста, введите поисковый запрос');
            searchInput.focus();
            return;
        }

        // Обновляем текущий запрос
        queries[activeType] = query;

        // Перенаправляем на соответствующую страницу с параметром query
        if (activeType === 'cars') {
            window.location.href = `/cars?query=${encodeURIComponent(query)}`;
        } else if (activeType === 'parts') {
            window.location.href = `/parts?query=${encodeURIComponent(query)}`;
        }
    });

    // Инициализация
    updateSearchPlaceholder(activeType);
    toggleClearButton();
});


// Функция для создания карточки автомобиля
function createCarCard(car) {
    const carCard = document.createElement('div');
    carCard.className = 'item-card';

    let imagesHtml = '';
    if (car.images && car.images.length > 0) {
        // Сортируем изображения по sort_order
        const sortedImages = [...car.images].sort((a, b) => a.sort_order - b.sort_order);

        if (sortedImages.length > 1) {
            // Несколько изображений - показываем карусель с элементами управления
            imagesHtml = `
                <div class="image-carousel">
                    <div class="carousel-wrapper">
                        ${sortedImages.map(image =>
                            `<img src="${image.url}" alt="${car.trim.brand_name} ${car.trim.model_name}" class="carousel-image" onerror="this.onerror=null;this.src='/static/images/cars/base.jpeg';">`
                        ).join('')}
                    </div>
                    <div class="carousel-controls">
                        <button class="carousel-btn carousel-prev">‹</button>
                        <button class="carousel-btn carousel-next">›</button>
                    </div>
                    <div class="carousel-indicators"></div>
                </div>
            `;
        } else {
            // Одно изображение - без элементов управления
            imagesHtml = `
                <div class="image-carousel">
                    <div class="carousel-wrapper">
                        <img src="${sortedImages[0].url}" alt="${car.trim.brand_name} ${car.trim.model_name}" class="carousel-image" onerror="this.onerror=null;this.src='/static/images/cars/base.jpeg';">
                    </div>
                </div>
            `;
        }
    } else {
        // Нет изображений - используем изображение по умолчанию
        imagesHtml = `
            <div class="image-carousel">
                <div class="carousel-wrapper">
                    <img src="/static/images/cars/base.jpeg" alt="Фото отсутствует" class="carousel-image">
                </div>
            </div>
        `;
    }

    const price = car.price ? parseFloat(car.price).toLocaleString('ru-RU') : 'Цена по запросу';

    const mileage = (car.mileage !== null && car.mileage !== undefined) ? `${parseInt(car.mileage).toLocaleString('ru-RU')} км` : '—';
    const color = car.color || '—';

    carCard.innerHTML =
        imagesHtml +
        `<h3 class="item-title">${car.trim.brand_name} ${car.trim.model_name}</h3>` +
        `<div class="item-info">Пробег: ${mileage}</div>` +
        `<div class="item-info">Цвет: ${color}</div>` +
        `<div class="item-info">Состояние: ${car.condition}</div>` +
        `<div class="item-info">Год: ${car.production_year}</div>` +
        `<div class="item-price">${price} ₽</div>` +
        `<div class="item-actions">
            <a href="/cars/${car.car_id}" class="btn btn-primary">Подробнее об автомобиле</a>
        </div>`;

    return carCard;
}

// Загрузка автомобилей для главной страницы
async function loadHomeCars() {
    try {
        const response = await fetch('/api/home-cars');
        const data = await response.json();

        const container = document.getElementById('home-cars-container');
        const loader = document.getElementById('home-cars-loader');

        // Скрываем лоадер
        loader.style.display = 'none';

        if (data.cars && data.cars.length > 0) {
            // Очищаем контейнер
            container.innerHTML = '';

            // Добавляем автомобили
            data.cars.forEach(car => {
                const carCard = createCarCard(car);
                container.appendChild(carCard);
            });

            // Инициализируем карусели для новых элементов
            initializeCarousels();
        } else {
            // Если нет автомобилей, показываем заглушку
            const fallback = document.getElementById('home-cars-fallback');
            fallback.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка при загрузке автомобилей:', error);

        // Показываем заглушку в случае ошибки
        const loader = document.getElementById('home-cars-loader');
        const fallback = document.getElementById('home-cars-fallback');

        loader.style.display = 'none';
        fallback.style.display = 'block';
    }
}

// Функция для создания карточки запчасти (как в части запчастей, но компактно для главной)
function createPartCard(part) {
    const partCard = document.createElement('div');
    partCard.className = 'item-card';

    let imagesHtml = '';
    if (part.images && part.images.length > 0) {
        const sortedImages = [...part.images].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
        if (sortedImages.length > 1) {
            imagesHtml = `
                <div class="image-carousel">
                    <div class="carousel-wrapper">
                        ${sortedImages.map(img => `<img src="${img.url}" alt="${img.alt_text || part.part_name}" class="carousel-image">`).join('')}
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
                        <img src="${sortedImages[0].url}" alt="${sortedImages[0].alt_text || part.part_name}" class="carousel-image">
                    </div>
                </div>
            `;
        }
    } else {
        imagesHtml = `
            <div class="image-carousel">
                <div class="carousel-wrapper">
                    <img src="/static/images/parts/base.png" alt="Фото отсутствует" class="carousel-image">
                </div>
            </div>
        `;
    }

    const price = part.price ? Number(part.price).toLocaleString('ru-RU') : 'Цена по запросу';
    const manufacturer = part.manufacturer || '—';
    const article = part.part_article || '—';
    const category = (part.category && part.category.category_name) ? part.category.category_name : '—';
    const stock = (part.stock_count === null || part.stock_count === undefined) ? '—' : `${part.stock_count} шт`;

    partCard.innerHTML =
        imagesHtml +
        `<h3 class="item-title">${part.part_name || ''}</h3>` +
        `<div class="item-info">Производитель: ${manufacturer}</div>` +
        `<div class="item-info">Артикул: ${article}</div>` +
        `<div class="item-info">Категория: ${category}</div>` +
        `<div class="item-info">В наличии: ${stock}</div>` +
        `<div class="item-price">${price}${price === 'Цена по запросу' ? '' : ' ₽'}</div>` +
        `<div class="item-actions">
            <button class="btn btn-primary" data-add-part="${part.part_id}">В корзину</button>
            <a href="/parts/${part.part_id}" class="btn btn-secondary">Подробнее</a>
        </div>`;

    // Добавление в корзину
    const btn = partCard.querySelector('[data-add-part]');
    if (btn) {
        btn.addEventListener('click', async () => {
            const oldText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Добавление...';
            
            try {
                // Используем универсальную функцию из cart_utils.js
                if (typeof window.addToCart === 'function') {
                    const success = await window.addToCart(part.part_id, 1);
                    if (success) {
                        btn.textContent = 'Добавлено';
                        setTimeout(() => {
                            btn.textContent = oldText;
                            btn.disabled = false;
                        }, 800);
                    } else {
                        btn.textContent = oldText;
                        btn.disabled = false;
                    }
                } else {
                    alert('Для добавления товара в корзину необходимо войти в аккаунт');
                    btn.textContent = oldText;
                    btn.disabled = false;
                }
            } catch (err) {
                console.error('Ошибка добавления в корзину:', err);
                btn.textContent = oldText;
                btn.disabled = false;
            }
        });
    }

    return partCard;
}

// Загрузка запчастей для главной страницы
async function loadHomeParts() {
    try {
        const response = await fetch('/api/home-parts');
        const data = await response.json();

        const container = document.getElementById('home-parts-container');
        const loader = document.getElementById('home-parts-loader');

        loader.style.display = 'none';

        if (data.parts && data.parts.length > 0) {
            container.innerHTML = '';
            data.parts.forEach(part => {
                container.appendChild(createPartCard(part));
            });
            initializeCarousels();
        } else {
            const fallback = document.getElementById('home-parts-fallback');
            fallback.style.display = 'block';
        }
    } catch (error) {
        console.error('Ошибка при загрузке запчастей:', error);
        const loader = document.getElementById('home-parts-loader');
        const fallback = document.getElementById('home-parts-fallback');
        if (loader) loader.style.display = 'none';
        if (fallback) fallback.style.display = 'block';
    }
}

// Инициализация карусели при загрузке страницы
function initializeCarousels() {
    const carousels = document.querySelectorAll('.image-carousel');

    carousels.forEach((carousel) => {
        const images = Array.from(carousel.querySelectorAll('.carousel-image'));
        const indicatorsContainer = carousel.querySelector('.carousel-indicators');
        const prevBtn = carousel.querySelector('.carousel-prev');
        const nextBtn = carousel.querySelector('.carousel-next');
        const controls = carousel.querySelector('.carousel-controls');

        // Базовые стили должны применяться всегда (даже если фото одно),
        // иначе появляется "зазор" внизу из-за естественной высоты img.
        const wrapper = carousel.querySelector('.carousel-wrapper');
        if (wrapper) {
            wrapper.style.position = 'relative';
            wrapper.style.overflow = 'hidden';
            wrapper.style.width = '100%';
            wrapper.style.height = '300px';
        }

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
        let isAnimating = false; // Флаг анимации

        // (wrapper/img стили выставлены выше; здесь остаётся логика индикаторов/кнопок/автоплея)

        // Создаем индикаторы внутри wrapper для правильного z-index
        const indicatorsWrapper = document.createElement('div');
        indicatorsWrapper.className = 'carousel-indicators';
        indicatorsWrapper.style.position = 'absolute';
        indicatorsWrapper.style.bottom = '10px';
        indicatorsWrapper.style.left = '50%';
        indicatorsWrapper.style.transform = 'translateX(-50%)';
        indicatorsWrapper.style.display = 'flex';
        indicatorsWrapper.style.gap = '6px';
        indicatorsWrapper.style.zIndex = '30';
        indicatorsWrapper.style.pointerEvents = 'auto'; // Позволяем клики

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

        // Новая реализация карусели с плавным переходом
        function goToSlide(targetIndex) {
            // Проверяем, если анимация уже выполняется
            if (isAnimating) {
                return;
            }

            // Проверяем границы
            if (targetIndex >= images.length) {
                targetIndex = 0;
            }
            if (targetIndex < 0) {
                targetIndex = images.length - 1;
            }

            // Проверяем, если переход не нужен (тот же индекс)
            if (targetIndex === currentIndex) {
                return;
            }

            // Устанавливаем флаг анимации
            isAnimating = true;

            // Скрываем текущее изображение с анимацией
            images[currentIndex].style.transition = 'opacity 0.5s ease-in-out';
            images[currentIndex].style.opacity = '0';

            // Показываем новое изображение
            images[targetIndex].style.opacity = '1';

            // Обновляем индикаторы
            const indicators = carousel.querySelectorAll('.indicator');
            indicators.forEach((ind, i) => {
                ind.classList.toggle('active', i === targetIndex);
            });

            // Через полсекунды обновляем currentIndex и сбрасываем флаг
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
    });
}

// Инициализация каруселей при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initializeCarousels();

    // Загружаем автомобили на главной странице (как было раньше)
    if (document.getElementById('home-cars-container')) {
        loadHomeCars();
    }

    // Загружаем запчасти на главной странице
    if (document.getElementById('home-parts-container')) {
        loadHomeParts();
    }
});