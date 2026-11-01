// ReWear - Product Detail Page Controller

let currentProduct = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const itemId = urlParams.get('id');

    if (!itemId) {
        showToast('No item specified.', 'error');
        setTimeout(() => window.location.href = '/explore.html', 1000);
        return;
    }

    loadProductDetails(itemId);
    initModals();
});

// Load Product by ID
async function loadProductDetails(id) {
    const container = document.getElementById('product-details-container');
    if (!container) return;

    try {
        const res = await api.get(`/items/${id}`);
        if (!res.success || !res.item) {
            throw new Error(res.message || 'Clothing item not found.');
        }

        currentProduct = res.item;
        renderProductView(currentProduct);
        loadRelatedItems(currentProduct.category_id, currentProduct.id);

    } catch (err) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon" style="color:var(--status-donate);"><i class="fas fa-exclamation-circle"></i></div>
                <h2 class="empty-state-title">Item Unavailable</h2>
                <p class="empty-state-desc">${err.message || 'This listing may have been removed or sold.'}</p>
                <a href="/explore.html" class="btn btn-primary">Back to Marketplace</a>
            </div>
        `;
    }
}

// Render Product Page Details
function renderProductView(item) {
    document.title = `${item.title} — ReWear Marketplace`;

    const user = getUser();
    const isOwner = user && user.id === item.seller_id;

    // Gallery Images
    const mainImg = document.getElementById('product-main-img');
    const thumbContainer = document.getElementById('product-thumbnails');

    if (mainImg) {
        mainImg.src = item.images && item.images.length > 0 ? item.images[0].image_url : (item.primary_image || '');
    }

    if (thumbContainer && item.images && item.images.length > 1) {
        thumbContainer.innerHTML = item.images.map((img, idx) => `
            <img src="${img.image_url}" class="thumb-img ${idx === 0 ? 'active' : ''}" data-src="${img.image_url}" alt="Thumbnail">
        `).join('');

        thumbContainer.querySelectorAll('.thumb-img').forEach(thumb => {
            thumb.addEventListener('click', () => {
                thumbContainer.querySelectorAll('.thumb-img').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
                if (mainImg) mainImg.src = thumb.getAttribute('data-src');
            });
        });
    }

    // Basic Meta Details
    setText('product-title', item.title);
    setText('product-brand', item.brand || 'Vintage / Artisan');
    setText('product-category', item.category_name || 'Fashion');
    setText('product-size', item.size);
    setText('product-gender', item.gender.toUpperCase());
    setText('product-location', item.location || 'India');
    setText('product-views', `${item.views_count || 1} views`);
    setText('product-desc', item.description);

    // Condition Formatting
    const conditionMap = {
        brand_new: 'Brand New (With Tags)',
        like_new: 'Like New (Worn 1-2 times)',
        gently_used: 'Gently Used (Great condition)',
        well_worn: 'Pre-Loved (Character wear)'
    };
    setText('product-condition', conditionMap[item.condition_grade] || item.condition_grade);

    // Listing Type Badge & Price
    const typeBadge = document.getElementById('product-type-badge');
    const priceEl = document.getElementById('product-price');

    if (item.listing_type === 'sell') {
        if (typeBadge) {
            typeBadge.className = 'badge badge-sell';
            typeBadge.textContent = 'For Sale';
        }
        if (priceEl) priceEl.innerHTML = formatCurrency(item.price);
    } else if (item.listing_type === 'exchange') {
        if (typeBadge) {
            typeBadge.className = 'badge badge-exchange';
            typeBadge.textContent = 'Exchange Available';
        }
        if (priceEl) priceEl.innerHTML = '<span style="color:#a45a16; font-size:1.6rem;"><i class="fas fa-sync-alt"></i> Available for Swap</span>';
    } else if (item.listing_type === 'donate') {
        if (typeBadge) {
            typeBadge.className = 'badge badge-donate';
            typeBadge.textContent = 'Donation';
        }
        if (priceEl) priceEl.innerHTML = '<span style="color:var(--status-donate); font-size:1.6rem;"><i class="fas fa-heart"></i> Free Clothing Donation</span>';
    }

    // Preferences Box (For exchange or donation)
    const preferencesBox = document.getElementById('product-preferences-box');
    if (preferencesBox) {
        if (item.listing_type === 'exchange' && item.exchange_preferences) {
            preferencesBox.style.display = 'block';
            preferencesBox.innerHTML = `
                <div class="pref-card exchange-pref">
                    <h4><i class="fas fa-exchange-alt"></i> Owner's Swap Wishlist</h4>
                    <p>${item.exchange_preferences}</p>
                </div>
            `;
        } else if (item.listing_type === 'donate' && item.donation_preferences) {
            preferencesBox.style.display = 'block';
            preferencesBox.innerHTML = `
                <div class="pref-card donation-pref">
                    <h4><i class="fas fa-hand-holding-heart"></i> Donor's Notes & Preferences</h4>
                    <p>${item.donation_preferences}</p>
                </div>
            `;
        } else {
            preferencesBox.style.display = 'none';
        }
    }

    // Seller Box
    setText('seller-name', item.seller_name);
    setText('seller-location', item.seller_location || 'India');
    setText('seller-listings-count', `${item.seller_active_items || 1} active listings`);
    const sellerAvatar = document.getElementById('seller-avatar');
    if (sellerAvatar) {
        sellerAvatar.src = item.seller_avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
    }

    // Dynamic CTA Buttons
    renderActionButtons(item, isOwner);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '';
}

// Render Appropriate Buttons for Sell, Exchange, Donate or Owner
function renderActionButtons(item, isOwner) {
    const actionsContainer = document.getElementById('product-actions-container');
    if (!actionsContainer) return;

    if (isOwner) {
        actionsContainer.innerHTML = `
            <div style="background:var(--bg-color); border:1px solid var(--secondary-color); border-radius:var(--radius-md); padding:1.25rem;">
                <p style="font-weight:600; color:var(--primary-dark); margin-bottom:0.75rem;">
                    <i class="fas fa-info-circle"></i> This is your clothing listing.
                </p>
                <div style="display:flex; gap:0.75rem; flex-wrap:wrap;">
                    <a href="/dashboard.html?tab=listings" class="btn btn-outline btn-sm">Manage in Dashboard</a>
                    <button id="btn-delete-own-item" class="btn btn-danger btn-sm">Delete Listing</button>
                </div>
            </div>
        `;

        document.getElementById('btn-delete-own-item').addEventListener('click', () => {
            showConfirmModal({
                title: 'Delete this listing?',
                message: `Are you sure you want to delete "${item.title}"? This cannot be undone.`,
                confirmText: 'Delete Now',
                onConfirm: async () => {
                    try {
                        await api.delete(`/items/${item.id}`);
                        showToast('Listing successfully deleted.', 'success');
                        setTimeout(() => window.location.href = '/dashboard.html', 1000);
                    } catch (e) {
                        showToast(e.message || 'Failed to delete listing.', 'error');
                    }
                }
            });
        });
        return;
    }

    if (item.status !== 'active') {
        actionsContainer.innerHTML = `
            <div style="background:#fee2e2; border-radius:var(--radius-md); padding:1rem; text-align:center; color:#991b1b; font-weight:600;">
                <i class="fas fa-lock"></i> This item is currently marked as ${item.status.toUpperCase()} and is no longer available.
            </div>
        `;
        return;
    }

    let buttonsHtml = '';

    if (item.listing_type === 'sell') {
        buttonsHtml = `
            <button id="btn-buy-now" class="btn btn-primary btn-lg" style="flex:2;">
                <i class="fas fa-shopping-bag"></i> Buy Now for ${formatCurrency(item.price)}
            </button>
            <button id="btn-wishlist-action" class="btn btn-outline ${item.is_wishlisted ? 'active' : ''}" style="flex:1;">
                <i class="${item.is_wishlisted ? 'fas' : 'far'} fa-heart"></i> ${item.is_wishlisted ? 'Saved' : 'Wishlist'}
            </button>
        `;
    } else if (item.listing_type === 'exchange') {
        buttonsHtml = `
            <button id="btn-request-exchange" class="btn btn-primary btn-lg" style="flex:2; background:#b46c24; border-color:#b46c24;">
                <i class="fas fa-sync-alt"></i> Propose Clothing Swap
            </button>
            <button id="btn-wishlist-action" class="btn btn-outline" style="flex:1;">
                <i class="${item.is_wishlisted ? 'fas' : 'far'} fa-heart"></i> Wishlist
            </button>
        `;
    } else if (item.listing_type === 'donate') {
        buttonsHtml = `
            <button id="btn-request-donation" class="btn btn-primary btn-lg" style="flex:2; background:var(--status-donate); border-color:var(--status-donate);">
                <i class="fas fa-hand-holding-heart"></i> Request Free Donation
            </button>
            <button id="btn-wishlist-action" class="btn btn-outline" style="flex:1;">
                <i class="${item.is_wishlisted ? 'fas' : 'far'} fa-heart"></i> Wishlist
            </button>
        `;
    }

    actionsContainer.innerHTML = buttonsHtml;

    // Attach listeners
    const buyBtn = document.getElementById('btn-buy-now');
    if (buyBtn) buyBtn.addEventListener('click', openBuyModal);

    const exchangeBtn = document.getElementById('btn-request-exchange');
    if (exchangeBtn) exchangeBtn.addEventListener('click', openExchangeModal);

    const donateBtn = document.getElementById('btn-request-donation');
    if (donateBtn) donateBtn.addEventListener('click', openDonationModal);

    const wishBtn = document.getElementById('btn-wishlist-action');
    if (wishBtn) {
        wishBtn.addEventListener('click', async () => {
            if (!isLoggedIn()) {
                showToast('Please sign in to save items to your wishlist.', 'info');
                setTimeout(() => window.location.href = '/login.html', 1000);
                return;
            }
            try {
                if (item.is_wishlisted) {
                    await api.delete(`/wishlist/${item.id}`);
                    item.is_wishlisted = false;
                    wishBtn.innerHTML = '<i class="far fa-heart"></i> Wishlist';
                    showToast('Removed from wishlist.', 'info');
                } else {
                    await api.post('/wishlist', { itemId: item.id });
                    item.is_wishlisted = true;
                    wishBtn.innerHTML = '<i class="fas fa-heart" style="color:#e11d48"></i> Saved';
                    showToast('Added to your wishlist! 🌿', 'success');
                }
            } catch (e) {
                showToast(e.message || 'Error updating wishlist.', 'error');
            }
        });
    }
}

// Modal Inits & Handlers
function initModals() {
    // Close modal triggers
    document.querySelectorAll('.modal-overlay .modal-close, .modal-overlay [data-close]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const overlay = e.target.closest('.modal-overlay');
            if (overlay) overlay.classList.remove('active');
        });
    });

    // Report Listing Trigger
    const reportLink = document.getElementById('btn-report-listing');
    if (reportLink) {
        reportLink.addEventListener('click', (e) => {
            e.preventDefault();
            if (!isLoggedIn()) {
                showToast('Please log in to report listings.', 'info');
                return;
            }
            document.getElementById('report-modal').classList.add('active');
        });
    }

    // Report Form Submit
    const reportForm = document.getElementById('report-form');
    if (reportForm) {
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reason = document.getElementById('report-reason').value;
            const details = document.getElementById('report-details').value;

            try {
                await api.post('/admin/reports', {
                    itemId: currentProduct.id,
                    reason,
                    details
                });
                document.getElementById('report-modal').classList.remove('active');
                showToast('Thank you. Your report has been submitted to moderators.', 'success');
            } catch (err) {
                showToast(err.message || 'Could not submit report.', 'error');
            }
        });
    }
}

// Checkout (Buy Now) Modal
function openBuyModal() {
    if (!isLoggedIn()) {
        showToast('Please log in or register to complete your purchase.', 'info');
        setTimeout(() => window.location.href = '/login.html', 1200);
        return;
    }

    const modal = document.getElementById('buy-modal');
    setText('buy-modal-item-title', currentProduct.title);
    setText('buy-modal-item-price', formatCurrency(currentProduct.price));

    const form = document.getElementById('checkout-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const address = document.getElementById('shipping-address').value.trim();
        const city = document.getElementById('shipping-city').value.trim();
        const zip = document.getElementById('shipping-zip').value.trim();
        const paymentMethod = document.getElementById('payment-method').value;

        const submitBtn = form.querySelector('button[type="submit"]');

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing Order...';

            const res = await api.post('/orders', {
                itemId: currentProduct.id,
                shippingAddress: address,
                shippingCity: city,
                shippingPostalCode: zip,
                paymentMethod
            });

            modal.classList.remove('active');
            showToast(`Order #${res.orderNumber} placed successfully! 🌿`, 'success', 5000);

            setTimeout(() => {
                window.location.href = '/dashboard.html?tab=orders';
            }, 1000);

        } catch (err) {
            showToast(err.message || 'Order failed to process.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Complete Purchase';
        }
    };

    modal.classList.add('active');
}

