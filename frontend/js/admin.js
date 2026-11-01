// ReWear - Admin Portal Controller

document.addEventListener('DOMContentLoaded', () => {
    // Check Admin Privileges
    if (!isLoggedIn() || !isAdmin()) {
        showToast('Access denied. Administrator privileges required.', 'error');
        setTimeout(() => window.location.href = '/dashboard.html', 1000);
        return;
    }

    initAdminTabs();
    loadAdminStats();
});

// Admin Navigation Tabs
function initAdminTabs() {
    const tabs = document.querySelectorAll('.admin-nav-tab');
    const panes = document.querySelectorAll('.admin-tab-pane');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            const target = tab.getAttribute('data-target');
            panes.forEach(p => p.classList.toggle('active', p.id === target));

            if (target === 'pane-users') loadAllUsers();
            if (target === 'pane-listings') loadAllListings();
            if (target === 'pane-reports') loadAllReports();
        });
    });
}

// 1. Load Admin Statistics
async function loadAdminStats() {
    try {
        const res = await api.get('/admin/dashboard');
        const stats = res.stats || {};

        setText('stat-total-users', stats.totalUsers || 0);
        setText('stat-total-listings', stats.totalListings || 0);
        setText('stat-active-listings', stats.activeListings || 0);
        setText('stat-total-orders', stats.totalOrders || 0);
        setText('stat-gmv', formatCurrency(stats.totalGmv));
        setText('stat-exchanges', `${stats.completedExchanges || 0} / ${stats.totalExchanges || 0}`);
        setText('stat-donations', `${stats.completedDonations || 0} / ${stats.totalDonations || 0}`);
        setText('stat-pending-reports', stats.pendingReports || 0);

        // Recent Listings table
        const recentContainer = document.getElementById('admin-recent-listings-body');
        if (recentContainer && res.recentListings) {
            recentContainer.innerHTML = res.recentListings.map(item => `
                <tr>
                    <td><strong>#${item.id}</strong></td>
                    <td><a href="/product.html?id=${item.id}" target="_blank">${item.title}</a></td>
                    <td>${item.seller_name}</td>
                    <td><span class="badge badge-${item.listing_type}">${item.listing_type.toUpperCase()}</span></td>
                    <td>${item.listing_type === 'sell' ? formatCurrency(item.price) : '-'}</td>
                    <td><span class="status-pill status-${item.status}">${item.status.toUpperCase()}</span></td>
                </tr>
            `).join('');
        }

    } catch (e) {
        showToast('Failed to load administrative overview.', 'error');
    }
}

