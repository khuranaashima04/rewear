// ReWear - Main Site Layout & Navigation Controller

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initNotifications();
    initNewsletter();
});

function initNavigation() {
    const mobileToggle = document.getElementById('mobile-nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const icon = mobileToggle.querySelector('i');
            if (navLinks.classList.contains('active')) {
                icon.classList.remove('fa-bars');
                icon.classList.add('fa-times');
            } else {
                icon.classList.remove('fa-times');
                icon.classList.add('fa-bars');
            }
        });
    }

    // Set Active Link based on pathname
    const currentPath = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');
        if (href && (currentPath.endsWith(href) || (href === '/' && (currentPath === '/' || currentPath.endsWith('index.html'))))) {
            link.classList.add('active');
        }
    });

    // Handle Auth UI State
    const guestArea = document.getElementById('nav-auth-guest');
    const loggedInArea = document.getElementById('nav-auth-user');
    const user = getUser();

    if (user && isLoggedIn()) {
        if (guestArea) guestArea.style.display = 'none';
        if (loggedInArea) {
            loggedInArea.style.display = 'flex';
            const avatarImg = document.getElementById('nav-user-avatar');
            const userNameSpan = document.getElementById('nav-user-name');
            if (avatarImg) avatarImg.src = user.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
            if (userNameSpan) userNameSpan.textContent = user.name.split(' ')[0];

            // Show admin link if admin
            const adminMenuItem = document.getElementById('nav-admin-link');
            if (adminMenuItem) {
                adminMenuItem.style.display = user.role === 'admin' ? 'flex' : 'none';
            }
        }

        // Setup User Dropdown
        const userBtn = document.getElementById('user-menu-btn');
        const userDropdown = document.getElementById('user-dropdown');
        if (userBtn && userDropdown) {
            userBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                userDropdown.classList.toggle('show');
            });

            document.addEventListener('click', () => {
                userDropdown.classList.remove('show');
            });
        }

        // Logout action
        const logoutBtn = document.getElementById('nav-logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                logout();
            });
        }
    } else {
        if (guestArea) guestArea.style.display = 'flex';
        if (loggedInArea) loggedInArea.style.display = 'none';
    }
}

// Fetch unread notifications count
async function initNotifications() {
    if (!isLoggedIn()) return;
    try {
        const data = await api.get('/notifications');
        if (data.success && data.unreadCount > 0) {
            const badge = document.getElementById('nav-notif-badge');
            if (badge) {
                badge.textContent = data.unreadCount > 9 ? '9+' : data.unreadCount;
                badge.style.display = 'flex';
            }
        }
    } catch (err) {
        // Silently skip if network/auth not ready
    }
}

// Newsletter Subscription Form Handler
function initNewsletter() {
    const form = document.getElementById('newsletter-form');
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const input = form.querySelector('input[type="email"]');
            if (input && input.value) {
                showToast(`Thank you for subscribing! Sustainable fashion updates sent to ${input.value}.`, 'success');
                input.value = '';
            }
        });
    }
}
