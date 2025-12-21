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

    // Загружаем данные для активного раздела (профиль)
    try {
        await loadSectionData('profile');
    } catch (err) {
        console.error('Error loading initial section:', err);
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
        'CONFIRMED': { text: 'Подтвержден', class: 'status-confirmed' },
        'SHIPPED': { text: 'Отправлен', class: 'status-shipped' },
        'DELIVERED': { text: 'Доставлен', class: 'status-delivered' },
        'CANCELLED': { text: 'Отменен', class: 'status-cancelled' }
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
            const imageUrl = item.image ? `/static/${item.image}` : '/static/images/placeholder.png';
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
            const imageUrl = car.image ? `/static/${car.image}` : '/static/images/placeholder.png';
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

