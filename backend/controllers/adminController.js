const db = require('../config/db');

// Admin Dashboard Overview Stats
async function getDashboardStats(req, res) {
    try {
        const [usersCount] = await db.query('SELECT COUNT(*) as total FROM users');
        const [listingsCount] = await db.query('SELECT COUNT(*) as total FROM items');
        const [activeListingsCount] = await db.query("SELECT COUNT(*) as total FROM items WHERE status = 'active'");
        const [ordersCount] = await db.query('SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as gmv FROM orders');
        const [exchangesCount] = await db.query('SELECT COUNT(*) as total FROM exchange_requests');
        const [completedExchangesCount] = await db.query("SELECT COUNT(*) as total FROM exchange_requests WHERE status = 'completed'");
        const [donationsCount] = await db.query('SELECT COUNT(*) as total FROM donation_requests');
        const [completedDonationsCount] = await db.query("SELECT COUNT(*) as total FROM donation_requests WHERE status = 'completed'");
        const [pendingReportsCount] = await db.query("SELECT COUNT(*) as total FROM reports WHERE status = 'pending'");

        // Recent listings
        const [recentListings] = await db.query(`
            SELECT i.id, i.title, i.price, i.listing_type, i.status, i.created_at, u.name as seller_name 
            FROM items i 
            JOIN users u ON i.user_id = u.id 
            ORDER BY i.created_at DESC 
            LIMIT 5
        `);

        // Recent users
        const [recentUsers] = await db.query(`
            SELECT id, name, email, role, location, created_at 
            FROM users 
            ORDER BY created_at DESC 
            LIMIT 5
        `);

        return res.json({
            success: true,
            stats: {
                totalUsers: usersCount[0].total,
                totalListings: listingsCount[0].total,
                activeListings: activeListingsCount[0].total,
                totalOrders: ordersCount[0].total,
                totalGmv: parseFloat(ordersCount[0].gmv || 0),
                totalExchanges: exchangesCount[0].total,
                completedExchanges: completedExchangesCount[0].total,
                totalDonations: donationsCount[0].total,
                completedDonations: completedDonationsCount[0].total,
                pendingReports: pendingReportsCount[0].total
            },
            recentListings,
            recentUsers
        });
    } catch (err) {
        console.error('[Admin getDashboardStats Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving admin stats.' });
    }
}

// Admin: Get all users
async function getUsers(req, res) {
    try {
        const [users] = await db.query(`
            SELECT 
                u.id, u.name, u.email, u.phone, u.location, u.role, u.created_at,
                (SELECT COUNT(*) FROM items WHERE user_id = u.id) as listing_count,
                (SELECT COUNT(*) FROM orders WHERE buyer_id = u.id) as order_count
            FROM users u
            ORDER BY u.created_at DESC
        `);

        return res.json({ success: true, users });
    } catch (err) {
        console.error('[Admin getUsers Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving users.' });
    }
}

// Admin: Toggle user role
async function toggleUserRole(req, res) {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        if (targetUserId === req.user.id) {
            return res.status(400).json({ success: false, message: 'You cannot alter your own admin privileges.' });
        }

        const [users] = await db.query('SELECT role FROM users WHERE id = ?', [targetUserId]);
        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const newRole = users[0].role === 'admin' ? 'user' : 'admin';
        await db.query('UPDATE users SET role = ? WHERE id = ?', [newRole, targetUserId]);

        return res.json({
            success: true,
            message: `User role successfully changed to ${newRole}.`,
            role: newRole
        });
    } catch (err) {
        console.error('[Admin toggleUserRole Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating user role.' });
    }
}

// Admin: Get all listings
async function getListings(req, res) {
    try {
        const [listings] = await db.query(`
            SELECT 
                i.*,
                c.name as category_name,
                u.name as seller_name,
                u.email as seller_email,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as primary_image,
                (SELECT COUNT(*) FROM reports WHERE item_id = i.id) as report_count
            FROM items i
            JOIN categories c ON i.category_id = c.id
            JOIN users u ON i.user_id = u.id
            ORDER BY i.created_at DESC
        `);

        return res.json({ success: true, listings });
    } catch (err) {
        console.error('[Admin getListings Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving listings.' });
    }
}

// Admin: Remove Inappropriate Listing
async function deleteListing(req, res) {
    try {
        const itemId = parseInt(req.params.id, 10);

        const [items] = await db.query('SELECT user_id, title FROM items WHERE id = ?', [itemId]);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Listing not found.' });
        }

        const item = items[0];

        await db.query('DELETE FROM items WHERE id = ?', [itemId]);

        // Send notification to owner
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message)
            VALUES (?, 'system', 'Listing Removed by Moderator', ?)
        `, [
            item.user_id,
            `Your listing "${item.title}" was removed by ReWear moderation team due to community guideline violations.`
        ]);

        return res.json({
            success: true,
            message: `Listing "${item.title}" has been permanently removed.`
        });
    } catch (err) {
        console.error('[Admin deleteListing Error]', err);
        return res.status(500).json({ success: false, message: 'Server error deleting listing.' });
    }
}

// Admin: Get all reports
async function getReports(req, res) {
    try {
        const [reports] = await db.query(`
            SELECT 
                r.*,
                u.name as reporter_name,
                u.email as reporter_email,
                i.title as item_title,
                i.status as item_status,
                i.user_id as item_owner_id,
                ow.name as item_owner_name
            FROM reports r
            JOIN users u ON r.reporter_id = u.id
            JOIN items i ON r.item_id = i.id
            JOIN users ow ON i.user_id = ow.id
            ORDER BY r.created_at DESC
        `);

        return res.json({ success: true, reports });
    } catch (err) {
        console.error('[Admin getReports Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving reports.' });
    }
}

// Admin: Update report status
async function updateReportStatus(req, res) {
    try {
        const reportId = parseInt(req.params.id, 10);
        const { status, adminNotes } = req.body;

        const validStatuses = ['pending', 'reviewed', 'dismissed', 'action_taken'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid report status.' });
        }

        await db.query(
            'UPDATE reports SET status = ?, admin_notes = ? WHERE id = ?',
            [status, adminNotes || null, reportId]
        );

        return res.json({
            success: true,
            message: `Report status updated to ${status}.`
        });
    } catch (err) {
        console.error('[Admin updateReportStatus Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating report status.' });
    }
}

// Create Report (Submitted by any logged-in user)
async function createReport(req, res) {
    try {
        const reporterId = req.user.id;
        const { itemId, reason, details } = req.body;

        if (!itemId || !reason) {
            return res.status(400).json({ success: false, message: 'Please select a reason for reporting.' });
        }

        const [item] = await db.query('SELECT title FROM items WHERE id = ?', [itemId]);
        if (!item || item.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        await db.query(`
            INSERT INTO reports (reporter_id, item_id, reason, details, status)
            VALUES (?, ?, ?, ?, 'pending')
        `, [
            reporterId,
            itemId,
            reason.trim(),
            details ? details.trim() : null
        ]);

        return res.status(201).json({
            success: true,
            message: 'Thank you for reporting. Our moderation team has been notified and will review this listing.'
        });
    } catch (err) {
        console.error('[Report createReport Error]', err);
        return res.status(500).json({ success: false, message: 'Server error creating report.' });
    }
}

module.exports = {
    getDashboardStats,
    getUsers,
    toggleUserRole,
    getListings,
    deleteListing,
    getReports,
    updateReportStatus,
    createReport
};
