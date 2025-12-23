// src/static/js/account.js
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Проверка авторизации
        if (typeof isAuthenticated === 'function') {
            if (!(await isAuthenticated())) {
                window.location.href = '/api/auth/login';
                return;
            }
        } else {
            console.warn('isAuthenticated function not found, skipping auth check');
        }
    } catch (err) {
        console.error('Error checking authentication:', err);
        // Продолжаем работу даже если проверка авторизации не удалась
    }

    // Инициализация вкладок
    const tabs = document.querySelectorAll('.account-tab');
    const sections = document.querySelectorAll('.account-section');

    console.log('Found tabs:', tabs.length, 'Found sections:', sections.length);

    if (tabs.length === 0 || sections.length === 0) {
        console.error('Tabs or sections not found in DOM');
        return;
    }

    tabs.forEach(tab => {
        tab.addEventListener('click', async () => {
            const targetTab = tab.dataset.tab;
            console.log('Tab clicked:', targetTab);
            
            // Убираем активный класс со всех вкладок и разделов
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // Добавляем активный класс к выбранной вкладке и разделу
            tab.classList.add('active');
            const targetSection = document.getElementById(`${targetTab}-section`);
            if (targetSection) {
                targetSection.classList.add('active');
                
                // Скрываем формы редактирования/добавления адреса при переключении вкладок
                if (targetTab !== 'addresses') {
                    const addForm = document.getElementById('add-address-form');
                    const editForm = document.getElementById('edit-address-form');
                    const addBtn = document.getElementById('add-address-btn');
                    if (addForm) addForm.style.display = 'none';
                    if (editForm) editForm.style.display = 'none';
                    if (addBtn) addBtn.style.display = 'inline-block';
                }
                
                // Загружаем данные для выбранного раздела
                console.log('Loading section data for:', targetTab);
                try {
                    await loadSectionData(targetTab);
                } catch (err) {
                    console.error('Error loading section data:', err);
                }
            } else {
                console.error('Section not found:', `${targetTab}-section`);
            }
        });
    });

    // Проверяем hash в URL для переключения на нужную вкладку
    const hash = window.location.hash;
    let initialSection = 'profile';
    
    if (hash === '#orders') {
        initialSection = 'orders';
        // Переключаем на вкладку заказов
        const ordersTab = document.querySelector('.account-tab[data-tab="orders"]');
        if (ordersTab) {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            ordersTab.classList.add('active');
            const ordersSection = document.getElementById('orders-section');
            if (ordersSection) {
                ordersSection.classList.add('active');
            }
        }
    } else if (hash === '#addresses') {
        initialSection = 'addresses';
        // Переключаем на вкладку адресов
        const addressesTab = document.querySelector('.account-tab[data-tab="addresses"]');
        if (addressesTab) {
            tabs.forEach(t => t.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            addressesTab.classList.add('active');
            const addressesSection = document.getElementById('addresses-section');
            if (addressesSection) {
                addressesSection.classList.add('active');
            }
        }
    }
    
    // Загружаем данные для активного раздела
    try {
        await loadSectionData(initialSection);
    } catch (err) {
        console.error('Error loading initial section:', err);
    }
    
    // Инициализируем вкладки управления (только для менеджеров и администраторов)
    // Проверяем роль пользователя перед инициализацией
    try {
        const profileResponse = await fetch('/account/api/profile');
        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            const userRole = profileData.role;
            if (userRole === 'Менеджер' || userRole === 'MANAGER' || userRole === 'Администратор' || userRole === 'ADMIN') {
                if (document.querySelector('.management-tab')) {
                    initManagementTabs();
                }
            }
        }
    } catch (err) {
        console.error('Ошибка проверки роли для инициализации вкладок управления:', err);
    }
    
    // Обработчики для редактирования профиля (имя, фамилия, отчество)
    const editProfileBtn = document.getElementById('edit-profile-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const updateProfileForm = document.getElementById('update-profile-form');
    
    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'none';
            document.getElementById('profile-edit-form').style.display = 'block';
            fillEditForm();
        });
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('profile-edit-form').style.display = 'none';
            document.getElementById('profile-update-error').style.display = 'none';
            document.getElementById('profile-update-success').style.display = 'none';
        });
    }
    
    if (updateProfileForm) {
        updateProfileForm.addEventListener('submit', handleProfileUpdate);
    }
    
    // Обработчики для смены пароля
    const changePasswordBtn = document.getElementById('change-password-btn');
    const cancelPasswordBtn = document.getElementById('cancel-password-btn');
    const updatePasswordForm = document.getElementById('update-password-form');
    
    if (changePasswordBtn) {
        changePasswordBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'none';
            document.getElementById('change-password-form').style.display = 'block';
        });
    }
    
    if (cancelPasswordBtn) {
        cancelPasswordBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('change-password-form').style.display = 'none';
            document.getElementById('password-update-error').style.display = 'none';
            document.getElementById('password-update-success').style.display = 'none';
            updatePasswordForm.reset();
        });
    }
    
    if (updatePasswordForm) {
        updatePasswordForm.addEventListener('submit', handlePasswordUpdate);
    }
    
    // Обработчики для указания телефона
    const addPhoneBtn = document.getElementById('add-phone-btn');
    const cancelPhoneBtn = document.getElementById('cancel-phone-btn');
    const updatePhoneForm = document.getElementById('update-phone-form');
    
    if (addPhoneBtn) {
        addPhoneBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'none';
            document.getElementById('add-phone-form').style.display = 'block';
        });
    }
    
    if (cancelPhoneBtn) {
        cancelPhoneBtn.addEventListener('click', () => {
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('add-phone-form').style.display = 'none';
            document.getElementById('phone-update-error').style.display = 'none';
            document.getElementById('phone-update-success').style.display = 'none';
            updatePhoneForm.reset();
        });
    }
    
    if (updatePhoneForm) {
        updatePhoneForm.addEventListener('submit', handlePhoneUpdate);
        
        // Добавляем валидацию при вводе телефона
        const phoneInput = document.getElementById('add-phone-number');
        const phoneErrorDiv = document.getElementById('phone-format-error');
        
        if (phoneInput && phoneErrorDiv) {
            phoneInput.addEventListener('input', (e) => {
                const phone = e.target.value.trim();
                if (phone) {
                    const validation = validatePhoneNumber(phone);
                    if (!validation.valid) {
                        phoneErrorDiv.textContent = validation.message;
                        phoneErrorDiv.style.display = 'block';
                        e.target.setCustomValidity(validation.message);
                    } else {
                        phoneErrorDiv.style.display = 'none';
                        e.target.setCustomValidity('');
                    }
                } else {
                    phoneErrorDiv.style.display = 'none';
                    e.target.setCustomValidity('');
                }
            });
            
            phoneInput.addEventListener('blur', (e) => {
                const phone = e.target.value.trim();
                if (phone) {
                    const validation = validatePhoneNumber(phone);
                    if (!validation.valid) {
                        phoneErrorDiv.textContent = validation.message;
                        phoneErrorDiv.style.display = 'block';
                    }
                }
            });
        }
    }
    
    // Обработчики для добавления адреса
    const addAddressBtn = document.getElementById('add-address-btn');
    const cancelAddAddressBtn = document.getElementById('cancel-add-address-btn');
    const createAddressForm = document.getElementById('create-address-form');
    
    if (addAddressBtn) {
        addAddressBtn.addEventListener('click', async () => {
            // Скрываем список адресов и форму редактирования
            const addressesList = document.getElementById('addresses-list');
            const addressesEmpty = document.getElementById('addresses-empty');
            const editForm = document.getElementById('edit-address-form');
            if (addressesList) addressesList.style.display = 'none';
            if (addressesEmpty) addressesEmpty.style.display = 'none';
            if (editForm) editForm.style.display = 'none';
            
            // Показываем форму добавления
            document.getElementById('add-address-form').style.display = 'block';
            addAddressBtn.style.display = 'none';
            await loadCountriesForAddress();
        });
    }
    
    if (cancelAddAddressBtn) {
        cancelAddAddressBtn.addEventListener('click', () => {
            document.getElementById('add-address-form').style.display = 'none';
            addAddressBtn.style.display = 'inline-block';
            createAddressForm.reset();
            document.getElementById('address-create-error').style.display = 'none';
            document.getElementById('address-create-success').style.display = 'none';
            
            // Показываем список адресов обратно
            const addressesList = document.getElementById('addresses-list');
            const addressesEmpty = document.getElementById('addresses-empty');
            if (addressesList && addressesList.innerHTML.trim() !== '') {
                addressesList.style.display = 'grid';
            }
            if (addressesEmpty) {
                // Проверяем, нужно ли показывать empty
                const addresses = document.querySelectorAll('.address-card');
                if (addresses.length === 0) {
                    addressesEmpty.style.display = 'block';
                }
            }
        });
    }
    
    if (createAddressForm) {
        createAddressForm.addEventListener('submit', handleAddressCreate);
    }
    
    // Обработчики для редактирования адреса
    const cancelEditAddressBtn = document.getElementById('cancel-edit-address-btn');
    const updateAddressForm = document.getElementById('update-address-form');
    
    if (cancelEditAddressBtn) {
        cancelEditAddressBtn.addEventListener('click', () => {
            const editForm = document.getElementById('edit-address-form');
            if (editForm) editForm.style.display = 'none';
            const errorDiv = document.getElementById('address-update-error');
            const successDiv = document.getElementById('address-update-success');
            if (errorDiv) errorDiv.style.display = 'none';
            if (successDiv) successDiv.style.display = 'none';
            if (updateAddressForm) updateAddressForm.reset();
            
            // Показываем список адресов обратно
            const addressesList = document.getElementById('addresses-list');
            const addressesEmpty = document.getElementById('addresses-empty');
            if (addressesList && addressesList.innerHTML.trim() !== '') {
                addressesList.style.display = 'grid';
            }
            if (addressesEmpty) {
                // Проверяем, нужно ли показывать empty
                const addresses = document.querySelectorAll('.address-card');
                if (addresses.length === 0) {
                    addressesEmpty.style.display = 'block';
                }
            }
        });
    }
    
    if (updateAddressForm) {
        updateAddressForm.addEventListener('submit', handleAddressUpdate);
    }
});

let currentProfileData = null;

async function loadSectionData(section) {
    switch (section) {
        case 'profile':
            await loadProfile();
            break;
        case 'orders':
            await loadOrders();
            break;
        case 'addresses':
            await loadAddresses();
            break;
    }
}

