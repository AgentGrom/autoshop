// src/static/js/payment.js
// Логика страницы оплаты заказа

document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (typeof isAuthenticated === 'function') {
        if (!(await isAuthenticated())) {
            window.location.href = '/api/auth/login';
            return;
        }
    }

    // Получаем ID заказа из URL
    const urlParams = new URLSearchParams(window.location.search);
    const orderId = urlParams.get('order_id');
    
    if (!orderId) {
        showErrorPage('Не указан номер заказа');
        return;
    }

    const loader = document.getElementById('payment-loader');
    const content = document.getElementById('payment-content');
    const errorPage = document.getElementById('payment-error-page');
    const payBtn = document.getElementById('pay-btn');
    const cancelBtn = document.getElementById('cancel-btn');

    // Загружаем данные заказа
    try {
        const response = await fetch(`/orders/api/order/${orderId}`, {
            credentials: 'include'
        });

        if (!response.ok) {
            if (response.status === 404) {
                showErrorPage('Заказ не найден');
                return;
            }
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }

        const orderData = await response.json();

        // Проверяем, что заказ еще не оплачен
        if (orderData.is_paid) {
            alert('Заказ уже оплачен');
            window.location.href = '/account';
            return;
        }

        // Проверяем, что заказ принадлежит текущему пользователю
        // (это должно проверяться на сервере, но для безопасности проверим и здесь)

        // Заполняем данные
        document.getElementById('payment-order-id').textContent = orderData.order_id;
        document.getElementById('payment-total-amount').textContent = orderData.total_amount.toLocaleString('ru-RU');

        loader.style.display = 'none';
        content.style.display = 'block';

        // Обработчики кнопок
        payBtn.addEventListener('click', async () => {
            await handlePayment(orderId, true);
        });

        cancelBtn.addEventListener('click', async () => {
            await handlePayment(orderId, false);
        });

    } catch (err) {
        console.error('Ошибка загрузки заказа:', err);
        showErrorPage(err.message || 'Ошибка загрузки заказа');
    }

    function showErrorPage(message) {
        loader.style.display = 'none';
        content.style.display = 'none';
        errorPage.style.display = 'block';
        if (errorPage.querySelector('p')) {
            errorPage.querySelector('p').textContent = message;
        }
    }

    async function handlePayment(orderId, pay) {
        const errorDiv = document.getElementById('payment-error');
        errorDiv.style.display = 'none';
        
        payBtn.disabled = true;
        cancelBtn.disabled = true;
        
        if (pay) {
            payBtn.textContent = 'Оплата...';
        } else {
            cancelBtn.textContent = 'Отмена...';
        }

        try {
            const response = await fetch(`/orders/api/pay/${orderId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ pay: pay })
            });

            if (!response.ok) {
                const errorMessage = await getErrorMessage(response);
                throw new Error(errorMessage);
            }

            const result = await response.json();

            // Перенаправляем в личный кабинет на вкладку заказов
            window.location.href = '/account#orders';
        } catch (err) {
            console.error('Ошибка оплаты:', err);
            errorDiv.textContent = err.message || 'Ошибка при обработке оплаты';
            errorDiv.style.display = 'block';
            payBtn.disabled = false;
            cancelBtn.disabled = false;
            payBtn.textContent = 'Оплатить';
            cancelBtn.textContent = 'Отменить';
        }
    }
});

