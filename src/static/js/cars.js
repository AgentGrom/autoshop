
        // Создание карточки автомобиля - общая функция
        function createCarCard(car) {
            const carCard = document.createElement('div');
            carCard.className = 'item-card';

            let imagesHtml = '';
            if (car.images && car.images.length > 0) {
                // Создаем HTML структуру, как в index.html
                const imagesList = car.images.map(image =>
                    `<img src="${image.url}" alt="${car.trim.brand_name} ${car.trim.model_name}" class="carousel-image">`
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
                    </div>
                `;
            } else {
                // Для случая без изображений
                imagesHtml = `
                    <div class="image-carousel">
                        <div class="carousel-wrapper">
                            <img src="/static/images/cars/base.jpeg" alt="Фото отсутствует" class="carousel-image">
                        </div>
                        <div class="carousel-controls">
                            <button class="carousel-btn carousel-prev">‹</button>
                            <button class="carousel-btn carousel-next">›</button>
                        </div>
                    </div>
                `;
            }

            const price = car.price ? parseFloat(car.price).toLocaleString('ru-RU') : 'Цена по запросу';

            carCard.innerHTML =
                imagesHtml +
                '<h3 class="item-title">' + car.trim.brand_name + ' ' + car.trim.model_name + ' ' + (car.trim.trim_name || '') + '</h3>' +
                '<div class="item-info">Пробег: ' + parseInt(car.mileage).toLocaleString('ru-RU') + ' км</div>' +
                '<div class="item-info">Состояние: ' + car.condition + '</div>' +
                '<div class="item-info">Год: ' + car.production_year + '</div>' +
                '<div class="item-info">Цвет: ' + car.color + '</div>' +
                '<div class="item-price">' + price + ' ₽</div>' +
                '<div class="item-actions">' +
                    '<a href="/cars/' + car.car_id + '" class="btn btn-primary">Подробнее</a>' +
                    '<button class="btn btn-secondary">В избранное</button>' +
                '</div>';

            

            return carCard;
        }

        // Инициализация карусели при загрузке страницы
        function initializeCarousels(carCard) {
            const carousels = carCard.querySelectorAll('.image-carousel');

            carousels.forEach((carousel) => {
                const images = Array.from(carousel.querySelectorAll('.carousel-image'));
                const indicatorsContainer = carousel.querySelector('.carousel-indicators');
                const prevBtn = carousel.querySelector('.carousel-prev');
                const nextBtn = carousel.querySelector('.carousel-next');
                const controls = carousel.querySelector('.carousel-controls');

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

                // Устанавливаем стили для обертки
                const wrapper = carousel.querySelector('.carousel-wrapper');
                wrapper.style.position = 'relative';
                wrapper.style.overflow = 'hidden';
                wrapper.style.width = '100%';
                wrapper.style.height = '300px'; // Увеличенная высота для больших изображений

                // Устанавливаем стили для изображений
                images.forEach((img, index) => {
                    img.style.position = 'absolute';
                    img.style.top = '0';
                    img.style.left = '0';
                    img.style.width = '100%';
                    img.style.height = '300px'; // Увеличенная высота
                    img.style.objectFit = 'contain';
                    img.style.display = 'block';
                    img.style.opacity = index === 0 ? '1' : '0'; // Только первое изображение видно
                    img.style.transition = 'opacity 0.5s ease-in-out';
                });

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
            return carCard;
        }

        let offset = 0;
        let limit = 3;
        let loading = false;  // Флаг загрузки
        let hasMore = true;   // Есть ли ещё автомобили

        // Загрузка начальных автомобилей
        async function loadCars() {
            if (loading || !hasMore) return;

            loading = true;
            const loader = document.getElementById('infinite-loader');
            loader.style.display = 'block';
            try {
                const response = await fetch(`/api/cars/?offset=${offset}&limit=${limit}`);
                const data = await response.json();

                const carsGrid = document.getElementById('cars-grid');

                // Очищаем контейнер, если это начальная загрузка
                if (offset === 0) {
                    carsGrid.innerHTML = '';
                }

                if (data.cars && data.cars.length > 0) {
                    // Добавляем новые автомобили, используя общую функцию
                    data.cars.forEach(car => {
                        const carCard = createCarCard(car);
                        const carCadWithCarousel = initializeCarousels(carCard)
                        carsGrid.appendChild(carCard);

                    });
                    hasMore = data.has_more;
                }

                loader.style.display = 'none';

                if (!hasMore) {
                    document.getElementById('end-message').style.display = 'block';
                };
            } catch (error) {
                console.error('Ошибка при загрузке автомобилей:', error);
                loader.style.display = 'none';
                loading = false;
            } finally {
                loading = false;
                offset+=limit;
            }
        }

        // Обработчик прокрутки для бесконечной прокрутки
        function handleScroll() {
            // Проверяем, приближаемся ли мы к концу страницы
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const footerHeight = document.getElementsByClassName('footer')[0].offsetHeight
            const cardHeight = document.getElementsByClassName('item-card')[0].offsetHeight
            // Если мы на 80% прокрутили страницу, загружаем больше
            if (scrollY + windowHeight > documentHeight - cardHeight - footerHeight) {
                loadCars();
            }
        }

        // Добавляем обработчик прокрутки
        window.addEventListener('scroll', handleScroll);

        // Инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            // Загружаем начальные автомобили
            loadCars();
        });