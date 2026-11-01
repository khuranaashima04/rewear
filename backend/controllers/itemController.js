const db = require('../config/db');

// List/Explore Items with Filters, Search, Sort & Pagination
async function getItems(req, res) {
    try {
        const {
            search,
            category,
            gender,
            size,
            condition,
            type, // sell | exchange | donate
            minPrice,
            maxPrice,
            location,
            sort = 'latest',
            page = 1,
            limit = 12,
            userId // optional: filter by specific user
        } = req.query;

        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
        const conditions = [];
        const params = [];

        // Base condition: only active items unless requested by owner/admin
        if (userId) {
            conditions.push('i.user_id = ?');
            params.push(userId);
        } else {
            conditions.push("i.status = 'active'");
        }

        // Search in title, description, or brand
        if (search && search.trim()) {
            conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.brand LIKE ?)');
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        // Category filter (by ID or Slug)
        if (category && category !== 'all') {
            if (!isNaN(category)) {
                conditions.push('i.category_id = ?');
                params.push(category);
            } else {
                conditions.push('c.slug = ?');
                params.push(category.toLowerCase());
            }
        }

        // Gender filter
        if (gender && gender !== 'all') {
            conditions.push('i.gender = ?');
            params.push(gender.toLowerCase());
        }

        // Size filter
        if (size && size !== 'all') {
            conditions.push('i.size = ?');
            params.push(size);
        }

        // Condition filter
        if (condition && condition !== 'all') {
            conditions.push('i.condition_grade = ?');
            params.push(condition);
        }

        // Listing type filter (sell, exchange, donate)
        if (type && type !== 'all') {
            conditions.push('i.listing_type = ?');
            params.push(type.toLowerCase());
        }

        // Price range filter
        if (minPrice && !isNaN(minPrice)) {
            conditions.push('i.price >= ?');
            params.push(parseFloat(minPrice));
        }
        if (maxPrice && !isNaN(maxPrice)) {
            conditions.push('i.price <= ?');
            params.push(parseFloat(maxPrice));
        }

        // Location filter
        if (location && location.trim()) {
            conditions.push('i.location LIKE ?');
            params.push(`%${location.trim()}%`);
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

        // Sorting
        let orderBy = 'ORDER BY i.created_at DESC';
        if (sort === 'price_asc') {
            orderBy = 'ORDER BY i.price ASC, i.created_at DESC';
        } else if (sort === 'price_desc') {
            orderBy = 'ORDER BY i.price DESC, i.created_at DESC';
        } else if (sort === 'popularity') {
            orderBy = 'ORDER BY i.views_count DESC, i.created_at DESC';
        }

        // Count total matching items
        const countSql = `
            SELECT COUNT(*) as total 
            FROM items i 
            LEFT JOIN categories c ON i.category_id = c.id 
            ${whereClause}
        `;
        const [countResult] = await db.query(countSql, params);
        const totalItems = countResult[0].total;
        const totalPages = Math.ceil(totalItems / parseInt(limit, 10));

        // Query items
        const itemsSql = `
            SELECT 
                i.*,
                c.name as category_name,
                c.slug as category_slug,
                u.name as seller_name,
                u.avatar as seller_avatar,
                (
                    SELECT image_url 
                    FROM item_images 
                    WHERE item_id = i.id 
                    ORDER BY is_primary DESC, id ASC 
                    LIMIT 1
                ) as primary_image
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN users u ON i.user_id = u.id
            ${whereClause}
            ${orderBy}
            LIMIT ? OFFSET ?
        `;

        const queryParams = [...params, parseInt(limit, 10), parseInt(offset, 10)];
        const [items] = await db.query(itemsSql, queryParams);

        // Check wishlist if user logged in
        let wishlistedItemIds = new Set();
        if (req.user) {
            const [wRows] = await db.query('SELECT item_id FROM wishlist WHERE user_id = ?', [req.user.id]);
            wishlistedItemIds = new Set(wRows.map(w => w.item_id));
        }

        const enrichedItems = items.map(item => ({
            ...item,
            primary_image: item.primary_image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
            is_wishlisted: wishlistedItemIds.has(item.id)
        }));

        return res.json({
            success: true,
            totalItems,
            totalPages,
            currentPage: parseInt(page, 10),
            limit: parseInt(limit, 10),
            items: enrichedItems
        });
    } catch (err) {
        console.error('[Item getItems Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving items.' });
    }
}

