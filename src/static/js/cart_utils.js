// Утилиты для работы с корзиной (только для авторизованных пользователей)

/**
 * Добавляет товар в корзину (только для авторизованных пользователей)
 * @returns {Promise<boolean>} true если успешно, false если ошибка или не авторизован
 */
async function addToCart(partId, quantity = 1) {
    // Проверяем, авторизован ли пользователь
    const isAuth = await window.isAuthenticated();
    
    if (!isAuth) {
        // Показываем сообщение о необходимости авторизации
        if (confirm('Для добавления товара в корзину необходимо войти в аккаунт. Перейти на страницу входа?')) {
            window.location.href = '/api/auth/login';
        }
        return false;
    }
    
    // Добавляем в БД
    try {
        const response = await fetch('/cart/api/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ part_id: partId, quantity: quantity })
        });
        
        if (response.ok) {
            const data = await response.json();
            // Обновляем счётчик корзины в навигации, если есть
            updateCartCountInNav(data.cart_count);
            return true;
        } else if (response.status === 401) {
            // Пользователь не авторизован
            if (confirm('Сессия истекла. Перейти на страницу входа?')) {
                window.location.href = '/api/auth/login';
            }
            return false;
        } else {
            // Получаем сообщение об ошибке
            const errorMessage = await getErrorMessage(response);
            console.error('Ошибка добавления в корзину:', errorMessage);
            alert(errorMessage || 'Ошибка добавления товара в корзину');
            return false;
        }
    } catch (err) {
        console.error('Ошибка добавления в корзину:', err);
        alert('Ошибка добавления товара в корзину');
        return false;
    }
}


/**
 * Обновляет счётчик корзины в навигации (только для авторизованных пользователей)
 */
async function updateCartCountInNav(count = null) {
    // Если count не передан, пытаемся получить из БД
    if (count === null) {
        const isAuth = await window.isAuthenticated();
        if (isAuth) {
            try {
                const response = await fetch('/cart/api/count', {
                    method: 'GET',
                    credentials: 'include'
                });
                if (response.ok) {
                    const data = await response.json();
                    count = data.count;
                }
            } catch (err) {
                console.error('Ошибка получения количества товаров:', err);
                count = 0;
            }
        } else {
            count = 0;
        }
    }
    
    // Обновляем счётчик в навигации (если есть элемент)
    // Примечание: в новой навигации счётчик не показывается, но можно добавить при необходимости
}

// Экспортируем функции
window.addToCart = addToCart;
window.updateCartCountInNav = updateCartCountInNav;

