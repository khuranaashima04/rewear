// ReWear - User Dashboard Controller

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!isLoggedIn()) {
        showToast('Please sign in to access your dashboard.', 'info');
        setTimeout(() => window.location.href = '/login.html', 800);
        return;
    }

    initDashboardTabs();
    loadDashboardProfile();
    initSettingsForm();
});

// Setup Tab Navigation
function initDashboardTabs() {
    const navItems = document.querySelectorAll('.dash-nav-item');
    const panes = document.querySelectorAll('.tab-pane');

    // Parse ?tab=... from URL
    const urlParams = new URLSearchParams(window.location.search);
    const initialTab = urlParams.get('tab') || 'overview';

    activateTab(initialTab);

    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            activateTab(tabId);

            // Update URL without reloading
            const newUrl = `${window.location.pathname}?tab=${tabId}`;
            window.history.replaceState({}, '', newUrl);
        });
    });

    function activateTab(tabId) {
        navItems.forEach(item => {
            item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
        });
        panes.forEach(pane => {
            pane.classList.toggle('active', pane.id === `tab-${tabId}`);
        });

        // Trigger tab-specific loads
        if (tabId === 'listings') loadMyListings();
        if (tabId === 'orders') loadMyOrders();
        if (tabId === 'exchanges') loadMyExchanges();
        if (tabId === 'donations') loadMyDonations();
        if (tabId === 'wishlist') loadMyWishlist();
        if (tabId === 'notifications') loadMyNotifications();
    }
}

// Load User Profile & Overall Stats
async function loadDashboardProfile() {
    try {
        const res = await api.get('/users/profile');
        currentUser = res.user;

        // Populate sidebar & overview
        setText('dash-sidebar-name', currentUser.name);
        setText('dash-sidebar-email', currentUser.email);
        setText('dash-sidebar-role', currentUser.role === 'admin' ? 'Administrator' : 'Eco Member');
        const avatarEl = document.getElementById('dash-sidebar-avatar');
        if (avatarEl) avatarEl.src = currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';

        // Overview Header
        setText('welcome-user-name', currentUser.name.split(' ')[0]);

        // Stats Cards
        if (currentUser.stats) {
            const s = currentUser.stats;
            setText('dash-stat-total-listings', s.totalListings || 0);
            setText('dash-stat-active-listings', s.activeListings || 0);
            setText('dash-stat-sold', s.itemsSold || 0);
            setText('dash-stat-exchanges', s.exchangesCompleted || 0);
            setText('dash-stat-donations', s.donationsCompleted || 0);

            // Eco Impact (estimated weight)
            const reusedCount = (s.itemsSold || 0) + (s.exchangesCompleted || 0) * 2 + (s.donationsCompleted || 0);
            setText('dash-stat-impact', `${(reusedCount * 0.55).toFixed(1)} kg`);
        }

        // Pre-fill settings form
        const nameInput = document.getElementById('settings-name');
        const phoneInput = document.getElementById('settings-phone');
        const locInput = document.getElementById('settings-location');
        const bioInput = document.getElementById('settings-bio');
        const avatarInput = document.getElementById('settings-avatar');

        if (nameInput) nameInput.value = currentUser.name || '';
        if (phoneInput) phoneInput.value = currentUser.phone || '';
        if (locInput) locInput.value = currentUser.location || '';
        if (bioInput) bioInput.value = currentUser.bio || '';
        if (avatarInput) avatarInput.value = currentUser.avatar || '';

    } catch (e) {
        console.error('Failed to load profile:', e);
    }
}