// Get Single Item by ID with images and seller details
async function getItemById(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);
        if (isNaN(itemId)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID.' });
        }

        // Increment views count asynchronously
        db.query('UPDATE items SET views_count = views_count + 1 WHERE id = ?', [itemId]).catch(() => {});

        const [items] = await db.query(`
            SELECT 
                i.*,
                c.name as category_name,
                c.slug as category_slug,
                u.id as seller_id,
                u.name as seller_name,
                u.email as seller_email,
                u.phone as seller_phone,
                u.avatar as seller_avatar,
                u.location as seller_location,
                u.bio as seller_bio,
                u.created_at as seller_joined_at
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN users u ON i.user_id = u.id
            WHERE i.id = ?
        `, [itemId]);

        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Clothing item not found.' });
        }

        const item = items[0];

        // Fetch all images for this item
        const [images] = await db.query(
            'SELECT id, image_url, is_primary FROM item_images WHERE item_id = ? ORDER BY is_primary DESC, id ASC',
            [itemId]
        );

        item.images = images.length > 0 ? images : [{
            id: 0,
            image_url: 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
            is_primary: 1
        }];

        // Wishlist check
        item.is_wishlisted = false;
        if (req.user) {
            const [w] = await db.query('SELECT id FROM wishlist WHERE user_id = ? AND item_id = ?', [req.user.id, itemId]);
            item.is_wishlisted = w.length > 0;
        }

        // Seller total listings count
        const [sellerCount] = await db.query('SELECT COUNT(*) as count FROM items WHERE user_id = ?', [item.seller_id]);
        item.seller_active_items = sellerCount[0].count;

        return res.json({
            success: true,
            item
        });
    } catch (err) {
        console.error('[Item getItemById Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving item details.' });
    }
}

// Create new clothing listing
async function createItem(req, res) {
    try {
        const userId = req.user.id;
        const {
            title,
            description,
            category_id,
            gender,
            size,
            brand,
            condition_grade,
            price,
            listing_type,
            exchange_preferences,
            donation_preferences,
            location
        } = req.body;

        if (!title || !description || !category_id || !gender || !size || !condition_grade || !listing_type) {
            return res.status(400).json({
                success: false,
                message: 'Please complete all required fields.'
            });
        }

        // Validate listing_type rules
        const cleanPrice = listing_type === 'sell' ? (parseFloat(price) || 0) : 0;

        const [insertResult] = await db.query(`
            INSERT INTO items (
                user_id, category_id, title, description, gender, size, brand, 
                condition_grade, price, listing_type, exchange_preferences, 
                donation_preferences, location, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
        `, [
            userId,
            parseInt(category_id, 10),
            title.trim(),
            description.trim(),
            gender.toLowerCase(),
            size.trim(),
            brand ? brand.trim() : 'Independent / Vintage',
            condition_grade,
            cleanPrice,
            listing_type.toLowerCase(),
            exchange_preferences ? exchange_preferences.trim() : null,
            donation_preferences ? donation_preferences.trim() : null,
            location ? location.trim() : req.user.location || 'New Delhi, India'
        ]);

        const newItemId = insertResult.insertId;

        // Process uploaded images
        let savedImages = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                const file = req.files[i];
                const relativeUrl = `/uploads/${file.filename}`;
                const isPrimary = i === 0 ? 1 : 0;
                await db.query('INSERT INTO item_images (item_id, image_url, is_primary) VALUES (?, ?, ?)', [
                    newItemId,
                    relativeUrl,
                    isPrimary
                ]);
                savedImages.push(relativeUrl);
            }
        } else if (req.body.image_url) {
            // Support direct image URL input as well
            await db.query('INSERT INTO item_images (item_id, image_url, is_primary) VALUES (?, ?, 1)', [
                newItemId,
                req.body.image_url.trim(),
                1
            ]);
            savedImages.push(req.body.image_url.trim());
        } else {
            // Default placeholder image
            const defaultImg = 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80';
            await db.query('INSERT INTO item_images (item_id, image_url, is_primary) VALUES (?, ?, 1)', [
                newItemId,
                defaultImg,
                1
            ]);
            savedImages.push(defaultImg);
        }

        return res.status(201).json({
            success: true,
            message: 'Your clothing item has been listed successfully!',
            itemId: newItemId
        });
    } catch (err) {
        console.error('[Item createItem Error]', err);
        return res.status(500).json({ success: false, message: 'Server error creating listing.' });
    }
}

