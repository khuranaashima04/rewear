// ReWear - Clothing Exchange System Controller

let selectedTargetItem = null;

document.addEventListener('DOMContentLoaded', () => {
    initExchangeTabs();
    loadAvailableExchanges();
    if (isLoggedIn()) {
        loadReceivedExchanges();
        loadSentExchanges();
    } else {
        document.getElementById('my-exchanges-section').style.display = 'none';
    }
    initExchangeProposalModal();
});

// Tab Switcher (Browse / Received / Sent)
function initExchangeTabs() {
    const tabs = document.querySelectorAll('.exchange-nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const target = tab.getAttribute('data-target');
            document.querySelectorAll('.exchange-tab-view').forEach(v => v.classList.remove('active'));
            const targetEl = document.getElementById(target);
            if (targetEl) targetEl.classList.add('active');
        });
    });
}

// 1. Browse All Available Exchange Listings
async function loadAvailableExchanges() {
    const grid = document.getElementById('exchange-items-grid');
    if (!grid) return;

    try {
        const res = await api.get('/items', { type: 'exchange', limit: 12 });
        if (!res.items || res.items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon"><i class="fas fa-sync-alt"></i></div>
                    <h3 class="empty-state-title">No Swap Listings Currently</h3>
                    <p class="empty-state-desc">Be the first to list clothing for direct exchange without spending money!</p>
                    <a href="/sell.html" class="btn btn-primary btn-sm">List an Item for Swap</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = res.items.map(item => `
            <article class="product-card">
                <div class="card-img-wrapper">
                    <img src="${item.primary_image}" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'">
                    <div class="card-badges">
                        <span class="badge badge-exchange"><i class="fas fa-sync-alt"></i> Swap</span>
                        <span class="badge badge-condition">${item.condition_grade.replace('_', ' ')}</span>
                    </div>
                </div>
                <div class="card-body">
                    <div class="card-meta">
                        <span class="card-brand">${item.brand}</span>
                        <span class="card-size">Size: ${item.size}</span>
                    </div>
                    <h4 class="card-title"><a href="/product.html?id=${item.id}">${item.title}</a></h4>
                    <p class="text-muted" style="font-size:0.85rem; margin-bottom:0.75rem;">
                        <i class="fas fa-exchange-alt" style="color:var(--secondary-color);"></i> 
                        ${item.exchange_preferences ? item.exchange_preferences.slice(0, 75) + '...' : 'Open to offers'}
                    </p>
                    <div class="card-footer">
                        <span style="font-size:0.85rem; color:var(--text-muted);">
                            <i class="fas fa-user-circle"></i> ${item.seller_name}
                        </span>
                        <button class="btn btn-primary btn-sm btn-propose-swap" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" data-owner="${item.user_id}">
                            Propose Swap
                        </button>
                    </div>
                </div>
            </article>
        `).join('');

        // Bind Propose Swap Buttons
        grid.querySelectorAll('.btn-propose-swap').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!isLoggedIn()) {
                    showToast('Please sign in to propose an exchange.', 'info');
                    setTimeout(() => window.location.href = '/login.html', 1000);
                    return;
                }

                const itemId = parseInt(btn.getAttribute('data-id'), 10);
                const ownerId = parseInt(btn.getAttribute('data-owner'), 10);
                const title = decodeURIComponent(btn.getAttribute('data-title'));

                const user = getUser();
                if (user.id === ownerId) {
                    showToast('You cannot exchange your own item!', 'warning');
                    return;
                }

                openSwapProposalModal(itemId, title);
            });
        });

    } catch (e) {
        grid.innerHTML = '<p class="text-muted text-center" style="grid-column: 1 / -1;">Error loading exchange listings.</p>';
    }
}

