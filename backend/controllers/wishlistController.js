const db = require('../config/db');

// Get User's Saved Wishlist Items
async function getWishlist(req, res) {
    try {
        const userId = req.user.id;

        const [items] = await db.query(`
            SELECT 
                i.*,
                c.name as category_name,
                c.slug as category_slug,
                u.name as seller_name,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image,
                w.created_at as saved_at
            FROM wishlist w
            JOIN items i ON w.item_id = i.id
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN users u ON i.user_id = u.id
            WHERE w.user_id = ?
            ORDER BY w.created_at DESC
        `, [userId]);

        return res.json({
            success: true,
            wishlist: items.map(item => ({
                ...item,
                primary_image: item.primary_image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80',
                is_wishlisted: true
            }))
        });
    } catch (err) {
        console.error('[Wishlist getWishlist Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving wishlist.' });
    }
}

// Add Item to Wishlist
async function addToWishlist(req, res) {
    try {
        const userId = req.user.id;
        const { itemId } = req.body;

        if (!itemId) {
            return res.status(400).json({ success: false, message: 'Item ID is required.' });
        }

        const [item] = await db.query('SELECT id, title FROM items WHERE id = ?', [itemId]);
        if (!item || item.length === 0) {
            return res.status(404).json({ success: false, message: 'Clothing item not found.' });
        }

        // Check if already in wishlist
        const [existing] = await db.query('SELECT id FROM wishlist WHERE user_id = ? AND item_id = ?', [userId, itemId]);
        if (existing.length > 0) {
            return res.json({ success: true, message: 'Item is already in your wishlist.' });
        }

        await db.query('INSERT INTO wishlist (user_id, item_id) VALUES (?, ?)', [userId, itemId]);

        return res.status(201).json({
            success: true,
            message: `"${item[0].title}" added to your saved wardrobe.`
        });
    } catch (err) {
        console.error('[Wishlist addToWishlist Error]', err);
        return res.status(500).json({ success: false, message: 'Server error adding item to wishlist.' });
    }
}

// Remove Item from Wishlist
async function removeFromWishlist(req, res) {
    try {
        const userId = req.user.id;
        const itemId = parseInt(req.params.itemId, 10);

        if (isNaN(itemId)) {
            return res.status(400).json({ success: false, message: 'Invalid item ID.' });
        }

        await db.query('DELETE FROM wishlist WHERE user_id = ? AND item_id = ?', [userId, itemId]);

        return res.json({
            success: true,
            message: 'Item removed from your wishlist.'
        });
    } catch (err) {
        console.error('[Wishlist removeFromWishlist Error]', err);
        return res.status(500).json({ success: false, message: 'Server error removing item from wishlist.' });
    }
}

module.exports = {
    getWishlist,
    addToWishlist,
    removeFromWishlist
};
