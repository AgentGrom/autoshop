// src/static/js/verification.js
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка авторизации
    if (typeof isAuthenticated === 'function') {
        if (!(await isAuthenticated())) {
            window.location.href = '/api/auth/login';
            return;
        }
    }

    // Получаем тип верификации из URL
    const urlParams = new URLSearchParams(window.location.search);
    let verificationType = urlParams.get('type');
    
    const loader = document.getElementById('verification-loader');
    const content = document.getElementById('verification-content');
    const errorPage = document.getElementById('verification-error-page');
    const verificationForm = document.getElementById('verification-form');
    const resendBtn = document.getElementById('resend-code-btn');
    let testCode = null;

    // Загружаем данные и определяем тип верификации
    try {
        const profileResponse = await fetch('/account/api/profile');
        if (!profileResponse.ok) throw new Error('Ошибка загрузки профиля');
        
        const profileData = await profileResponse.json();
        
        // Определяем тип верификации, если не указан
        if (!verificationType) {
            if (!profileData.email_verified) {
                verificationType = 'email';
            } else if (profileData.phone_number && !profileData.phone_verified) {
                verificationType = 'phone';
            } else {
                // Всё подтверждено, возвращаемся в личный кабинет
                window.location.href = '/account';
                return;
            }
        }

        // Обновляем заголовок и описание
        const title = document.getElementById('verification-title');
        const description = document.getElementById('verification-description');
        
        if (verificationType === 'email') {
            title.textContent = 'Подтверждение email';
            description.textContent = `Мы отправили код подтверждения на адрес ${profileData.email}. Пожалуйста, введите код из письма.`;
        } else if (verificationType === 'phone') {
            title.textContent = 'Подтверждение телефона';
            description.textContent = `Мы отправили код подтверждения на номер ${profileData.phone_number}. Пожалуйста, введите код из SMS.`;
        }

        // Отправляем код
        await sendVerificationCode(verificationType);

        loader.style.display = 'none';
        content.style.display = 'block';
    } catch (err) {
        console.error('Ошибка загрузки страницы подтверждения:', err);
        loader.style.display = 'none';
        errorPage.style.display = 'block';
    }

    // Обработчик отправки формы
    if (verificationForm) {
        verificationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleVerificationSubmit(verificationType);
        });
    }

    // Обработчик повторной отправки кода
    if (resendBtn) {
        resendBtn.addEventListener('click', async () => {
            await sendVerificationCode(verificationType);
        });
    }

    async function sendVerificationCode(type) {
        try {
            const response = await fetch(`/account/verification/send-code?type=${type}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorMessage = await getErrorMessage(response);
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            // Сохраняем тестовый код для отображения
            if (result.test_code) {
                testCode = result.test_code;
                const hint = document.getElementById('verification-code-hint');
                hint.textContent = `Тестовый код: ${testCode}`;
                hint.style.display = 'block';
            }
        } catch (err) {
            console.error('Ошибка отправки кода:', err);
            const errorDiv = document.getElementById('verification-error');
            errorDiv.textContent = err.message || 'Ошибка отправки кода';
            errorDiv.style.display = 'block';
        }
    }

    async function handleVerificationSubmit(type) {
        const errorDiv = document.getElementById('verification-error');
        const successDiv = document.getElementById('verification-success');
        const codeInput = document.getElementById('verification-code');
        
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        const code = codeInput.value.trim();
        
        if (!code) {
            errorDiv.textContent = 'Введите код подтверждения';
            errorDiv.style.display = 'block';
            return;
        }

        try {
            const response = await fetch(`/account/verification/verify?type=${type}&code=${code}`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) {
                const errorMessage = await getErrorMessage(response);
                throw new Error(errorMessage);
            }
            
            const result = await response.json();
            
            successDiv.textContent = result.message || 'Успешно подтверждено';
            successDiv.style.display = 'block';
            
            // Перенаправляем в личный кабинет через 2 секунды
            setTimeout(() => {
                window.location.href = '/account';
            }, 2000);
        } catch (err) {
            errorDiv.textContent = err.message || 'Ошибка подтверждения';
            errorDiv.style.display = 'block';
        }
    }
});