async function loadProfile() {
    const loader = document.querySelector('#profile-section .account-loader');
    const content = document.getElementById('profile-content');
    const error = document.getElementById('profile-error');

    if (!loader || !content || !error) {
        console.error('Profile section elements not found');
        return;
    }

    loader.style.display = 'flex';
    content.style.display = 'none';
    error.style.display = 'none';

    try {
        const response = await fetch('/account/api/profile');
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Ошибка загрузки профиля: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        currentProfileData = data; // Сохраняем данные для формы редактирования
        
        const firstNameEl = document.getElementById('profile-first-name');
        const lastNameEl = document.getElementById('profile-last-name');
        const middleNameEl = document.getElementById('profile-middle-name');
        const emailEl = document.getElementById('profile-email');
        const phoneEl = document.getElementById('profile-phone');
        
        if (firstNameEl) firstNameEl.textContent = data.first_name || '—';
        if (lastNameEl) lastNameEl.textContent = data.last_name || '—';
        if (middleNameEl) middleNameEl.textContent = data.middle_name || '—';
        if (emailEl) emailEl.textContent = data.email || '—';
        if (phoneEl) phoneEl.textContent = data.phone_number || '—';
        
        // Показываем кнопку "Указать телефон" только если телефон не указан
        const addPhoneBtn = document.getElementById('add-phone-btn');
        if (addPhoneBtn) {
            if (!data.phone_number || data.phone_number === '') {
                addPhoneBtn.style.display = 'inline-block';
            } else {
                addPhoneBtn.style.display = 'none';
            }
        }
        
        const regDateEl = document.getElementById('profile-registration-date');
        const statusEl = document.getElementById('profile-status');
        const userIdEl = document.getElementById('profile-user-id');
        
        if (regDateEl) {
            if (data.registration_date) {
                const date = new Date(data.registration_date);
                regDateEl.textContent = date.toLocaleDateString('ru-RU', { year: 'numeric', month: 'long', day: 'numeric' });
            } else {
                regDateEl.textContent = '—';
            }
        }
        
        const statusMap = {
            'PENDING_VERIFICATION': 'Ожидает верификации',
            'ACTIVE': 'Активен',
            'SUSPENDED': 'Заблокирован'
        };
        if (statusEl) statusEl.textContent = statusMap[data.status] || data.status;
        if (userIdEl) userIdEl.textContent = data.user_id || '';
        
        // Показываем плашку верификации, если нужно
        updateVerificationBanner(data);
        
        // Показываем вкладку "Управление" для менеджера и администратора
        showManagementTab(data.role);
        
        loader.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        console.error('Ошибка загрузки профиля:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
    }
}

async function loadOrders() {
    const loader = document.querySelector('#orders-section .account-loader');
    const content = document.getElementById('orders-content');
    const empty = document.getElementById('orders-empty');
    const list = document.getElementById('orders-list');
    const error = document.getElementById('orders-error');

    loader.style.display = 'flex';
    content.style.display = 'none';
    error.style.display = 'none';

    try {
        const response = await fetch('/account/api/orders');
        if (!response.ok) throw new Error('Ошибка загрузки заказов');
        
        const data = await response.json();
        const orders = data.orders || [];
        
        loader.style.display = 'none';
        content.style.display = 'block';
        
        if (orders.length === 0) {
            empty.style.display = 'block';
            list.innerHTML = '';
        } else {
            empty.style.display = 'none';
            list.innerHTML = orders.map(order => renderOrder(order)).join('');
        }
    } catch (err) {
        console.error('Ошибка загрузки заказов:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
    }
}

function renderOrder(order) {
    const statusMap = {
        'PROCESSING': { text: 'В обработке', class: 'status-processing' },
        'В обработке': { text: 'В обработке', class: 'status-processing' },
        'CONFIRMED': { text: 'Подтвержден', class: 'status-confirmed' },
        'SHIPPED': { text: 'Отправлен', class: 'status-shipped' },
        'Отправлен': { text: 'Отправлен', class: 'status-shipped' },
        'DELIVERED': { text: 'Доставлен', class: 'status-delivered' },
        'Доставлен': { text: 'Доставлен', class: 'status-delivered' },
        'CANCELLED': { text: 'Отменен', class: 'status-cancelled' },
        'Отменен': { text: 'Отменен', class: 'status-cancelled' }
    };
    
    const statusInfo = statusMap[order.status] || { text: order.status, class: 'status-default' };
    
    const paymentMethodMap = {
        'CASH': 'Наличные',
        'CARD': 'Банковская карта',
        'ONLINE': 'Онлайн оплата'
    };
    
    const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }) : '—';
    
    let itemsHtml = '';
    
    // Запчасти
    if (order.order_items && order.order_items.length > 0) {
        itemsHtml += '<div class="order-items-group"><h4>Запчасти:</h4><ul class="order-items-list">';
        order.order_items.forEach(item => {
            const imageUrl = item.image || '/static/images/parts/base.png';
            itemsHtml += `
                <li class="order-item">
                    <img src="${imageUrl}" alt="${item.part_name}" class="order-item-image">
                    <div class="order-item-info">
                        <div class="order-item-name">${item.part_name}</div>
                        <div class="order-item-details">${item.manufacturer} × ${item.quantity}</div>
                    </div>
                    <div class="order-item-price">${item.total.toLocaleString('ru-RU')} ₽</div>
                </li>
            `;
        });
        itemsHtml += '</ul></div>';
    }
    
    // Автомобили
    if (order.car_orders && order.car_orders.length > 0) {
        itemsHtml += '<div class="order-items-group"><h4>Автомобили:</h4><ul class="order-items-list">';
        order.car_orders.forEach(car => {
            const imageUrl = car.image || '/static/images/cars/base.jpeg';
            itemsHtml += `
                <li class="order-item">
                    <img src="${imageUrl}" alt="${car.brand} ${car.model}" class="order-item-image">
                    <div class="order-item-info">
                        <div class="order-item-name">${car.brand} ${car.model}</div>
                        <div class="order-item-details">${car.year} год</div>
                    </div>
                    <div class="order-item-price">${car.price.toLocaleString('ru-RU')} ₽</div>
                </li>
            `;
        });
        itemsHtml += '</ul></div>';
    }
    
    const deliveryInfo = order.delivery_info ? 
        `<div class="order-delivery"><strong>${order.delivery_info.type === 'address' ? 'Адрес доставки' : 'Пункт выдачи'}:</strong> ${order.delivery_info.full_address}</div>` : 
        '';
    
    return `
        <div class="order-card">
            <div class="order-header">
                <div class="order-id">Заказ №${order.order_id}</div>
                <div class="order-date">${orderDate}</div>
                <div class="order-status ${statusInfo.class}">${statusInfo.text}</div>
            </div>
            <div class="order-body">
                ${itemsHtml}
                ${deliveryInfo}
                ${order.tracking_number ? `<div class="order-tracking"><strong>Трек-номер:</strong> ${order.tracking_number}</div>` : ''}
                ${order.customer_notes ? `<div class="order-notes"><strong>Примечания:</strong> ${order.customer_notes}</div>` : ''}
            </div>
            <div class="order-footer">
                <div class="order-payment">
                    <strong>Способ оплаты:</strong> ${paymentMethodMap[order.payment_method] || order.payment_method}
                    ${order.is_paid ? '<span class="order-paid">✓ Оплачен</span>' : '<span class="order-unpaid">Не оплачен</span>'}
                </div>
                <div class="order-total">
                    <strong>Итого:</strong> ${order.total_amount.toLocaleString('ru-RU')} ₽
                </div>
                <div class="order-actions" style="margin-top: 15px; display: flex; gap: 10px; justify-content: flex-end;">
                    ${order.is_paid ? `
                        <a href="/orders/api/order/${order.order_id}/receipt" class="btn btn-success btn-sm" style="text-decoration: none; display: inline-block;">📄 Скачать чек</a>
                    ` : ''}
                    ${!order.is_paid && order.status !== 'Отменен' && order.status !== 'CANCELLED' ? `
                        <button class="btn btn-primary btn-sm" onclick="payOrder(${order.order_id})">Оплатить заказ</button>
                    ` : ''}
                    ${order.status !== 'Отменен' && order.status !== 'CANCELLED' && order.status !== 'Доставлен' && order.status !== 'DELIVERED' ? `
                        <button class="btn btn-secondary btn-sm" onclick="cancelOrder(${order.order_id})">Отменить заказ</button>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
}

async function loadAddresses() {
    const loader = document.querySelector('#addresses-section .account-loader');
    const content = document.getElementById('addresses-content');
    const empty = document.getElementById('addresses-empty');
    const list = document.getElementById('addresses-list');
    const error = document.getElementById('addresses-error');

    loader.style.display = 'flex';
    content.style.display = 'none';
    error.style.display = 'none';

    try {
        const response = await fetch('/api/addresses/');
        if (!response.ok) throw new Error('Ошибка загрузки адресов');
        
        const data = await response.json();
        const addresses = data.addresses || [];
        
        loader.style.display = 'none';
        content.style.display = 'block';
        
        // Скрываем формы редактирования/добавления при загрузке адресов
        document.getElementById('add-address-form').style.display = 'none';
        document.getElementById('edit-address-form').style.display = 'none';
        document.getElementById('add-address-btn').style.display = 'inline-block';
        
        if (addresses.length === 0) {
            empty.style.display = 'block';
            list.innerHTML = '';
            list.style.display = 'none';
        } else {
            empty.style.display = 'none';
            list.innerHTML = addresses.map(addr => renderAddress(addr)).join('');
            list.style.display = 'grid';
            
            // Добавляем обработчики для кнопок редактирования
            document.querySelectorAll('.btn-edit-address').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const addressId = parseInt(e.target.dataset.addressId);
                    const address = addresses.find(a => a.address_id === addressId);
                    if (address) {
                        await showEditAddressForm(address);
                    }
                });
            });
        }
    } catch (err) {
        console.error('Ошибка загрузки адресов:', err);
        loader.style.display = 'none';
        error.style.display = 'block';
    }
}

