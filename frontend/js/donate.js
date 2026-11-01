// ReWear - Clothing Donation Page Controller

let targetDonationItem = null;

document.addEventListener('DOMContentLoaded', () => {
    loadDonationItems();
    loadDonationMetrics();
    initDonationFilters();
    initDonationRequestModal();
    if (isLoggedIn()) {
        loadMyDonationRequests();
    } else {
        const myRequestsSec = document.getElementById('my-donation-requests-section');
        if (myRequestsSec) myRequestsSec.style.display = 'none';
    }
});

// Load Donated Clothes with Filters
async function loadDonationItems() {
    const grid = document.getElementById('donations-grid');
    if (!grid) return;

    grid.innerHTML = `
        <div class="loading-spinner" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;

    const search = document.getElementById('donate-search') ? document.getElementById('donate-search').value.trim() : '';
    const category = document.getElementById('donate-category') ? document.getElementById('donate-category').value : 'all';
    const size = document.getElementById('donate-size') ? document.getElementById('donate-size').value : 'all';
    const location = document.getElementById('donate-location') ? document.getElementById('donate-location').value.trim() : '';

    try {
        const params = {};
        if (search) params.search = search;
        if (category && category !== 'all') params.category = category;
        if (size && size !== 'all') params.size = size;
        if (location) params.location = location;

        const res = await api.get('/donations', params);
        const items = res.items || [];

        if (items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon"><i class="fas fa-hand-holding-heart"></i></div>
                    <h3 class="empty-state-title font-serif">No Donated Clothing Matches</h3>
                    <p class="empty-state-desc">All current donations in this filter have been claimed. Check back soon or list a donation of your own!</p>
                    <a href="/sell.html" class="btn btn-primary btn-sm">Donate Clothes Now</a>
                </div>
            `;
            return;
        }

        grid.innerHTML = items.map(item => `
            <article class="product-card">
                <div class="card-img-wrapper">
                    <img src="${item.primary_image}" alt="${item.title}" onerror="this.src='https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'">
                    <div class="card-badges">
                        <span class="badge badge-donate"><i class="fas fa-heart"></i> Donation</span>
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
                        <i class="fas fa-quote-left" style="color:var(--secondary-color);"></i>
                        ${item.donation_preferences || 'Free for anyone in need of clothing.'}
                    </p>
                    <div class="card-location">
                        <i class="fas fa-map-marker-alt"></i> ${item.location}
                    </div>
                    <div class="card-footer">
                        <span class="card-price free">100% Free</span>
                        <button class="btn btn-primary btn-sm btn-claim-donation" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}" data-donor="${item.user_id}">
                            Request Item
                        </button>
                    </div>
                </div>
            </article>
        `).join('');

        // Bind Request Buttons
        grid.querySelectorAll('.btn-claim-donation').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!isLoggedIn()) {
                    showToast('Please sign in to submit a donation request.', 'info');
                    setTimeout(() => window.location.href = '/login.html', 1000);
                    return;
                }

                const donorId = parseInt(btn.getAttribute('data-donor'), 10);
                const user = getUser();
                if (user.id === donorId) {
                    showToast('You cannot request your own donated clothing.', 'warning');
                    return;
                }

                const itemId = parseInt(btn.getAttribute('data-id'), 10);
                const title = decodeURIComponent(btn.getAttribute('data-title'));
                openDonationModal(itemId, title);
            });
        });

    } catch (e) {
        grid.innerHTML = '<p class="text-muted text-center" style="grid-column: 1 / -1;">Error loading donation listings.</p>';
    }
}