// 2. Load All Users
async function loadAllUsers() {
    const tbody = document.getElementById('admin-users-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>';

    try {
        const res = await api.get('/admin/users');
        const users = res.users || [];

        tbody.innerHTML = users.map(u => `
            <tr>
                <td><strong>#${u.id}</strong></td>
                <td>
                    <div style="font-weight:600;">${u.name}</div>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${u.email}</span>
                </td>
                <td>${u.location || 'United States'}</td>
                <td>${u.listing_count || 0} listings • ${u.order_count || 0} orders</td>
                <td>
                    <span class="user-role-badge ${u.role === 'admin' ? 'admin' : ''}">${u.role.toUpperCase()}</span>
                </td>
                <td>
                    <button class="btn btn-outline btn-sm btn-toggle-role" data-id="${u.id}" data-role="${u.role}">
                        ${u.role === 'admin' ? 'Demote to User' : 'Promote to Admin'}
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-toggle-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const userId = btn.getAttribute('data-id');
                try {
                    const toggleRes = await api.put(`/admin/users/${userId}/role`, {});
                    showToast(toggleRes.message || 'User role updated.', 'success');
                    loadAllUsers();
                    loadAdminStats();
                } catch (err) {
                    showToast(err.message || 'Failed to alter user privileges.', 'error');
                }
            });
        });

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Error retrieving user directory.</td></tr>';
    }
}

// 3. Load All Listings
async function loadAllListings() {
    const tbody = document.getElementById('admin-listings-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner"></div></td></tr>';

    try {
        const res = await api.get('/admin/listings');
        const listings = res.listings || [];

        tbody.innerHTML = listings.map(item => `
            <tr>
                <td><strong>#${item.id}</strong></td>
                <td>
                    <div style="display:flex; align-items:center;">
                        <span style="display:inline-flex; align-items:center; justify-content:center; width:32px; height:32px; background:var(--secondary-light); border-radius:var(--radius-sm); color:var(--primary-color); margin-right:0.75rem; flex-shrink:0;">
                            <i class="fas fa-tshirt"></i>
                        </span>
                        <div>
                            <div style="font-weight:600;"><a href="/product.html?id=${item.id}" target="_blank">${item.title}</a></div>
                            <span style="font-size:0.8rem; color:var(--text-muted);">${item.category_name} • Size ${item.size} • ${item.brand || 'Artisan'}</span>
                        </div>
                    </div>
                </td>
                <td>${item.seller_name}</td>
                <td><span class="badge badge-${item.listing_type}">${item.listing_type.toUpperCase()}</span></td>
                <td>${item.listing_type === 'sell' ? formatCurrency(item.price) : '-'}</td>
                <td><span class="status-pill status-${item.status}">${item.status.toUpperCase()}</span></td>
                <td>
                    <button class="btn btn-danger btn-sm btn-admin-del-listing" data-id="${item.id}" data-title="${encodeURIComponent(item.title)}">
                        <i class="fas fa-trash-alt"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-admin-del-listing').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                const title = decodeURIComponent(btn.getAttribute('data-title'));

                showConfirmModal({
                    title: 'Remove Inappropriate Listing?',
                    message: `Are you sure you want to delete "${title}" permanently? The seller will receive an administrative notice.`,
                    confirmText: 'Remove Listing',
                    onConfirm: async () => {
                        try {
                            await api.delete(`/admin/listings/${id}`);
                            showToast('Listing removed successfully.', 'success');
                            loadAllListings();
                            loadAdminStats();
                        } catch (err) {
                            showToast(err.message || 'Deletion failed.', 'error');
                        }
                    }
                });
            });
        });

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-muted text-center">Error retrieving listings.</td></tr>';
    }
}

// 4. Load Community Reports
async function loadAllReports() {
    const tbody = document.getElementById('admin-reports-table-body');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="text-center"><div class="spinner"></div></td></tr>';

    try {
        const res = await api.get('/admin/reports');
        const reports = res.reports || [];

        if (reports.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted">No pending community reports! Platform is clean. 🌿</td></tr>';
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr>
                <td><strong>#${r.id}</strong></td>
                <td><a href="/product.html?id=${r.item_id}" target="_blank"><strong>${r.item_title}</strong></a></td>
                <td><span style="font-weight:600; color:#b91c1c;">${r.reason}</span><br><small class="text-muted">${r.details || 'No additional note'}</small></td>
                <td>${r.reporter_name}</td>
                <td><span class="status-pill status-${r.status}">${r.status.toUpperCase()}</span></td>
                <td>
                    <div style="display:flex; gap:0.4rem;">
                        <button class="btn btn-outline btn-sm btn-report-dismiss" data-id="${r.id}" title="Dismiss">Dismiss</button>
                        <button class="btn btn-danger btn-sm btn-report-action" data-id="${r.id}" data-item="${r.item_id}" title="Take Action">Ban Item</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-report-dismiss').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                try {
                    await api.put(`/admin/reports/${id}/status`, { status: 'dismissed', adminNotes: 'Reviewed and dismissed' });
                    showToast('Report marked as dismissed.', 'info');
                    loadAllReports();
                    loadAdminStats();
                } catch (e) {
                    showToast('Action failed.', 'error');
                }
            });
        });

        tbody.querySelectorAll('.btn-report-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const reportId = btn.getAttribute('data-id');
                const itemId = btn.getAttribute('data-item');

                showConfirmModal({
                    title: 'Take Action on Report?',
                    message: 'This will delete the reported clothing listing and resolve this incident report.',
                    confirmText: 'Remove & Resolve',
                    onConfirm: async () => {
                        try {
                            await api.delete(`/admin/listings/${itemId}`);
                            await api.put(`/admin/reports/${reportId}/status`, { status: 'action_taken', adminNotes: 'Item removed by admin' });
                            showToast('Report resolved and item removed from platform.', 'success');
                            loadAllReports();
                            loadAdminStats();
                        } catch (e) {
                            showToast(e.message || 'Action failed.', 'error');
                        }
                    }
                });
            });
        });

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-muted text-center">Error retrieving reports.</td></tr>';
    }
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}
