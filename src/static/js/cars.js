
        // ==== Создание карточки автомобиля ====
        function createCarCard(car) {
            const carCard = document.createElement('div');
            carCard.className = 'item-card';

            let imagesHtml = '';
            if (car.images && car.images.length > 0) {
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
            const mileage = car.mileage ? parseInt(car.mileage).toLocaleString('ru-RU') + ' км' : '—';
            const condition = car.condition || '—';
            const year = car.production_year || '—';
            const color = car.color || '—';

            carCard.innerHTML = `
                <div class="car-card-body">
                    <div class="car-images">
                        ${imagesHtml}
                    </div>
                    <div class="car-info">
                        <h3 class="item-title">${car.trim.brand_name || ''}</h3>
                        <div class="item-subtitle">${car.trim.model_name || ''}</div>
                        <div class="item-info">Пробег: <span>${mileage}</span></div>
                        <div class="item-info">Цвет: <span>${color}</span></div>
                        <div class="item-info">Год: <span>${year}</span></div>
                        <div class="item-info">Состояние: <span>${condition}</span></div>
                    </div>
                </div>
                <div class="car-price-row">
                    <div class="item-price">Цена: <span>${price} ₽</span></div>
                    <a href="/cars/${car.car_id}" class="btn btn-primary car-price-btn">Подробнее о автомобиле</a>
                </div>
            `;

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

                // Новая реализация карусели с плавным переходом
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
            });
            return carCard;
        }

        // ==== Состояние списка автомобилей и фильтров ====
        let offset = 0;
        const limit = 6;
        let loading = false;  // Флаг загрузки
        let hasMore = true;   // Есть ли ещё автомобили

        // Текущее состояние фильтров
        let currentFilters = {};
        // Метаданные фильтров (ENUM-ы)
        let filtersMeta = null;
        // Поисковый запрос
        let searchQuery = "";

        // ==== Работа с UI фильтров ====

        function buildChoiceGroup(containerId, name, values) {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = "";
            values.forEach((val) => {
                const pill = document.createElement("div");
                pill.className = "filter-pill";
                pill.dataset.name = name;
                pill.dataset.value = val;
                pill.textContent = val;
                pill.addEventListener("click", () => {
                    pill.classList.toggle("active");
                    updateGroupClearButton(containerId);
                });
                container.appendChild(pill);
            });
            // Обновляем видимость кнопки "Очистить" после создания группы
            updateGroupClearButton(containerId);
        }

        function applyFiltersToState() {
            const formFilters = {};

            // Числовые поля
            const numFieldMap = [
                ["min_price", "min-price"],
                ["max_price", "max-price"],
                ["min_mileage", "min-mileage"],
                ["max_mileage", "max-mileage"],
                ["min_production_year", "min-year"],
                ["max_production_year", "max-year"],
                ["min_engine_power", "min-engine-power"],
                ["max_engine_power", "max-engine-power"],
                ["min_engine_volume", "min-engine-volume"],
                ["max_engine_volume", "max-engine-volume"],
                ["min_engine_torque", "min-engine-torque"],
                ["max_engine_torque", "max-engine-torque"],
            ];

            numFieldMap.forEach(([param, domId]) => {
                const el = document.getElementById(domId);
                if (!el) return;
                const raw = el.value.trim();
                if (raw === "") return;
                const num = Number(raw.replace(",", "."));
                if (!Number.isNaN(num)) {
                    formFilters[param] = num;
                }
            });

            // Переключатели (пилюли)
            const choiceGroups = [
                ["brands", "brands-checkboxes"],
                ["conditions", "conditions-checkboxes"],
                ["colors", "colors-checkboxes"],
                ["body_types", "body-types-checkboxes"],
                ["drive_types", "drive-types-checkboxes"],
                ["transmissions", "transmissions-checkboxes"],
                ["fuel_types", "fuel-types-checkboxes"],
            ];

            choiceGroups.forEach(([param, containerId]) => {
                const container = document.getElementById(containerId);
                if (!container) return;
                const active = Array.from(container.querySelectorAll('.filter-pill.active'))
                    .map((el) => el.dataset.value);
                if (active.length > 0) {
                    formFilters[param] = active;
                }
            });

            currentFilters = formFilters;
            updateActiveFilterChips();
        }

        function clearFiltersForm() {
            // Инпуты
            const inputs = document.querySelectorAll(
                "#filters-overlay input[type='number'], #filters-overlay input[type='text']"
            );
            inputs.forEach((el) => (el.value = ""));

            // Пилюли
            const pills = document.querySelectorAll(
                "#filters-overlay .filter-pill"
            );
            pills.forEach((pill) => pill.classList.remove("active"));
        }

        function resetFilters() {
            clearFiltersForm();
            currentFilters = {};
            updateActiveFilterChips();
        }

        function updateActiveFilterChips() {
            const container = document.getElementById("active-filters");
            if (!container) return;
            container.innerHTML = "";

            const entries = Object.entries(currentFilters);
            if (entries.length === 0) return;

            const labelsMap = {
                min_price: "Цена от",
                max_price: "Цена до",
                min_mileage: "Пробег от",
                max_mileage: "Пробег до",
                min_production_year: "Год от",
                max_production_year: "Год до",
                min_engine_power: "Л.с. от",
                max_engine_power: "Л.с. до",
                min_engine_volume: "Объём от",
                max_engine_volume: "Объём до",
                min_engine_torque: "Момент от",
                max_engine_torque: "Момент до",
                brands: "Марка",
                conditions: "Состояние",
                colors: "Цвет",
                body_types: "Кузов",
                drive_types: "Привод",
                transmissions: "КПП",
                fuel_types: "Топливо",
            };

            entries.forEach(([key, value]) => {
                const label = labelsMap[key] || key;
                if (Array.isArray(value)) {
                    value.forEach((v) => {
                        const chip = document.createElement("div");
                        chip.className = "filter-chip";
                        chip.innerHTML = `
                            <span>${label}: ${v}</span>
                            <button type="button" data-key="${key}" data-value="${v}">✕</button>
                        `;
                        container.appendChild(chip);
                    });
                } else {
                    const chip = document.createElement("div");
                    chip.className = "filter-chip";
                    chip.innerHTML = `
                        <span>${label}: ${value}</span>
                        <button type="button" data-key="${key}">✕</button>
                    `;
                    container.appendChild(chip);
                }
            });

            container.addEventListener("click", (e) => {
                const target = e.target;
                if (!(target instanceof HTMLElement)) return;
                if (target.tagName !== "BUTTON") return;
                const key = target.getAttribute("data-key");
                const val = target.getAttribute("data-value");
                if (!key) return;

                if (val && Array.isArray(currentFilters[key])) {
                    currentFilters[key] = currentFilters[key].filter(
                        (item) => String(item) !== val
                    );
                    if (currentFilters[key].length === 0) {
                        delete currentFilters[key];
                    }
                } else {
                    delete currentFilters[key];
                }

                // Также синхронизируем форму с обновлённым состоянием
                syncFormWithFiltersState();
                updateActiveFilterChips();
                offset = 0;
                hasMore = true;
                loadCars(true);
            }, { once: true });
        }

        function syncFormWithFiltersState() {
            clearFiltersForm();

            // Числа
            const numFieldMap = [
                ["min_price", "min-price"],
                ["max_price", "max-price"],
                ["min_mileage", "min-mileage"],
                ["max_mileage", "max-mileage"],
                ["min_production_year", "min-year"],
                ["max_production_year", "max-year"],
                ["min_engine_power", "min-engine-power"],
                ["max_engine_power", "max-engine-power"],
                ["min_engine_volume", "min-engine-volume"],
                ["max_engine_volume", "max-engine-volume"],
                ["min_engine_torque", "min-engine-torque"],
                ["max_engine_torque", "max-engine-torque"],
            ];
            numFieldMap.forEach(([param, domId]) => {
                if (currentFilters[param] == null) return;
                const el = document.getElementById(domId);
                if (!el) return;
                el.value = String(currentFilters[param]);
                updateClearButtonVisibility(el);
            });

            // Пилюли
            const choiceGroups = [
                ["brands", "brands-checkboxes"],
                ["conditions", "conditions-checkboxes"],
                ["colors", "colors-checkboxes"],
                ["body_types", "body-types-checkboxes"],
                ["drive_types", "drive-types-checkboxes"],
                ["transmissions", "transmissions-checkboxes"],
                ["fuel_types", "fuel-types-checkboxes"],
            ];
            choiceGroups.forEach(([param, containerId]) => {
                const values = currentFilters[param];
                if (!values) {
                    // Обновляем видимость кнопки "Очистить" для группы
                    updateGroupClearButton(containerId);
                    return;
                }
                const container = document.getElementById(containerId);
                if (!container) return;
                Array.from(container.querySelectorAll('.filter-pill')).forEach(
                    (pill) => {
                        const val = pill.dataset.value;
                        pill.classList.toggle("active", Array.isArray(values) && values.includes(val));
                    });
                updateGroupClearButton(containerId);
            });
        }

        function updateGroupClearButton(groupId) {
            const container = document.getElementById(groupId);
            if (!container) return;
            const hasActive = container.querySelectorAll('.filter-pill.active').length > 0;
            const clearBtn = document.querySelector(`.clear-group-btn[data-group="${groupId}"]`);
            if (clearBtn) {
                clearBtn.style.display = hasActive ? 'block' : 'none';
            }
        }

        function openFiltersOverlay() {
            const overlay = document.getElementById("filters-overlay");
            if (!overlay) return;
            overlay.classList.add("open");
            overlay.setAttribute("aria-hidden", "false");
        }

        function closeFiltersOverlay() {
            const overlay = document.getElementById("filters-overlay");
            if (!overlay) return;
            overlay.classList.remove("open");
            overlay.setAttribute("aria-hidden", "true");
        }

        async function loadFiltersMeta() {
            try {
                const resp = await fetch("/api/cars/filters-meta");
                if (!resp.ok) {
                    throw new Error("Ошибка загрузки фильтров");
                }
                filtersMeta = await resp.json();

                buildChoiceGroup("brands-checkboxes", "brands", filtersMeta.brands || []);
                buildChoiceGroup("conditions-checkboxes", "conditions", filtersMeta.conditions || []);
                buildChoiceGroup("colors-checkboxes", "colors", filtersMeta.colors || []);
                buildChoiceGroup("body-types-checkboxes", "body_types", filtersMeta.body_types || []);
                buildChoiceGroup("drive-types-checkboxes", "drive_types", filtersMeta.drive_types || []);
                buildChoiceGroup("transmissions-checkboxes", "transmissions", filtersMeta.transmissions || []);
                buildChoiceGroup("fuel-types-checkboxes", "fuel_types", filtersMeta.fuel_types || []);
            } catch (e) {
                console.error(e);
            }
        }

        function buildQueryParams() {
            const params = new URLSearchParams();
            params.set("offset", String(offset));
            params.set("limit", String(limit));

            // Добавляем поисковый запрос, если он есть
            if (searchQuery && searchQuery.trim()) {
                params.set("query", searchQuery.trim());
            }

            Object.entries(currentFilters).forEach(([key, value]) => {
                if (Array.isArray(value)) {
                    value.forEach((v) => params.append(key, String(v)));
                } else if (value != null && value !== "") {
                    params.set(key, String(value));
                }
            });

            return params.toString();
        }

        // ==== Загрузка автомобилей с учётом фильтров ====
        async function loadCars(reset = false) {
            if (loading || !hasMore) return;

            if (reset) {
                offset = 0;
                hasMore = true;
            }

            loading = true;
            const loader = document.getElementById('infinite-loader');
            loader.style.display = 'block';
            try {
                const queryString = buildQueryParams();
                const response = await fetch(`/api/cars/?${queryString}`);
                const data = await response.json();

                const carsGrid = document.getElementById('cars-grid');

                // Очищаем контейнер, если это начальная загрузка
                if (offset === 0 || reset) {
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
                    offset += data.cars.length;
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

        // Обработка очистки отдельных полей и групп
        function setupClearButtons() {
            // Кнопки очистки числовых полей
            document.querySelectorAll('.clear-input-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const targetId = btn.getAttribute('data-target');
                    const input = document.getElementById(targetId);
                    if (input) {
                        input.value = '';
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        // Обновляем видимость крестика
                        updateClearButtonVisibility(input);
                    }
                });
            });

            // Обновление видимости крестиков при изменении значений
            document.querySelectorAll('#filters-overlay input[type="number"]').forEach(input => {
                input.addEventListener('input', () => {
                    updateClearButtonVisibility(input);
                });
                input.addEventListener('focus', () => {
                    updateClearButtonVisibility(input);
                });
                input.addEventListener('blur', () => {
                    updateClearButtonVisibility(input);
                });
                // Инициализация видимости при загрузке
                updateClearButtonVisibility(input);
            });

            // Кнопки очистки групп пилюль
            document.querySelectorAll('.clear-group-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const groupId = btn.getAttribute('data-group');
                    const container = document.getElementById(groupId);
                    if (container) {
                        container.querySelectorAll('.filter-pill.active').forEach(pill => {
                            pill.classList.remove('active');
                        });
                        updateGroupClearButton(groupId);
                    }
                });
            });

            // Отслеживание изменений пилюль для обновления видимости кнопок "Очистить"
            const observer = new MutationObserver(() => {
                document.querySelectorAll('.checkbox-group').forEach(container => {
                    const groupId = container.id;
                    if (groupId) {
                        updateGroupClearButton(groupId);
                    }
                });
            });

            // Наблюдаем за изменениями в группах пилюль
            document.querySelectorAll('.checkbox-group').forEach(container => {
                observer.observe(container, { attributes: true, subtree: true, attributeFilter: ['class'] });
            });
        }

        function updateClearButtonVisibility(input) {
            const wrapper = input.closest('.input-wrapper');
            if (!wrapper) return;
            const clearBtn = wrapper.querySelector('.clear-input-btn');
            if (!clearBtn) return;
            
            if (input.value && input.value.trim() !== '') {
                clearBtn.style.opacity = '0.6';
            } else {
                clearBtn.style.opacity = '0';
            }
        }

        // Инициализация при загрузке страницы
        document.addEventListener('DOMContentLoaded', function() {
            // Инициализация UI фильтров
            const openBtn = document.getElementById("open-filters");
            const closeBtn = document.getElementById("close-filters");
            const overlay = document.getElementById("filters-overlay");
            const applyBtn = document.getElementById("apply-filters");
            const resetBtn = document.getElementById("reset-filters");
            const toggleAdvancedBtn = document.getElementById("toggle-advanced-filters");
            const advancedBlock = document.getElementById("advanced-filters");

            if (openBtn) {
                openBtn.addEventListener("click", () => {
                    syncFormWithFiltersState();
                    openFiltersOverlay();
                    // Обновляем видимость крестиков после открытия
                    setTimeout(() => {
                        document.querySelectorAll('#filters-overlay input[type="number"]').forEach(input => {
                            updateClearButtonVisibility(input);
                        });
                    }, 100);
                });
            }

            if (closeBtn) {
                closeBtn.addEventListener("click", () => {
                    closeFiltersOverlay();
                });
            }

            if (overlay) {
                overlay.addEventListener("click", (e) => {
                    if (e.target === overlay) {
                        closeFiltersOverlay();
                    }
                });
            }

            if (toggleAdvancedBtn && advancedBlock) {
                toggleAdvancedBtn.addEventListener("click", () => {
                    const isHidden = advancedBlock.style.display === "none";
                    advancedBlock.style.display = isHidden ? "block" : "none";
                    // Обновляем видимость крестиков после раскрытия
                    if (isHidden) {
                        setTimeout(() => {
                            document.querySelectorAll('#advanced-filters input[type="number"]').forEach(input => {
                                updateClearButtonVisibility(input);
                            });
                        }, 100);
                    }
                });
            }

            if (applyBtn) {
                applyBtn.addEventListener("click", () => {
                    applyFiltersToState();
                    closeFiltersOverlay();
                    offset = 0;
                    hasMore = true;
                    loadCars(true);
                });
            }

            if (resetBtn) {
                resetBtn.addEventListener("click", () => {
                    resetFilters();
                    closeFiltersOverlay();
                    offset = 0;
                    hasMore = true;
                    loadCars(true);
                });
            }

            // Настройка кнопок очистки
            setupClearButtons();

            // Инициализация поиска
            const searchForm = document.getElementById("cars-search-form");
            const searchInput = document.getElementById("cars-search-input");
            const searchClear = document.getElementById("cars-search-clear");

            if (searchForm && searchInput) {
                // Читаем параметр query из URL при загрузке страницы
                const urlParams = new URLSearchParams(window.location.search);
                const urlQuery = urlParams.get('query');
                if (urlQuery) {
                    searchInput.value = urlQuery;
                    searchQuery = urlQuery;
                }

                // Обработка отправки формы поиска
                searchForm.addEventListener("submit", (e) => {
                    e.preventDefault();
                    const query = searchInput.value.trim();
                    searchQuery = query;
                    offset = 0;
                    hasMore = true;
                    loadCars(true);
                });

                // Кнопка очистки поиска
                if (searchClear) {
                    searchClear.addEventListener("click", () => {
                        searchInput.value = "";
                        searchQuery = "";
                        updateSearchClearVisibility();
                        searchInput.focus();
                        offset = 0;
                        hasMore = true;
                        // Убираем параметр query из URL
                        const url = new URL(window.location);
                        url.searchParams.delete('query');
                        window.history.replaceState({}, '', url);
                        loadCars(true);
                    });
                }

                // Обновление видимости кнопки очистки
                function updateSearchClearVisibility() {
                    if (searchClear) {
                        if (searchInput.value && searchInput.value.trim()) {
                            searchClear.style.opacity = "0.6";
                        } else {
                            searchClear.style.opacity = "0";
                        }
                    }
                }

                searchInput.addEventListener("input", updateSearchClearVisibility);
                searchInput.addEventListener("focus", updateSearchClearVisibility);
                searchInput.addEventListener("blur", () => {
                    setTimeout(updateSearchClearVisibility, 100);
                });

                // Инициализация видимости
                updateSearchClearVisibility();
            }

            // Загружаем ENUM-метаданные и стартовый список автомобилей
            loadFiltersMeta().finally(() => {
                // Повторно настраиваем кнопки очистки после загрузки метаданных
                setupClearButtons();
                loadCars(true);
            });
        });