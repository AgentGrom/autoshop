// src/static/js/cart.js
// Функции для работы с корзиной

let cartData = null;

// Загрузка корзины с сервера
async function loadCart() {
    const loader = document.getElementById('cart-loader');
    const empty = document.getElementById('cart-empty');
    const container = document.getElementById('cart-items-container');
    const error = document.getElementById('cart-error');
    
    try {
        loader.style.display = 'flex';
        empty.style.display = 'none';
        container.style.display = 'none';
        error.style.display = 'none';
        
        const response = await fetch('/cart/api/items', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.status === 401) {
            // Не авторизован
            error.style.display = 'block';
            document.getElementById('cart-error-message').textContent = 'Для просмотра корзины необходимо войти в аккаунт';
            loader.style.display = 'none';
            return;
        }
        
        if (!response.ok) {
            throw new Error('Ошибка загрузки корзины');
        }
        
        const data = await response.json();
        cartData = data;
        
        loader.style.display = 'none';
        
        if (data.items.length === 0) {
            empty.style.display = 'block';
        } else {
            container.style.display = 'block';
            renderCartItems(data.items);
            updateCartSummary(data);
        }
    } catch (err) {
        console.error('Ошибка загрузки корзины:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('cart-error-message').textContent = 'Ошибка загрузки корзины. Попробуйте обновить страницу.';
    }
}

// Отображение товаров в корзине
function renderCartItems(items) {
    const container = document.getElementById('cart-items-list');
    container.innerHTML = items.map(item => `
        <div class="cart-item" data-part-id="${item.part_id}">
            <div class="cart-item-image">
                <img src="${item.image}" alt="${item.part_name}" onerror="this.src='/static/images/parts/base.png'">
            </div>
            <div class="cart-item-info">
                <h3 class="cart-item-name">${escapeHtml(item.part_name)}</h3>
                <div class="cart-item-details">
                    <span>Производитель: ${escapeHtml(item.manufacturer || '—')}</span>
                    <span>Артикул: ${escapeHtml(item.part_article || '—')}</span>
                    <span>В наличии: ${item.stock_count} шт</span>
                </div>
            </div>
            <div class="cart-item-price">
                <div class="cart-item-price-single">${formatPrice(item.price)} ₽</div>
                <div class="cart-item-price-total">${formatPrice(item.total)} ₽</div>
            </div>
            <div class="cart-item-quantity">
                <button class="quantity-btn" data-action="decrease" data-part-id="${item.part_id}">−</button>
                <input type="number" class="quantity-input" value="${item.quantity}" min="1" max="${item.stock_count}" data-part-id="${item.part_id}">
                <button class="quantity-btn" data-action="increase" data-part-id="${item.part_id}">+</button>
            </div>
            <div class="cart-item-remove">
                <button class="btn-remove" data-part-id="${item.part_id}" title="Удалить">×</button>
            </div>
        </div>
    `).join('');
    
    // Добавляем обработчики событий
    container.querySelectorAll('[data-action="decrease"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const partId = parseInt(btn.dataset.partId);
            const input = container.querySelector(`.quantity-input[data-part-id="${partId}"]`);
            const newQuantity = Math.max(1, parseInt(input.value) - 1);
            updateQuantity(partId, newQuantity);
        });
    });
    
    container.querySelectorAll('[data-action="increase"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const partId = parseInt(btn.dataset.partId);
            const input = container.querySelector(`.quantity-input[data-part-id="${partId}"]`);
            const max = parseInt(input.max);
            const newQuantity = Math.min(max, parseInt(input.value) + 1);
            updateQuantity(partId, newQuantity);
        });
    });
    
    container.querySelectorAll('.quantity-input').forEach(input => {
        input.addEventListener('change', () => {
            const partId = parseInt(input.dataset.partId);
            const quantity = Math.max(1, Math.min(parseInt(input.max), parseInt(input.value) || 1));
            updateQuantity(partId, quantity);
        });
    });
    
    container.querySelectorAll('.btn-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            const partId = parseInt(btn.dataset.partId);
            removeItem(partId);
        });
    });
}

