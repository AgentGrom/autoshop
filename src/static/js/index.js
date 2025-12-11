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

        console.log(`Поиск ${activeType}: ${query}`);
        // Раскомментировать при готовности:
        // window.location.href = `/search/${activeType}?q=${encodeURIComponent(query)}`;
    });

    // Инициализация
    updateSearchPlaceholder(activeType);
    toggleClearButton();
});
