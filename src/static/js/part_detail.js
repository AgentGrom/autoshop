// Глобальная переменная для хранения данных запчасти
let partData = null;

function getPartIdFromDom() {
    const container = document.querySelector('.part-detail-container');
    const raw = container?.getAttribute('data-part-id');
    const id = raw ? Number(raw) : NaN;
    return Number.isFinite(id) ? id : null;
}

document.addEventListener('DOMContentLoaded', async () => {
    await loadPartData();
});

async function loadPartData() {
    const loader = document.getElementById('loader');
    const partContent = document.getElementById('part-content');
    const errorMessage = document.getElementById('error-message');

    try {
        const partId = getPartIdFromDom();
        if (!partId) {
            throw new Error('Некорректный идентификатор запчасти');
        }

        const response = await fetch(`/api/parts/${partId}`);
        if (!response.ok) {
            throw new Error('Запчасть не найдена');
        }

        partData = await response.json();

        loader.style.display = 'none';
        partContent.style.display = 'block';

        renderPartDetails();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        loader.style.display = 'none';
        errorMessage.style.display = 'block';
    }
}

function renderPartDetails() {
    const title = document.getElementById('part-title');
    title.textContent = partData.part_name || 'Запчасть';

    const subtitle = document.getElementById('part-subtitle');
    const manufacturer = partData.manufacturer || '—';
    const article = partData.part_article || '—';
    const categoryName = partData.category?.category_name || '—';
    const stock = (partData.stock_count ?? '—');
    subtitle.textContent = `Производитель: ${manufacturer} · Артикул: ${article} · Категория: ${categoryName} · Остаток: ${stock}`;

    renderCarousel();

    const priceElement = document.getElementById('part-price');
    if (partData.price !== null && partData.price !== undefined) {
        priceElement.textContent = `${formatPrice(partData.price)} ₽`;
    } else {
        priceElement.textContent = 'Цена по запросу';
    }

    const descEl = document.getElementById('part-desc');
    descEl.textContent = partData.description || '';

    const addBtn = document.getElementById('add-to-cart-btn');
    addBtn.addEventListener('click', () => {
        addToCart(partData.part_id);
    });

    renderSpecifications();
}

// Карусель (по логике как в car_detail.js / cars.js)
function renderCarousel() {
    const carouselContainer = document.getElementById('part-carousel');

    let imagesHtml = '';

    if (!partData.images || partData.images.length === 0) {
        imagesHtml = `
            <div class="carousel-wrapper">
                <img src="/static/images/parts/base.png" alt="Фото отсутствует" class="carousel-image">
            </div>
            <div class="carousel-controls">
                <button class="carousel-btn carousel-prev">‹</button>
                <button class="carousel-btn carousel-next">›</button>
            </div>
        `;
    } else {
        const imagesList = [...partData.images]
            .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
            .map(image => `<img src="${image.url}" alt="${image.alt_text || 'Изображение запчасти'}" class="carousel-image">`)
            .join('');

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
    initializeCarousel(carouselContainer);
}

function initializeCarousel(carousel) {
    const images = Array.from(carousel.querySelectorAll('.carousel-image'));
    const prevBtn = carousel.querySelector('.carousel-prev');
    const nextBtn = carousel.querySelector('.carousel-next');
    const controls = carousel.querySelector('.carousel-controls');

    let currentIndex = 0;
    let isAnimating = false;

    const wrapper = carousel.querySelector('.carousel-wrapper');
    wrapper.style.position = 'relative';
    wrapper.style.overflow = 'hidden';
    wrapper.style.width = '100%';
    wrapper.style.height = '100%';

    images.forEach((img, index) => {
        img.style.position = 'absolute';
        img.style.top = '0';
        img.style.left = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        img.style.display = 'block';
        img.style.opacity = index === 0 ? '1' : '0';
        img.style.transition = 'opacity 0.5s ease-in-out';
    });

    // Если изображений меньше 2, скрываем элементы управления (но базовые стили уже применены,
    // чтобы не было "зазора" между фото и рамкой).
    if (images.length <= 1) {
        if (controls) controls.style.display = 'none';
        return;
    }

    if (controls) controls.style.display = 'flex';

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

    images.forEach((_, index) => {
        const indicator = document.createElement('div');
        indicator.classList.add('indicator');
        if (index === 0) indicator.classList.add('active');
        indicator.addEventListener('click', () => goToSlide(index));
        indicatorsWrapper.appendChild(indicator);
    });

    wrapper.appendChild(indicatorsWrapper);

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

    goToSlide(0);

    if (images.length > 1) {
        let isPaused = false;
        setInterval(() => {
            if (!isPaused) {
                const newIndex = (currentIndex + 1) % images.length;
                goToSlide(newIndex);
            }
        }, 5000);

        carousel.addEventListener('mouseenter', () => { isPaused = true; });
        carousel.addEventListener('mouseleave', () => { isPaused = false; });
    }
}

function renderSpecifications() {
    const specsContainer = document.getElementById('part-specs');

    const items = [];
    if (partData.manufacturer) items.push({ label: 'Производитель', value: partData.manufacturer });
    if (partData.part_article) items.push({ label: 'Артикул', value: partData.part_article });
    if (partData.category?.category_name) items.push({ label: 'Категория', value: partData.category.category_name });
    if (partData.stock_count !== null && partData.stock_count !== undefined) items.push({ label: 'Остаток', value: String(partData.stock_count) });

    if (Array.isArray(partData.specifications)) {
        partData.specifications.forEach(s => {
            const name = s?.spec_name;
            const value = s?.spec_value;
            if (!name || value === null || value === undefined || String(value).trim() === '') return;
            const unit = s?.spec_unit ? ` ${s.spec_unit}` : '';
            items.push({ label: name, value: `${value}${unit}` });
        });
    }

    specsContainer.innerHTML = items.map(it => `
        <div class="part-spec-item">
            <span class="part-spec-label">${escapeHtml(it.label)}:</span>
            <span class="part-spec-value">${escapeHtml(it.value)}</span>
        </div>
    `).join('');
}

async function addToCart(partId) {
    // Используем универсальную функцию из cart_utils.js
    if (typeof window.addToCart === 'function') {
        const success = await window.addToCart(partId, 1);
        if (success) {
            alert('Добавлено в корзину');
        }
        // Если success === false, функция уже показала сообщение о необходимости авторизации
    } else {
        alert('Для добавления товара в корзину необходимо войти в аккаунт');
    }
}

function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

function escapeHtml(str) {
    return String(str)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}


