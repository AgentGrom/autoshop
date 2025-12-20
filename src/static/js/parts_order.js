// src/static/js/parts_order.js
// Логика оформления заказа запчастей

let cartData = null;
let orderFees = null;
let userAddresses = null;

// Загрузка данных
async function loadOrderData() {
    const loader = document.getElementById('order-loader');
    const error = document.getElementById('order-error');
    const formContainer = document.getElementById('order-form-container');
    
    try {
        // Загружаем товары из корзины
        const cartResponse = await fetch('/cart/api/items', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (!cartResponse.ok) {
            if (cartResponse.status === 401) {
                throw new Error('Для оформления заказа необходимо войти в аккаунт');
            }
            throw new Error('Ошибка загрузки корзины');
        }
        
        cartData = await cartResponse.json();
        
        if (!cartData.items || cartData.items.length === 0) {
            throw new Error('Корзина пуста');
        }
        
        // Загружаем настройки сборов
        const feesResponse = await fetch('/api/settings/order-fees');
        if (feesResponse.ok) {
            orderFees = await feesResponse.json();
        } else {
            orderFees = { part_service_fee: 500, part_delivery_cost: 500 };
        }
        
        // Загружаем адреса пользователя
        await loadUserAddresses();
        
        // Загружаем список стран для самовывоза
        await loadCountries();
        
        // Отображаем данные
        renderOrderItems();
        updateOrderSummary();
        
        loader.style.display = 'none';
        formContainer.style.display = 'block';
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
        document.getElementById('order-error-message').textContent = err.message || 'Ошибка загрузки данных';
    }
}

// Отображение товаров в заказе (без возможности изменения)
function renderOrderItems() {
    const container = document.getElementById('order-items-list');
    if (!cartData || !cartData.items) return;
    
    container.innerHTML = cartData.items.map(item => `
        <div class="order-item">
            <div class="order-item-image">
                <img src="${item.image}" alt="${item.part_name}" onerror="this.src='/static/images/parts/base.png'">
            </div>
            <div class="order-item-info">
                <h4 class="order-item-name">${escapeHtml(item.part_name)}</h4>
                <div class="order-item-details">
                    <span>Производитель: ${escapeHtml(item.manufacturer || '—')}</span>
                    <span>Артикул: ${escapeHtml(item.part_article || '—')}</span>
                    <span>Количество: ${item.quantity} шт</span>
                </div>
            </div>
            <div class="order-item-price">
                <div class="order-item-price-single">${formatPrice(item.price)} ₽ × ${item.quantity}</div>
                <div class="order-item-price-total">${formatPrice(item.total)} ₽</div>
            </div>
        </div>
    `).join('');
}

// Обновление итоговой суммы
function updateOrderSummary() {
    if (!cartData || !orderFees) return;
    
    const itemsTotal = cartData.total_price || 0;
    const serviceFee = orderFees.part_service_fee || 0;
    const deliveryMethod = document.getElementById('delivery-method-select').value;
    const deliveryCost = (deliveryMethod === 'home') ? (orderFees.part_delivery_cost || 0) : 0;
    const total = itemsTotal + serviceFee + deliveryCost;
    
    document.getElementById('items-total').textContent = `${formatPrice(itemsTotal)} ₽`;
    document.getElementById('service-fee').textContent = `${formatPrice(serviceFee)} ₽`;
    document.getElementById('delivery-cost').textContent = `${formatPrice(deliveryCost)} ₽`;
    document.getElementById('total-amount').textContent = `${formatPrice(total)} ₽`;
}

// Загрузка адресов пользователя
async function loadUserAddresses() {
    try {
        const response = await fetch('/api/addresses/', {
            method: 'GET',
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            userAddresses = data.addresses || [];
            
            const select = document.getElementById('shipping-address-select');
            select.innerHTML = '<option value="">Выберите сохраненный адрес (необязательно)</option>';
            
            if (userAddresses.length > 0) {
                userAddresses.forEach(addr => {
                    const option = document.createElement('option');
                    option.value = addr.address_id;
                    option.textContent = addr.full_address;
                    if (addr.is_default) {
                        option.textContent += ' (по умолчанию)';
                    }
                    select.appendChild(option);
                });
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки адресов:', err);
    }
}

// Заполнение полей адреса при выборе сохраненного адреса
function fillAddressFields(addressId) {
    if (!addressId || !userAddresses) return;
    
    const address = userAddresses.find(addr => addr.address_id === parseInt(addressId));
    if (!address) return;
    
    // Заполняем поля
    document.getElementById('address-country-select').value = address.country || '';
    document.getElementById('address-region-input').value = address.region || '';
    document.getElementById('address-city-input').value = address.city || '';
    document.getElementById('address-street-input').value = address.street || '';
    document.getElementById('address-house-input').value = address.house || '';
    document.getElementById('address-apartment-input').value = address.apartment || '';
    document.getElementById('address-entrance-input').value = address.entrance || '';
    document.getElementById('address-floor-input').value = address.floor || '';
}

// Загрузка списка стран (для самовывоза и доставки)
async function loadCountries() {
    try {
        const response = await fetch('/api/pickup/countries');
        const data = await response.json();
        
        // Для самовывоза
        const pickupSelect = document.getElementById('country-select');
        pickupSelect.innerHTML = '<option value="">Выберите страну</option>';
        
        // Для доставки на дом
        const addressSelect = document.getElementById('address-country-select');
        addressSelect.innerHTML = '<option value="">Выберите страну</option>';
        
        data.countries.forEach(country => {
            // Для самовывоза
            const pickupOption = document.createElement('option');
            pickupOption.value = country;
            pickupOption.textContent = country;
            pickupSelect.appendChild(pickupOption);
            
            // Для доставки на дом
            const addressOption = document.createElement('option');
            addressOption.value = country;
            addressOption.textContent = country;
            addressSelect.appendChild(addressOption);
        });
    } catch (err) {
        console.error('Ошибка загрузки стран:', err);
    }
}

// Загрузка списка областей
async function loadRegions(country) {
    const select = document.getElementById('region-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/regions?country=${encodeURIComponent(country)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите область</option>';
        data.regions.forEach(region => {
            const option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            select.appendChild(option);
        });
        select.disabled = false;
        
        // Сбрасываем зависимые поля
        document.getElementById('city-select').innerHTML = '<option value="">Сначала выберите область</option>';
        document.getElementById('city-select').disabled = true;
        document.getElementById('pickup-point-select').innerHTML = '<option value="">Сначала выберите город</option>';
        document.getElementById('pickup-point-select').disabled = true;
    } catch (err) {
        console.error('Ошибка загрузки областей:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Загрузка списка городов
async function loadCities(country, region) {
    const select = document.getElementById('city-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/cities?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите город</option>';
        data.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            select.appendChild(option);
        });
        select.disabled = false;
        
        // Сбрасываем пункты выдачи
        document.getElementById('pickup-point-select').innerHTML = '<option value="">Сначала выберите город</option>';
        document.getElementById('pickup-point-select').disabled = true;
    } catch (err) {
        console.error('Ошибка загрузки городов:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Загрузка списка пунктов выдачи
async function loadPickupPoints(country, region, city) {
    const select = document.getElementById('pickup-point-select');
    select.innerHTML = '<option value="">Загрузка...</option>';
    select.disabled = true;
    
    try {
        const response = await fetch(`/api/pickup/points?country=${encodeURIComponent(country)}&region=${encodeURIComponent(region)}&city=${encodeURIComponent(city)}`);
        const data = await response.json();
        
        select.innerHTML = '<option value="">Выберите пункт выдачи</option>';
        data.points.forEach(point => {
            const option = document.createElement('option');
            option.value = point.pickup_point_id;
            option.textContent = point.address;
            select.appendChild(option);
        });
        select.disabled = false;
    } catch (err) {
        console.error('Ошибка загрузки пунктов выдачи:', err);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// Оформление заказа
async function submitOrder() {
    const deliveryMethod = document.getElementById('delivery-method-select').value;
    const paymentMethod = document.getElementById('payment-method-select').value;
    const customerNotes = document.getElementById('customer-notes').value;
    
    if (!deliveryMethod || !paymentMethod) {
        alert('Заполните все обязательные поля');
        return;
    }
    
    let shippingAddressId = null;
    let pickupPointId = null;
    let addressData = null;
    let saveAddress = false;
    
    if (deliveryMethod === 'home') {
        // Проверяем обязательные поля адреса
        const country = document.getElementById('address-country-select').value;
        const region = document.getElementById('address-region-input').value;
        const city = document.getElementById('address-city-input').value;
        const street = document.getElementById('address-street-input').value;
        const house = document.getElementById('address-house-input').value;
        
        if (!country || !region || !city || !street || !house) {
            alert('Заполните все обязательные поля адреса');
            return;
        }
        
        // Если выбран сохраненный адрес, используем его ID
        const selectedAddressId = document.getElementById('shipping-address-select').value;
        if (selectedAddressId) {
            shippingAddressId = parseInt(selectedAddressId);
        } else {
            // Создаем новый адрес
            addressData = {
                country: country,
                region: region,
                city: city,
                street: street,
                house: house,
                apartment: document.getElementById('address-apartment-input').value || null,
                entrance: document.getElementById('address-entrance-input').value || null,
                floor: document.getElementById('address-floor-input').value || null
            };
            
            saveAddress = document.getElementById('save-address-checkbox').checked;
        }
    } else {
        pickupPointId = document.getElementById('pickup-point-select').value;
        if (!pickupPointId) {
            alert('Выберите пункт выдачи');
            return;
        }
    }
    
    const submitBtn = document.getElementById('submit-order-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Оформление...';
    
    try {
        const response = await fetch('/orders/api/create-part-order', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
                delivery_method: deliveryMethod,
                shipping_address_id: shippingAddressId,
                pickup_point_id: pickupPointId ? parseInt(pickupPointId) : null,
                address_data: addressData,
                save_address: saveAddress,
                payment_method: paymentMethod,
                customer_notes: customerNotes || null
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Ошибка создания заказа');
        }
        
        const data = await response.json();
        alert(`Заказ успешно оформлен! Номер заказа: ${data.order_id}`);
        window.location.href = '/';
    } catch (err) {
        console.error('Ошибка оформления заказа:', err);
        alert(err.message || 'Ошибка оформления заказа');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Оформить заказ';
    }
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

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadOrderData();
    
    // Обработчик изменения способа доставки
    document.getElementById('delivery-method-select').addEventListener('change', (e) => {
        const method = e.target.value;
        const homeSection = document.getElementById('home-delivery-section');
        const pickupSection = document.getElementById('pickup-section');
        
        if (method === 'home') {
            homeSection.style.display = 'block';
            pickupSection.style.display = 'none';
            
            // Включаем поля адреса
            document.getElementById('shipping-address-select').disabled = false;
            document.getElementById('address-country-select').disabled = false;
            document.getElementById('address-region-input').disabled = false;
            document.getElementById('address-city-input').disabled = false;
            document.getElementById('address-street-input').disabled = false;
            document.getElementById('address-house-input').disabled = false;
            document.getElementById('address-entrance-input').disabled = false;
            document.getElementById('address-floor-input').disabled = false;
            document.getElementById('address-apartment-input').disabled = false;
            document.getElementById('save-address-checkbox').disabled = false;
            
            // Сбрасываем поля самовывоза
            document.getElementById('country-select').value = '';
            document.getElementById('region-select').value = '';
            document.getElementById('city-select').value = '';
            document.getElementById('pickup-point-select').value = '';
        } else if (method === 'pickup') {
            homeSection.style.display = 'none';
            pickupSection.style.display = 'block';
            
            // Отключаем поля адреса
            document.getElementById('shipping-address-select').disabled = true;
            document.getElementById('address-country-select').disabled = true;
            document.getElementById('address-region-input').disabled = true;
            document.getElementById('address-city-input').disabled = true;
            document.getElementById('address-street-input').disabled = true;
            document.getElementById('address-house-input').disabled = true;
            document.getElementById('address-entrance-input').disabled = true;
            document.getElementById('address-floor-input').disabled = true;
            document.getElementById('address-apartment-input').disabled = true;
            document.getElementById('save-address-checkbox').disabled = true;
            
            document.getElementById('country-select').disabled = false;
        } else {
            homeSection.style.display = 'none';
            pickupSection.style.display = 'none';
            document.getElementById('country-select').disabled = true;
        }
        updateOrderSummary();
    });
    
    // Обработчик выбора сохраненного адреса
    document.getElementById('shipping-address-select').addEventListener('change', (e) => {
        if (e.target.value) {
            fillAddressFields(e.target.value);
        } else {
            // Очищаем поля при выборе "не выбрано"
            document.getElementById('address-country-select').value = '';
            document.getElementById('address-region-input').value = '';
            document.getElementById('address-city-input').value = '';
            document.getElementById('address-street-input').value = '';
            document.getElementById('address-house-input').value = '';
            document.getElementById('address-entrance-input').value = '';
            document.getElementById('address-floor-input').value = '';
            document.getElementById('address-apartment-input').value = '';
        }
    });
    
    // Обработчики для каскадных списков самовывоза
    document.getElementById('country-select').addEventListener('change', (e) => {
        if (e.target.value) {
            loadRegions(e.target.value);
        }
    });
    
    document.getElementById('region-select').addEventListener('change', (e) => {
        const country = document.getElementById('country-select').value;
        if (country && e.target.value) {
            loadCities(country, e.target.value);
        }
    });
    
    document.getElementById('city-select').addEventListener('change', (e) => {
        const country = document.getElementById('country-select').value;
        const region = document.getElementById('region-select').value;
        if (country && region && e.target.value) {
            loadPickupPoints(country, region, e.target.value);
        }
    });
    
    // Обновление суммы при изменении способа доставки
    document.getElementById('delivery-method-select').addEventListener('change', updateOrderSummary);
    
    // Обработчик кнопки оформления заказа
    document.getElementById('submit-order-btn').addEventListener('click', submitOrder);
});