// Обновление итоговой информации
function updateCartSummary(data) {
    document.getElementById('cart-total-items').textContent = data.total_items;
    document.getElementById('cart-total-price').textContent = `${formatPrice(data.total_price)} ₽`;
}

// Оптимистичное обновление итоговой суммы (без перезагрузки)
function updateCartSummaryOptimistic(priceDelta, quantityDelta = 0) {
    const totalPriceEl = document.getElementById('cart-total-price');
    const totalItemsEl = document.getElementById('cart-total-items');
    
    if (totalPriceEl) {
        const currentPrice = parseFloat(totalPriceEl.textContent.replace(/\s/g, '').replace('₽', '')) || 0;
        const newPrice = Math.max(0, currentPrice + priceDelta);
        totalPriceEl.textContent = `${formatPrice(newPrice)} ₽`;
        if (cartData) {
            cartData.total_price = newPrice;
        }
    }
    
    if (totalItemsEl && quantityDelta !== 0) {
        const currentItems = parseInt(totalItemsEl.textContent) || 0;
        const newItems = Math.max(0, currentItems + quantityDelta);
        totalItemsEl.textContent = newItems;
        if (cartData) {
            cartData.total_items = newItems;
        }
    }
}

// Обновление количества товара
async function updateQuantity(partId, quantity) {
    const cartItem = document.querySelector(`.cart-item[data-part-id="${partId}"]`);
    if (!cartItem) return;
    
    // Сохраняем текущие значения для отката в случае ошибки
    const oldQuantity = parseInt(cartItem.querySelector('.quantity-input').value);
    const oldTotal = parseFloat(cartItem.querySelector('.cart-item-price-total').textContent.replace(/\s/g, '').replace('₽', ''));
    const pricePerUnit = oldTotal / oldQuantity;
    
    // Оптимистичное обновление UI
    const quantityInput = cartItem.querySelector('.quantity-input');
    const priceTotalEl = cartItem.querySelector('.cart-item-price-total');
    
    quantityInput.value = quantity;
    const newTotal = pricePerUnit * quantity;
    priceTotalEl.textContent = `${formatPrice(newTotal)} ₽`;
    
    // Обновляем итоговую сумму
    const quantityDelta = quantity - oldQuantity;
    updateCartSummaryOptimistic(pricePerUnit * quantityDelta, quantityDelta);
    
    try {
        const response = await fetch('/cart/api/update', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({ part_id: partId, quantity: quantity })
        });
        
        if (!response.ok) {
            throw new Error('Ошибка обновления количества');
        }
        
        // Если количество стало 0, товар был удалён - обновляем корзину
        if (quantity === 0) {
            await loadCart();
            return;
        }
        
        // Получаем актуальные данные для проверки
        const data = await response.json();
        
        // Обновляем только итоговую информацию, если нужно
        if (cartData) {
            const item = cartData.items.find(item => item.part_id === partId);
            if (item) {
                item.quantity = quantity;
                item.total = newTotal;
                updateCartSummary(cartData);
            }
        }
    } catch (err) {
        console.error('Ошибка обновления количества:', err);
        // Откатываем изменения
        quantityInput.value = oldQuantity;
        priceTotalEl.textContent = `${formatPrice(oldTotal)} ₽`;
        const rollbackDelta = oldQuantity - quantity;
        updateCartSummaryOptimistic(pricePerUnit * rollbackDelta, rollbackDelta);
        alert('Ошибка обновления количества товара');
    }
}

