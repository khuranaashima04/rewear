const db = require('../config/db');

// Get Profile with user stats
async function getProfile(req, res) {
    try {
        const userId = req.user.id;

        const [users] = await db.query(
            'SELECT id, name, email, phone, location, avatar, bio, role, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found.' });
        }

        const user = users[0];

        // Gather comprehensive statistics
        const [totalListings] = await db.query('SELECT COUNT(*) as count FROM items WHERE user_id = ?', [userId]);
        const [activeListings] = await db.query('SELECT COUNT(*) as count FROM items WHERE user_id = ? AND status = "active"', [userId]);
        const [itemsSold] = await db.query('SELECT COUNT(*) as count FROM orders WHERE seller_id = ?', [userId]);
        const [exchangesCompleted] = await db.query(
            'SELECT COUNT(*) as count FROM exchange_requests WHERE (requester_id = ? OR owner_id = ?) AND status = "completed"',
            [userId, userId]
        );
        const [donationsCompleted] = await db.query(
            'SELECT COUNT(*) as count FROM donation_requests WHERE donor_id = ? AND status = "completed"',
            [userId]
        );

        user.stats = {
            totalListings: totalListings[0].count,
            activeListings: activeListings[0].count,
            itemsSold: itemsSold[0].count,
            exchangesCompleted: exchangesCompleted[0].count,
            donationsCompleted: donationsCompleted[0].count
        };

        return res.json({
            success: true,
            user
        });
    } catch (err) {
        console.error('[User getProfile Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving profile.' });
    }
}

// Update Profile
async function updateProfile(req, res) {
    try {
        const userId = req.user.id;
        const { name, phone, location, bio, avatar } = req.body;

        const updates = [];
        const params = [];

        if (name) { updates.push('name = ?'); params.push(name.trim()); }
        if (phone !== undefined) { updates.push('phone = ?'); params.push(phone ? phone.trim() : null); }
        if (location !== undefined) { updates.push('location = ?'); params.push(location.trim()); }
        if (bio !== undefined) { updates.push('bio = ?'); params.push(bio.trim()); }
        if (avatar !== undefined) { updates.push('avatar = ?'); params.push(avatar.trim()); }

        if (updates.length === 0) {
            return res.status(400).json({ success: false, message: 'No profile details provided for update.' });
        }

        params.push(userId);
        await db.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);

        const [updated] = await db.query(
            'SELECT id, name, email, phone, location, avatar, bio, role FROM users WHERE id = ?',
            [userId]
        );

        return res.json({
            success: true,
            message: 'Profile updated successfully!',
            user: updated[0]
        });
    } catch (err) {
        console.error('[User updateProfile Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating profile.' });
    }
}

module.exports = {
    getProfile,
    updateProfile
};