// Propose Exchange Modal
async function openExchangeModal() {
    if (!isLoggedIn()) {
        showToast('Please log in to propose a clothing exchange.', 'info');
        setTimeout(() => window.location.href = '/login.html', 1200);
        return;
    }

    const modal = document.getElementById('exchange-modal');
    setText('exchange-modal-target-title', currentProduct.title);

    const selectEl = document.getElementById('exchange-offered-item-select');
    selectEl.innerHTML = '<option value="">Loading your available wardrobe items...</option>';

    modal.classList.add('active');

    try {
        const myItemsRes = await api.get('/items/my-listings');
        const activeItems = (myItemsRes.items || []).filter(i => i.status === 'active' && i.id !== currentProduct.id);

        if (activeItems.length === 0) {
            selectEl.innerHTML = '<option value="">You have no active listings. Please list an item first.</option>';
            document.getElementById('exchange-no-items-warning').style.display = 'block';
        } else {
            document.getElementById('exchange-no-items-warning').style.display = 'none';
            selectEl.innerHTML = '<option value="">-- Choose an item to offer --</option>' + 
                activeItems.map(i => `<option value="${i.id}">${i.title} (${i.brand} - Size ${i.size})</option>`).join('');
        }
    } catch (e) {
        selectEl.innerHTML = '<option value="">Could not load your listings.</option>';
    }

    const form = document.getElementById('exchange-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const offeredItemId = selectEl.value;
        const message = document.getElementById('exchange-note').value;

        if (!offeredItemId) {
            showToast('Please select one of your clothing items to offer.', 'warning');
            return;
        }

        try {
            await api.post('/exchanges', {
                requestedItemId: currentProduct.id,
                offeredItemId: parseInt(offeredItemId, 10),
                message
            });

            modal.classList.remove('active');
            showToast('Exchange proposal sent to the owner! 🔄', 'success');
            setTimeout(() => window.location.href = '/dashboard.html?tab=exchanges', 1000);
        } catch (err) {
            showToast(err.message || 'Could not send exchange request.', 'error');
        }
    };
}