// Удаление товара
async function removeItem(partId) {
    if (!confirm('Удалить товар из корзины?')) {
        return;
    }
    
    const cartItem = document.querySelector(`.cart-item[data-part-id="${partId}"]`);
    if (!cartItem) return;
    
    // Получаем актуальные данные из cartData, если доступны, иначе из DOM
    let itemTotal, itemQuantity;
    if (cartData && cartData.items) {
        const item = cartData.items.find(item => item.part_id === partId);
        if (item) {
            itemTotal = item.total;
            itemQuantity = item.quantity;
        } else {
            // Fallback на DOM, если не найдено в cartData
            itemTotal = parseFloat(cartItem.querySelector('.cart-item-price-total').textContent.replace(/\s/g, '').replace('₽', ''));
            itemQuantity = parseInt(cartItem.querySelector('.quantity-input').value);
        }
    } else {
        // Fallback на DOM
        itemTotal = parseFloat(cartItem.querySelector('.cart-item-price-total').textContent.replace(/\s/g, '').replace('₽', ''));
        itemQuantity = parseInt(cartItem.querySelector('.quantity-input').value);
    }
    
    // Сохраняем элемент для возможного отката
    const itemClone = cartItem.cloneNode(true);
    
    // Оптимистичное удаление - скрываем элемент с анимацией
    cartItem.style.transition = 'opacity 0.3s, transform 0.3s';
    cartItem.style.opacity = '0';
    cartItem.style.transform = 'translateX(-20px)';
    
    // Обновляем итоговую сумму (вычитаем один раз)
    updateCartSummaryOptimistic(-itemTotal, -itemQuantity);
    
    // Обновляем cartData сразу, чтобы избежать двойного вычитания
    if (cartData && cartData.items) {
        cartData.items = cartData.items.filter(item => item.part_id !== partId);
        cartData.total_price -= itemTotal;
        cartData.total_items -= itemQuantity;
    }
    
    setTimeout(() => {
        cartItem.remove();
        
        // Проверяем, не пуста ли корзина
        const remainingItems = document.querySelectorAll('.cart-item');
        if (remainingItems.length === 0) {
            document.getElementById('cart-items-container').style.display = 'none';
            document.getElementById('cart-empty').style.display = 'block';
        }
    }, 300);
    
    try {
        const response = await fetch(`/cart/api/remove/${partId}`, {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка удаления товара');
        }
        
        // Не обновляем cartData повторно, так как уже обновили выше
        // Просто проверяем, что данные синхронизированы
    } catch (err) {
        console.error('Ошибка удаления товара:', err);
        
        // Откатываем изменения - возвращаем элемент
        const container = document.getElementById('cart-items-list');
        if (container && itemClone) {
            cartItem.style.opacity = '1';
            cartItem.style.transform = 'translateX(0)';
            // Восстанавливаем cartData
            if (cartData && cartData.items) {
                // Находим позицию для вставки (можно просто добавить в конец)
                const restoredItem = {
                    part_id: partId,
                    total: itemTotal,
                    quantity: itemQuantity
                };
                cartData.items.push(restoredItem);
                cartData.total_price += itemTotal;
                cartData.total_items += itemQuantity;
            }
            updateCartSummaryOptimistic(itemTotal, itemQuantity);
        }
        alert('Ошибка удаления товара');
    }
}

// Очистка корзины
async function clearCart() {
    if (!confirm('Очистить всю корзину?')) {
        return;
    }
    
    try {
        const response = await fetch('/cart/api/clear', {
            method: 'DELETE',
            credentials: 'include'
        });
        
        if (!response.ok) {
            throw new Error('Ошибка очистки корзины');
        }
        
        await loadCart(); // Перезагружаем корзину
    } catch (err) {
        console.error('Ошибка очистки корзины:', err);
        alert('Ошибка очистки корзины');
    }
}

// Оформление заказа (пока заглушка)
function checkout() {
    alert('Функция оформления заказа будет реализована позже');
}

// Утилиты
function formatPrice(price) {
    return new Intl.NumberFormat('ru-RU').format(price);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadCart();
    
    const clearBtn = document.getElementById('clear-cart-btn');
    if (clearBtn) {
        clearBtn.addEventListener('click', clearCart);
    }
    
    const checkoutBtn = document.getElementById('checkout-btn');
    if (checkoutBtn) {
        checkoutBtn.addEventListener('click', checkout);
    }
});

