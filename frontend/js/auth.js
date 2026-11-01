// ReWear - Authentication Page Logic

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect to dashboard
    if (isLoggedIn() && (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('register.html'))) {
        window.location.href = '/dashboard.html';
        return;
    }

    initLoginForm();
    initRegisterForm();
    initDemoLoginButtons();
});

// Handle Login Form
function initLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button[type="submit"]');
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;

        if (!email || !password) {
            showToast('Please enter both your email address and password.', 'warning');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Authenticating...';

            const res = await api.post('/auth/login', { email, password });

            setToken(res.token);
            setUser(res.user);

            showToast(res.message || 'Login successful!', 'success');

            setTimeout(() => {
                // If user is admin, allow choosing admin dashboard or user dashboard
                if (res.user.role === 'admin') {
                    window.location.href = '/admin.html';
                } else {
                    window.location.href = '/dashboard.html';
                }
            }, 700);
        } catch (err) {
            showToast(err.message || 'Login failed. Please check credentials.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Sign In <i class="fas fa-arrow-right"></i>';
        }
    });
}

// Handle Registration Form
function initRegisterForm() {
    const regForm = document.getElementById('register-form');
    if (!regForm) return;

    regForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = regForm.querySelector('button[type="submit"]');

        const name = document.getElementById('reg-name').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const phone = document.getElementById('reg-phone') ? document.getElementById('reg-phone').value.trim() : '';
        const location = document.getElementById('reg-location') ? document.getElementById('reg-location').value.trim() : '';
        const password = document.getElementById('reg-password').value;
        const confirmPassword = document.getElementById('reg-confirm-password').value;

        if (password !== confirmPassword) {
            showToast('Passwords do not match. Please re-enter.', 'error');
            return;
        }

        if (password.length < 6) {
            showToast('Password must be at least 6 characters.', 'warning');
            return;
        }

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';

            const res = await api.post('/auth/register', {
                name,
                email,
                phone,
                location,
                password,
                confirmPassword
            });

            setToken(res.token);
            setUser(res.user);

            showToast(res.message || 'Welcome to ReWear!', 'success');

            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 800);
        } catch (err) {
            showToast(err.message || 'Registration failed.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Create Account <i class="fas fa-arrow-right"></i>';
        }
    });
}

// Quick Demo Login Buttons Helper
function initDemoLoginButtons() {
    const demoBtns = document.querySelectorAll('.btn-demo-pill');
    demoBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const email = btn.getAttribute('data-email');
            const pass = btn.getAttribute('data-pass');
            const emailInput = document.getElementById('login-email');
            const passInput = document.getElementById('login-password');

            if (emailInput && passInput) {
                emailInput.value = email;
                passInput.value = pass;
                showToast(`Filled credentials for ${btn.textContent.trim()}. Submitting...`, 'info', 2000);
                setTimeout(() => {
                    const submitBtn = document.querySelector('#login-form button[type="submit"]');
                    if (submitBtn) submitBtn.click();
                }, 300);
            }
        });
    });
}