// Load User's Wardrobe Listings
async function loadMyListings() {
    const container = document.getElementById('my-listings-container');
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner"><div class="spinner"></div></div>';

    try {
        const res = await api.get('/items/my-listings');
        const items = res.items || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-tshirt"></i></div>
                    <h3 class="empty-state-title">No Wardrobe Items Listed</h3>
                    <p class="empty-state-desc">Give your unused clothes a second life by listing them for sale, exchange, or donation.</p>
                    <a href="/sell.html" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> List Your First Item</a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="products-grid">
                ${items.map(item => `
                    <article class="product-card">
                        <div class="card-img-wrapper">
                            <img src="${item.primary_image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'}" alt="${item.title}">
                            <div class="card-badges">
                                <span class="badge badge-${item.listing_type}">${item.listing_type.toUpperCase()}</span>
                                <span class="status-pill status-${item.status}">${item.status.toUpperCase()}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="card-meta">
                                <span class="card-brand">${item.brand}</span>
                                <span class="card-size">Size: ${item.size}</span>
                            </div>
                            <h4 class="card-title"><a href="/product.html?id=${item.id}">${item.title}</a></h4>
                            <div class="card-footer">
                                <span class="card-price">${item.listing_type === 'sell' ? formatCurrency(item.price) : item.listing_type.toUpperCase()}</span>
                                <div style="display:flex; gap:0.4rem;">
                                    <a href="/sell.html?id=${item.id}" class="btn btn-outline btn-sm" title="Edit"><i class="fas fa-edit"></i></a>
                                    <button class="btn btn-danger btn-sm btn-del-listing" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" title="Delete"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        `;

        container.querySelectorAll('.btn-del-listing').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const title = decodeURIComponent(btn.getAttribute('data-title'));

                showConfirmModal({
                    title: 'Delete Listing?',
                    message: `Are you sure you want to delete "${title}"?`,
                    confirmText: 'Delete',
                    onConfirm: async () => {
                        try {
                            await api.delete(`/items/${id}`);
                            showToast('Listing removed successfully.', 'success');
                            loadMyListings();
                            loadDashboardProfile();
                        } catch (err) {
                            showToast(err.message || 'Failed to remove listing.', 'error');
                        }
                    }
                });
            });
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading listings.</p>';
    }
}

// Load User's Purchases & Sales
async function loadMyOrders() {
    const purchasesContainer = document.getElementById('my-purchases-table-body');
    const salesContainer = document.getElementById('my-sales-table-body');

    try {
        const res = await api.get('/orders');
        const purchases = res.purchases || [];
        const sales = res.sales || [];

        // Purchases Table
        if (purchasesContainer) {
            if (purchases.length === 0) {
                purchasesContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No purchase orders placed yet.</td></tr>';
            } else {
                purchasesContainer.innerHTML = purchases.map(ord => `
                    <tr>
                        <td><strong>${ord.order_number}</strong></td>
                        <td>
                            <div class="table-item-preview">
                                <img src="${ord.item_image || ''}" class="table-item-img" alt="Item">
                                <div>
                                    <div style="font-weight:600;"><a href="/product.html?id=${ord.item_id}">${ord.item_title}</a></div>
                                    <span style="font-size:0.8rem; color:var(--text-muted);">${ord.item_brand} • ${ord.item_size}</span>
                                </div>
                            </div>
                        </td>
                        <td>${formatCurrency(ord.amount)}</td>
                        <td>${ord.seller_name}</td>
                        <td><span class="status-pill status-${ord.status}">${ord.status.toUpperCase()}</span></td>
                        <td>
                            ${ord.status === 'confirmed' || ord.status === 'pending' ? `
                                <button class="btn btn-danger btn-sm btn-cancel-order" data-id="${ord.id}">Cancel</button>
                            ` : `<span class="text-muted" style="font-size:0.85rem;">Completed</span>`}
                        </td>
                    </tr>
                `).join('');

                purchasesContainer.querySelectorAll('.btn-cancel-order').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const ordId = btn.getAttribute('data-id');
                        showConfirmModal({
                            title: 'Cancel Order?',
                            message: 'Are you sure you want to cancel this order? The item will be returned to active marketplace listings.',
                            confirmText: 'Cancel Order',
                            onConfirm: async () => {
                                try {
                                    await api.put(`/orders/${ordId}/cancel`, {});
                                    showToast('Order successfully cancelled.', 'info');
                                    loadMyOrders();
                                } catch (e) {
                                    showToast(e.message || 'Could not cancel order.', 'error');
                                }
                            }
                        });
                    });
                });
            }
        }

        // Sales Table
        if (salesContainer) {
            if (sales.length === 0) {
                salesContainer.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No sales orders received yet.</td></tr>';
            } else {
                salesContainer.innerHTML = sales.map(ord => `
                    <tr>
                        <td><strong>${ord.order_number}</strong></td>
                        <td>
                            <div class="table-item-preview">
                                <img src="${ord.item_image || ''}" class="table-item-img" alt="Item">
                                <div style="font-weight:600;"><a href="/product.html?id=${ord.item_id}">${ord.item_title}</a></div>
                            </div>
                        </td>
                        <td>${formatCurrency(ord.amount)}</td>
                        <td>${ord.buyer_name} (${ord.shipping_city})</td>
                        <td><span class="status-pill status-${ord.status}">${ord.status.toUpperCase()}</span></td>
                        <td>
                            <select class="form-select select-order-status" data-id="${ord.id}" style="padding:0.3rem 0.5rem; font-size:0.85rem; width:auto;">
                                <option value="confirmed" ${ord.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                                <option value="shipped" ${ord.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                                <option value="delivered" ${ord.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="cancelled" ${ord.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </td>
                    </tr>
                `).join('');

                salesContainer.querySelectorAll('.select-order-status').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        const ordId = sel.getAttribute('data-id');
                        const newStatus = sel.value;
                        try {
                            await api.put(`/orders/${ordId}/status`, { status: newStatus });
                            showToast(`Order status updated to ${newStatus.toUpperCase()}.`, 'success');
                            loadMyOrders();
                        } catch (e) {
                            showToast(e.message || 'Status update failed.', 'error');
                        }
                    });
                });
            }
        }

    } catch (e) {
        console.error('Failed to load orders', e);
    }
}

