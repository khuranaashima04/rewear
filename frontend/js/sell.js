// ReWear - Sell / List An Item Controller

let selectedFiles = [];
let editItemId = null;

document.addEventListener('DOMContentLoaded', () => {
    // Require authentication
    if (!isLoggedIn()) {
        showToast('Please sign in or register to list your clothing.', 'info');
        setTimeout(() => window.location.href = '/login.html', 1000);
        return;
    }

    loadCategories();
    initListingTypeToggle();
    initImageUpload();
    initSellForm();

    // Check if in edit mode
    const urlParams = new URLSearchParams(window.location.search);
    editItemId = urlParams.get('id');
    if (editItemId) {
        loadItemForEditing(editItemId);
    } else {
        // Pre-fill location from user profile
        const user = getUser();
        if (user && user.location) {
            const locInput = document.getElementById('item-location');
            if (locInput) locInput.value = user.location;
        }
    }
});

// Load Categories for Dropdown
async function loadCategories() {
    const catSelect = document.getElementById('item-category');
    if (!catSelect) return;

    try {
        const res = await api.get('/items/categories');
        if (res.success && res.categories) {
            catSelect.innerHTML = '<option value="">-- Select Category --</option>' + 
                res.categories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
        }
    } catch (e) {
        console.error('Failed to load categories', e);
    }
}

// Listing Type Toggle (Sell / Exchange / Donate)
function initListingTypeToggle() {
    const radios = document.querySelectorAll('input[name="listing_type"]');
    const priceGroup = document.getElementById('group-price');
    const exchangeGroup = document.getElementById('group-exchange-pref');
    const donateGroup = document.getElementById('group-donation-pref');

    radios.forEach(radio => {
        radio.addEventListener('change', () => {
            const val = radio.value;
            if (val === 'sell') {
                if (priceGroup) priceGroup.style.display = 'block';
                if (exchangeGroup) exchangeGroup.style.display = 'none';
                if (donateGroup) donateGroup.style.display = 'none';
            } else if (val === 'exchange') {
                if (priceGroup) priceGroup.style.display = 'none';
                if (exchangeGroup) exchangeGroup.style.display = 'block';
                if (donateGroup) donateGroup.style.display = 'none';
            } else if (val === 'donate') {
                if (priceGroup) priceGroup.style.display = 'none';
                if (exchangeGroup) exchangeGroup.style.display = 'none';
                if (donateGroup) donateGroup.style.display = 'block';
            }
        });
    });
}

// Multi-image upload and preview
function initImageUpload() {
    const dropzone = document.getElementById('image-dropzone');
    const fileInput = document.getElementById('item-images-input');
    const previewContainer = document.getElementById('image-previews-container');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelection(Array.from(e.dataTransfer.files));
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files.length > 0) {
            handleFileSelection(Array.from(fileInput.files));
        }
    });

    function handleFileSelection(files) {
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        files.forEach(file => {
            if (allowedTypes.includes(file.type)) {
                if (file.size <= 5 * 1024 * 1024) {
                    if (selectedFiles.length < 5) {
                        selectedFiles.push(file);
                    } else {
                        showToast('Maximum 5 images allowed per listing.', 'warning');
                    }
                } else {
                    showToast(`"${file.name}" exceeds the 5MB file limit.`, 'error');
                }
            } else {
                showToast(`"${file.name}" has an unsupported format.`, 'error');
            }
        });
        renderPreviews();
    }

    function renderPreviews() {
        if (!previewContainer) return;
        previewContainer.innerHTML = '';

        selectedFiles.forEach((file, idx) => {
            const previewCard = document.createElement('div');
            previewCard.className = 'upload-preview-card';
            const imgUrl = URL.createObjectURL(file);

            previewCard.innerHTML = `
                <img src="${imgUrl}" alt="Preview ${idx + 1}">
                <button type="button" class="btn-remove-preview" data-idx="${idx}">&times;</button>
                ${idx === 0 ? '<span class="primary-indicator">Cover</span>' : ''}
            `;

            previewContainer.appendChild(previewCard);
        });

        // Bind remove buttons
        previewContainer.querySelectorAll('.btn-remove-preview').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const index = parseInt(btn.getAttribute('data-idx'), 10);
                selectedFiles.splice(index, 1);
                renderPreviews();
            });
        });
    }
}

