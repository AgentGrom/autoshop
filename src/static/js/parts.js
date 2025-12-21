// Страница запчастей: список + карусель как на авто + 2 кнопки (Подробнее / В корзину)

document.addEventListener('DOMContentLoaded', () => {
    const grid = document.getElementById('parts-grid');
    const loader = document.getElementById('loader');
    const infiniteLoader = document.getElementById('infinite-loader');
    const endMessage = document.getElementById('end-message');

    const searchForm = document.getElementById('parts-search-form');
    const searchInput = document.getElementById('parts-search-input');
    const searchClear = document.getElementById('parts-search-clear');

    // Фильтры
    const openFiltersBtn = document.getElementById('open-filters');
    const closeFiltersBtn = document.getElementById('close-filters');
    const filtersOverlay = document.getElementById('filters-overlay');
    const applyFiltersBtn = document.getElementById('apply-filters');
    const resetFiltersBtn = document.getElementById('reset-filters');
    const activeFiltersEl = document.getElementById('active-filters');

    const categoriesLevelsEl = document.getElementById('parts-categories-levels');
    const specsSectionEl = document.getElementById('parts-specs-section');
    const specsGridEl = document.getElementById('parts-specs-grid');

    let offset = 0;
    const limit = 12;
    let isLoading = false;
    let hasMore = true;
    let query = '';

    // state filters
    let categoriesTree = null; // from API
    // выбранный путь по дереву: массив узлов (от root до текущего)
    let selectedPath = [];
    let selectedCategoryId = null; // текущая выбранная категория (последняя в пути)
    let selectedLeafCategoryId = null; // leaf для specs
    let specsMeta = null; // {filters: {...}}
    let currentSpecsFilters = {}; // {specName: [values] or {min,max}}

    function formatPrice(value) {
        if (value === null || value === undefined) return '—';
        const num = Number(value);
        if (!Number.isFinite(num)) return String(value);
        return num.toLocaleString('ru-RU');
    }

    function getQueryFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return (params.get('query') || '').trim();
    }

    function setQueryInUrl(nextQuery) {
        const url = new URL(window.location.href);
        if (nextQuery) {
            url.searchParams.set('query', nextQuery);
        } else {
            url.searchParams.delete('query');
        }
        window.history.replaceState({}, '', url.toString());
    }

    async function updateCartCount() {
        // Обновляем счётчик корзины только для авторизованных пользователей
        if (typeof window.updateCartCountInNav === 'function') {
            await window.updateCartCountInNav();
        }
        // Примечание: счётчик корзины больше не отображается в навигации,
        // но функция оставлена для совместимости
    }

    async function addToCart(partId) {
        // Используем универсальную функцию из cart_utils.js
        if (typeof window.addToCart === 'function') {
            const success = await window.addToCart(partId, 1);
            if (success) {
                updateCartCount();
            }
        } else {
            alert('Для добавления товара в корзину необходимо войти в аккаунт');
        }
    }

    function openFiltersOverlay() {
        if (!filtersOverlay) return;
        filtersOverlay.classList.add('open');
        filtersOverlay.setAttribute('aria-hidden', 'false');
    }

    function closeFiltersOverlayFn() {
        if (!filtersOverlay) return;
        filtersOverlay.classList.remove('open');
        filtersOverlay.setAttribute('aria-hidden', 'true');
    }

    function clearEl(el) {
        if (el) el.innerHTML = '';
    }

    function buildPills(container, items, onClick, activeId) {
        if (!container) return;
        clearEl(container);
        items.forEach((item) => {
            const pill = document.createElement('div');
            pill.className = 'filter-pill';
            pill.textContent = item.category_name;
            pill.dataset.categoryId = String(item.category_id);
            if (activeId && Number(activeId) === Number(item.category_id)) {
                pill.classList.add('active');
            }
            pill.addEventListener('click', () => onClick(item));
            container.appendChild(pill);
        });
    }

    function findNodeById(nodes, id) {
        if (!nodes) return null;
        for (const n of nodes) {
            if (Number(n.category_id) === Number(id)) return n;
            const childFound = findNodeById(n.children || [], id);
            if (childFound) return childFound;
        }
        return null;
    }

    function getPathLabels(pathNodes) {
        return (pathNodes || []).map((n) => n.category_name).filter(Boolean);
    }

    function getCategoryLabelById(id) {
        if (!id || !categoriesTree) return null;
        const node = findNodeById(categoriesTree, id);
        return node ? node.category_name : null;
    }

    function updateActiveFilterChips() {
        if (!activeFiltersEl) return;
        activeFiltersEl.innerHTML = '';

        if (selectedCategoryId) {
            const label = getPathLabels(selectedPath).join(' / ') || (getCategoryLabelById(selectedCategoryId) || String(selectedCategoryId));
            const chip = document.createElement('div');
            chip.className = 'filter-chip';
            chip.innerHTML = `<span>Категория: ${label}</span><button type="button" data-key="category">✕</button>`;
            activeFiltersEl.appendChild(chip);
        }

        // specs chips: показываем "Имя: значение"
        const specs = currentSpecsFilters || {};
        Object.entries(specs).forEach(([specName, val]) => {
            if (Array.isArray(val)) {
                val.forEach((one) => {
                    const chip = document.createElement('div');
                    chip.className = 'filter-chip';
                    chip.innerHTML = `<span>${specName}: ${one}</span><button type="button" data-key="spec" data-spec="${specName}" data-value="${one}">✕</button>`;
                    activeFiltersEl.appendChild(chip);
                });
                return;
            }
            if (val && typeof val === 'object') {
                const min = val.min != null ? String(val.min) : '';
                const max = val.max != null ? String(val.max) : '';
                const rangeLabel = [min ? `от ${min}` : null, max ? `до ${max}` : null].filter(Boolean).join(' ');
                if (!rangeLabel) return;
                const chip = document.createElement('div');
                chip.className = 'filter-chip';
                chip.innerHTML = `<span>${specName}: ${rangeLabel}</span><button type="button" data-key="spec" data-spec="${specName}">✕</button>`;
                activeFiltersEl.appendChild(chip);
            }
        });

        // один обработчик (без once), чтобы крестики работали всегда
        activeFiltersEl.onclick = (e) => {
            const t = e.target;
            if (!(t instanceof HTMLElement)) return;
            if (t.tagName !== 'BUTTON') return;

            const key = t.getAttribute('data-key');
            if (key === 'category') {
                selectedPath = [];
                selectedCategoryId = null;
                selectedLeafCategoryId = null;
                currentSpecsFilters = {};
                specsMeta = null;
                renderCategoriesUI();
                renderSpecsUI();
                updateActiveFilterChips();
                resetAndLoad();
                return;
            }

            if (key === 'spec') {
                const specName = t.getAttribute('data-spec');
                const value = t.getAttribute('data-value');
                if (!specName) return;

                const cur = currentSpecsFilters[specName];
                if (Array.isArray(cur) && value) {
                    currentSpecsFilters[specName] = cur.filter((v) => String(v) !== String(value));
                    if (currentSpecsFilters[specName].length === 0) {
                        delete currentSpecsFilters[specName];
                    }
                } else {
                    delete currentSpecsFilters[specName];
                }
                updateActiveFilterChips();
                resetAndLoad();
            }
        };
    }

    async function loadCategories() {
        if (categoriesTree) return categoriesTree;
        const resp = await fetch('/api/parts/categories');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        categoriesTree = data.categories || [];
        return categoriesTree;
    }

    function renderCategoriesUI() {
        if (!categoriesTree || !categoriesLevelsEl) return;
        categoriesLevelsEl.innerHTML = '';

        // уровень 0: root nodes
        const levels = [];
        levels.push({ title: 'Раздел', nodes: categoriesTree });

        // для каждого выбранного узла добавляем следующий уровень (его children), пока они есть
        for (let i = 0; i < selectedPath.length; i++) {
            const node = selectedPath[i];
            const children = node && node.children ? node.children : [];
            if (children.length > 0) {
                levels.push({ title: `Уровень ${i + 1}`, nodes: children });
            }
        }

        levels.forEach((lvl, idx) => {
            const wrap = document.createElement('div');
            wrap.className = 'category-level';
            wrap.innerHTML = `<div class="category-level-title">${lvl.title}</div><div class="checkbox-group" data-level="${idx}"></div>`;
            const pillsWrap = wrap.querySelector('.checkbox-group');
            const activeId = selectedPath[idx] ? selectedPath[idx].category_id : null;
            lvl.nodes.forEach((n) => {
                const pill = document.createElement('div');
                pill.className = 'filter-pill';
                pill.textContent = n.category_name;
                pill.dataset.categoryId = String(n.category_id);
                if (activeId && Number(activeId) === Number(n.category_id)) pill.classList.add('active');
                pill.addEventListener('click', () => onCategoryClickAtLevel(idx, n));
                pillsWrap.appendChild(pill);
            });
            categoriesLevelsEl.appendChild(wrap);
        });
    }

    async function onCategoryClickAtLevel(levelIndex, node) {
        // зафиксировать путь до этого уровня включительно
        selectedPath = selectedPath.slice(0, levelIndex);
        selectedPath.push(node);

        selectedCategoryId = node.category_id;
        selectedLeafCategoryId = node.is_leaf ? node.category_id : null;
        currentSpecsFilters = {};
        specsMeta = null;
        renderCategoriesUI();

        if (node.is_leaf) {
            const resp = await fetch(`/api/parts/specs-meta?category_id=${encodeURIComponent(node.category_id)}`);
            specsMeta = resp.ok ? await resp.json() : null;
        }

        renderSpecsUI();
    }

    function renderSpecsUI() {
        if (!specsSectionEl || !specsGridEl) return;

        if (!selectedLeafCategoryId || !specsMeta || !specsMeta.filters) {
            specsSectionEl.style.display = 'none';
            specsGridEl.innerHTML = '';
            return;
        }

        specsSectionEl.style.display = 'block';
        specsGridEl.innerHTML = '';

        const filters = specsMeta.filters;
        Object.entries(filters).forEach(([specName, meta]) => {
            const group = document.createElement('div');
            group.className = 'filter-group';

            if (meta.type === 'options') {
                const values = meta.values || [];
                group.innerHTML = `
                    <div class="filter-group-header">
                        <label>${specName}</label>
                        <button type="button" class="clear-group-btn" data-spec="${specName}" title="Очистить все">Очистить</button>
                    </div>
                    <div class="checkbox-group" data-spec-name="${specName}"></div>
                `;
                const pillsWrap = group.querySelector('.checkbox-group');
                values.forEach((val) => {
                    const pill = document.createElement('div');
                    pill.className = 'filter-pill';
                    pill.textContent = val;
                    pill.addEventListener('click', () => {
                        pill.classList.toggle('active');
                    });
                    pillsWrap.appendChild(pill);
                });
            } else if (meta.type === 'range') {
                const unit = meta.unit ? ` ${meta.unit}` : '';
                group.innerHTML = `
                    <label>${specName}${unit}</label>
                    <div class="range-row">
                        <div class="input-wrapper">
                            <input type="number" class="form-control" data-range-min="${specName}" placeholder="От" step="any">
                            <button type="button" class="clear-input-btn" data-target="range-min-${specName}" title="Очистить">✕</button>
                        </div>
                        <div class="input-wrapper">
                            <input type="number" class="form-control" data-range-max="${specName}" placeholder="До" step="any">
                            <button type="button" class="clear-input-btn" data-target="range-max-${specName}" title="Очистить">✕</button>
                        </div>
                    </div>
                    <div class="hint-small">Доступно: ${meta.min} - ${meta.max}${unit}</div>
                `;
            }

            specsGridEl.appendChild(group);
        });

        // clear group for options
        specsGridEl.querySelectorAll('.clear-group-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const spec = btn.getAttribute('data-spec');
                if (!spec) return;
                const wrap = specsGridEl.querySelector(`.checkbox-group[data-spec-name="${CSS.escape(spec)}"]`);
                if (!wrap) return;
                wrap.querySelectorAll('.filter-pill.active').forEach((p) => p.classList.remove('active'));
            });
        });
    }

    // ==== Создание карточки запчасти (скелет как у авто) ====
    function createPartCard(part) {
        const card = document.createElement('div');
        card.className = 'item-card';

        let imagesHtml = '';
        if (part.images && part.images.length > 0) {
            const imagesList = part.images
                .slice()
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                .map(img => `<img src="${img.url}" alt="${img.alt_text || part.part_name}" class="carousel-image">`)
                .join('');

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
                        <img src="/static/images/parts/base.png" alt="Фото отсутствует" class="carousel-image">
                    </div>
                    <div class="carousel-controls">
                        <button class="carousel-btn carousel-prev">‹</button>
                        <button class="carousel-btn carousel-next">›</button>
                    </div>
                </div>
            `;
        }

        const article = part.part_article || '—';
        const category = (part.category && part.category.category_name) ? part.category.category_name : '—';
        const manufacturer = part.manufacturer || '—';
        const stock = (part.stock_count === null || part.stock_count === undefined) ? '—' : `${part.stock_count} шт`;
        const price = part.price !== null && part.price !== undefined ? formatPrice(part.price) : 'Цена по запросу';

        card.innerHTML = `
            <div class="car-card-body">
                <div class="car-images">
                    ${imagesHtml}
                </div>
                <div class="car-info">
                    <h3 class="item-title">${part.part_name || ''}</h3>
                    <div class="item-subtitle">${manufacturer}</div>
                    <div class="item-info">Артикул: <span>${article}</span></div>
                    <div class="item-info">Категория: <span>${category}</span></div>
                    <div class="item-info">В наличии: <span>${stock}</span></div>
                </div>
            </div>
            <div class="car-price-row">
                <div class="item-price">Цена: <span>${price}${price === 'Цена по запросу' ? '' : ' ₽'}</span></div>
                <div class="part-actions-col">
                    <a href="/parts/${part.part_id}" class="btn btn-secondary car-price-btn">Подробнее</a>
                    <button class="btn btn-primary car-price-btn add-to-cart-btn" data-part-id="${part.part_id}">В корзину</button>
                </div>
            </div>
        `;

        // кнопка "в корзину"
        const addBtn = card.querySelector('.add-to-cart-btn');
        addBtn?.addEventListener('click', async () => {
            const oldText = addBtn.textContent;
            addBtn.disabled = true;
            addBtn.textContent = 'Добавление...';
            
            try {
                const success = await addToCart(part.part_id);
                if (success) {
                    addBtn.textContent = 'Добавлено';
                    setTimeout(() => {
                        addBtn.textContent = oldText;
                        addBtn.disabled = false;
                    }, 800);
                } else {
                    addBtn.textContent = oldText;
                    addBtn.disabled = false;
                }
            } catch (err) {
                addBtn.textContent = oldText;
                addBtn.disabled = false;
            }
        });

        initializeCarousels(card);
        return card;
    }

    // Карусель — копия логики из cars.js (индикаторы, hover-кнопки, автоплей)
    function initializeCarousels(cardEl) {
        const carousels = cardEl.querySelectorAll('.image-carousel');

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

            function goToSlide(targetIndex) {
                if (isAnimating) return;

                if (targetIndex >= images.length) targetIndex = 0;
                if (targetIndex < 0) targetIndex = images.length - 1;
                if (targetIndex === currentIndex) return;

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

        return cardEl;
    }

    async function fetchParts() {
        if (isLoading || !hasMore) return;
        isLoading = true;

        if (offset === 0) {
            loader.style.display = 'block';
            endMessage.style.display = 'none';
        } else {
            infiniteLoader.style.display = 'block';
        }

        try {
            const params = new URLSearchParams();
            params.set('offset', String(offset));
            params.set('limit', String(limit));
            if (query) params.set('query', query);

            if (selectedCategoryId) {
                params.set('category_id', String(selectedCategoryId));
            }

            if (selectedLeafCategoryId && currentSpecsFilters && Object.keys(currentSpecsFilters).length > 0) {
                params.set('specs', JSON.stringify(currentSpecsFilters));
            }

            const resp = await fetch(`/api/parts/?${params.toString()}`);
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();

            if (offset === 0) {
                grid.innerHTML = '';
            }

            const parts = data.parts || [];
            parts.forEach((p) => {
                grid.appendChild(createPartCard(p));
            });

            hasMore = Boolean(data.has_more);
            offset += limit;

            if (!hasMore) {
                endMessage.style.display = 'block';
            }
        } catch (err) {
            console.error('Ошибка загрузки запчастей:', err);
            if (offset === 0) {
                grid.innerHTML = '<div class="error-message">Не удалось загрузить запчасти. Попробуйте позже.</div>';
            }
            hasMore = false;
        } finally {
            loader.style.display = 'none';
            infiniteLoader.style.display = 'none';
            isLoading = false;
        }
    }

    function resetAndLoad() {
        offset = 0;
        hasMore = true;
        fetchParts();
    }

    // Поиск
    function updateClearVisibility() {
        const hasText = Boolean(searchInput.value.trim());
        searchClear.style.display = hasText ? 'block' : 'none';
    }

    searchInput.addEventListener('input', updateClearVisibility);
    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        query = '';
        setQueryInUrl('');
        updateClearVisibility();
        resetAndLoad();
    });

    searchForm.addEventListener('submit', (e) => {
        e.preventDefault();
        query = searchInput.value.trim();
        setQueryInUrl(query);
        resetAndLoad();
    });

    // Бесконечный скролл
    window.addEventListener('scroll', () => {
        if (!hasMore || isLoading) return;
        const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
        if (nearBottom) fetchParts();
    });

    // init
    query = getQueryFromUrl();
    if (query) searchInput.value = query;
    updateClearVisibility();
    updateCartCount();
    updateActiveFilterChips();
    fetchParts();

    // Filters init
    if (openFiltersBtn) {
        openFiltersBtn.addEventListener('click', async () => {
            try {
                await loadCategories();
                renderCategoriesUI();
                renderSpecsUI();
                openFiltersOverlay();
            } catch (e) {
                console.error(e);
                openFiltersOverlay();
            }
        });
    }
    if (closeFiltersBtn) {
        closeFiltersBtn.addEventListener('click', closeFiltersOverlayFn);
    }
    if (filtersOverlay) {
        filtersOverlay.addEventListener('click', (e) => {
            if (e.target === filtersOverlay) closeFiltersOverlayFn();
        });
    }

    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', () => {
            // собрать specs filters из UI (только для leaf)
            const nextSpecs = {};
            if (selectedLeafCategoryId && specsGridEl) {
                // options
                specsGridEl.querySelectorAll('.checkbox-group[data-spec-name]').forEach((wrap) => {
                    const specName = wrap.getAttribute('data-spec-name');
                    const selected = Array.from(wrap.querySelectorAll('.filter-pill.active')).map((p) => p.textContent.trim()).filter(Boolean);
                    if (specName && selected.length > 0) {
                        nextSpecs[specName] = selected;
                    }
                });
                // range
                specsGridEl.querySelectorAll('input[data-range-min]').forEach((inp) => {
                    const specName = inp.getAttribute('data-range-min');
                    const minVal = inp.value.trim();
                    if (!specName || !minVal) return;
                    const obj = nextSpecs[specName] && typeof nextSpecs[specName] === 'object' && !Array.isArray(nextSpecs[specName]) ? nextSpecs[specName] : {};
                    obj.min = Number(minVal);
                    nextSpecs[specName] = obj;
                });
                specsGridEl.querySelectorAll('input[data-range-max]').forEach((inp) => {
                    const specName = inp.getAttribute('data-range-max');
                    const maxVal = inp.value.trim();
                    if (!specName || !maxVal) return;
                    const obj = nextSpecs[specName] && typeof nextSpecs[specName] === 'object' && !Array.isArray(nextSpecs[specName]) ? nextSpecs[specName] : {};
                    obj.max = Number(maxVal);
                    nextSpecs[specName] = obj;
                });
            }
            currentSpecsFilters = nextSpecs;
            updateActiveFilterChips();
            closeFiltersOverlayFn();
            resetAndLoad();
        });
    }

    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', () => {
            selectedPath = [];
            selectedCategoryId = null;
            selectedLeafCategoryId = null;
            currentSpecsFilters = {};
            specsMeta = null;
            renderCategoriesUI();
            renderSpecsUI();
            updateActiveFilterChips();
            closeFiltersOverlayFn();
            resetAndLoad();
        });
    }
});