async function showEditAddressForm(address) {
    // Скрываем форму добавления, если она открыта
    document.getElementById('add-address-form').style.display = 'none';
    document.getElementById('add-address-btn').style.display = 'inline-block';
    
    // Скрываем список адресов
    const addressesList = document.getElementById('addresses-list');
    const addressesEmpty = document.getElementById('addresses-empty');
    if (addressesList) addressesList.style.display = 'none';
    if (addressesEmpty) addressesEmpty.style.display = 'none';
    
    // Показываем форму редактирования
    document.getElementById('edit-address-form').style.display = 'block';
    
    // Заполняем форму данными адреса (кроме страны - её загрузим отдельно)
    document.getElementById('edit-addr-id').value = address.address_id;
    document.getElementById('edit-addr-region').value = address.region || '';
    document.getElementById('edit-addr-city').value = address.city || '';
    document.getElementById('edit-addr-street').value = address.street || '';
    document.getElementById('edit-addr-house').value = address.house || '';
    document.getElementById('edit-addr-apartment').value = address.apartment || '';
    document.getElementById('edit-addr-entrance').value = address.entrance || '';
    document.getElementById('edit-addr-floor').value = address.floor || '';
    document.getElementById('edit-addr-postal').value = address.postal_code || '';
    document.getElementById('edit-addr-recipient-name').value = address.recipient_name || '';
    document.getElementById('edit-addr-recipient-phone').value = address.recipient_phone || '';
    document.getElementById('edit-addr-is-default').checked = address.is_default || false;
    
    // Загружаем страны и устанавливаем текущее значение после загрузки
    const countryToSet = address.country || '';
    await loadCountriesForAddress('edit-addr-country');
    // Устанавливаем значение страны после загрузки списка
    const countrySelect = document.getElementById('edit-addr-country');
    if (countrySelect && countryToSet) {
        countrySelect.value = countryToSet;
    }
    
    // Прокручиваем к форме
    document.getElementById('edit-address-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function handleAddressUpdate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('address-update-error');
    const successDiv = document.getElementById('address-update-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const addressId = parseInt(formData.get('address_id'));
    const addressData = {
        country: formData.get('country'),
        region: formData.get('region') || null,
        city: formData.get('city'),
        street: formData.get('street'),
        house: formData.get('house'),
        apartment: formData.get('apartment') || null,
        entrance: formData.get('entrance') || null,
        floor: formData.get('floor') || null,
        postal_code: formData.get('postal_code') || null,
        recipient_name: formData.get('recipient_name'),
        recipient_phone: formData.get('recipient_phone'),
        is_default: formData.get('is_default') === 'on'
    };
    
    try {
        const response = await fetch(`/api/addresses/${addressId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(addressData)
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        successDiv.textContent = result.message || 'Адрес успешно обновлен';
        successDiv.style.display = 'block';
        
        // Перезагружаем адреса и скрываем форму через 1 секунду
        setTimeout(() => {
            loadAddresses();
            document.getElementById('edit-address-form').style.display = 'none';
            e.target.reset();
        }, 1000);
    } catch (err) {
        errorDiv.textContent = err.message || 'Ошибка обновления адреса';
        errorDiv.style.display = 'block';
    }
}

function renderAddress(addr) {
    // Название адреса: "Город, улица, дом"
    const shortAddress = `${addr.city}, ${addr.street}, ${addr.house}`;
    
    // Полный адрес для серого текста
    const fullAddressParts = [];
    if (addr.country) fullAddressParts.push(addr.country);
    if (addr.region) fullAddressParts.push(addr.region);
    fullAddressParts.push(addr.city, addr.street, addr.house);
    if (addr.apartment) fullAddressParts.push(`кв. ${addr.apartment}`);
    const fullAddress = fullAddressParts.join(', ');
    
    const details = [];
    if (addr.entrance) details.push(`подъезд ${addr.entrance}`);
    if (addr.floor) details.push(`этаж ${addr.floor}`);
    
    return `
        <div class="address-card" data-address-id="${addr.address_id}">
            <div class="address-header">
                <div class="address-type">${addr.address_type === 'EXACT' ? 'Точный адрес' : 'Примерный адрес'}</div>
                <div class="address-header-right">
                    ${addr.is_default ? '<span class="address-default">По умолчанию</span>' : ''}
                    <button class="btn-edit-address" data-address-id="${addr.address_id}">Редактировать</button>
                </div>
            </div>
            <div class="address-body">
                <div class="address-short">${shortAddress}</div>
                <div class="address-full-gray">${fullAddress}</div>
                ${details.length > 0 ? `<div class="address-details">${details.join(', ')}</div>` : ''}
                ${addr.postal_code ? `<div class="address-postal">Индекс: ${addr.postal_code}</div>` : ''}
                <div class="address-recipient">
                    <strong>Получатель:</strong> ${addr.recipient_name}
                    ${addr.recipient_phone ? `, ${addr.recipient_phone}` : ''}
                </div>
            </div>
        </div>
    `;
}

function fillEditForm() {
    if (!currentProfileData) return;
    
    document.getElementById('edit-last-name').value = currentProfileData.last_name || '';
    document.getElementById('edit-first-name').value = currentProfileData.first_name || '';
    document.getElementById('edit-middle-name').value = currentProfileData.middle_name || '';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('profile-update-error');
    const successDiv = document.getElementById('profile-update-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const updateData = {
        first_name: formData.get('first_name'),
        last_name: formData.get('last_name'),
        middle_name: formData.get('middle_name') || null
    };
    
    try {
        const response = await fetch('/account/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        successDiv.textContent = result.message || 'Профиль успешно обновлен';
        successDiv.style.display = 'block';
        
        // Перезагружаем профиль через 1 секунду
        setTimeout(() => {
            loadProfile();
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('profile-edit-form').style.display = 'none';
        }, 1000);
    } catch (err) {
        errorDiv.textContent = err.message || 'Ошибка обновления профиля';
        errorDiv.style.display = 'block';
    }
}

async function handlePasswordUpdate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('password-update-error');
    const successDiv = document.getElementById('password-update-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const newPassword = formData.get('new_password');
    const confirmPassword = formData.get('confirm_password');
    
    // Проверка совпадения паролей
    if (newPassword !== confirmPassword) {
        errorDiv.textContent = 'Новые пароли не совпадают';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Проверка минимальной длины пароля
    if (newPassword.length < 6) {
        errorDiv.textContent = 'Пароль должен содержать минимум 6 символов';
        errorDiv.style.display = 'block';
        return;
    }
    
    const updateData = {
        current_password: formData.get('current_password'),
        new_password: newPassword
    };
    
    try {
        const response = await fetch('/account/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        successDiv.textContent = result.message || 'Пароль успешно изменен';
        successDiv.style.display = 'block';
        
        // Перезагружаем профиль и скрываем форму через 1 секунду
        setTimeout(() => {
            loadProfile();
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('change-password-form').style.display = 'none';
            e.target.reset();
        }, 1000);
    } catch (err) {
        errorDiv.textContent = err.message || 'Ошибка изменения пароля';
        errorDiv.style.display = 'block';
    }
}

// Валидация формата телефона
function validatePhoneNumber(phone) {
    if (!phone) return { valid: false, message: 'Телефон не может быть пустым' };
    
    // Удаляем все пробелы, дефисы, скобки и другие символы для проверки
    const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
    
    // Проверяем различные форматы:
    // +7XXXXXXXXXX (11 цифр после +7)
    // 8XXXXXXXXXX (11 цифр начинающихся с 8)
    // 7XXXXXXXXXX (11 цифр начинающихся с 7)
    // XXXXXXXXXX (10 цифр)
    
    // Проверяем, что остались только цифры
    if (!/^\d+$/.test(cleaned)) {
        return { valid: false, message: 'Телефон должен содержать только цифры, пробелы, дефисы, скобки и знак +' };
    }
    
    // Проверяем длину (должно быть 10 или 11 цифр)
    if (cleaned.length < 10 || cleaned.length > 11) {
        return { valid: false, message: 'Телефон должен содержать 10 или 11 цифр' };
    }
    
    // Если 11 цифр, проверяем что начинается с 7 или 8
    if (cleaned.length === 11) {
        if (!cleaned.startsWith('7') && !cleaned.startsWith('8')) {
            return { valid: false, message: 'Телефон из 11 цифр должен начинаться с 7 или 8' };
        }
    }
    
    return { valid: true };
}

async function handlePhoneUpdate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('phone-update-error');
    const successDiv = document.getElementById('phone-update-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const phoneNumber = formData.get('phone_number').trim();
    
    // Валидация формата телефона
    const validation = validatePhoneNumber(phoneNumber);
    if (!validation.valid) {
        errorDiv.textContent = validation.message;
        errorDiv.style.display = 'block';
        return;
    }
    
    const updateData = {
        phone_number: phoneNumber
    };
    
    try {
        const response = await fetch('/account/api/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updateData)
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        successDiv.textContent = result.message || 'Телефон успешно сохранен';
        successDiv.style.display = 'block';
        
        // Перезагружаем профиль и скрываем форму через 1 секунду
        setTimeout(() => {
            loadProfile();
            document.querySelector('.profile-view').style.display = 'block';
            document.getElementById('add-phone-form').style.display = 'none';
            e.target.reset();
        }, 1000);
    } catch (err) {
        errorDiv.textContent = err.message || 'Ошибка сохранения телефона';
        errorDiv.style.display = 'block';
    }
}

async function handleAddressCreate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('address-create-error');
    const successDiv = document.getElementById('address-create-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const addressData = {
        country: formData.get('country'),
        region: formData.get('region') || null,
        city: formData.get('city'),
        street: formData.get('street'),
        house: formData.get('house'),
        apartment: formData.get('apartment') || null,
        entrance: formData.get('entrance') || null,
        floor: formData.get('floor') || null,
        postal_code: formData.get('postal_code') || null,
        recipient_name: formData.get('recipient_name'),
        recipient_phone: formData.get('recipient_phone'),
        is_default: formData.get('is_default') === 'on'
    };
    
    try {
        const response = await fetch('/api/addresses/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(addressData)
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        
        successDiv.textContent = result.message || 'Адрес успешно добавлен';
        successDiv.style.display = 'block';
        
        // Перезагружаем адреса и скрываем форму через 1 секунду
        setTimeout(() => {
            loadAddresses();
            e.target.reset();
        }, 1000);
    } catch (err) {
        errorDiv.textContent = err.message || 'Ошибка создания адреса';
        errorDiv.style.display = 'block';
    }
}

async function loadCountriesForAddress(selectId = 'addr-country') {
    const countrySelect = document.getElementById(selectId);
    if (!countrySelect) return;
    
    // Очищаем список, оставляя только первый option
    const currentValue = countrySelect.value;
    countrySelect.innerHTML = '<option value="">Выберите страну</option>';
    
    try {
        const response = await fetch('/api/pickup/countries');
        if (!response.ok) throw new Error('Ошибка загрузки стран');
        
        const data = await response.json();
        const countries = data.countries || [];
        
        // Заполняем список стран
        countries.forEach(country => {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            if (country === currentValue) {
                option.selected = true;
            }
            countrySelect.appendChild(option);
        });
    } catch (err) {
        console.error('Ошибка загрузки стран:', err);
        // В случае ошибки оставляем текстовое поле функциональным
        const errorOption = document.createElement('option');
        errorOption.value = '';
        errorOption.textContent = 'Ошибка загрузки стран';
        errorOption.disabled = true;
        countrySelect.appendChild(errorOption);
    }
}

function updateVerificationBanner(profileData) {
    const banner = document.getElementById('verification-banner');
    const bannerTitle = document.getElementById('verification-banner-title');
    const bannerMessage = document.getElementById('verification-banner-message');
    const bannerBtn = document.getElementById('verification-banner-btn');
    
    if (!banner || !bannerTitle || !bannerMessage || !bannerBtn) return;
    
    // Проверяем, что нужно подтвердить
    let needsVerification = false;
    let verificationType = null;
    let message = '';
    
    if (!profileData.email_verified) {
        needsVerification = true;
        verificationType = 'email';
        message = 'Подтвердите ваш email для полного доступа к функциям сайта';
    } else if (profileData.phone_number && !profileData.phone_verified) {
        needsVerification = true;
        verificationType = 'phone';
        message = 'Подтвердите ваш телефон для полного доступа к функциям сайта';
    }
    
    if (needsVerification) {
        bannerTitle.textContent = verificationType === 'email' ? 'Email не подтвержден' : 'Телефон не подтвержден';
        bannerMessage.textContent = message;
        bannerBtn.onclick = () => {
            window.location.href = `/account/verification?type=${verificationType}`;
        };
        banner.style.display = 'block';
    } else {
        banner.style.display = 'none';
    }
}

// Оплата заказа
async function payOrder(orderId) {
    if (!confirm('Перейти к оплате заказа?')) {
        return;
    }
    
    window.location.href = `/orders/payment?order_id=${orderId}`;
}

// Отмена заказа
async function cancelOrder(orderId) {
    if (!confirm('Вы уверены, что хотите отменить заказ? Это действие нельзя отменить.')) {
        return;
    }
    
    try {
        const response = await fetch(`/orders/api/cancel/${orderId}`, {
            method: 'POST',
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const result = await response.json();
        alert(result.message || 'Заказ успешно отменен');
        
        // Перезагружаем список заказов
        await loadOrders();
    } catch (err) {
        console.error('Ошибка отмены заказа:', err);
        await showError(err, 'Ошибка отмены заказа');
    }
}

// Показ вкладки "Управление" для менеджера и администратора
function showManagementTab(role) {
    const managementTab = document.getElementById('management-tab');
    const adminPanelTab = document.getElementById('admin-panel-tab');
    
    if (!managementTab) {
        return;
    }
    
    // Показываем вкладку только для менеджера и администратора
    if (role === 'Менеджер' || role === 'MANAGER' || role === 'Администратор' || role === 'ADMIN') {
        managementTab.style.display = 'inline-block';
    } else {
        managementTab.style.display = 'none';
    }
    
    // Показываем вкладку админ-панели только для администратора
    if (adminPanelTab) {
        if (role === 'Администратор' || role === 'ADMIN') {
            adminPanelTab.style.display = 'inline-block';
        } else {
            adminPanelTab.style.display = 'none';
        }
    }
}

// ========== УПРАВЛЕНИЕ ЗАКАЗАМИ (для менеджеров и администраторов) ==========

// Инициализация вкладок управления
function initManagementTabs() {
    const managementTabs = document.querySelectorAll('.management-tab');
    const managementSubsections = document.querySelectorAll('.management-subsection');
    
    managementTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Убираем активный класс со всех вкладок и подразделов
            managementTabs.forEach(t => {
                t.classList.remove('active');
                t.style.borderBottomColor = 'transparent';
            });
            managementSubsections.forEach(s => s.style.display = 'none');
            
            // Добавляем активный класс к выбранной вкладке
            tab.classList.add('active');
            tab.style.borderBottomColor = '#007bff';
            
            // Показываем соответствующий подраздел
            const targetSubsection = document.getElementById(`${targetTab}-content`);
            if (targetSubsection) {
                targetSubsection.style.display = 'block';
                
                // Загружаем данные для раздела управления заказами
                if (targetTab === 'orders-management') {
                    loadManagementOrders();
                } else if (targetTab === 'add-car') {
                    // Инициализируем форму, если она еще не инициализирована
                    if (document.getElementById('add-car-form') && !document.getElementById('add-car-form').dataset.initialized) {
                        initAddCarForm();
                        document.getElementById('add-car-form').dataset.initialized = 'true';
                    }
                } else if (targetTab === 'add-part') {
                    // Инициализируем форму, если она еще не инициализирована
                    if (document.getElementById('add-part-form') && !document.getElementById('add-part-form').dataset.initialized) {
                        initAddPartForm();
                        document.getElementById('add-part-form').dataset.initialized = 'true';
                    }
                } else if (targetTab === 'admin-panel') {
                    // Инициализируем админ-панель, если она еще не инициализирована
                    if (!document.getElementById('admin-panel-content').dataset.initialized) {
                        initAdminPanel();
                        document.getElementById('admin-panel-content').dataset.initialized = 'true';
                    }
                }
            }
        });
    });
    
    // Активируем первую вкладку по умолчанию
    if (managementTabs.length > 0) {
        const firstTab = managementTabs[0];
        firstTab.classList.add('active');
        firstTab.style.borderBottomColor = '#007bff';
        const firstSubsection = document.getElementById(`${firstTab.dataset.tab}-content`);
        if (firstSubsection) {
            firstSubsection.style.display = 'block';
            if (firstTab.dataset.tab === 'orders-management') {
                loadManagementOrders();
            } else if (firstTab.dataset.tab === 'add-car') {
                // Инициализируем форму, если она еще не инициализирована
                if (document.getElementById('add-car-form') && !document.getElementById('add-car-form').dataset.initialized) {
                    initAddCarForm();
                    document.getElementById('add-car-form').dataset.initialized = 'true';
                }
            } else if (firstTab.dataset.tab === 'add-part') {
                // Инициализируем форму, если она еще не инициализирована
                if (document.getElementById('add-part-form') && !document.getElementById('add-part-form').dataset.initialized) {
                    initAddPartForm();
                    document.getElementById('add-part-form').dataset.initialized = 'true';
                }
            }
        }
    }
}

// Загрузка заказов для управления
async function loadManagementOrders() {
    const loader = document.querySelector('#orders-management-content .account-loader');
    const content = document.getElementById('orders-management-list');
    const empty = document.getElementById('orders-management-empty');
    const error = document.getElementById('orders-management-error');
    
    if (!loader || !content || !empty || !error) {
        return;
    }
    
    loader.style.display = 'flex';
    content.style.display = 'none';
    empty.style.display = 'none';
    error.style.display = 'none';
    
    try {
        const response = await fetch('/account/api/management/orders');
        if (!response.ok) {
            // Если 403 - это нормально для обычных пользователей, просто не показываем ошибку
            if (response.status === 403) {
                loader.style.display = 'none';
                empty.style.display = 'block';
                return;
            }
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        const orders = data.orders || [];
        
        loader.style.display = 'none';
        
        if (orders.length === 0) {
            empty.style.display = 'block';
        } else {
            content.style.display = 'block';
            renderManagementOrders(orders);
        }
    } catch (err) {
        console.error('Ошибка загрузки заказов для управления:', err);
        loader.style.display = 'none';
        // Не показываем ошибку пользователю, если это 403
        if (err.message && !err.message.includes('403')) {
            error.style.display = 'block';
            await showError(err);
        } else {
            empty.style.display = 'block';
        }
    }
}

// Отображение заказов для управления
function renderManagementOrders(orders) {
    const container = document.getElementById('orders-management-list');
    if (!container) return;
    
    container.innerHTML = orders.map(order => {
        const orderDate = order.order_date ? new Date(order.order_date).toLocaleDateString('ru-RU') : '—';
        const statusUpdated = order.status_updated ? new Date(order.status_updated).toLocaleDateString('ru-RU') : '—';
        
        // Определяем доступные действия в зависимости от текущего статуса
        let statusActions = '';
        if (order.status === 'В обработке') {
            statusActions = `
                <button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${order.order_id}, 'Отправлен', null)">
                    Отметить как "Отправлен"
                </button>
                <button class="btn btn-info btn-sm" onclick="updateOrderPaymentStatus(${order.order_id}, ${!order.is_paid})">
                    ${order.is_paid ? 'Отметить как не оплачен' : 'Отметить как оплачен'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="updateOrderStatus(${order.order_id}, 'Отменен', null)">
                    Отменить заказ
                </button>
            `;
        } else if (order.status === 'Отправлен') {
            statusActions = `
                <button class="btn btn-success btn-sm" onclick="updateOrderStatus(${order.order_id}, 'Доставлен', null)">
                    Отметить как "Доставлен"
                </button>
                <button class="btn btn-info btn-sm" onclick="updateOrderPaymentStatus(${order.order_id}, ${!order.is_paid})">
                    ${order.is_paid ? 'Отметить как не оплачен' : 'Отметить как оплачен'}
                </button>
                <button class="btn btn-danger btn-sm" onclick="updateOrderStatus(${order.order_id}, 'Отменен', null)">
                    Отменить заказ
                </button>
            `;
        }
        
        // Информация о товарах
        let itemsHtml = '';
        if (order.order_items && order.order_items.length > 0) {
            itemsHtml = order.order_items.map(item => `
                <div class="order-item" style="display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid #eee;">
                    <img src="${item.image}" alt="${item.part_name}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${item.part_name}</div>
                        <div style="font-size: 14px; color: #666;">${item.manufacturer || '—'}</div>
                        <div style="font-size: 14px; color: #666;">Количество: ${item.quantity} x ${item.price.toFixed(2)} ₽</div>
                    </div>
                    <div style="font-weight: 600;">${item.total.toFixed(2)} ₽</div>
                </div>
            `).join('');
        }
        
        // Информация об автомобилях
        let carsHtml = '';
        if (order.car_orders && order.car_orders.length > 0) {
            carsHtml = order.car_orders.map(car => `
                <div class="order-item" style="display: flex; align-items: center; gap: 15px; padding: 10px; border-bottom: 1px solid #eee;">
                    <img src="${car.image}" alt="${car.brand} ${car.model}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 4px;">
                    <div style="flex: 1;">
                        <div style="font-weight: 500;">${car.brand} ${car.model}${car.year ? ` (${car.year})` : ''}</div>
                    </div>
                    <div style="font-weight: 600;">${car.price.toFixed(2)} ₽</div>
                </div>
            `).join('');
        }
        
        // Информация о клиенте
        const customerInfo = order.user ? `
            <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee;">
                <strong>Клиент:</strong> ${order.user.first_name || ''} ${order.user.last_name || ''}<br>
                <strong>Email:</strong> ${order.user.email || '—'}<br>
                ${order.user.phone_number ? `<strong>Телефон:</strong> ${order.user.phone_number}` : ''}
            </div>
        ` : '';
        
        // Определяем, является ли заказ завершенным
        const isCompleted = order.status === 'Доставлен' || order.status === 'DELIVERED' || order.status === 'Отменен' || order.status === 'CANCELLED';
        const orderCardClass = isCompleted ? 'order-card completed-order' : 'order-card';
        
        return `
            <div class="${orderCardClass}" style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                    <div>
                        <h3 style="margin: 0 0 5px 0;">Заказ #${order.order_id}</h3>
                        <div style="font-size: 14px; color: #666;">
                            Дата: ${orderDate} | Обновлен: ${statusUpdated}
                        </div>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 18px; font-weight: 600; color: #007bff; margin-bottom: 5px;">
                            ${order.total_amount.toFixed(2)} ₽
                        </div>
                        <div style="padding: 5px 10px; background: ${order.status === 'В обработке' ? '#ffc107' : order.status === 'Отправлен' ? '#17a2b8' : '#28a745'}; color: #fff; border-radius: 4px; display: inline-block; font-size: 12px;">
                            ${order.status}
                        </div>
                        ${order.is_paid ? '<div style="margin-top: 5px; font-size: 12px; color: #28a745;">✓ Оплачен</div>' : '<div style="margin-top: 5px; font-size: 12px; color: #dc3545;">Не оплачен</div>'}
                    </div>
                </div>
                
                ${itemsHtml || carsHtml ? `
                    <div style="margin-bottom: 15px;">
                        ${itemsHtml}
                        ${carsHtml}
                    </div>
                ` : ''}
                
                ${order.delivery_info ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #f8f9fa; border-radius: 4px;">
                        <strong>Доставка:</strong> ${order.delivery_info.full_address}
                    </div>
                ` : ''}
                
                ${order.customer_notes ? `
                    <div style="margin-bottom: 15px; padding: 10px; background: #fff3cd; border-left: 3px solid #ffc107; border-radius: 4px;">
                        <strong>Комментарий клиента:</strong><br>
                        <div style="margin-top: 5px; color: #666;">${order.customer_notes}</div>
                    </div>
                ` : ''}
                
                <div style="margin-bottom: 15px; padding: 10px; background: #e7f3ff; border-left: 3px solid #007bff; border-radius: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
                        <strong>Комментарии менеджера:</strong>
                        <button class="btn btn-sm btn-secondary" onclick="toggleEditAdminNotes(${order.order_id})" style="padding: 2px 6px; font-size: 11px;">
                            ${order.admin_notes ? 'Редактировать' : 'Добавить'}
                        </button>
                    </div>
                    <div id="admin-notes-display-${order.order_id}" style="margin-top: 5px; color: #666; ${order.admin_notes ? '' : 'font-style: italic; color: #999;'}">
                        ${order.admin_notes || 'Комментариев нет'}
                    </div>
                    <div id="admin-notes-edit-${order.order_id}" style="display: none; margin-top: 10px;">
                        <textarea id="admin-notes-text-${order.order_id}" class="form-control" rows="3" style="width: 100%; margin-bottom: 10px;">${order.admin_notes || ''}</textarea>
                        <div style="display: flex; gap: 10px;">
                            <button class="btn btn-sm btn-primary" onclick="saveAdminNotes(${order.order_id})" style="padding: 4px 12px; font-size: 12px;">Сохранить</button>
                            <button class="btn btn-sm btn-secondary" onclick="cancelEditAdminNotes(${order.order_id})" style="padding: 4px 12px; font-size: 12px;">Отмена</button>
                        </div>
                    </div>
                </div>
                
                ${customerInfo}
                
                <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #eee; display: flex; gap: 10px; flex-wrap: wrap;">
                    ${order.is_paid ? `
                        <a href="/orders/api/order/${order.order_id}/receipt" class="btn btn-success btn-sm" style="text-decoration: none; display: inline-block;">📄 Скачать чек</a>
                    ` : ''}
                    ${statusActions}
                </div>
            </div>
        `;
    }).join('');
}

// Обновление статуса заказа
async function updateOrderStatus(orderId, newStatus, isPaid) {
    if (!confirm(`Вы уверены, что хотите изменить статус заказа #${orderId} на "${newStatus}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/account/api/management/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status: newStatus,
                is_paid: isPaid
            })
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        await showError(data.message || 'Статус заказа успешно обновлен');
        
        // Перезагружаем список заказов
        await loadManagementOrders();
    } catch (err) {
        console.error('Ошибка обновления статуса заказа:', err);
        await showError(err);
    }
}

// Обновление статуса оплаты заказа
async function updateOrderPaymentStatus(orderId, isPaid) {
    const statusText = isPaid ? 'оплачен' : 'не оплачен';
    if (!confirm(`Вы уверены, что хотите изменить статус оплаты заказа #${orderId} на "${statusText}"?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/account/api/management/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                is_paid: isPaid
            })
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        await showError(data.message || `Статус оплаты заказа успешно изменен на "${statusText}"`);
        
        // Перезагружаем список заказов
        await loadManagementOrders();
    } catch (err) {
        console.error('Ошибка обновления статуса оплаты заказа:', err);
        await showError(err);
    }
}

// Управление комментариями администратора
function toggleEditAdminNotes(orderId) {
    const displayDiv = document.getElementById(`admin-notes-display-${orderId}`);
    const editDiv = document.getElementById(`admin-notes-edit-${orderId}`);
    
    if (displayDiv && editDiv) {
        displayDiv.style.display = displayDiv.style.display === 'none' ? 'block' : 'none';
        editDiv.style.display = editDiv.style.display === 'none' ? 'block' : 'none';
    }
}

function cancelEditAdminNotes(orderId) {
    const displayDiv = document.getElementById(`admin-notes-display-${orderId}`);
    const editDiv = document.getElementById(`admin-notes-edit-${orderId}`);
    const textarea = document.getElementById(`admin-notes-text-${orderId}`);
    
    if (displayDiv && editDiv && textarea) {
        // Восстанавливаем исходное значение
        const originalNotes = displayDiv.textContent.trim() === 'Комментариев нет' ? '' : displayDiv.textContent.trim();
        textarea.value = originalNotes;
        displayDiv.style.display = 'block';
        editDiv.style.display = 'none';
    }
}

async function saveAdminNotes(orderId) {
    const textarea = document.getElementById(`admin-notes-text-${orderId}`);
    if (!textarea) return;
    
    const adminNotes = textarea.value.trim();
    
    try {
        const response = await fetch(`/account/api/management/orders/${orderId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                admin_notes: adminNotes
            })
        });
        
        if (!response.ok) {
            const errorMessage = await getErrorMessage(response);
            throw new Error(errorMessage);
        }
        
        const data = await response.json();
        
        // Обновляем отображение
        const displayDiv = document.getElementById(`admin-notes-display-${orderId}`);
        const editDiv = document.getElementById(`admin-notes-edit-${orderId}`);
        
        if (displayDiv && editDiv) {
            displayDiv.textContent = adminNotes || 'Комментариев нет';
            displayDiv.style.fontStyle = adminNotes ? 'normal' : 'italic';
            displayDiv.style.color = adminNotes ? '#666' : '#999';
            displayDiv.style.display = 'block';
            editDiv.style.display = 'none';
        }
        
        await showError(data.message || 'Комментарии успешно сохранены');
    } catch (err) {
        console.error('Ошибка сохранения комментариев:', err);
        await showError(err);
    }
}

// ========== ДОБАВЛЕНИЕ АВТОМОБИЛЯ (для менеджеров и администраторов) ==========

// Загрузка списка комплектаций по марке и модели
async function loadCarTrims(brandName = null, modelName = null) {
    try {
        let url = '/account/api/car-trims?';
        if (brandName) url += `brand_name=${encodeURIComponent(brandName)}&`;
        if (modelName) url += `model_name=${encodeURIComponent(modelName)}&`;
        
        const response = await fetch(url, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'Ошибка загрузки комплектаций' }));
            throw new Error(errorData.detail || 'Ошибка загрузки комплектаций');
        }
        
        const data = await response.json();
        const trimSelect = document.getElementById('car-trim');
        
        if (!trimSelect) return;
        
        // Очищаем список
        if (brandName && modelName) {
            trimSelect.innerHTML = '<option value="">Выберите комплектацию...</option>';
        } else {
            trimSelect.innerHTML = '<option value="">Сначала выберите марку и модель...</option>';
        }
        
        // Добавляем комплектации
        if (data.trims && data.trims.length > 0) {
            data.trims.forEach(trim => {
                const option = document.createElement('option');
                option.value = trim.trim_id;
                option.textContent = trim.display_name || `${trim.brand_name} ${trim.model_name} ${trim.trim_name}`.trim();
                trimSelect.appendChild(option);
            });
        } else if (brandName && modelName) {
            trimSelect.innerHTML = '<option value="">Комплектации не найдены</option>';
        }
    } catch (err) {
        console.error('Ошибка загрузки комплектаций:', err);
        await showError(err);
    }
}

// Функция для инициализации обработчиков выбора и загрузки файла (универсальная для авто и запчастей)
// type: 'car' или 'part'
function initImageInputHandlers(imageGroup, type = 'car') {
    const fileInput = imageGroup.querySelector('.image-file-input');
    const selectBtn = imageGroup.querySelector('.select-image-btn');
    const filenameSpan = imageGroup.querySelector('.image-filename');
    const urlInput = imageGroup.querySelector('.image-url-input');
    const previewDiv = imageGroup.querySelector('.image-preview');
    const previewImg = previewDiv ? previewDiv.querySelector('img') : null;
    const statusDiv = imageGroup.querySelector('.image-upload-status');
    
    if (selectBtn && fileInput) {
        // Обработчик клика на кнопку "Выбрать файл"
        selectBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        // Обработчик выбора файла
        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            // Проверяем тип файла
            const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
            if (!allowedTypes.includes(file.type)) {
                if (statusDiv) {
                    statusDiv.textContent = 'Ошибка: разрешены только JPG, JPEG и PNG';
                    statusDiv.style.color = '#d32f2f';
                }
                return;
            }
            
            // Проверяем размер файла (10 МБ)
            if (file.size > 10 * 1024 * 1024) {
                if (statusDiv) {
                    statusDiv.textContent = 'Ошибка: файл слишком большой (макс. 10 МБ)';
                    statusDiv.style.color = '#d32f2f';
                }
                return;
            }
            
            // Показываем имя файла
            if (filenameSpan) {
                filenameSpan.textContent = file.name;
            }
            
            // Показываем превью
            if (previewDiv && previewImg) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    previewImg.src = e.target.result;
                    previewDiv.style.display = 'block';
                };
                reader.readAsDataURL(file);
            }
            
            // Загружаем файл на сервер
            if (statusDiv) {
                statusDiv.textContent = 'Загрузка...';
                statusDiv.style.color = '#666';
            }
            
            try {
                const formData = new FormData();
                formData.append('file', file);
                
                const uploadUrl = type === 'part' ? '/account/api/upload-part-image' : '/account/api/upload-image';
                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });
                
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'Ошибка при загрузке файла');
                }
                
                // Сохраняем URL
                if (urlInput) {
                    urlInput.value = data.url;
                }
                
                if (statusDiv) {
                    statusDiv.textContent = 'Загружено';
                    statusDiv.style.color = '#28a745';
                }
                
                // Обновляем превью с загруженного URL
                if (previewImg) {
                    previewImg.src = data.url;
                }
                
            } catch (err) {
                console.error('Ошибка загрузки файла:', err);
                if (statusDiv) {
                    statusDiv.textContent = 'Ошибка: ' + (err.message || 'Не удалось загрузить файл');
                    statusDiv.style.color = '#d32f2f';
                }
                if (filenameSpan) {
                    filenameSpan.textContent = '';
                }
                if (previewDiv) {
                    previewDiv.style.display = 'none';
                }
            }
        });
    }
}

// Инициализация формы добавления автомобиля
function initAddCarForm() {
    const form = document.getElementById('add-car-form');
    const addImageBtn = document.getElementById('add-image-btn');
    const imagesContainer = document.getElementById('car-images-container');
    
    if (!form) return;
    
    // Проверяем, была ли уже инициализирована форма
    if (form.dataset.initialized === 'true') {
        return;
    }
    
    // Функция для обновления видимости кнопок удаления (сохраняем ссылку на форме для доступа из обработчиков)
    const updateRemoveButtons = function() {
        const imageGroups = imagesContainer.querySelectorAll('.image-input-group');
        imageGroups.forEach((group, index) => {
            const removeBtn = group.querySelector('.remove-image-btn');
            if (removeBtn) {
                // Показываем кнопку удаления только если изображений больше одного
                if (imageGroups.length > 1) {
                    removeBtn.style.display = 'inline-block';
                } else {
                    removeBtn.style.display = 'none';
                }
            }
        });
    };
    
    // Сохраняем ссылку на функцию в форме для доступа из обработчиков
    form.updateRemoveButtons = updateRemoveButtons;
    
    // Используем делегирование событий для кнопки добавления (чтобы избежать дублирования)
    if (addImageBtn && !addImageBtn.dataset.listenerAdded) {
        addImageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            const imageGroup = document.createElement('div');
            imageGroup.className = 'image-input-group';
            
            imageGroup.innerHTML = `
                <input type="file" class="image-file-input" accept="image/jpeg,image/jpg,image/png" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm select-image-btn">Выбрать файл</button>
                <span class="image-filename" style="margin-left: 10px; color: #666;"></span>
                <input type="hidden" class="image-url-input" value="">
                <input type="text" class="image-alt-input" placeholder="Альтернативный текст" style="margin-top: 10px; width: 100%;">
                <button type="button" class="btn btn-secondary btn-sm remove-image-btn" style="display: none; margin-top: 10px;">Удалить</button>
                <div class="image-preview" style="margin-top: 10px; max-width: 200px; display: none;">
                    <img src="" alt="Preview" style="max-width: 100%; height: auto; border-radius: 4px;">
                </div>
                <div class="image-upload-status" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
            `;
            
            imagesContainer.appendChild(imageGroup);
            
            // Инициализируем обработчики для нового элемента
            initImageInputHandlers(imageGroup, 'car');
            
            updateRemoveButtons();
        });
        addImageBtn.dataset.listenerAdded = 'true';
    }
    
    // Используем делегирование событий для кнопок удаления (чтобы работало для динамически добавленных элементов)
    if (imagesContainer && !imagesContainer.dataset.listenerAdded) {
        imagesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-image-btn')) {
                e.preventDefault();
                e.stopPropagation();
                const imageGroup = e.target.closest('.image-input-group');
                if (imageGroup) {
                    imageGroup.remove();
                    updateRemoveButtons();
                }
            }
        });
        imagesContainer.dataset.listenerAdded = 'true';
    }
    
    // Инициализируем видимость кнопок при загрузке
    updateRemoveButtons();
    
    // Инициализируем обработчики для существующих элементов изображений
    document.querySelectorAll('#car-images-container .image-input-group').forEach(group => {
        initImageInputHandlers(group, 'car');
    });
    
    // Обработчик кнопки "Характеристики"
    const toggleSpecsBtn = document.getElementById('toggle-specs-btn');
    const specsSection = document.getElementById('trim-specs-section');
    const specsBtnText = document.getElementById('specs-btn-text');
    let specsExpanded = false;
    let selectedTrimId = null;
    let originalSpecs = {}; // Для отслеживания изменений
    
    if (toggleSpecsBtn) {
        toggleSpecsBtn.addEventListener('click', () => {
            specsExpanded = !specsExpanded;
            if (specsExpanded) {
                specsSection.style.display = 'block';
                specsBtnText.textContent = '▲ Скрыть характеристики';
            } else {
                specsSection.style.display = 'none';
                specsBtnText.textContent = '▼ Характеристики';
            }
        });
    }
    
    // Загрузка данных комплектации при выборе
    async function loadTrimDetails(trimId) {
        if (!trimId) {
            selectedTrimId = null;
            originalSpecs = {};
            return;
        }
        
        try {
            const response = await fetch(`/account/api/car-trim/${trimId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return;
            }
            
            const data = await response.json();
            selectedTrimId = trimId;
            
            // Сохраняем оригинальные значения для отслеживания изменений
            originalSpecs = {
                trim_name: data.trim_name || '',
                engine_volume: data.engine_volume || '',
                engine_power: data.engine_power || '',
                engine_torque: data.engine_torque || '',
                fuel_type: data.fuel_type || '',
                transmission: data.transmission || '',
                drive_type: data.drive_type || '',
                body_type: data.body_type || '',
                doors: data.doors || '',
                seats: data.seats || ''
            };
            
            // Заполняем поля
            document.getElementById('trim-name').value = data.trim_name || '';
            document.getElementById('trim-engine-volume').value = data.engine_volume || '';
            document.getElementById('trim-engine-power').value = data.engine_power || '';
            document.getElementById('trim-engine-torque').value = data.engine_torque || '';
            document.getElementById('trim-fuel-type').value = data.fuel_type || '';
            document.getElementById('trim-transmission').value = data.transmission || '';
            document.getElementById('trim-drive-type').value = data.drive_type || '';
            document.getElementById('trim-body-type').value = data.body_type || '';
            document.getElementById('trim-doors').value = data.doors || '';
            document.getElementById('trim-seats').value = data.seats || '';
            
            // Показываем кнопку и открываем секцию характеристик
            toggleSpecsBtn.style.display = 'inline-block';
            if (!specsExpanded) {
                specsExpanded = true;
                specsSection.style.display = 'block';
                specsBtnText.textContent = '▲ Скрыть характеристики';
            }
        } catch (err) {
            console.error('Ошибка загрузки данных комплектации:', err);
        }
    }
    
    // Функция для проверки изменений и очистки названия комплектации
    function checkSpecsChanges() {
        if (!selectedTrimId) return; // Если комплектация не выбрана, не проверяем
        
        const currentSpecs = {
            trim_name: document.getElementById('trim-name').value,
            engine_volume: document.getElementById('trim-engine-volume').value,
            engine_power: document.getElementById('trim-engine-power').value,
            engine_torque: document.getElementById('trim-engine-torque').value,
            fuel_type: document.getElementById('trim-fuel-type').value,
            transmission: document.getElementById('trim-transmission').value,
            drive_type: document.getElementById('trim-drive-type').value,
            body_type: document.getElementById('trim-body-type').value,
            doors: document.getElementById('trim-doors').value,
            seats: document.getElementById('trim-seats').value
        };
        
        // Проверяем, изменилось ли что-то (кроме названия)
        const changed = 
            currentSpecs.engine_volume !== String(originalSpecs.engine_volume || '') ||
            currentSpecs.engine_power !== String(originalSpecs.engine_power || '') ||
            currentSpecs.engine_torque !== String(originalSpecs.engine_torque || '') ||
            currentSpecs.fuel_type !== String(originalSpecs.fuel_type || '') ||
            currentSpecs.transmission !== String(originalSpecs.transmission || '') ||
            currentSpecs.drive_type !== String(originalSpecs.drive_type || '') ||
            currentSpecs.body_type !== String(originalSpecs.body_type || '') ||
            currentSpecs.doors !== String(originalSpecs.doors || '') ||
            currentSpecs.seats !== String(originalSpecs.seats || '');
        
        if (changed) {
            // Очищаем выбор комплектации и название
            document.getElementById('car-trim').value = '';
            document.getElementById('trim-name').value = '';
            selectedTrimId = null;
            originalSpecs = {};
        }
    }
    
    // Обработчики изменений полей характеристик
    const specsInputs = ['trim-engine-volume', 'trim-engine-power', 'trim-engine-torque', 
                        'trim-fuel-type', 'trim-transmission', 'trim-drive-type', 
                        'trim-body-type', 'trim-doors', 'trim-seats'];
    
    specsInputs.forEach(inputId => {
        const input = document.getElementById(inputId);
        if (input) {
            input.addEventListener('change', checkSpecsChanges);
            input.addEventListener('input', checkSpecsChanges);
        }
    });
    
    // Обработчик выбора комплектации
    const trimSelect = document.getElementById('car-trim');
    if (trimSelect) {
        trimSelect.addEventListener('change', (e) => {
            const trimId = e.target.value;
            const brandName = brandSelect.value;
            const modelName = modelInput.value.trim();
            
            if (trimId) {
                loadTrimDetails(parseInt(trimId));
            } else {
                // Очищаем выбор комплектации, но оставляем кнопку видимой, если выбраны марка и модель
                selectedTrimId = null;
                originalSpecs = {};
                
                // Очищаем поля характеристик
                document.getElementById('trim-name').value = '';
                document.getElementById('trim-engine-volume').value = '';
                document.getElementById('trim-engine-power').value = '';
                document.getElementById('trim-engine-torque').value = '';
                document.getElementById('trim-fuel-type').value = '';
                document.getElementById('trim-transmission').value = '';
                document.getElementById('trim-drive-type').value = '';
                document.getElementById('trim-body-type').value = '';
                document.getElementById('trim-doors').value = '';
                document.getElementById('trim-seats').value = '';
                
                // Показываем кнопку только если выбраны марка и модель
                if (brandName && modelName) {
                    toggleSpecsBtn.style.display = 'inline-block';
                } else {
                    toggleSpecsBtn.style.display = 'none';
                }
                
                // Закрываем секцию характеристик
                specsSection.style.display = 'none';
                specsExpanded = false;
                if (specsBtnText) specsBtnText.textContent = '▼ Характеристики';
            }
        });
    }
    
    // Обработчики для загрузки комплектаций при изменении марки/модели
    const brandSelect = document.getElementById('car-brand');
    const modelInput = document.getElementById('car-model');
    const suggestionsDropdown = document.getElementById('model-suggestions');
    let selectedSuggestionIndex = -1;
    let suggestions = [];
    
    // Загрузка подсказок моделей
    async function loadModelSuggestions(query) {
        if (!query || query.length < 1) {
            suggestionsDropdown.style.display = 'none';
            return;
        }
        
        try {
            const brandName = brandSelect.value;
            let url = `/account/api/car-models?query=${encodeURIComponent(query)}`;
            if (brandName) {
                url += `&brand_name=${encodeURIComponent(brandName)}`;
            }
            
            const response = await fetch(url, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return;
            }
            
            const data = await response.json();
            suggestions = data.models || [];
            selectedSuggestionIndex = -1;
            
            if (suggestions.length > 0) {
                renderSuggestions(suggestions, query);
            } else {
                suggestionsDropdown.style.display = 'none';
            }
        } catch (err) {
            console.error('Ошибка загрузки подсказок:', err);
            suggestionsDropdown.style.display = 'none';
        }
    }
    
    // Отображение подсказок
    function renderSuggestions(models, query) {
        suggestionsDropdown.innerHTML = '';
        
        models.forEach((model, index) => {
            const item = document.createElement('div');
            item.className = 'suggestion-item';
            item.textContent = model;
            item.dataset.index = index;
            
            item.addEventListener('click', () => {
                modelInput.value = model;
                suggestionsDropdown.style.display = 'none';
                updateTrimsList();
            });
            
            item.addEventListener('mouseenter', () => {
                selectedSuggestionIndex = index;
                updateSuggestionSelection();
            });
            
            suggestionsDropdown.appendChild(item);
        });
        
        suggestionsDropdown.style.display = 'block';
    }
    
    // Обновление выделения подсказки
    function updateSuggestionSelection() {
        const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
        items.forEach((item, index) => {
            if (index === selectedSuggestionIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
    }
    
    async function updateTrimsList() {
        const brandName = brandSelect.value;
        const modelName = modelInput.value.trim();
        
        // Очищаем выбор комплектации при изменении марки/модели
        selectedTrimId = null;
        originalSpecs = {};
        
        if (brandName && modelName) {
            // Показываем кнопку "Характеристики", если выбраны марка и модель
            toggleSpecsBtn.style.display = 'inline-block';
            await loadCarTrims(brandName, modelName);
        } else {
            // Скрываем кнопку и секцию, если марка или модель не выбраны
            toggleSpecsBtn.style.display = 'none';
            specsSection.style.display = 'none';
            specsExpanded = false;
            if (specsBtnText) specsBtnText.textContent = '▼ Характеристики';
            
            const trimSelect = document.getElementById('car-trim');
            if (trimSelect) {
                trimSelect.innerHTML = '<option value="">Сначала выберите марку и модель...</option>';
            }
        }
    }
    
    if (brandSelect) {
        brandSelect.addEventListener('change', () => {
            modelInput.value = '';
            suggestionsDropdown.style.display = 'none';
            const trimSelect = document.getElementById('car-trim');
            if (trimSelect) {
                trimSelect.innerHTML = '<option value="">Сначала выберите марку и модель...</option>';
                trimSelect.value = '';
            }
            selectedTrimId = null;
            originalSpecs = {};
            toggleSpecsBtn.style.display = 'none';
            specsSection.style.display = 'none';
            specsExpanded = false;
            if (specsBtnText) specsBtnText.textContent = '▼ Характеристики';
            updateTrimsList();
        });
    }
    
    if (modelInput) {
        let modelTimeout;
        let suggestionsTimeout;
        
        modelInput.addEventListener('input', () => {
            const query = modelInput.value.trim();
            
            // Загружаем подсказки
            clearTimeout(suggestionsTimeout);
            suggestionsTimeout = setTimeout(() => {
                loadModelSuggestions(query);
            }, 300);
            
            // Обновляем список комплектаций с задержкой
            clearTimeout(modelTimeout);
            modelTimeout = setTimeout(updateTrimsList, 500);
        });
        
        // Закрываем подсказки при потере фокуса
        modelInput.addEventListener('blur', () => {
            setTimeout(() => {
                suggestionsDropdown.style.display = 'none';
            }, 200);
        });
        
        // Обработка навигации по подсказкам с клавиатуры
        modelInput.addEventListener('keydown', (e) => {
            if (suggestionsDropdown.style.display === 'none' || suggestions.length === 0) {
                return;
            }
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, suggestions.length - 1);
                updateSuggestionSelection();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSuggestionSelection();
            } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                e.preventDefault();
                modelInput.value = suggestions[selectedSuggestionIndex];
                suggestionsDropdown.style.display = 'none';
                updateTrimsList();
            } else if (e.key === 'Escape') {
                suggestionsDropdown.style.display = 'none';
            }
        });
    }
    
    // Закрываем подсказки при клике вне поля
    document.addEventListener('click', (e) => {
        if (!modelInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
            suggestionsDropdown.style.display = 'none';
        }
    });
    
    // Обработчик отправки формы (добавляем только один раз)
    if (!form.dataset.submitHandlerAdded) {
        form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const messageDiv = document.getElementById('add-car-message');
        messageDiv.style.display = 'none';
        messageDiv.className = '';
        
        // Собираем данные формы
        const formData = {
            vin: document.getElementById('car-vin').value.trim().toUpperCase(),
            production_year: parseInt(document.getElementById('car-year').value),
            condition: document.getElementById('car-condition').value,
            mileage: parseInt(document.getElementById('car-mileage').value),
            color: document.getElementById('car-color').value,
            price: document.getElementById('car-price').value ? parseFloat(document.getElementById('car-price').value) : null
        };
        
        // Определяем, используется ли готовая комплектация или создается новая
        const trimId = document.getElementById('car-trim').value;
        const brandName = document.getElementById('car-brand').value;
        const modelName = document.getElementById('car-model').value.trim();
        
        if (trimId && selectedTrimId && parseInt(trimId) === selectedTrimId) {
            // Используем готовую комплектацию (если она не была изменена)
            formData.trim_id = parseInt(trimId);
        } else {
            // Создаем новую комплектацию или используем измененную
            if (!brandName || !modelName) {
                messageDiv.textContent = 'Выберите марку и модель';
                messageDiv.className = 'error-message';
                messageDiv.style.display = 'block';
                messageDiv.style.color = '#d32f2f';
                return;
            }
            
            const newTrim = {
                brand_name: brandName,
                model_name: modelName,
                trim_name: document.getElementById('trim-name').value.trim() || null,
                engine_volume: document.getElementById('trim-engine-volume').value ? parseFloat(document.getElementById('trim-engine-volume').value) : null,
                engine_power: document.getElementById('trim-engine-power').value ? parseInt(document.getElementById('trim-engine-power').value) : null,
                engine_torque: document.getElementById('trim-engine-torque').value ? parseInt(document.getElementById('trim-engine-torque').value) : null,
                fuel_type: document.getElementById('trim-fuel-type').value,
                transmission: document.getElementById('trim-transmission').value,
                drive_type: document.getElementById('trim-drive-type').value,
                body_type: document.getElementById('trim-body-type').value,
                doors: document.getElementById('trim-doors').value ? parseInt(document.getElementById('trim-doors').value) : null,
                seats: document.getElementById('trim-seats').value ? parseInt(document.getElementById('trim-seats').value) : null
            };
            
            // Валидация обязательных полей
            if (!newTrim.fuel_type || !newTrim.transmission || !newTrim.drive_type || !newTrim.body_type) {
                messageDiv.textContent = 'Заполните все обязательные поля характеристик (тип топлива, КПП, привод, тип кузова)';
                messageDiv.className = 'error-message';
                messageDiv.style.display = 'block';
                messageDiv.style.color = '#d32f2f';
                return;
            }
            
            formData.new_trim = newTrim;
        }
        
        // Собираем изображения (только из контейнера формы)
        const imageInputs = imagesContainer.querySelectorAll('.image-input-group');
        const imageUrls = [];
        imageInputs.forEach((group, index) => {
            const urlInput = group.querySelector('.image-url-input');
            const altInput = group.querySelector('.image-alt-input');
            if (urlInput && altInput) {
                const url = urlInput.value.trim();
                
                if (url) {
                    imageUrls.push({
                        url: url,
                        alt_text: altInput.value.trim() || null,
                        sort_order: index
                    });
                }
            }
        });
        
        if (imageUrls.length > 0) {
            formData.image_urls = imageUrls;
        }
        
        // Отправляем запрос
        try {
            const response = await fetch('/account/api/cars', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(formData)
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.detail || 'Ошибка при добавлении автомобиля');
            }
            
            // Успех
            messageDiv.textContent = data.message || 'Автомобиль успешно добавлен';
            messageDiv.className = 'success-message';
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#28a745';
            
            // Очищаем форму
            form.reset();
            imagesContainer.innerHTML = `
                <div class="image-input-group">
                    <input type="file" class="image-file-input" accept="image/jpeg,image/jpg,image/png" style="display: none;">
                    <button type="button" class="btn btn-secondary btn-sm select-image-btn">Выбрать файл</button>
                    <span class="image-filename" style="margin-left: 10px; color: #666;"></span>
                    <input type="hidden" class="image-url-input" value="">
                    <input type="text" class="image-alt-input" placeholder="Альтернативный текст" style="margin-top: 10px; width: 100%;">
                    <button type="button" class="btn btn-secondary btn-sm remove-image-btn" style="display: none; margin-top: 10px;">Удалить</button>
                    <div class="image-preview" style="margin-top: 10px; max-width: 200px; display: none;">
                        <img src="" alt="Preview" style="max-width: 100%; height: auto; border-radius: 4px;">
                    </div>
                    <div class="image-upload-status" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
                </div>
            `;
            
            // Инициализируем обработчики для первого элемента
            const firstGroup = imagesContainer.querySelector('.image-input-group');
            if (firstGroup) {
                initImageInputHandlers(firstGroup);
            }
            
            // Обновляем видимость кнопок удаления
            if (form.updateRemoveButtons && typeof form.updateRemoveButtons === 'function') {
                form.updateRemoveButtons();
            }
            
            // Сбрасываем состояние комплектации
            selectedTrimId = null;
            originalSpecs = {};
            if (toggleSpecsBtn) toggleSpecsBtn.style.display = 'none';
            if (specsSection) specsSection.style.display = 'none';
            specsExpanded = false;
            if (specsBtnText) specsBtnText.textContent = '▼ Характеристики';
            
            // Сбрасываем выбор марки и модели
            if (brandSelect && modelInput) {
                brandSelect.value = '';
                modelInput.value = '';
                const trimSelect = document.getElementById('car-trim');
                if (trimSelect) {
                    trimSelect.innerHTML = '<option value="">Сначала выберите марку и модель...</option>';
                }
            }
            
        } catch (err) {
            console.error('Ошибка добавления автомобиля:', err);
            messageDiv.textContent = typeof err === 'string' ? err : err.message || 'Ошибка при добавлении автомобиля';
            messageDiv.className = 'error-message';
            messageDiv.style.display = 'block';
            messageDiv.style.color = '#d32f2f';
        }
        });
        form.dataset.submitHandlerAdded = 'true';
    }
    
    // Помечаем форму как инициализированную
    form.dataset.initialized = 'true';
}

