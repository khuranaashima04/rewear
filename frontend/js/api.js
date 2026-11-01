// ReWear - Unified API Client & Utilities

const API_BASE = '/api';

// Authentication State Management
const TOKEN_KEY = 'rewear_jwt_token';
const USER_KEY = 'rewear_user_data';

function getToken() {
    return localStorage.getItem(TOKEN_KEY);
}

function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
}

function removeToken() {
    localStorage.removeItem(TOKEN_KEY);
}

function getUser() {
    const raw = localStorage.getItem(USER_KEY);
    try {
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
}

function setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function removeUser() {
    localStorage.removeItem(USER_KEY);
}

function isLoggedIn() {
    return !!getToken() && !!getUser();
}

function isAdmin() {
    const user = getUser();
    return user && user.role === 'admin';
}

function logout() {
    removeToken();
    removeUser();
    showToast('Logged out successfully. See you soon!', 'info');
    setTimeout(() => {
        window.location.href = '/login.html';
    }, 600);
}

// Unified Fetch API Wrapper
async function request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
    const token = getToken();

    const headers = options.headers || {};

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // If body is not FormData, add JSON Content-Type
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(options.body);
    }

    options.headers = headers;

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            // Handle session expiration
            if (response.status === 401 && !url.includes('/auth/login') && !url.includes('/auth/register')) {
                removeToken();
                removeUser();
                showToast('Your session has expired. Please log in again.', 'warning');
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 1000);
            }
            throw new Error(data.message || 'An error occurred during request.');
        }

        return data;
    } catch (err) {
        console.error(`[API Error] ${endpoint}:`, err);
        throw err;
    }
}

const api = {
    get: (endpoint, params = {}) => {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `${endpoint}?${queryString}` : endpoint;
        return request(url, { method: 'GET' });
    },
    post: (endpoint, body, isFormData = false) => {
        return request(endpoint, {
            method: 'POST',
            body: isFormData ? body : body
        });
    },
    put: (endpoint, body, isFormData = false) => {
        return request(endpoint, {
            method: 'PUT',
            body: isFormData ? body : body
        });
    },
    delete: (endpoint) => {
        return request(endpoint, { method: 'DELETE' });
    }
};

// Toast Notification System
function showToast(message, type = 'success', duration = 4000) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let icon = 'fa-check-circle';
    if (type === 'error') icon = 'fa-exclamation-circle';
    if (type === 'info') icon = 'fa-info-circle';
    if (type === 'warning') icon = 'fa-exclamation-triangle';

    toast.innerHTML = `
        <div class="toast-content">
            <i class="fas ${icon}"></i>
            <span>${message}</span>
        </div>
        <button class="toast-close"><i class="fas fa-times"></i></button>
    `;

    container.appendChild(toast);

    toast.querySelector('.toast-close').addEventListener('click', () => {
        toast.remove();
    });

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 250);
    }, duration);
}

// Confirmation Dialog Modal
function showConfirmModal({ title = 'Are you sure?', message, confirmText = 'Confirm', onConfirm }) {
    let overlay = document.getElementById('global-confirm-modal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-confirm-modal';
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal-card">
                <button class="modal-close" id="confirm-modal-close"><i class="fas fa-times"></i></button>
                <div class="modal-header">
                    <h3 class="modal-title font-serif" id="confirm-modal-title"></h3>
                    <p class="text-muted" id="confirm-modal-desc"></p>
                </div>
                <div style="display:flex; justify-content:flex-end; gap:0.75rem; margin-top:1.5rem;">
                    <button class="btn btn-outline btn-sm" id="confirm-modal-cancel">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="confirm-modal-action">Confirm</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
    }

    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-desc').textContent = message;
    const actionBtn = document.getElementById('confirm-modal-action');
    actionBtn.textContent = confirmText;

    overlay.classList.add('active');

    function close() {
        overlay.classList.remove('active');
    }

    document.getElementById('confirm-modal-close').onclick = close;
    document.getElementById('confirm-modal-cancel').onclick = close;
    actionBtn.onclick = () => {
        close();
        if (typeof onConfirm === 'function') onConfirm();
    };
}

// Format Indian Rupee Currency (INR)
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-IN', { 
        style: 'currency', 
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(amount || 0);
}

// Format Relative or Formatted Date
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