// Load Exchanges in Dashboard
async function loadMyExchanges() {
    const container = document.getElementById('dash-exchanges-container');
    if (!container) return;

    try {
        const [sentRes, recRes] = await Promise.all([
            api.get('/exchanges/sent'),
            api.get('/exchanges/received')
        ]);

        const sent = sentRes.exchanges || [];
        const received = recRes.exchanges || [];

        if (sent.length === 0 && received.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-sync-alt"></i></div>
                    <h3 class="empty-state-title">No Swap Proposals Yet</h3>
                    <p class="empty-state-desc">Explore clothing items listed by other circular fashion enthusiasts and trade without spending money.</p>
                    <a href="/exchange.html" class="btn btn-primary btn-sm">Explore Clothing Swaps</a>
                </div>
            `;
            return;
        }

        let html = '';

        if (received.length > 0) {
            html += `<h4 style="margin-bottom:1rem; color:var(--primary-dark);">Proposals Received (${received.length})</h4>`;
            html += received.map(req => `
                <div class="request-card" style="margin-bottom:1.2rem;">
                    <div class="request-header">
                        <div><strong>From:</strong> ${req.requester_name} • ${formatDate(req.created_at)}</div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                    <div class="swap-pair-container">
                        <div class="swap-item-box">
                            <img src="${req.requested_image || ''}" class="table-item-img" alt="Your item">
                            <div>
                                <span class="text-muted" style="font-size:0.75rem;">Your Item</span>
                                <div><a href="/product.html?id=${req.requested_item_id}"><strong>${req.requested_title}</strong></a></div>
                            </div>
                        </div>
                        <div class="swap-arrow"><i class="fas fa-exchange-alt"></i></div>
                        <div class="swap-item-box">
                            <img src="${req.offered_image || ''}" class="table-item-img" alt="Offered">
                            <div>
                                <span class="text-muted" style="font-size:0.75rem;">Their Offer</span>
                                <div><a href="/product.html?id=${req.offered_item_id}"><strong>${req.offered_title}</strong></a></div>
                            </div>
                        </div>
                    </div>
                    ${req.message ? `<div style="background:#faf9f6; padding:0.6rem; font-size:0.85rem; border-radius:var(--radius-sm);">"${req.message}"</div>` : ''}
                    <div class="request-actions">
                        ${req.status === 'pending' ? `
                            <button class="btn btn-outline btn-sm btn-dash-swap-action" data-id="${req.id}" data-action="rejected">Decline</button>
                            <button class="btn btn-primary btn-sm btn-dash-swap-action" data-id="${req.id}" data-action="accepted">Accept Swap</button>
                        ` : ''}
                        ${req.status === 'accepted' ? `
                            <button class="btn btn-primary btn-sm btn-dash-swap-action" data-id="${req.id}" data-action="completed" style="background:#047857;">Mark Completed</button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (sent.length > 0) {
            html += `<h4 style="margin:2rem 0 1rem; color:var(--primary-dark);">Proposals Sent (${sent.length})</h4>`;
            html += sent.map(req => `
                <div class="request-card" style="margin-bottom:1.2rem;">
                    <div class="request-header">
                        <div><strong>To:</strong> ${req.owner_name} • ${formatDate(req.created_at)}</div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                    <div class="swap-pair-container">
                        <div class="swap-item-box">
                            <img src="${req.offered_image || ''}" class="table-item-img" alt="Offered">
                            <div>
                                <span class="text-muted" style="font-size:0.75rem;">Your Offer</span>
                                <div><a href="/product.html?id=${req.offered_item_id}"><strong>${req.offered_title}</strong></a></div>
                            </div>
                        </div>
                        <div class="swap-arrow"><i class="fas fa-arrow-right"></i></div>
                        <div class="swap-item-box">
                            <img src="${req.requested_image || ''}" class="table-item-img" alt="Requested">
                            <div>
                                <span class="text-muted" style="font-size:0.75rem;">Requested</span>
                                <div><a href="/product.html?id=${req.requested_item_id}"><strong>${req.requested_title}</strong></a></div>
                            </div>
                        </div>
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = html;

        container.querySelectorAll('.btn-dash-swap-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                try {
                    await api.put(`/exchanges/${id}/status`, { status: action });
                    showToast(`Exchange proposal marked as ${action}.`, 'success');
                    loadMyExchanges();
                    loadDashboardProfile();
                } catch (e) {
                    showToast(e.message || 'Action failed.', 'error');
                }
            });
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading exchange requests.</p>';
    }
}