// Load Sustainability & Donation Metrics
async function loadDonationMetrics() {
    try {
        const res = await api.get('/sustainability/stats');
        if (res.success && res.metrics) {
            const m = res.metrics;
            setText('metric-donations-count', m.totalDonations || 0);
            setText('metric-reused-count', m.totalItemsReused || 0);
            setText('metric-weight-diverted', `${m.divertedWeightKg || 0} kg`);
            setText('metric-water-saved', `${(m.waterSavedLiters || 0).toLocaleString()} L`);
        }
    } catch (e) {
        console.error('Failed to load metrics:', e);
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// Init Filter Listeners
function initDonationFilters() {
    const searchInput = document.getElementById('donate-search');
    const catSelect = document.getElementById('donate-category');
    const sizeSelect = document.getElementById('donate-size');
    const locInput = document.getElementById('donate-location');

    if (searchInput) searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') loadDonationItems(); });
    if (catSelect) catSelect.addEventListener('change', loadDonationItems);
    if (sizeSelect) sizeSelect.addEventListener('change', loadDonationItems);
    if (locInput) locInput.addEventListener('change', loadDonationItems);
}

// Open Donation Request Modal
function openDonationModal(itemId, title) {
    targetDonationItem = itemId;
    const modal = document.getElementById('donation-request-modal');
    document.getElementById('modal-donation-title').textContent = title;
    modal.classList.add('active');
}

function initDonationRequestModal() {
    const modal = document.getElementById('donation-request-modal');
    if (!modal) return;

    const form = document.getElementById('donation-request-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const msg = document.getElementById('donation-req-purpose').value.trim();
        const mode = document.getElementById('donation-req-mode').value;

        if (!msg) {
            showToast('Please provide a message explaining your purpose.', 'warning');
            return;
        }

        try {
            await api.post('/donations', {
                itemId: targetDonationItem,
                purposeMessage: msg,
                deliveryMode: mode
            });

            modal.classList.remove('active');
            showToast('Donation request sent to the donor! ❤️', 'success');
            loadMyDonationRequests();
        } catch (err) {
            showToast(err.message || 'Failed to submit request.', 'error');
        }
    });
}

// Load User's Sent and Received Donation Requests
async function loadMyDonationRequests() {
    const container = document.getElementById('my-donation-requests-list');
    if (!container) return;

    try {
        const res = await api.get('/donations/requests');
        const sent = res.sent || [];
        const received = res.received || [];

        if (sent.length === 0 && received.length === 0) {
            container.innerHTML = '<p class="text-muted" style="text-align:center; padding:1.5rem;">No active donation requests at the moment.</p>';
            return;
        }

        let html = '';

        if (received.length > 0) {
            html += `<h4 style="margin:1rem 0 0.8rem; color:var(--primary-dark);">Requests for Your Donated Items</h4>`;
            html += received.map(req => `
                <div class="request-card">
                    <div class="request-header">
                        <div>
                            <strong>Requester:</strong> ${req.requester_name} (${req.requester_location || 'India'})
                            <span class="text-muted" style="margin-left:0.5rem;">• ${formatDate(req.created_at)}</span>
                        </div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <img src="${req.item_image || ''}" class="table-item-img" alt="Item">
                        <div>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.item_id}">${req.item_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.item_brand} • Size ${req.item_size} • Delivery: ${req.delivery_mode}</span>
                        </div>
                    </div>
                    <div style="background:#faf9f6; padding:0.75rem; border-radius:var(--radius-sm); font-size:0.9rem;">
                        <strong>Purpose:</strong> "${req.purpose_message}"
                    </div>
                    <div class="request-actions">
                        ${req.status === 'pending' ? `
                            <button class="btn btn-outline btn-sm btn-reject-don" data-id="${req.id}">Decline</button>
                            <button class="btn btn-primary btn-sm btn-approve-don" data-id="${req.id}"><i class="fas fa-check"></i> Approve Donation</button>
                        ` : ''}
                        ${req.status === 'approved' ? `
                            <button class="btn btn-primary btn-sm btn-complete-don" data-id="${req.id}" style="background:#047857;">
                                <i class="fas fa-check-double"></i> Mark Handover Completed
                            </button>
                        ` : ''}
                    </div>
                </div>
            `).join('');
        }

        if (sent.length > 0) {
            html += `<h4 style="margin:2rem 0 0.8rem; color:var(--primary-dark);">Your Requests for Donated Clothes</h4>`;
            html += sent.map(req => `
                <div class="request-card">
                    <div class="request-header">
                        <div><strong>Donor:</strong> ${req.donor_name} • ${formatDate(req.created_at)}</div>
                        <span class="status-pill status-${req.status}">${req.status.toUpperCase()}</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:1rem;">
                        <img src="${req.item_image || ''}" class="table-item-img" alt="Item">
                        <div>
                            <div style="font-weight:600;"><a href="/product.html?id=${req.item_id}">${req.item_title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${req.item_brand} • Size ${req.item_size}</span>
                        </div>
                    </div>
                    ${req.status === 'approved' ? `
                        <div style="background:#dcfce7; padding:0.75rem 1rem; border-radius:var(--radius-sm); font-size:0.88rem; color:#166534;">
                            <i class="fas fa-check-circle"></i> Approved by donor! Connect with ${req.donor_name} at ${req.donor_email} to arrange delivery/pickup.
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }

        container.innerHTML = html;

        // Actions
        container.querySelectorAll('.btn-approve-don').forEach(btn => {
            btn.addEventListener('click', () => updateDonationStatus(btn.getAttribute('data-id'), 'approved'));
        });
        container.querySelectorAll('.btn-reject-don').forEach(btn => {
            btn.addEventListener('click', () => updateDonationStatus(btn.getAttribute('data-id'), 'rejected'));
        });
        container.querySelectorAll('.btn-complete-don').forEach(btn => {
            btn.addEventListener('click', () => updateDonationStatus(btn.getAttribute('data-id'), 'completed'));
        });

    } catch (e) {
        container.innerHTML = '<p class="text-muted">Error loading donation requests.</p>';
    }
}

async function updateDonationStatus(reqId, newStatus) {
    try {
        await api.put(`/donations/${reqId}/status`, { status: newStatus });
        showToast(`Donation request ${newStatus}!`, 'success');
        loadMyDonationRequests();
        loadDonationMetrics();
    } catch (err) {
        showToast(err.message || 'Status update failed.', 'error');
    }
}
