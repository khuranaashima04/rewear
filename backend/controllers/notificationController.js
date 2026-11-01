const db = require('../config/db');

// Get Notifications for Current User
async function getNotifications(req, res) {
    try {
        const userId = req.user.id;

        const [notifications] = await db.query(
            'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
            [userId]
        );

        const unreadCount = notifications.filter(n => !n.is_read).length;

        return res.json({
            success: true,
            unreadCount,
            notifications
        });
    } catch (err) {
        console.error('[Notification getNotifications Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving notifications.' });
    }
}

// Mark Single Notification as Read
async function markAsRead(req, res) {
    try {
        const notifId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        await db.query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [notifId, userId]);

        return res.json({ success: true, message: 'Notification marked as read.' });
    } catch (err) {
        console.error('[Notification markAsRead Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating notification.' });
    }
}

// Mark All Notifications as Read
async function markAllAsRead(req, res) {
    try {
        const userId = req.user.id;
        await db.query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [userId]);

        return res.json({ success: true, message: 'All notifications marked as read.' });
    } catch (err) {
        console.error('[Notification markAllAsRead Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating notifications.' });
    }
}

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead
};