// Request Donation Modal
function openDonationModal() {
    if (!isLoggedIn()) {
        showToast('Please sign in to request donated clothing.', 'info');
        setTimeout(() => window.location.href = '/login.html', 1200);
        return;
    }

    const modal = document.getElementById('donation-modal');
    setText('donation-modal-title', currentProduct.title);

    const form = document.getElementById('donation-form');
    form.onsubmit = async (e) => {
        e.preventDefault();
        const message = document.getElementById('donation-purpose-message').value.trim();
        const deliveryMode = document.getElementById('donation-delivery-mode').value;

        if (!message) {
            showToast('Please explain why you are requesting this donation.', 'warning');
            return;
        }

        try {
            await api.post('/donations', {
                itemId: currentProduct.id,
                purposeMessage: message,
                deliveryMode
            });

            modal.classList.remove('active');
            showToast('Donation request sent to the donor! ❤️', 'success');
            setTimeout(() => window.location.href = '/dashboard.html?tab=donations', 1000);
        } catch (err) {
            showToast(err.message || 'Could not submit donation request.', 'error');
        }
    };

    modal.classList.add('active');
}

// Load Related Items
async function loadRelatedItems(categoryId, currentId) {
    const container = document.getElementById('related-products-grid');
    if (!container) return;

    try {
        const res = await api.get('/items', { category: categoryId, limit: 4 });
        const related = (res.items || []).filter(i => i.id !== currentId).slice(0, 3);

        if (related.length === 0) {
            document.getElementById('related-section').style.display = 'none';
            return;
        }

        container.innerHTML = related.map(item => `
            <article class="product-card">
                <div class="card-img-wrapper">
                    <img src="${item.primary_image}" alt="${item.title}">
                </div>
                <div class="card-body">
                    <div class="card-meta">
                        <span class="card-brand">${item.brand}</span>
                        <span class="card-size">Size: ${item.size}</span>
                    </div>
                    <h4 class="card-title"><a href="/product.html?id=${item.id}">${item.title}</a></h4>
                    <div class="card-footer">
                        <span class="card-price">${item.listing_type === 'sell' ? formatCurrency(item.price) : item.listing_type.toUpperCase()}</span>
                        <a href="/product.html?id=${item.id}" class="btn btn-outline btn-sm">View</a>
                    </div>
                </div>
            </article>
        `).join('');
    } catch (e) {
        // Silently skip related
    }
}
