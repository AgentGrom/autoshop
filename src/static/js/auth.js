// src/static/js/auth.js
// Утилиты для работы с авторизацией

/**
 * Проверяет, авторизован ли пользователь
 * @returns {Promise<boolean>}
 */
async function isAuthenticated() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include' // Важно для отправки cookies
        });
        return response.ok;
    } catch (error) {
        return false;
    }
}

/**
 * Получает информацию о текущем пользователе
 * @returns {Promise<Object|null>}
 */
async function getCurrentUser() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            credentials: 'include'
        });
        if (response.ok) {
            return await response.json();
        }
        return null;
    } catch (error) {
        return null;
    }
}

/**
 * Выход из аккаунта
 */
async function logout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'GET',
            credentials: 'include'
        });
        // Перезагружаем страницу после выхода
        window.location.href = '/';
    } catch (error) {
        console.error('Ошибка при выходе:', error);
        // Всё равно перезагружаем страницу
        window.location.href = '/';
    }
}

/**
 * Обновляет навигацию в зависимости от статуса авторизации
 */
async function updateNavigation() {
    const navRight = document.querySelector('.nav-right');
    if (!navRight) return;

    const isAuth = await isAuthenticated();
    
    if (isAuth) {
        // Пользователь авторизован - показываем "Аккаунт" и "Корзина"
        navRight.innerHTML = `
            <a href="/account">Аккаунт</a>
            <a href="/cart">Корзина</a>
            <a href="#" onclick="logout(); return false;">Выход</a>
        `;
    } else {
        // Пользователь не авторизован - показываем "Вход" и "Регистрация"
        navRight.innerHTML = `
            <a href="/api/auth/login">Вход</a>
            <a href="/api/auth/register">Регистрация</a>
        `;
    }
}

// Обновляем навигацию при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await updateNavigation();
    
    // Синхронизируем корзину из localStorage с БД при входе
    if (typeof window.syncCartToServer === 'function') {
        const isAuth = await isAuthenticated();
        if (isAuth) {
            await window.syncCartToServer();
        }
    }
});

// Экспортируем функции для использования в других скриптах
window.isAuthenticated = isAuthenticated;
window.getCurrentUser = getCurrentUser;
window.logout = logout;
window.updateNavigation = updateNavigation;