// Update existing clothing listing
async function updateItem(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [existing] = await db.query('SELECT user_id, status FROM items WHERE id = ?', [itemId]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        if (existing[0].user_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'You do not have permission to edit this listing.' });
        }

        const {
            title,
            description,
            category_id,
            gender,
            size,
            brand,
            condition_grade,
            price,
            listing_type,
            exchange_preferences,
            donation_preferences,
            location,
            status
        } = req.body;

        const updates = [];
        const params = [];

        if (title) { updates.push('title = ?'); params.push(title.trim()); }
        if (description) { updates.push('description = ?'); params.push(description.trim()); }
        if (category_id) { updates.push('category_id = ?'); params.push(parseInt(category_id, 10)); }
        if (gender) { updates.push('gender = ?'); params.push(gender.toLowerCase()); }
        if (size) { updates.push('size = ?'); params.push(size.trim()); }
        if (brand !== undefined) { updates.push('brand = ?'); params.push(brand.trim()); }
        if (condition_grade) { updates.push('condition_grade = ?'); params.push(condition_grade); }
        if (price !== undefined) { updates.push('price = ?'); params.push(parseFloat(price) || 0); }
        if (listing_type) { updates.push('listing_type = ?'); params.push(listing_type.toLowerCase()); }
        if (exchange_preferences !== undefined) { updates.push('exchange_preferences = ?'); params.push(exchange_preferences); }
        if (donation_preferences !== undefined) { updates.push('donation_preferences = ?'); params.push(donation_preferences); }
        if (location) { updates.push('location = ?'); params.push(location.trim()); }
        if (status) { updates.push('status = ?'); params.push(status); }

        if (updates.length > 0) {
            params.push(itemId);
            await db.query(`UPDATE items SET ${updates.join(', ')} WHERE id = ?`, params);
        }

        // Handle additional images if uploaded
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const relativeUrl = `/uploads/${file.filename}`;
                await db.query('INSERT INTO item_images (item_id, image_url, is_primary) VALUES (?, ?, 0)', [
                    itemId,
                    relativeUrl
                ]);
            }
        }

        return res.json({
            success: true,
            message: 'Listing updated successfully.'
        });
    } catch (err) {
        console.error('[Item updateItem Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating listing.' });
    }
}

// Delete clothing listing
async function deleteItem(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [existing] = await db.query('SELECT user_id, title FROM items WHERE id = ?', [itemId]);
        if (!existing || existing.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        if (existing[0].user_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'You do not have permission to remove this listing.' });
        }

        await db.query('DELETE FROM items WHERE id = ?', [itemId]);

        return res.json({
            success: true,
            message: `"${existing[0].title}" has been successfully removed.`
        });
    } catch (err) {
        console.error('[Item deleteItem Error]', err);
        return res.status(500).json({ success: false, message: 'Server error deleting listing.' });
    }
}

// Get all categories
async function getCategories(req, res) {
    try {
        const [categories] = await db.query(`
            SELECT c.*, COUNT(i.id) as item_count 
            FROM categories c 
            LEFT JOIN items i ON c.id = i.category_id AND i.status = 'active'
            GROUP BY c.id 
            ORDER BY c.id ASC
        `);
        return res.json({ success: true, categories });
    } catch (err) {
        console.error('[Categories Error]', err);
        return res.status(500).json({ success: false, message: 'Server error fetching categories.' });
    }
}

// Get listings for current user
async function getMyListings(req, res) {
    try {
        const userId = req.user.id;
        const [items] = await db.query(`
            SELECT 
                i.*,
                c.name as category_name,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            WHERE i.user_id = ?
            ORDER BY i.created_at DESC
        `, [userId]);

        return res.json({ success: true, items });
    } catch (err) {
        console.error('[Item getMyListings Error]', err);
        return res.status(500).json({ success: false, message: 'Server error fetching your listings.' });
    }
}

module.exports = {
    getItems,
    getItemById,
    createItem,
    updateItem,
    deleteItem,
    getCategories,
    getMyListings
};