// Инициализируем форму при загрузке страницы
if (document.getElementById('add-car-form')) {
    initAddCarForm();
}

// ========== Функции для работы с формой добавления запчасти ==========

function initAddPartForm() {
    const form = document.getElementById('add-part-form');
    if (!form) return;
    
    // Проверяем, была ли уже инициализирована форма
    if (form.dataset.initialized === 'true') {
        return;
    }
    
    let categoriesTree = [];
    let selectedCategoryId = null;
    let newCategories = []; // Категории, созданные локально, но еще не отправленные в БД
    let selectedCategoryPath = []; // Путь выбранных категорий для сохранения при перерисовке
    
    // Загружаем дерево категорий
    async function loadCategoriesTree(preserveSelections = false) {
        try {
            const response = await fetch('/account/api/part-categories', {
                credentials: 'include'
            });
            if (!response.ok) throw new Error('Ошибка загрузки категорий');
            const data = await response.json();
            categoriesTree = data.categories || [];
            
            // Объединяем с локально созданными категориями
            mergeNewCategoriesIntoTree();
            
            if (preserveSelections && selectedCategoryPath.length > 0) {
                // Восстанавливаем выбранные категории
                restoreCategorySelections();
            } else {
                renderCategoryLevel(0, null, false);
                updateCategoryButtonsForLevel(0);
            }
        } catch (err) {
            console.error('Ошибка загрузки категорий:', err);
        }
    }
    
    // Объединяет новые категории с деревом категорий
    function mergeNewCategoriesIntoTree() {
        // Сортируем новые категории по уровню (сначала родители, потом дети)
        const sortedNewCategories = [...newCategories].sort((a, b) => {
            // Если у одной есть parent_id, а у другой нет, то без parent_id идет первым
            if (a.parent_id === null && b.parent_id !== null) return -1;
            if (a.parent_id !== null && b.parent_id === null) return 1;
            // Если обе имеют parent_id, сортируем по parent_id
            if (a.parent_id !== null && b.parent_id !== null) {
                return a.parent_id - b.parent_id;
            }
            return 0;
        });
        
        sortedNewCategories.forEach(newCat => {
            if (newCat.parent_id === null) {
                // Это корневая категория
                categoriesTree.push({
                    category_id: newCat.temp_id,
                    category_name: newCat.category_name,
                    parent_id: null,
                    children: []
                });
            } else {
                // Это подкатегория - находим родителя и добавляем туда
                const findAndAdd = (nodes, targetParentId) => {
                    for (const node of nodes) {
                        if (node.category_id === targetParentId || 
                            (node.temp_id && node.temp_id === targetParentId)) {
                            if (!node.children) node.children = [];
                            node.children.push({
                                category_id: newCat.temp_id,
                                category_name: newCat.category_name,
                                parent_id: targetParentId,
                                children: []
                            });
                            return true;
                        }
                        if (node.children && node.children.length > 0) {
                            if (findAndAdd(node.children, targetParentId)) return true;
                        }
                    }
                    return false;
                };
                findAndAdd(categoriesTree, newCat.parent_id);
            }
        });
    }
    
    // Восстанавливает выбранные категории после перерисовки
    function restoreCategorySelections() {
        if (selectedCategoryPath.length === 0) {
            renderCategoryLevel(0, null, false);
            return;
        }
        
        // Восстанавливаем каждый уровень
        let currentParentId = null;
        for (let i = 0; i < selectedCategoryPath.length; i++) {
            const categoryId = selectedCategoryPath[i];
            renderCategoryLevel(i, currentParentId, true);
            
            const selector = document.getElementById(`part-category-level-${i}`);
            if (selector) {
                // Ищем категорию в селекторе (может быть temp_id или category_id)
                const option = Array.from(selector.options).find(opt => {
                    const optValue = parseInt(opt.value);
                    return optValue === categoryId;
                });
                
                if (option) {
                    selector.value = option.value;
                    // Не триггерим change для промежуточных уровней, только для последнего
                    if (i === selectedCategoryPath.length - 1) {
                        selector.dispatchEvent(new Event('change'));
                    }
                }
            }
            
            // Обновляем currentParentId для следующего уровня
            currentParentId = categoryId;
        }
        
        // Устанавливаем selectedCategoryId на последнюю категорию в пути
        if (selectedCategoryPath.length > 0) {
            selectedCategoryId = selectedCategoryPath[selectedCategoryPath.length - 1];
        }
    }
    
    // Сохраняет текущий путь выбранных категорий
    function saveCategoryPath() {
        selectedCategoryPath = [];
        const allSelectors = document.querySelectorAll('.part-category-select');
        allSelectors.forEach(sel => {
            const value = sel.value;
            if (value) {
                selectedCategoryPath.push(parseInt(value));
            }
        });
    }
    
    // Рендерим уровень категорий
    function renderCategoryLevel(level, parentId, preserveSelections = false) {
        const selector = document.getElementById(`part-category-level-${level}`);
        const levelsContainer = document.getElementById('part-category-levels');
        const categorySelector = document.getElementById('part-category-selector');
        
        if (!selector) {
            if (level === 0) {
                // Для первого уровня селектор уже есть в HTML, просто обновляем его
                const newSelector = document.getElementById(`part-category-level-${level}`);
                // Управляем кнопками для level 0
                updateCategoryButtonsForLevel(level);
            } else {
                // Создаем новый селектор для этого уровня (level > 0)
                const levelDiv = document.createElement('div');
                levelDiv.className = 'form-row';
                levelDiv.style.marginTop = '10px';
                levelDiv.innerHTML = `
                    <div class="form-group" style="flex: 1;">
                        <select id="part-category-level-${level}" class="part-category-select" data-level="${level}">
                            <option value="">Выберите подкатегорию...</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 0 0 auto; margin-left: 10px;">
                        <button type="button" class="btn btn-secondary btn-sm add-category-right-btn" data-level="${level}">+ Создать</button>
                    </div>
                `;
                levelsContainer.appendChild(levelDiv);
            }
        }
        
        const newSelector = document.getElementById(`part-category-level-${level}`);
        
        // Для level 0 используем специальную логику кнопок
        if (level === 0) {
            updateCategoryButtonsForLevel(level);
        }
        
        const addBtn = level === 0 
            ? document.getElementById(`add-category-right-btn-${level}`) || document.getElementById(`add-category-below-btn-${level}`)
            : document.querySelector(`.add-category-right-btn[data-level="${level}"]`);
        
        // Очищаем селектор
        newSelector.innerHTML = '<option value="">Выберите подкатегорию...</option>';
        
        // Находим категории для этого уровня
        let categories = [];
        if (level === 0) {
            categories = categoriesTree;
        } else {
            const findChildren = (nodes, targetParentId) => {
                for (const node of nodes) {
                    if (node.category_id === targetParentId || 
                        (node.temp_id && node.temp_id === targetParentId)) {
                        return node.children || [];
                    }
                    if (node.children && node.children.length > 0) {
                        const found = findChildren(node.children, targetParentId);
                        if (found.length > 0) return found;
                    }
                }
                return [];
            };
            categories = findChildren(categoriesTree, parentId);
        }
        
        // Заполняем селектор
        categories.forEach(cat => {
            const option = document.createElement('option');
            // Используем temp_id если есть, иначе category_id
            option.value = (cat.temp_id !== undefined) ? cat.temp_id : cat.category_id;
            option.textContent = cat.category_name;
            newSelector.appendChild(option);
        });
        
        // Восстанавливаем выбранное значение, если нужно
        if (preserveSelections && selectedCategoryPath.length > level) {
            const valueToRestore = selectedCategoryPath[level];
            const option = Array.from(newSelector.options).find(opt => {
                const optValue = parseInt(opt.value);
                return optValue === valueToRestore;
            });
            if (option) {
                newSelector.value = option.value;
            }
        }
        
        // Обновляем кнопки для level 0 после заполнения опций
        if (level === 0) {
            updateCategoryButtonsForLevel(0);
        }
        
        // Удаляем все уровни после текущего
        const allSelectors = document.querySelectorAll('.part-category-select');
        allSelectors.forEach(sel => {
            const selLevel = parseInt(sel.dataset.level);
            if (selLevel > level) {
                sel.closest('.form-row').remove();
            }
        });
        
        // Обработчик выбора категории
        newSelector.onchange = function() {
            const categoryId = parseInt(this.value);
            if (categoryId) {
                selectedCategoryId = categoryId;
                saveCategoryPath(); // Сохраняем путь
                
                // Проверяем, есть ли у этой категории дочерние
                const findCategory = (nodes, targetId) => {
                    for (const node of nodes) {
                        if (node.category_id === targetId || 
                            (node.temp_id && node.temp_id === targetId)) return node;
                        if (node.children && node.children.length > 0) {
                            const found = findCategory(node.children, targetId);
                            if (found) return found;
                        }
                    }
                    return null;
                };
                const selectedCategory = findCategory(categoriesTree, categoryId);
                
                if (selectedCategory && selectedCategory.children && selectedCategory.children.length > 0) {
                    // Есть дочерние категории - показываем следующий уровень
                    renderCategoryLevel(level + 1, categoryId, false);
                }
            } else {
                // Сброс выбора - удаляем все последующие уровни
                selectedCategoryId = null;
                selectedCategoryPath = selectedCategoryPath.slice(0, level); // Обрезаем путь
                
                // Удаляем все уровни после текущего
                const allSelectors = document.querySelectorAll('.part-category-select');
                allSelectors.forEach(sel => {
                    const selLevel = parseInt(sel.dataset.level);
                    if (selLevel > level) {
                        sel.closest('.form-row').remove();
                    }
                });
            }
        };
        
        // Обработчик создания новой категории (для уровней > 0 всегда справа)
        if (addBtn && level > 0) {
            addBtn.onclick = () => {
                showCategoryInputForm(level, parentId, false); // false = добавлять в текущий уровень
            };
        }
    }
    
    // Управление кнопками для level 0
    function updateCategoryButtonsForLevel(level) {
        if (level !== 0) return;
        
        const selector = document.getElementById(`part-category-level-${level}`);
        const categorySelector = document.getElementById('part-category-selector');
        if (!selector || !categorySelector) return;
        
        const belowBtn = document.getElementById('add-category-below-btn-0');
        const rightBtn = document.getElementById('add-category-right-btn-0');
        const selectorRow = selector.closest('.form-row');
        
        // Проверяем, есть ли категории в селекторе (кроме пустой опции)
        const hasCategories = selector.options.length > 1;
        
        if (hasCategories) {
            // Есть категории - показываем кнопку справа, скрываем снизу
            if (belowBtn) belowBtn.style.display = 'none';
            
            // Создаем или показываем кнопку справа
            if (!rightBtn) {
                const rightBtnDiv = document.createElement('div');
                rightBtnDiv.className = 'form-group';
                rightBtnDiv.style.cssText = 'flex: 0 0 auto; margin-left: 10px;';
                rightBtnDiv.innerHTML = `<button type="button" class="btn btn-secondary btn-sm" id="add-category-right-btn-0">+ Создать</button>`;
                if (selectorRow) {
                    selectorRow.appendChild(rightBtnDiv);
                }
            } else {
                rightBtn.style.display = 'inline-block';
            }
            
            // Обработчик для кнопки справа
            const newRightBtn = document.getElementById('add-category-right-btn-0');
            if (newRightBtn && !newRightBtn.dataset.handlerAdded) {
                newRightBtn.onclick = () => {
                    showCategoryInputForm(0, null, false); // false = добавлять в текущий уровень
                };
                newRightBtn.dataset.handlerAdded = 'true';
            }
        } else {
            // Нет категорий - показываем кнопку снизу, скрываем справа
            if (belowBtn) belowBtn.style.display = 'inline-block';
            if (rightBtn) {
                rightBtn.style.display = 'none';
                // Удаляем кнопку справа, если она была создана
                const rightBtnParent = rightBtn.parentElement;
                if (rightBtnParent && rightBtnParent.classList.contains('form-group')) {
                    rightBtnParent.remove();
                }
            }
            
            // Обработчик для кнопки снизу (создает категорию в первом уровне)
            if (belowBtn && !belowBtn.dataset.handlerAdded) {
                belowBtn.onclick = () => {
                    showCategoryInputForm(0, null, false); // false = добавлять в текущий уровень (первый)
                };
                belowBtn.dataset.handlerAdded = 'true';
            }
        }
    }
    
    // Показать форму ввода для создания категории
    // createNewLevel: true = создать новый уровень (кнопка снизу), false = добавить в текущий (кнопка справа)
    function showCategoryInputForm(level, parentId, createNewLevel = false) {
        // Проверяем, не открыта ли уже форма на этом уровне
        const existingForm = document.getElementById(`category-input-form-${level}`);
        if (existingForm) {
            existingForm.remove();
            return;
        }
        
        // Создаем форму ввода
        const formDiv = document.createElement('div');
        formDiv.id = `category-input-form-${level}`;
        formDiv.className = 'category-input-form';
        formDiv.style.marginTop = '10px';
        formDiv.style.padding = '12px';
        formDiv.style.background = '#f8f9fa';
        formDiv.style.borderRadius = '8px';
        formDiv.style.border = '1px solid #e0e0e0';
        formDiv.innerHTML = `
            <div class="form-row" style="align-items: center;">
                <div class="form-group" style="flex: 1; margin-bottom: 0;">
                    <input type="text" 
                           id="new-category-name-${level}" 
                           class="form-control" 
                           placeholder="Введите название категории" 
                           style="padding: 10px 14px; border: 2px solid #0066cc; border-radius: 6px; font-size: 14px; width: 100%;">
                </div>
                <div class="form-group" style="flex: 0 0 auto; margin-left: 10px; margin-bottom: 0;">
                    <button type="button" class="btn btn-primary btn-sm" id="save-category-btn-${level}">Сохранить</button>
                </div>
                <div class="form-group" style="flex: 0 0 auto; margin-left: 10px; margin-bottom: 0;">
                    <button type="button" class="btn btn-secondary btn-sm" id="cancel-category-btn-${level}">Отмена</button>
                </div>
            </div>
        `;
        
        // Находим контейнер для вставки формы (после селектора этого уровня)
        const selector = document.getElementById(`part-category-level-${level}`);
        const selectorRow = selector ? selector.closest('.form-row') : null;
        const levelsContainer = document.getElementById('part-category-levels');
        
        if (selectorRow && selectorRow.nextSibling) {
            selectorRow.parentNode.insertBefore(formDiv, selectorRow.nextSibling);
        } else if (selectorRow) {
            selectorRow.parentNode.appendChild(formDiv);
        } else if (level === 0) {
            // Если это первый уровень, вставляем после основного селектора
            const mainSelector = document.getElementById('part-category-selector');
            if (mainSelector) {
                mainSelector.appendChild(formDiv);
            }
        } else {
            levelsContainer.appendChild(formDiv);
        }
        
        // Фокус на поле ввода
        const input = document.getElementById(`new-category-name-${level}`);
        if (input) {
            input.focus();
            
            // Обработчик Enter
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById(`save-category-btn-${level}`).click();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    document.getElementById(`cancel-category-btn-${level}`).click();
                }
            });
        }
        
        // Обработчик сохранения
        const saveBtn = document.getElementById(`save-category-btn-${level}`);
        if (saveBtn) {
            saveBtn.onclick = () => {
                const categoryName = input.value.trim();
                if (categoryName) {
                    createCategory(categoryName, parentId, level, createNewLevel);
                    formDiv.remove();
                } else {
                    alert('Введите название категории');
                    input.focus();
                }
            };
        }
        
        // Обработчик отмены
        const cancelBtn = document.getElementById(`cancel-category-btn-${level}`);
        if (cancelBtn) {
            cancelBtn.onclick = () => {
                formDiv.remove();
            };
        }
    }
    
    // Создание новой категории (локально, без отправки в БД)
    // createNewLevel: true = создать новый уровень, false = добавить в текущий
    function createCategory(categoryName, parentId, level, createNewLevel = false) {
        // Генерируем временный отрицательный ID для новой категории
        const tempId = -Date.now(); // Уникальный отрицательный ID
        
        // Сохраняем текущий путь выбора перед добавлением категории
        saveCategoryPath();
        
        // Добавляем новую категорию в локальный список
        const newCategory = {
            temp_id: tempId,
            category_name: categoryName.trim(),
            parent_id: parentId,
            level: level
        };
        newCategories.push(newCategory);
        
        // Добавляем категорию в дерево категорий
        if (parentId === null) {
            // Это корневая категория
            if (!categoriesTree.find(cat => (cat.temp_id && cat.temp_id === tempId) || 
                                           (cat.category_id === tempId))) {
                categoriesTree.push({
                    category_id: tempId,
                    temp_id: tempId,
                    category_name: categoryName.trim(),
                    parent_id: null,
                    children: []
                });
            }
        } else {
            // Это подкатегория - находим родителя и добавляем туда
            const findAndAdd = (nodes, targetParentId) => {
                for (const node of nodes) {
                    if (node.category_id === targetParentId || 
                        (node.temp_id && node.temp_id === targetParentId)) {
                        if (!node.children) node.children = [];
                        // Проверяем, нет ли уже такой категории
                        if (!node.children.find(child => 
                            (child.temp_id && child.temp_id === tempId) || 
                            (child.category_id === tempId))) {
                            node.children.push({
                                category_id: tempId,
                                temp_id: tempId,
                                category_name: categoryName.trim(),
                                parent_id: targetParentId,
                                children: []
                            });
                        }
                        return true;
                    }
                    if (node.children && node.children.length > 0) {
                        if (findAndAdd(node.children, targetParentId)) return true;
                    }
                }
                return false;
            };
            findAndAdd(categoriesTree, parentId);
        }
        
        // Добавляем опцию в существующий селектор, не перерисовывая весь уровень
        const selector = document.getElementById(`part-category-level-${level}`);
        if (selector) {
            // Проверяем, нет ли уже такой опции
            const existingOption = Array.from(selector.options).find(opt => parseInt(opt.value) === tempId);
            if (!existingOption) {
                // Добавляем новую опцию
                const newOption = document.createElement('option');
                newOption.value = tempId.toString();
                newOption.textContent = categoryName.trim();
                selector.appendChild(newOption);
            }
            // Выбираем созданную категорию
            selector.value = tempId.toString();
            // Обновляем путь выбора
            selectedCategoryPath = selectedCategoryPath.slice(0, level);
            selectedCategoryPath.push(tempId);
            selectedCategoryId = tempId;
            
            // Если это level 0, обновляем кнопки
            if (level === 0) {
                updateCategoryButtonsForLevel(0);
            }
            
            // Если createNewLevel = true, создаем следующий уровень (новую строку)
            if (createNewLevel) {
                // Создаем новый уровень с пустым селектором
                renderCategoryLevel(level + 1, tempId, false);
            } else {
                // Просто добавляем в текущий уровень - триггерим событие change
                selector.dispatchEvent(new Event('change'));
            }
        }
    }
    
    // Автодополнение для спецификаций
    function initSpecAutocomplete(input, fieldType) {
        let suggestionsTimeout;
        let suggestionsDropdown = null;
        let selectedSuggestionIndex = -1;
        let suggestions = [];
        
        // Создаем dropdown для подсказок
        const createDropdown = () => {
            if (suggestionsDropdown) return suggestionsDropdown;
            suggestionsDropdown = document.createElement('div');
            suggestionsDropdown.className = 'spec-suggestions-dropdown';
            suggestionsDropdown.style.cssText = `
                position: absolute;
                background: white;
                border: 1px solid #ddd;
                border-radius: 4px;
                max-height: 200px;
                overflow-y: auto;
                z-index: 1000;
                box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                display: none;
                width: 100%;
                margin-top: 2px;
            `;
            input.parentElement.style.position = 'relative';
            input.parentElement.appendChild(suggestionsDropdown);
            return suggestionsDropdown;
        };
        
        const loadSuggestions = async (query) => {
            if (!query || query.length < 1) {
                if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
                return;
            }
            
            try {
                const categoryId = selectedCategoryId && selectedCategoryId > 0 ? selectedCategoryId : null;
                let url = `/account/api/part-spec-autocomplete?field=${fieldType}&query=${encodeURIComponent(query)}`;
                if (categoryId) {
                    url += `&category_id=${categoryId}`;
                }
                
                const response = await fetch(url, {
                    credentials: 'include'
                });
                
                if (!response.ok) return;
                
                const data = await response.json();
                suggestions = data.suggestions || [];
                selectedSuggestionIndex = -1;
                
                if (suggestions.length > 0) {
                    renderSuggestions(suggestions, query);
                } else {
                    if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
                }
            } catch (err) {
                console.error('Ошибка загрузки подсказок:', err);
                if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
            }
        };
        
        const renderSuggestions = (sugs, query) => {
            const dropdown = createDropdown();
            dropdown.innerHTML = '';
            
            sugs.forEach((suggestion, index) => {
                const item = document.createElement('div');
                item.className = 'spec-suggestion-item';
                item.style.cssText = `
                    padding: 8px 12px;
                    cursor: pointer;
                    border-bottom: 1px solid #f0f0f0;
                `;
                item.textContent = suggestion;
                item.dataset.index = index;
                
                item.addEventListener('click', () => {
                    input.value = suggestion;
                    dropdown.style.display = 'none';
                });
                
                item.addEventListener('mouseenter', () => {
                    selectedSuggestionIndex = index;
                    updateSuggestionSelection();
                });
                
                dropdown.appendChild(item);
            });
            
            dropdown.style.display = 'block';
        };
        
        const updateSuggestionSelection = () => {
            const items = suggestionsDropdown.querySelectorAll('.spec-suggestion-item');
            items.forEach((item, index) => {
                if (index === selectedSuggestionIndex) {
                    item.style.backgroundColor = '#f0f0f0';
                } else {
                    item.style.backgroundColor = 'white';
                }
            });
        };
        
        input.addEventListener('input', () => {
            const query = input.value.trim();
            clearTimeout(suggestionsTimeout);
            suggestionsTimeout = setTimeout(() => {
                loadSuggestions(query);
            }, 300);
        });
        
        input.addEventListener('blur', () => {
            // Закрываем dropdown с небольшой задержкой, чтобы клик по элементу успел сработать
            setTimeout(() => {
                if (suggestionsDropdown) suggestionsDropdown.style.display = 'none';
            }, 200);
        });
        
        input.addEventListener('keydown', (e) => {
            if (!suggestionsDropdown || suggestionsDropdown.style.display === 'none') return;
            
            const items = suggestionsDropdown.querySelectorAll('.spec-suggestion-item');
            if (items.length === 0) return;
            
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedSuggestionIndex = Math.min(selectedSuggestionIndex + 1, items.length - 1);
                updateSuggestionSelection();
                items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedSuggestionIndex = Math.max(selectedSuggestionIndex - 1, -1);
                updateSuggestionSelection();
                if (selectedSuggestionIndex >= 0) {
                    items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
                }
            } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
                e.preventDefault();
                input.value = suggestions[selectedSuggestionIndex];
                suggestionsDropdown.style.display = 'none';
            } else if (e.key === 'Escape') {
                suggestionsDropdown.style.display = 'none';
            }
        });
    }
    
    // Управление спецификациями
    const specsContainer = document.getElementById('part-specs-container');
    const addSpecBtn = document.getElementById('add-spec-btn');
    
    function addSpecField(name = '', value = '', unit = '') {
        const specGroup = document.createElement('div');
        specGroup.className = 'spec-input-group';
        specGroup.innerHTML = `
            <div class="form-row">
                <div class="form-group" style="flex: 1;">
                    <input type="text" class="spec-name-input" placeholder="Название спецификации" value="${name}" autocomplete="off">
                </div>
                <div class="form-group" style="flex: 1;">
                    <input type="text" class="spec-value-input" placeholder="Значение" value="${value}" autocomplete="off">
                </div>
                <div class="form-group" style="flex: 0 0 100px;">
                    <input type="text" class="spec-unit-input" placeholder="Ед. изм." value="${unit}" autocomplete="off">
                </div>
                <div class="form-group" style="flex: 0 0 auto; margin-left: 10px;">
                    <button type="button" class="btn btn-secondary btn-sm remove-spec-btn">Удалить</button>
                </div>
            </div>
        `;
        specsContainer.appendChild(specGroup);
        
        // Инициализируем автодополнение для новых полей
        const nameInput = specGroup.querySelector('.spec-name-input');
        const valueInput = specGroup.querySelector('.spec-value-input');
        const unitInput = specGroup.querySelector('.spec-unit-input');
        
        if (nameInput) initSpecAutocomplete(nameInput, 'name');
        if (valueInput) initSpecAutocomplete(valueInput, 'value');
        if (unitInput) initSpecAutocomplete(unitInput, 'unit');
    }
    
    function updateRemoveSpecButtons() {
        const specGroups = specsContainer.querySelectorAll('.spec-input-group');
        specGroups.forEach((group, index) => {
            const removeBtn = group.querySelector('.remove-spec-btn');
            if (removeBtn) {
                removeBtn.style.display = specGroups.length > 1 ? 'inline-block' : 'none';
            }
        });
    }
    
    if (addSpecBtn) {
        addSpecBtn.addEventListener('click', () => {
            addSpecField();
            updateRemoveSpecButtons();
        });
    }
    
    if (specsContainer) {
        specsContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-spec-btn')) {
                e.target.closest('.spec-input-group').remove();
                updateRemoveSpecButtons();
            }
        });
    }
    
    // Управление изображениями (унифицировано с автомобилями)
    const partImagesContainer = document.getElementById('part-images-container');
    const addPartImageBtn = document.getElementById('add-part-image-btn');
    
    function updateRemovePartImageButtons() {
        const imageGroups = partImagesContainer.querySelectorAll('.image-input-group');
        imageGroups.forEach((group, index) => {
            const removeBtn = group.querySelector('.remove-image-btn');
            if (removeBtn) {
                removeBtn.style.display = imageGroups.length > 1 ? 'inline-block' : 'none';
            }
        });
    }
    
    if (addPartImageBtn && !addPartImageBtn.dataset.listenerAdded) {
        addPartImageBtn.addEventListener('click', () => {
            const imageGroup = document.createElement('div');
            imageGroup.className = 'image-input-group';
            imageGroup.innerHTML = `
                <input type="file" class="image-file-input" accept="image/jpeg,image/jpg,image/png" style="display: none;">
                <button type="button" class="btn btn-secondary btn-sm select-image-btn">Выбрать файл</button>
                <span class="image-filename" style="margin-left: 10px; color: #666;"></span>
                <input type="hidden" class="image-url-input" value="">
                <input type="text" class="image-alt-input" placeholder="Альтернативный текст" style="margin-top: 10px; width: 100%;">
                <button type="button" class="btn btn-secondary btn-sm remove-image-btn" style="display: none; margin-top: 10px;">Удалить</button>
                <div class="image-preview" style="margin-top: 10px; max-width: 200px; display: none;">
                    <img src="" alt="Preview" style="max-width: 100%; height: auto; border-radius: 4px;">
                </div>
                <div class="image-upload-status" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
            `;
            partImagesContainer.appendChild(imageGroup);
            initImageInputHandlers(imageGroup, 'part');
            updateRemovePartImageButtons();
        });
        addPartImageBtn.dataset.listenerAdded = 'true';
    }
    
    if (partImagesContainer && !partImagesContainer.dataset.listenerAdded) {
        partImagesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-image-btn')) {
                e.target.closest('.image-input-group').remove();
                updateRemovePartImageButtons();
            }
        });
        partImagesContainer.dataset.listenerAdded = 'true';
    }
    
    // Инициализация существующих изображений
    document.querySelectorAll('#part-images-container .image-input-group').forEach(group => {
        initImageInputHandlers(group, 'part');
    });
    updateRemovePartImageButtons();
    
    // Инициализация автодополнения для существующих полей спецификаций
    document.querySelectorAll('.spec-name-input').forEach(input => {
        initSpecAutocomplete(input, 'name');
    });
    document.querySelectorAll('.spec-value-input').forEach(input => {
        initSpecAutocomplete(input, 'value');
    });
    document.querySelectorAll('.spec-unit-input').forEach(input => {
        initSpecAutocomplete(input, 'unit');
    });
    
    // Обработчик отправки формы
    if (!form.dataset.submitHandlerAdded) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (!selectedCategoryId) {
                alert('Пожалуйста, выберите категорию');
                return;
            }
            
            const messageDiv = document.getElementById('add-part-message');
            messageDiv.style.display = 'none';
            
            try {
                // Определяем, является ли выбранная категория новой (temp_id отрицательный)
                const isNewCategory = selectedCategoryId < 0;
                
                // Собираем данные формы
                const partData = {
                    part_name: document.getElementById('part-name').value.trim(),
                    part_article: document.getElementById('part-article').value.trim() || null,
                    description: document.getElementById('part-description').value.trim(),
                    price: parseFloat(document.getElementById('part-price').value),
                    stock_count: parseInt(document.getElementById('part-stock').value) || 0,
                    manufacturer: document.getElementById('part-manufacturer').value,
                    category_id: isNewCategory ? null : selectedCategoryId, // Если новая категория, будет null
                    specifications: [],
                    image_urls: [],
                    new_categories: [] // Новые категории для создания
                };
                
                // Если выбрана новая категория, собираем путь новых категорий
                if (isNewCategory && newCategories.length > 0) {
                    // Собираем путь категорий от корня до выбранной
                    const categoryPath = [];
                    let currentId = selectedCategoryId;
                    let firstExistingParentId = null;
                    
                    // Проходим путь от выбранной категории к корню
                    while (currentId !== null && currentId !== undefined) {
                        const cat = newCategories.find(c => c.temp_id === currentId);
                        if (cat) {
                            categoryPath.unshift({
                                category_name: cat.category_name,
                                parent_id: null // Будет установлен бэкендом при создании
                            });
                            currentId = cat.parent_id;
                        } else {
                            // Если parent_id не найден в newCategories, значит это существующая категория
                            if (currentId >= 0) {
                                firstExistingParentId = currentId;
                            }
                            break;
                        }
                    }
                    
                    // Если есть существующий родитель, используем его ID как category_id
                    // и устанавливаем parent_id для первой новой категории
                    if (firstExistingParentId !== null) {
                        partData.category_id = firstExistingParentId;
                        if (categoryPath.length > 0) {
                            categoryPath[0].parent_id = firstExistingParentId;
                        }
                    }
                    
                    partData.new_categories = categoryPath;
                }
                
                // Собираем спецификации
                const specGroups = specsContainer.querySelectorAll('.spec-input-group');
                specGroups.forEach((group, index) => {
                    const name = group.querySelector('.spec-name-input').value.trim();
                    const value = group.querySelector('.spec-value-input').value.trim();
                    const unit = group.querySelector('.spec-unit-input').value.trim();
                    if (name && value) {
                        partData.specifications.push({
                            spec_name: name,
                            spec_value: value,
                            spec_unit: unit || null
                        });
                    }
                });
                
                // Собираем изображения
                const imageGroups = partImagesContainer.querySelectorAll('.image-input-group');
                imageGroups.forEach((group, index) => {
                    const url = group.querySelector('.image-url-input').value;
                    const altText = group.querySelector('.image-alt-input').value.trim();
                    if (url) {
                        partData.image_urls.push({
                            url: url,
                            alt_text: altText || null,
                            sort_order: index
                        });
                    }
                });
                
                // Отправляем данные
                const response = await fetch('/account/api/parts', {
                    method: 'POST',
                    credentials: 'include',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(partData)
                });
                
                const data = await response.json();
                if (!response.ok) {
                    throw new Error(data.detail || 'Ошибка при создании запчасти');
                }
                
                // Успех
                messageDiv.textContent = data.message || 'Запчасть успешно добавлена';
                messageDiv.className = 'success-message';
                messageDiv.style.display = 'block';
                messageDiv.style.color = '#28a745';
                
                // Очищаем форму
                form.reset();
                specsContainer.innerHTML = '';
                addSpecField();
                partImagesContainer.innerHTML = '';
                const firstImageGroup = document.createElement('div');
                firstImageGroup.className = 'image-input-group';
                firstImageGroup.innerHTML = `
                    <input type="file" class="image-file-input" accept="image/jpeg,image/jpg,image/png" style="display: none;">
                    <button type="button" class="btn btn-secondary btn-sm select-image-btn">Выбрать файл</button>
                    <span class="image-filename" style="margin-left: 10px; color: #666;"></span>
                    <input type="hidden" class="image-url-input" value="">
                    <input type="text" class="image-alt-input" placeholder="Альтернативный текст" style="margin-top: 10px; width: 100%;">
                    <button type="button" class="btn btn-secondary btn-sm remove-image-btn" style="display: none; margin-top: 10px;">Удалить</button>
                    <div class="image-preview" style="margin-top: 10px; max-width: 200px; display: none;">
                        <img src="" alt="Preview" style="max-width: 100%; height: auto; border-radius: 4px;">
                    </div>
                    <div class="image-upload-status" style="margin-top: 5px; font-size: 12px; color: #666;"></div>
                `;
                partImagesContainer.appendChild(firstImageGroup);
                initImageInputHandlers(firstImageGroup, 'part');
                updateRemovePartImageButtons();
                
                // Сбрасываем категории
                selectedCategoryId = null;
                selectedCategoryPath = [];
                newCategories = [];
                document.getElementById('part-category-levels').innerHTML = '';
                await loadCategoriesTree();
                
            } catch (err) {
                console.error('Ошибка добавления запчасти:', err);
                messageDiv.textContent = typeof err === 'string' ? err : err.message || 'Ошибка при добавлении запчасти';
                messageDiv.className = 'error-message';
                messageDiv.style.display = 'block';
                messageDiv.style.color = '#d32f2f';
            }
        });
        form.dataset.submitHandlerAdded = 'true';
    }
    
    // Инициализация при загрузке
    loadCategoriesTree();
    updateRemoveSpecButtons();
}

