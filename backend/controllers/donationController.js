const db = require('../config/db');

// Browse Donated Clothing Listings
async function getDonations(req, res) {
    try {
        const { category, size, location, search, page = 1, limit = 12 } = req.query;
        const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

        const conditions = ["i.listing_type = 'donate'", "i.status = 'active'"];
        const params = [];

        if (search && search.trim()) {
            conditions.push('(i.title LIKE ? OR i.description LIKE ? OR i.donation_preferences LIKE ?)');
            const s = `%${search.trim()}%`;
            params.push(s, s, s);
        }

        if (category && category !== 'all') {
            if (!isNaN(category)) {
                conditions.push('i.category_id = ?');
                params.push(category);
            } else {
                conditions.push('c.slug = ?');
                params.push(category.toLowerCase());
            }
        }

        if (size && size !== 'all') {
            conditions.push('i.size = ?');
            params.push(size);
        }

        if (location && location.trim()) {
            conditions.push('i.location LIKE ?');
            params.push(`%${location.trim()}%`);
        }

        const whereClause = `WHERE ${conditions.join(' AND ')}`;

        const countSql = `SELECT COUNT(*) as total FROM items i LEFT JOIN categories c ON i.category_id = c.id ${whereClause}`;
        const [countResult] = await db.query(countSql, params);
        const totalItems = countResult[0].total;

        const itemsSql = `
            SELECT 
                i.*,
                c.name as category_name,
                c.slug as category_slug,
                u.name as donor_name,
                u.avatar as donor_avatar,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image
            FROM items i
            LEFT JOIN categories c ON i.category_id = c.id
            LEFT JOIN users u ON i.user_id = u.id
            ${whereClause}
            ORDER BY i.created_at DESC
            LIMIT ? OFFSET ?
        `;

        const [items] = await db.query(itemsSql, [...params, parseInt(limit, 10), parseInt(offset, 10)]);

        return res.json({
            success: true,
            totalItems,
            totalPages: Math.ceil(totalItems / parseInt(limit, 10)),
            currentPage: parseInt(page, 10),
            items: items.map(item => ({
                ...item,
                primary_image: item.primary_image || 'https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&w=800&q=80'
            }))
        });
    } catch (err) {
        console.error('[Donation getDonations Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving donations.' });
    }
}