// 2. Load Received Exchange Proposals
async function loadReceivedExchanges() {
    const container = document.getElementById('received-exchanges-list');
    const badge = document.getElementById('received-exchanges-badge');
    if (!container) return;

    try {
        const res = await api.get('/exchanges/received');
        const list = res.exchanges || [];

        const pendingCount = list.filter(e => e.status === 'pending').length;
        if (badge) {
            badge.textContent = pendingCount;
            badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
        }

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-inbox"></i></div>
                    <h4 class="empty-state-title">No Swap Proposals Received Yet</h4>
                    <p class="empty-state-desc">When other members want to trade with your listed clothes, their proposals will appear here.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(req => `
            <div class="request-card">
                <div class="request-header">
                    <div>
                        <strong>From:</strong> ${req.requester_name} (${req.requester_location || 'India'})
                        <span class="text-muted" style="margin-left:0.5rem;">• ${formatDate(req.created_at)}</span>
                    </div>
                    <div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                </div>

                <div class="swap-pair-container">
                    <div class="swap-item-box">
                        <img src="${req.requested_image || ''}" class="table-item-img" alt="Your item">
                        <div>
                            <span class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Your Item</span>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.requested_item_id}">${req.requested_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.requested_brand} • Size ${req.requested_size}</span>
                        </div>
                    </div>

                    <div class="swap-arrow"><i class="fas fa-exchange-alt"></i></div>

                    <div class="swap-item-box">
                        <img src="${req.offered_image || ''}" class="table-item-img" alt="Offered item">
                        <div>
                            <span class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Their Offer</span>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.offered_item_id}">${req.offered_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.offered_brand} • Size ${req.offered_size}</span>
                        </div>
                    </div>
                </div>

                ${req.message ? `<div style="background:#faf9f6; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.9rem;"><strong>Message:</strong> "${req.message}"</div>` : ''}

                <div class="request-actions">
                    ${req.status === 'pending' ? `
                        <button class="btn btn-outline btn-sm btn-reject-exchange" data-id="${req.id}">Decline</button>
                        <button class="btn btn-primary btn-sm btn-accept-exchange" data-id="${req.id}"><i class="fas fa-check"></i> Accept Swap</button>
                    ` : ''}
                    ${req.status === 'accepted' ? `
                        <button class="btn btn-primary btn-sm btn-complete-exchange" data-id="${req.id}" style="background:#047857;">
                            <i class="fas fa-check-double"></i> Mark Swap Completed
                        </button>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Bind Actions
        container.querySelectorAll('.btn-accept-exchange').forEach(btn => {
            btn.addEventListener('click', () => updateExchangeStatus(btn.getAttribute('data-id'), 'accepted'));
        });
        container.querySelectorAll('.btn-reject-exchange').forEach(btn => {
            btn.addEventListener('click', () => updateExchangeStatus(btn.getAttribute('data-id'), 'rejected'));
        });
        container.querySelectorAll('.btn-complete-exchange').forEach(btn => {
            btn.addEventListener('click', () => updateExchangeStatus(btn.getAttribute('data-id'), 'completed'));
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading received exchanges.</p>';
    }
}

// 3. Load Sent Exchange Proposals
async function loadSentExchanges() {
    const container = document.getElementById('sent-exchanges-list');
    if (!container) return;

    try {
        const res = await api.get('/exchanges/sent');
        const list = res.exchanges || [];

        if (list.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon"><i class="fas fa-paper-plane"></i></div>
                    <h4 class="empty-state-title">No Sent Swap Proposals</h4>
                    <p class="empty-state-desc">Browse through available clothing items above and propose an exchange from your wardrobe.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = list.map(req => `
            <div class="request-card">
                <div class="request-header">
                    <div>
                        <strong>To:</strong> ${req.owner_name} (${req.owner_location || 'India'})
                        <span class="text-muted" style="margin-left:0.5rem;">• ${formatDate(req.created_at)}</span>
                    </div>
                    <div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                </div>

                <div class="swap-pair-container">
                    <div class="swap-item-box">
                        <img src="${req.offered_image || ''}" class="table-item-img" alt="Offered">
                        <div>
                            <span class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Your Item Offered</span>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.offered_item_id}">${req.offered_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.offered_brand} • Size ${req.offered_size}</span>
                        </div>
                    </div>

                    <div class="swap-arrow"><i class="fas fa-arrow-right"></i></div>

                    <div class="swap-item-box">
                        <img src="${req.requested_image || ''}" class="table-item-img" alt="Requested">
                        <div>
                            <span class="text-muted" style="font-size:0.75rem; text-transform:uppercase;">Requested Item</span>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.requested_item_id}">${req.requested_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.requested_brand} • Size ${req.requested_size}</span>
                        </div>
                    </div>
                </div>

                ${req.status === 'accepted' ? `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#dcfce7; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.88rem; color:#166534;">
                        <span><i class="fas fa-check-circle"></i> Owner accepted! Coordinate exchange with ${req.owner_name} (${req.owner_email}).</span>
                        <button class="btn btn-sm btn-primary btn-complete-exchange" data-id="${req.id}" style="background:#15803d;">Mark Completed</button>
                    </div>
                ` : ''}
            </div>
        `).join('');

        container.querySelectorAll('.btn-complete-exchange').forEach(btn => {
            btn.addEventListener('click', () => updateExchangeStatus(btn.getAttribute('data-id'), 'completed'));
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading sent exchanges.</p>';
    }
}

// Update Status Action Helper
async function updateExchangeStatus(exchangeId, newStatus) {
    try {
        await api.put(`/exchanges/${exchangeId}/status`, { status: newStatus });
        showToast(`Exchange marked as ${newStatus}!`, 'success');
        loadReceivedExchanges();
        loadSentExchanges();
    } catch (err) {
        showToast(err.message || 'Status update failed.', 'error');
    }
}

// Open Proposal Modal from Exchange Browse View
async function openSwapProposalModal(itemId, title) {
    selectedTargetItem = itemId;
    const modal = document.getElementById('exchange-proposal-modal');
    document.getElementById('modal-target-item-title').textContent = title;

    const selectEl = document.getElementById('modal-offered-item-select');
    selectEl.innerHTML = '<option value="">Loading your wardrobe items...</option>';

    modal.classList.add('active');

    try {
        const res = await api.get('/items/my-listings');
        const activeItems = (res.items || []).filter(i => i.status === 'active' && i.id !== itemId);

        if (activeItems.length === 0) {
            selectEl.innerHTML = '<option value="">No active listings found in your wardrobe.</option>';
            document.getElementById('modal-no-items-warning').style.display = 'block';
        } else {
            document.getElementById('modal-no-items-warning').style.display = 'none';
            selectEl.innerHTML = '<option value="">-- Select an item to offer in return --</option>' + 
                activeItems.map(i => `<option value="${i.id}">${i.title} (${i.brand} - ${i.size})</option>`).join('');
        }
    } catch (e) {
        selectEl.innerHTML = '<option value="">Error loading items.</option>';
    }
}

function initExchangeProposalModal() {
    const modal = document.getElementById('exchange-proposal-modal');
    if (!modal) return;

    const form = document.getElementById('exchange-proposal-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const offeredId = document.getElementById('modal-offered-item-select').value;
        const note = document.getElementById('modal-proposal-note').value;

        if (!offeredId) {
            showToast('Please select an item from your wardrobe to swap.', 'warning');
            return;
        }

        try {
            await api.post('/exchanges', {
                requestedItemId: selectedTargetItem,
                offeredItemId: parseInt(offeredId, 10),
                message: note
            });

            modal.classList.remove('active');
            showToast('Swap proposal submitted! Check "Sent Proposals" to follow up.', 'success');
            loadSentExchanges();
        } catch (err) {
            showToast(err.message || 'Failed to submit proposal.', 'error');
        }
    });
}