// Form Submission (Create or Edit)
function initSellForm() {
    const form = document.getElementById('sell-item-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = form.querySelector('button[type="submit"]');

        const title = document.getElementById('item-title').value.trim();
        const description = document.getElementById('item-desc').value.trim();
        const categoryId = document.getElementById('item-category').value;
        const gender = document.getElementById('item-gender').value;
        const size = document.getElementById('item-size').value;
        const brand = document.getElementById('item-brand').value.trim();
        const condition = document.getElementById('item-condition').value;
        const location = document.getElementById('item-location').value.trim();
        const listingType = document.querySelector('input[name="listing_type"]:checked').value;
        const price = document.getElementById('item-price') ? document.getElementById('item-price').value : 0;
        const exchangePref = document.getElementById('item-exchange-pref') ? document.getElementById('item-exchange-pref').value.trim() : '';
        const donationPref = document.getElementById('item-donation-pref') ? document.getElementById('item-donation-pref').value.trim() : '';
        const fallbackUrl = document.getElementById('item-image-url') ? document.getElementById('item-image-url').value.trim() : '';

        if (!title || !description || !categoryId || !gender || !size || !condition) {
            showToast('Please fill out all required fields marked with an asterisk (*).', 'warning');
            return;
        }

        if (listingType === 'sell' && (!price || parseFloat(price) <= 0)) {
            showToast('Please enter a valid selling price.', 'warning');
            return;
        }

        if (selectedFiles.length === 0 && !fallbackUrl && !editItemId) {
            showToast('Please upload at least one image or provide an image URL.', 'warning');
            return;
        }

        const formData = new FormData();
        formData.append('title', title);
        formData.append('description', description);
        formData.append('category_id', categoryId);
        formData.append('gender', gender);
        formData.append('size', size);
        formData.append('brand', brand);
        formData.append('condition_grade', condition);
        formData.append('location', location);
        formData.append('listing_type', listingType);
        formData.append('price', listingType === 'sell' ? price : '0');
        formData.append('exchange_preferences', exchangePref);
        formData.append('donation_preferences', donationPref);

        if (fallbackUrl) {
            formData.append('image_url', fallbackUrl);
        }

        selectedFiles.forEach(file => {
            formData.append('images', file);
        });

        try {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing Clothing Item...';

            let res;
            if (editItemId) {
                res = await api.put(`/items/${editItemId}`, formData, true);
            } else {
                res = await api.post('/items', formData, true);
            }

            showToast(res.message || 'Clothing item listed successfully!', 'success');

            setTimeout(() => {
                if (editItemId) {
                    window.location.href = `/product.html?id=${editItemId}`;
                } else {
                    window.location.href = `/product.html?id=${res.itemId}`;
                }
            }, 800);

        } catch (err) {
            showToast(err.message || 'Error publishing listing. Please check inputs.', 'error');
            submitBtn.disabled = false;
            submitBtn.innerHTML = editItemId ? 'Update Listing' : 'Publish Listing <i class="fas fa-arrow-right"></i>';
        }
    });
}

// Pre-fill form if editing
async function loadItemForEditing(id) {
    try {
        const res = await api.get(`/items/${id}`);
        const item = res.item;

        document.getElementById('sell-page-title').textContent = 'Edit Clothing Listing';
        document.getElementById('sell-page-desc').textContent = 'Update details, pricing, or description for your wardrobe piece.';

        document.getElementById('item-title').value = item.title;
        document.getElementById('item-desc').value = item.description;
        document.getElementById('item-category').value = item.category_id;
        document.getElementById('item-gender').value = item.gender;
        document.getElementById('item-size').value = item.size;
        document.getElementById('item-brand').value = item.brand || '';
        document.getElementById('item-condition').value = item.condition_grade;
        document.getElementById('item-location').value = item.location;

        const radio = document.querySelector(`input[name="listing_type"][value="${item.listing_type}"]`);
        if (radio) {
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
        }

        if (item.listing_type === 'sell' && document.getElementById('item-price')) {
            document.getElementById('item-price').value = item.price;
        }
        if (item.exchange_preferences && document.getElementById('item-exchange-pref')) {
            document.getElementById('item-exchange-pref').value = item.exchange_preferences;
        }
        if (item.donation_preferences && document.getElementById('item-donation-pref')) {
            document.getElementById('item-donation-pref').value = item.donation_preferences;
        }

        const submitBtn = document.querySelector('#sell-item-form button[type="submit"]');
        if (submitBtn) submitBtn.textContent = 'Save Changes';

    } catch (e) {
        showToast('Could not load item details for editing.', 'error');
    }
}
