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

async function handlePhoneUpdate(e) {
    e.preventDefault();
    
    const errorDiv = document.getElementById('phone-update-error');
    const successDiv = document.getElementById('phone-update-success');
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    const formData = new FormData(e.target);
    const updateData = {
        phone_number: formData.get('phone_number')
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
    
    if (!managementTab) {
        return;
    }
    
    // Показываем вкладку только для менеджера и администратора
    if (role === 'Менеджер' || role === 'MANAGER' || role === 'Администратор' || role === 'ADMIN') {
        managementTab.style.display = 'inline-block';
    } else {
        managementTab.style.display = 'none';
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
        
        return `
            <div class="order-card" style="background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
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

// Экспортируем функции для использования в HTML
window.payOrder = payOrder;
window.cancelOrder = cancelOrder;
window.updateOrderStatus = updateOrderStatus;
window.updateOrderPaymentStatus = updateOrderPaymentStatus;
window.toggleEditAdminNotes = toggleEditAdminNotes;
window.cancelEditAdminNotes = cancelEditAdminNotes;
window.saveAdminNotes = saveAdminNotes;
window.updateOrderPaymentStatus = updateOrderPaymentStatus;