// Request a Donated Clothing Item
async function createDonationRequest(req, res) {
    try {
        const requesterId = req.user.id;
        const { itemId, purposeMessage, deliveryMode = 'pickup' } = req.body;

        if (!itemId || !purposeMessage || !purposeMessage.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a message explaining your purpose or context for this clothing request.'
            });
        }

        const [items] = await db.query('SELECT * FROM items WHERE id = ?', [itemId]);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Donation listing not found.' });
        }

        const item = items[0];

        if (item.listing_type !== 'donate') {
            return res.status(400).json({ success: false, message: 'This item is not listed for donation.' });
        }

        if (item.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This donation item is no longer available.' });
        }

        if (item.user_id === requesterId) {
            return res.status(400).json({ success: false, message: 'You cannot request your own donation listing.' });
        }

        // Check for existing pending request
        const [existing] = await db.query(
            'SELECT id FROM donation_requests WHERE item_id = ? AND requester_id = ? AND status = "pending"',
            [itemId, requesterId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'You already have an open request for this donation.' });
        }

        // Insert request
        const [result] = await db.query(`
            INSERT INTO donation_requests (item_id, requester_id, donor_id, purpose_message, delivery_mode, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        `, [
            itemId,
            requesterId,
            item.user_id,
            purposeMessage.trim(),
            deliveryMode
        ]);

        // Send notification to donor
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'donation', 'New Donation Request ❤️', ?, '/dashboard.html?tab=donations')
        `, [
            item.user_id,
            `${req.user.name} submitted a request for your donated item "${item.title}".`
        ]);

        return res.status(201).json({
            success: true,
            message: 'Your donation request has been sent to the donor!',
            requestId: result.insertId
        });
    } catch (err) {
        console.error('[Donation createDonationRequest Error]', err);
        return res.status(500).json({ success: false, message: 'Server error submitting donation request.' });
    }
}

// Get user donation requests (both sent by user and received as donor)
async function getDonationRequests(req, res) {
    try {
        const userId = req.user.id;

        // Sent requests (User is requester)
        const [sent] = await db.query(`
            SELECT 
                dr.*,
                i.title as item_title,
                i.brand as item_brand,
                i.size as item_size,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as item_image,
                d.name as donor_name,
                d.email as donor_email,
                d.location as donor_location
            FROM donation_requests dr
            JOIN items i ON dr.item_id = i.id
            JOIN users d ON dr.donor_id = d.id
            WHERE dr.requester_id = ?
            ORDER BY dr.created_at DESC
        `, [userId]);

        // Received requests (User is donor)
        const [received] = await db.query(`
            SELECT 
                dr.*,
                i.title as item_title,
                i.brand as item_brand,
                i.size as item_size,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as item_image,
                r.name as requester_name,
                r.email as requester_email,
                r.location as requester_location
            FROM donation_requests dr
            JOIN items i ON dr.item_id = i.id
            JOIN users r ON dr.requester_id = r.id
            WHERE dr.donor_id = ?
            ORDER BY dr.created_at DESC
        `, [userId]);

        return res.json({
            success: true,
            sent,
            received
        });
    } catch (err) {
        console.error('[Donation getDonationRequests Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving donation requests.' });
    }
}

// Update donation request status (approved, rejected, completed, cancelled)
async function updateDonationStatus(req, res) {
    try {
        const requestId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const validStatuses = ['approved', 'rejected', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status specified.' });
        }

        const [requests] = await db.query(`
            SELECT dr.*, i.title as item_title 
            FROM donation_requests dr
            JOIN items i ON dr.item_id = i.id
            WHERE dr.id = ?
        `, [requestId]);

        if (!requests || requests.length === 0) {
            return res.status(404).json({ success: false, message: 'Donation request not found.' });
        }

        const request = requests[0];

        // Donor can approve or reject
        if ((status === 'approved' || status === 'rejected') && request.donor_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Only the donor can approve or reject this request.' });
        }

        // Donor, requester or admin can mark completed/cancelled
        if ((status === 'completed' || status === 'cancelled') &&
            request.donor_id !== userId && request.requester_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        await db.query('UPDATE donation_requests SET status = ? WHERE id = ?', [status, requestId]);

        if (status === 'completed') {
            await db.query("UPDATE items SET status = 'donated' WHERE id = ?", [request.item_id]);

            // Notify requester
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES (?, 'donation', 'Donation Completed! 🌟', ?, '/dashboard.html?tab=donations')
            `, [
                request.requester_id,
                `Donation for "${request.item_title}" has been completed. Thank you for championing clothing reuse!`
            ]);
        } else if (status === 'approved') {
            await db.query("UPDATE items SET status = 'reserved' WHERE id = ?", [request.item_id]);

            // Notify requester
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES (?, 'donation', 'Donation Approved! 🎁', ?, '/dashboard.html?tab=donations')
            `, [
                request.requester_id,
                `Wonderful news! Your request for "${request.item_title}" was approved by the donor. Reach out to arrange transfer.`
            ]);
        } else if (status === 'rejected') {
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES (?, 'donation', 'Donation Request Declined', ?, '/dashboard.html?tab=donations')
            `, [
                request.requester_id,
                `Your request for "${request.item_title}" was declined by the donor.`
            ]);
        }

        return res.json({
            success: true,
            message: `Donation request status updated to ${status}.`
        });
    } catch (err) {
        console.error('[Donation updateDonationStatus Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating donation status.' });
    }
}

module.exports = {
    getDonations,
    createDonationRequest,
    getDonationRequests,
    updateDonationStatus
};