// ========== АДМИН-ПАНЕЛЬ: УПРАВЛЕНИЕ ПОЛЬЗОВАТЕЛЯМИ (только для администраторов) ==========

let currentAdminUser = null;

function initAdminPanel() {
    const searchBtn = document.getElementById('admin-search-btn');
    const searchInput = document.getElementById('admin-search-query');
    const saveBtn = document.getElementById('admin-save-btn');
    const cancelBtn = document.getElementById('admin-cancel-btn');
    
    if (searchBtn) {
        searchBtn.addEventListener('click', handleAdminSearch);
    }
    
    if (searchInput) {
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                handleAdminSearch();
            }
        });
    }
    
    if (saveBtn) {
        saveBtn.addEventListener('click', handleAdminSave);
    }
    
    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleAdminCancel);
    }
}

async function handleAdminSearch() {
    const query = document.getElementById('admin-search-query').value.trim();
    const messageDiv = document.getElementById('admin-message');
    const formDiv = document.getElementById('admin-user-form');
    const searchBtn = document.getElementById('admin-search-btn');
    
    if (!query) {
        showAdminMessage('Введите ID пользователя или email', 'error');
        return;
    }
    
    // Показываем индикатор загрузки
    const oldBtnText = searchBtn.textContent;
    searchBtn.disabled = true;
    searchBtn.textContent = 'Поиск...';
    formDiv.style.display = 'none';
    messageDiv.style.display = 'none';
    
    try {
        const response = await fetch(`/account/api/admin/search-user?query=${encodeURIComponent(query)}`, {
            credentials: 'include'
        });
        
        if (!response.ok) {
            let errorMessage = 'Пользователь не найден';
            try {
                const error = await response.json();
                if (response.status === 404) {
                    errorMessage = `Пользователь с ID или email "${query}" не найден. Проверьте правильность введенных данных.`;
                } else if (response.status === 403) {
                    errorMessage = 'Доступ запрещен. Требуется роль администратора.';
                } else {
                    errorMessage = error.detail || errorMessage;
                }
            } catch (e) {
                // Если не удалось распарсить JSON, используем стандартное сообщение
                if (response.status === 404) {
                    errorMessage = `Пользователь с ID или email "${query}" не найден. Проверьте правильность введенных данных.`;
                }
            }
            throw new Error(errorMessage);
        }
        
        const user = await response.json();
        currentAdminUser = user;
        
        // Заполняем форму
        document.getElementById('admin-user-id').value = user.user_id;
        document.getElementById('admin-user-email').value = user.email || '';
        document.getElementById('admin-user-phone').value = user.phone_number || '';
        document.getElementById('admin-user-email-verified').value = user.email_verified ? 'true' : 'false';
        document.getElementById('admin-user-phone-verified').value = user.phone_verified ? 'true' : 'false';
        document.getElementById('admin-user-role').value = user.role;
        document.getElementById('admin-user-status').value = user.status;
        document.getElementById('admin-user-action').value = '';
        
        formDiv.style.display = 'block';
        messageDiv.style.display = 'none';
        showAdminMessage(`Пользователь найден: ${user.email} (ID: ${user.user_id})`, 'success');
        
    } catch (err) {
        showAdminMessage(err.message || 'Ошибка поиска пользователя', 'error');
        formDiv.style.display = 'none';
    } finally {
        // Восстанавливаем кнопку
        searchBtn.disabled = false;
        searchBtn.textContent = oldBtnText;
    }
}

