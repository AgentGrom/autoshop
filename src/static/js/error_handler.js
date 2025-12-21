// src/static/js/error_handler.js
// Универсальная функция для обработки ошибок API

/**
 * Безопасно извлекает сообщение об ошибке из ответа API
 * @param {Response} response - Объект Response от fetch
 * @returns {Promise<string>} - Текст ошибки
 */
async function getErrorMessage(response) {
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const error = await response.json();
            // Проверяем различные форматы ошибок
            if (error.detail) {
                // FastAPI формат
                if (typeof error.detail === 'string') {
                    return error.detail;
                } else if (Array.isArray(error.detail)) {
                    // Валидационные ошибки
                    return error.detail.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
                } else {
                    return JSON.stringify(error.detail);
                }
            } else if (error.message) {
                return error.message;
            } else if (error.error) {
                return error.error;
            } else {
                return JSON.stringify(error);
            }
        } else {
            // Если не JSON, пытаемся получить текст
            const text = await response.text();
            return text || `Ошибка ${response.status}: ${response.statusText}`;
        }
    } catch (err) {
        // Если не удалось распарсить ответ
        return `Ошибка ${response.status}: ${response.statusText || 'Неизвестная ошибка'}`;
    }
}

/**
 * Обрабатывает ошибку и показывает alert пользователю
 * @param {Error|Response|string} error - Ошибка для обработки
 * @param {string} defaultMessage - Сообщение по умолчанию, если не удалось извлечь ошибку
 */
async function showError(error, defaultMessage = 'Произошла ошибка') {
    let message = defaultMessage;
    
    if (error instanceof Response) {
        // Если это Response объект
        message = await getErrorMessage(error);
    } else if (error instanceof Error) {
        // Если это Error объект
        message = error.message || defaultMessage;
    } else if (typeof error === 'string') {
        // Если это строка
        message = error;
    } else if (error && typeof error === 'object') {
        // Если это объект с ошибкой
        if (error.detail) {
            message = typeof error.detail === 'string' ? error.detail : JSON.stringify(error.detail);
        } else if (error.message) {
            message = error.message;
        } else {
            message = JSON.stringify(error);
        }
    }
    
    alert(message);
}

/**
 * Безопасно обрабатывает ответ API
 * @param {Response} response - Объект Response от fetch
 * @param {string} defaultError - Сообщение об ошибке по умолчанию
 * @returns {Promise<Object>} - Распарсенный JSON ответ
 * @throws {Error} - Если ответ не успешен
 */
async function handleApiResponse(response, defaultError = 'Ошибка запроса') {
    if (!response.ok) {
        const errorMessage = await getErrorMessage(response);
        const error = new Error(errorMessage);
        error.response = response;
        throw error;
    }
    
    try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            return await response.json();
        } else {
            const text = await response.text();
            return { message: text };
        }
    } catch (err) {
        throw new Error('Не удалось обработать ответ сервера');
    }
}

// Экспортируем функции для использования в других файлах
window.getErrorMessage = getErrorMessage;
window.showError = showError;
window.handleApiResponse = handleApiResponse;