// Load Donations in Dashboard
async function loadMyDonations() {
    const container = document.getElementById('dash-donations-container');
    if (!container) return;

    try {
        const res = await api.get('/donations/requests');
        const sent = res.sent || [];
        const received = res.received || [];

        if (sent.length === 0 && received.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-hand-holding-heart"></i></div>
                    <h3 class="empty-state-title">No Donation Requests</h3>
                    <p class="empty-state-desc">Support community circularity by donating unused clothing or requesting available garments.</p>
                    <a href="/donate.html" class="btn btn-primary btn-sm">Browse Donations Hub</a>
                </div>
            `;
            return;
        }

        let html = '';
        if (received.length > 0) {
            html += `<h4 style="margin-bottom:1rem; color:var(--primary-dark);">Requests for Your Donated Clothes (${received.length})</h4>`;
            html += received.map(req => `
                <div class="request-card" style="margin-bottom:1rem;">
                    <div class="request-header">
                        <div><strong>Requester:</strong> ${req.requester_name} • ${formatDate(req.created_at)}</div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <img src="${req.item_image || ''}" class="table-item-img" alt="Item">
                        <div>
                            <div><a href="/product.html?id=${req.item_id}"><strong>${req.item_title}</strong></a></div>
                            <span class="text-muted" style="font-size:0.8rem;">Delivery mode: ${req.delivery_mode}</span>
                        </div>
                    </div>
                    <div style="background:#faf9f6; padding:0.6rem; font-size:0.85rem; border-radius:var(--radius-sm); margin-top:0.5rem;">
                        "${req.purpose_message}"
                    </div>
                    <div class="request-actions" style="margin-top:0.75rem;">
                        ${req.status === 'pending' ? `
                            <button class="btn btn-outline btn-sm btn-dash-don-action" data-id="${req.id}" data-action="rejected">Decline</button>
                            <button class="btn btn-primary btn-sm btn-dash-don-action" data-id="${req.id}" data-action="approved">Approve</button>
                        ` : ''}
                        ${req.status === 'approved' ? `
                            <button class="btn btn-primary btn-sm btn-dash-don-action" data-id="${req.id}" data-action="completed" style="background:#047857;">Mark Handover Done</button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        container.innerHTML = html;

        container.querySelectorAll('.btn-dash-don-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const action = btn.getAttribute('data-action');
                try {
                    await api.put(`/donations/${id}/status`, { status: action });
                    showToast(`Donation marked as ${action}.`, 'success');
                    loadMyDonations();
                    loadDashboardProfile();
                } catch (e) {
                    showToast(e.message || 'Action failed.', 'error');
                }
            });
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading donations.</p>';
    }
}

// Load Wishlist
async function loadMyWishlist() {
    const container = document.getElementById('dash-wishlist-container');
    if (!container) return;

    try {
        const res = await api.get('/wishlist');
        const items = res.wishlist || [];

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="far fa-heart"></i></div>
                    <h3 class="empty-state-title">Your Saved Wardrobe is Empty</h3>
                    <p class="empty-state-desc">Explore circular marketplace products and click the heart icon on any piece you love to save it here.</p>
                    <a href="/explore.html" class="btn btn-primary btn-sm">Explore Marketplace</a>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div class="products-grid">
                ${items.map(item => `
                    <article class="product-card">
                        <div class="card-img-wrapper">
                            <img src="${item.primary_image || ''}" alt="${item.title}">
                            <div class="card-badges">
                                <span class="badge badge-${item.listing_type}">${item.listing_type.toUpperCase()}</span>
                            </div>
                        </div>
                        <div class="card-body">
                            <div class="card-meta">
                                <span class="card-brand">${item.brand}</span>
                                <span class="card-size">Size: ${item.size}</span>
                            </div>
                            <h4 class="card-title"><a href="/product.html?id=${item.id}">${item.title}</a></h4>
                            <div class="card-footer">
                                <span class="card-price">${item.listing_type === 'sell' ? formatCurrency(item.price) : item.listing_type.toUpperCase()}</span>
                                <div style="display:flex; gap:0.4rem;">
                                    <a href="/product.html?id=${item.id}" class="btn btn-outline btn-sm">View</a>
                                    <button class="btn btn-danger btn-sm btn-del-wishlist" data-id="${item.id}" title="Remove"><i class="fas fa-trash-alt"></i></button>
                                </div>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        `;

        container.querySelectorAll('.btn-del-wishlist').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await api.delete(`/wishlist/${id}`);
                    showToast('Item removed from wishlist.', 'info');
                    loadMyWishlist();
                } catch (e) {
                    showToast(e.message || 'Failed to remove from wishlist.', 'error');
                }
            });
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading wishlist.</p>';
    }
}

// Load Notifications
async function loadMyNotifications() {
    const container = document.getElementById('dash-notifications-container');
    if (!container) return;

    try {
        const res = await api.get('/notifications');
        const list = res.notifications || [];

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="far fa-bell"></i></div>
                    <h3 class="empty-state-title">No Notifications</h3>
                    <p class="empty-state-desc">You're all caught up! Updates regarding your orders, exchanges, and community activities will appear here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = `
            <div style="display:flex; justify-content:flex-end; margin-bottom:1rem;">
                <button id="btn-mark-all-read" class="btn btn-outline btn-sm">Mark All as Read</button>
            </div>
            <div style="display:flex; flex-direction:column; gap:0.85rem;">
                ${list.map(notif => `
                    <div class="notif-item ${notif.is_read ? 'read' : 'unread'}" style="background:${notif.is_read ? '#ffffff' : '#f0fdf4'}; border:1px solid ${notif.is_read ? 'var(--border-color)' : '#bbf7d0'}; border-radius:var(--radius-md); padding:1rem; display:flex; justify-content:space-between; align-items:center;">
                        <div style="display:flex; gap:0.8rem; align-items:center;">
                            <div style="width:36px; height:36px; border-radius:50%; background:var(--secondary-light); color:var(--primary-color); display:flex; align-items:center; justify-content:center;">
                                <i class="fas fa-bell"></i>
                            </div>
                            <div>
                                <h4 style="font-size:1rem; margin-bottom:0.15rem;">${notif.title}</h4>
                                <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:0.25rem;">${notif.message}</p>
                                <span style="font-size:0.75rem; color:var(--text-light);">${formatDate(notif.created_at)}</span>
                            </div>
                        </div>
                        ${notif.link ? `<a href="${notif.link}" class="btn btn-outline btn-sm">View</a>` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        document.getElementById('btn-mark-all-read').addEventListener('click', async () => {
            try {
                await api.put('/notifications/read-all', {});
                showToast('All notifications marked as read.', 'success');
                loadMyNotifications();
                const badge = document.getElementById('nav-notif-badge');
                if (badge) badge.style.display = 'none';
            } catch (e) {
                showToast('Action failed.', 'error');
            }
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading notifications.</p>';
    }
}

// Update Profile Settings Form
function initSettingsForm() {
    const form = document.getElementById('account-settings-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');

        const name = document.getElementById('settings-name').value.trim();
        const phone = document.getElementById('settings-phone').value.trim();
        const location = document.getElementById('settings-location').value.trim();
        const bio = document.getElementById('settings-bio').value.trim();
        const avatar = document.getElementById('settings-avatar').value.trim();

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            const res = await api.put('/users/profile', {
                name,
                phone,
                location,
                bio,
                avatar
            });

            setUser(res.user);
            showToast('Account details updated successfully!', 'success');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Save Profile Changes';

            loadDashboardProfile();

        } catch (err) {
            showToast(err.message || 'Failed to update profile.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Save Profile Changes';
        }
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
