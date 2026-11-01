// ReWear - Explore Marketplace Logic

let currentFilters = {
    search: '',
    category: 'all',
    gender: 'all',
    size: 'all',
    condition: 'all',
    type: 'all',
    minPrice: '',
    maxPrice: '',
    location: '',
    sort: 'latest',
    page: 1,
    limit: 12
};

document.addEventListener('DOMContentLoaded', () => {
    // Read initial query params from URL
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('category')) currentFilters.category = urlParams.get('category');
    if (urlParams.get('type')) currentFilters.type = urlParams.get('type');
    if (urlParams.get('gender')) currentFilters.gender = urlParams.get('gender');
    if (urlParams.get('search')) currentFilters.search = urlParams.get('search');
    if (urlParams.get('page')) currentFilters.page = parseInt(urlParams.get('page'), 10) || 1;

    initFilterControls();
    loadCategories();
    fetchItems();
});

// Initialize Filter Inputs and Event Listeners
function initFilterControls() {
    // Search input
    const searchInput = document.getElementById('marketplace-search');
    const searchBtn = document.getElementById('marketplace-search-btn');
    if (searchInput) {
        searchInput.value = currentFilters.search;
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                currentFilters.search = searchInput.value.trim();
                currentFilters.page = 1;
                fetchItems();
            }
        });
    }
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => {
            currentFilters.search = searchInput.value.trim();
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Sort Dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
        sortSelect.value = currentFilters.sort;
        sortSelect.addEventListener('change', () => {
            currentFilters.sort = sortSelect.value;
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Listing Type Pills
    const typePills = document.querySelectorAll('.type-filter-pill');
    typePills.forEach(pill => {
        const typeVal = pill.getAttribute('data-type');
        if (typeVal === currentFilters.type) pill.classList.add('active');
        pill.addEventListener('click', () => {
            typePills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilters.type = typeVal;
            currentFilters.page = 1;
            fetchItems();
        });
    });

    // Gender Filter
    const genderSelect = document.getElementById('filter-gender');
    if (genderSelect) {
        if (currentFilters.gender) genderSelect.value = currentFilters.gender;
        genderSelect.addEventListener('change', () => {
            currentFilters.gender = genderSelect.value;
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Size Filter
    const sizeSelect = document.getElementById('filter-size');
    if (sizeSelect) {
        sizeSelect.addEventListener('change', () => {
            currentFilters.size = sizeSelect.value;
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Condition Filter
    const conditionSelect = document.getElementById('filter-condition');
    if (conditionSelect) {
        conditionSelect.addEventListener('change', () => {
            currentFilters.condition = conditionSelect.value;
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Price Filter Apply
    const priceApplyBtn = document.getElementById('btn-apply-price');
    if (priceApplyBtn) {
        priceApplyBtn.addEventListener('click', () => {
            const min = document.getElementById('filter-min-price').value;
            const max = document.getElementById('filter-max-price').value;
            currentFilters.minPrice = min ? parseFloat(min) : '';
            currentFilters.maxPrice = max ? parseFloat(max) : '';
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Location Filter
    const locationInput = document.getElementById('filter-location');
    if (locationInput) {
        locationInput.addEventListener('change', () => {
            currentFilters.location = locationInput.value.trim();
            currentFilters.page = 1;
            fetchItems();
        });
    }

    // Reset Filters Button
    const resetBtn = document.getElementById('btn-reset-filters');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            currentFilters = {
                search: '',
                category: 'all',
                gender: 'all',
                size: 'all',
                condition: 'all',
                type: 'all',
                minPrice: '',
                maxPrice: '',
                location: '',
                sort: 'latest',
                page: 1,
                limit: 12
            };
            if (searchInput) searchInput.value = '';
            if (genderSelect) genderSelect.value = 'all';
            if (sizeSelect) sizeSelect.value = 'all';
            if (conditionSelect) conditionSelect.value = 'all';
            if (locationInput) locationInput.value = '';
            const minEl = document.getElementById('filter-min-price');
            const maxEl = document.getElementById('filter-max-price');
            if (minEl) minEl.value = '';
            if (maxEl) maxEl.value = '';
            typePills.forEach(p => p.classList.remove('active'));
            const defaultPill = document.querySelector('.type-filter-pill[data-type="all"]');
            if (defaultPill) defaultPill.classList.add('active');
            highlightActiveCategory('all');
            fetchItems();
        });
    }
}

// Load Categories dynamically into Filter Sidebar
async function loadCategories() {
    const categoryContainer = document.getElementById('category-filter-list');
    if (!categoryContainer) return;

    try {
        const res = await api.get('/items/categories');
        if (res.success && res.categories) {
            categoryContainer.innerHTML = `
                <li class="category-filter-item ${currentFilters.category === 'all' ? 'active' : ''}" data-slug="all">
                    <span>All Collections</span>
                </li>
            `;

            res.categories.forEach(cat => {
                const li = document.createElement('li');
                li.className = `category-filter-item ${currentFilters.category === cat.slug ? 'active' : ''}`;
                li.setAttribute('data-slug', cat.slug);
                li.innerHTML = `
                    <span>${cat.name}</span>
                    <span class="cat-pill-count">${cat.item_count || 0}</span>
                `;
                categoryContainer.appendChild(li);
            });

            // Bind click events
            categoryContainer.querySelectorAll('.category-filter-item').forEach(item => {
                item.addEventListener('click', () => {
                    const slug = item.getAttribute('data-slug');
                    currentFilters.category = slug;
                    currentFilters.page = 1;
                    highlightActiveCategory(slug);
                    fetchItems();
                });
            });
        }
    } catch (err) {
        console.error('Error loading categories:', err);
    }
}

function highlightActiveCategory(slug) {
    document.querySelectorAll('.category-filter-item').forEach(el => {
        el.classList.toggle('active', el.getAttribute('data-slug') === slug);
    });
}

// Fetch Items from Backend REST API
async function fetchItems() {
    const grid = document.getElementById('products-grid');
    const countLabel = document.getElementById('results-count');
    const paginationContainer = document.getElementById('pagination-container');

    if (!grid) return;

    // Show Loader
    grid.innerHTML = `
        <div class="loading-spinner" style="grid-column: 1 / -1;">
            <div class="spinner"></div>
        </div>
    `;

    try {
        const params = {
            page: currentFilters.page,
            limit: currentFilters.limit,
            sort: currentFilters.sort
        };

        if (currentFilters.search) params.search = currentFilters.search;
        if (currentFilters.category && currentFilters.category !== 'all') params.category = currentFilters.category;
        if (currentFilters.gender && currentFilters.gender !== 'all') params.gender = currentFilters.gender;
        if (currentFilters.size && currentFilters.size !== 'all') params.size = currentFilters.size;
        if (currentFilters.condition && currentFilters.condition !== 'all') params.condition = currentFilters.condition;
        if (currentFilters.type && currentFilters.type !== 'all') params.type = currentFilters.type;
        if (currentFilters.minPrice !== '') params.minPrice = currentFilters.minPrice;
        if (currentFilters.maxPrice !== '') params.maxPrice = currentFilters.maxPrice;
        if (currentFilters.location) params.location = currentFilters.location;

        const res = await api.get('/items', params);

        if (countLabel) {
            countLabel.textContent = `Showing ${res.items.length} of ${res.totalItems} sustainable items`;
        }

        if (!res.items || res.items.length === 0) {
            grid.innerHTML = `
                <div class="empty-state" style="grid-column: 1 / -1;">
                    <div class="empty-state-icon"><i class="fas fa-tshirt"></i></div>
                    <h3 class="empty-state-title font-serif">No Clothing Matches Found</h3>
                    <p class="empty-state-desc">Try loosening your search terms, choosing a different category, or resetting active filters.</p>
                    <button class="btn btn-outline btn-sm" onclick="document.getElementById('btn-reset-filters').click()">Clear All Filters</button>
                </div>
            `;
            if (paginationContainer) paginationContainer.innerHTML = '';
            return;
        }

        // Render product cards
        grid.innerHTML = res.items.map(item => renderProductCard(item)).join('');

        // Bind Wishlist Buttons
        grid.querySelectorAll('.wishlist-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleWishlistToggle(btn);
            });
        });

        // Render Pagination
        renderPagination(res.totalPages, res.currentPage);

        // Update URL state without page reload
        const searchParams = new URLSearchParams();
        if (currentFilters.category !== 'all') searchParams.set('category', currentFilters.category);
        if (currentFilters.type !== 'all') searchParams.set('type', currentFilters.type);
        if (currentFilters.search) searchParams.set('search', currentFilters.search);
        if (currentFilters.page > 1) searchParams.set('page', currentFilters.page);
        const newUrl = `${window.location.pathname}${searchParams.toString() ? '?' + searchParams.toString() : ''}`;
        window.history.replaceState({}, '', newUrl);

    } catch (err) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <div class="empty-state-icon" style="color:var(--status-donate);"><i class="fas fa-exclamation-triangle"></i></div>
                <h3 class="empty-state-title">Unable to Load Clothing Items</h3>
                <p class="empty-state-desc">${err.message || 'Please check your connection and try again.'}</p>
                <button class="btn btn-primary btn-sm" onclick="fetchItems()">Retry</button>
            </div>
        `;
    }
}

// Generate Product Card HTML
function renderProductCard(item) {
    const isWishlisted = item.is_wishlisted;
    let badgeClass = 'badge-sell';
    let badgeText = 'For Sale';
    let priceDisplay = formatCurrency(item.price);

    if (item.listing_type === 'exchange') {
        badgeClass = 'badge-exchange';
        badgeText = 'Exchange';
        priceDisplay = '<span class="card-price exchange"><i class="fas fa-sync-alt"></i> Swap</span>';
    } else if (item.listing_type === 'donate') {
        badgeClass = 'badge-donate';
        badgeText = 'Donation';
        priceDisplay = '<span class="card-price free"><i class="fas fa-heart"></i> Free</span>';
    }

    const conditionMap = {
        brand_new: 'Brand New',
        like_new: 'Like New',
        gently_used: 'Gently Used',
        well_worn: 'Pre-Loved'
    };
    const conditionText = conditionMap[item.condition_grade] || item.condition_grade;

    return `
        <article class="product-card" data-id="${item.id}">
            <div class="card-img-wrapper">
                <img src="${item.primary_image}" alt="${item.title}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'">
                <div class="card-badges">
                    <span class="badge ${badgeClass}">${badgeText}</span>
                    <span class="badge badge-condition">${conditionText}</span>
                </div>
                <button class="wishlist-btn ${isWishlisted ? 'active' : ''}" data-id="${item.id}" title="${isWishlisted ? 'Remove from Wishlist' : 'Add to Wishlist'}">
                    <i class="${isWishlisted ? 'fas' : 'far'} fa-heart"></i>
                </button>
            </div>
            <div class="card-body">
                <div class="card-meta">
                    <span class="card-brand">${item.brand || 'Vintage'}</span>
                    <span class="card-size">Size: ${item.size}</span>
                </div>
                <h4 class="card-title">
                    <a href="/product.html?id=${item.id}">${item.title}</a>
                </h4>
                <div class="card-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${item.location || 'India'}</span>
                </div>
                <div class="card-footer">
                    <div class="card-price-container">
                        ${typeof priceDisplay === 'string' && !priceDisplay.includes('<') ? `<span class="card-price">${priceDisplay}</span>` : priceDisplay}
                    </div>
                    <a href="/product.html?id=${item.id}" class="btn btn-outline btn-sm">View Details</a>
                </div>
            </div>
        </article>
    `;
}

// Handle Wishlist Toggle
async function handleWishlistToggle(button) {
    if (!isLoggedIn()) {
        showToast('Please sign in to save items to your wishlist.', 'info');
        setTimeout(() => window.location.href = '/login.html', 1200);
        return;
    }

    const itemId = button.getAttribute('data-id');
    const isCurrentlyActive = button.classList.contains('active');
    const icon = button.querySelector('i');

    try {
        if (isCurrentlyActive) {
            await api.delete(`/wishlist/${itemId}`);
            button.classList.remove('active');
            icon.classList.remove('fas');
            icon.classList.add('far');
            showToast('Item removed from your wishlist.', 'info');
        } else {
            await api.post('/wishlist', { itemId: parseInt(itemId, 10) });
            button.classList.add('active');
            icon.classList.remove('far');
            icon.classList.add('fas');
            showToast('Saved to your wishlist! 💚', 'success');
        }
    } catch (err) {
        showToast(err.message || 'Could not update wishlist.', 'error');
    }
}

// Render Dynamic Pagination Controls
function renderPagination(totalPages, currentPage) {
    const container = document.getElementById('pagination-container');
    if (!container || totalPages <= 1) {
        if (container) container.innerHTML = '';
        return;
    }

    let html = `
        <button class="btn btn-outline btn-sm pagination-btn" ${currentPage === 1 ? 'disabled' : ''} data-page="${currentPage - 1}">
            <i class="fas fa-chevron-left"></i> Previous
        </button>
        <div class="pagination-numbers">
    `;

    for (let p = 1; p <= totalPages; p++) {
        if (p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)) {
            html += `
                <button class="pagination-num-btn ${p === currentPage ? 'active' : ''}" data-page="${p}">${p}</button>
            `;
        } else if (p === currentPage - 2 || p === currentPage + 2) {
            html += `<span class="pagination-ellipsis">...</span>`;
        }
    }

    html += `
        </div>
        <button class="btn btn-outline btn-sm pagination-btn" ${currentPage === totalPages ? 'disabled' : ''} data-page="${currentPage + 1}">
            Next <i class="fas fa-chevron-right"></i>
        </button>
    `;

    container.innerHTML = html;

    container.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const pageNum = parseInt(btn.getAttribute('data-page'), 10);
            if (pageNum && pageNum !== currentFilters.page) {
                currentFilters.page = pageNum;
                fetchItems();
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        });
    });
}