async function handleAdminSave() {
    if (!currentAdminUser) {
        showAdminMessage('Сначала найдите пользователя', 'error');
        return;
    }
    
    const action = document.getElementById('admin-user-action').value;
    
    if (!action) {
        showAdminMessage('Выберите действие', 'error');
        return;
    }
    
    if (action === 'delete') {
        if (!confirm(`Вы уверены, что хотите удалить пользователя ${currentAdminUser.email}? Это действие нельзя отменить.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/account/api/admin/delete-user/${currentAdminUser.user_id}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка удаления пользователя');
            }
            
            const data = await response.json();
            showAdminMessage(data.message || 'Пользователь успешно удален', 'success');
            handleAdminCancel();
            
        } catch (err) {
            showAdminMessage(err.message || 'Ошибка удаления пользователя', 'error');
        }
    } else if (action === 'update') {
        const updateData = {
            email: document.getElementById('admin-user-email').value.trim(),
            phone_number: document.getElementById('admin-user-phone').value.trim() || null,
            email_verified: document.getElementById('admin-user-email-verified').value === 'true',
            phone_verified: document.getElementById('admin-user-phone-verified').value === 'true',
            role: document.getElementById('admin-user-role').value,
            status: document.getElementById('admin-user-status').value
        };
        
        if (!updateData.email) {
            showAdminMessage('Email не может быть пустым', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/account/api/admin/update-user/${currentAdminUser.user_id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(updateData)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Ошибка обновления пользователя');
            }
            
            const data = await response.json();
            showAdminMessage(data.message || 'Данные пользователя успешно обновлены', 'success');
            
            // Обновляем текущего пользователя
            currentAdminUser = data.user;
            
        } catch (err) {
            showAdminMessage(err.message || 'Ошибка обновления пользователя', 'error');
        }
    }
}

function handleAdminCancel() {
    document.getElementById('admin-user-form').style.display = 'none';
    document.getElementById('admin-search-query').value = '';
    document.getElementById('admin-message').style.display = 'none';
    currentAdminUser = null;
}

function showAdminMessage(message, type) {
    const messageDiv = document.getElementById('admin-message');
    messageDiv.textContent = message;
    messageDiv.style.display = 'block';
    messageDiv.style.padding = '10px';
    messageDiv.style.borderRadius = '4px';
    
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#d4edda';
        messageDiv.style.color = '#155724';
        messageDiv.style.border = '1px solid #c3e6cb';
    } else {
        messageDiv.style.backgroundColor = '#f8d7da';
        messageDiv.style.color = '#721c24';
        messageDiv.style.border = '1px solid #f5c6cb';
    }
    
    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 5000);
}

// Экспортируем функции для использования в HTML
window.payOrder = payOrder;
window.cancelOrder = cancelOrder;
window.updateOrderStatus = updateOrderStatus;
window.updateOrderPaymentStatus = updateOrderPaymentStatus;
window.toggleEditAdminNotes = toggleEditAdminNotes;
window.cancelEditAdminNotes = cancelEditAdminNotes;
window.saveAdminNotes = saveAdminNotes;

