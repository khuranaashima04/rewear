const db = require('../config/db');

// Create Exchange Request
async function createExchange(req, res) {
    try {
        const requesterId = req.user.id;
        const { requestedItemId, offeredItemId, message } = req.body;

        if (!requestedItemId || !offeredItemId) {
            return res.status(400).json({
                success: false,
                message: 'Please choose both the item you want and an item from your wardrobe to swap.'
            });
        }

        if (parseInt(requestedItemId, 10) === parseInt(offeredItemId, 10)) {
            return res.status(400).json({
                success: false,
                message: 'You cannot exchange an item for itself.'
            });
        }

        // Fetch requested item
        const [requestedItems] = await db.query('SELECT * FROM items WHERE id = ?', [requestedItemId]);
        if (!requestedItems || requestedItems.length === 0) {
            return res.status(404).json({ success: false, message: 'Requested item not found.' });
        }
        const requestedItem = requestedItems[0];

        // Fetch offered item
        const [offeredItems] = await db.query('SELECT * FROM items WHERE id = ?', [offeredItemId]);
        if (!offeredItems || offeredItems.length === 0) {
            return res.status(404).json({ success: false, message: 'Offered item not found.' });
        }
        const offeredItem = offeredItems[0];

        // Validations
        if (requestedItem.user_id === requesterId) {
            return res.status(400).json({ success: false, message: 'You cannot request an exchange on your own item.' });
        }

        if (offeredItem.user_id !== requesterId) {
            return res.status(403).json({ success: false, message: 'You can only offer items from your own listed wardrobe.' });
        }

        if (requestedItem.status !== 'active') {
            return res.status(400).json({ success: false, message: 'The requested item is no longer available for exchange.' });
        }

        if (offeredItem.status !== 'active') {
            return res.status(400).json({ success: false, message: 'Your offered item is currently not active or already reserved.' });
        }

        // Check if pending request already exists for this exact pair
        const [existing] = await db.query(
            'SELECT id FROM exchange_requests WHERE requested_item_id = ? AND offered_item_id = ? AND status = "pending"',
            [requestedItemId, offeredItemId]
        );
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'You already have an open exchange request for this item.' });
        }

        // Insert request
        const [result] = await db.query(`
            INSERT INTO exchange_requests (
                requested_item_id, offered_item_id, requester_id, owner_id, message, status
            ) VALUES (?, ?, ?, ?, ?, 'pending')
        `, [
            requestedItemId,
            offeredItemId,
            requesterId,
            requestedItem.user_id,
            message ? message.trim() : null
        ]);

        // Send notification to Owner
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'exchange', 'New Swap Proposal! 🔄', ?, '/dashboard.html?tab=exchanges')
        `, [
            requestedItem.user_id,
            `${req.user.name} proposed an exchange: their "${offeredItem.title}" for your "${requestedItem.title}".`
        ]);

        return res.status(201).json({
            success: true,
            message: 'Exchange proposal submitted successfully! The owner has been notified.',
            exchangeId: result.insertId
        });
    } catch (err) {
        console.error('[Exchange createExchange Error]', err);
        return res.status(500).json({ success: false, message: 'Server error sending exchange request.' });
    }
}

// Get user sent exchanges
async function getSentExchanges(req, res) {
    try {
        const userId = req.user.id;

        const [exchanges] = await db.query(`
            SELECT 
                er.*,
                ri.title as requested_title,
                ri.size as requested_size,
                ri.brand as requested_brand,
                (SELECT image_url FROM item_images WHERE item_id = ri.id ORDER BY is_primary DESC, id ASC LIMIT 1) as requested_image,
                oi.title as offered_title,
                oi.size as offered_size,
                oi.brand as offered_brand,
                (SELECT image_url FROM item_images WHERE item_id = oi.id ORDER BY is_primary DESC, id ASC LIMIT 1) as offered_image,
                ow.name as owner_name,
                ow.email as owner_email,
                ow.location as owner_location
            FROM exchange_requests er
            JOIN items ri ON er.requested_item_id = ri.id
            JOIN items oi ON er.offered_item_id = oi.id
            JOIN users ow ON er.owner_id = ow.id
            WHERE er.requester_id = ?
            ORDER BY er.created_at DESC
        `, [userId]);

        return res.json({ success: true, exchanges });
    } catch (err) {
        console.error('[Exchange getSentExchanges Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving sent exchanges.' });
    }
}

// Get user received exchanges
async function getReceivedExchanges(req, res) {
    try {
        const userId = req.user.id;

        const [exchanges] = await db.query(`
            SELECT 
                er.*,
                ri.title as requested_title,
                ri.size as requested_size,
                ri.brand as requested_brand,
                (SELECT image_url FROM item_images WHERE item_id = ri.id ORDER BY is_primary DESC, id ASC LIMIT 1) as requested_image,
                oi.title as offered_title,
                oi.size as offered_size,
                oi.brand as offered_brand,
                (SELECT image_url FROM item_images WHERE item_id = oi.id ORDER BY is_primary DESC, id ASC LIMIT 1) as offered_image,
                req.name as requester_name,
                req.email as requester_email,
                req.location as requester_location
            FROM exchange_requests er
            JOIN items ri ON er.requested_item_id = ri.id
            JOIN items oi ON er.offered_item_id = oi.id
            JOIN users req ON er.requester_id = req.id
            WHERE er.owner_id = ?
            ORDER BY er.created_at DESC
        `, [userId]);

        return res.json({ success: true, exchanges });
    } catch (err) {
        console.error('[Exchange getReceivedExchanges Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving received exchanges.' });
    }
}

// Update exchange status (accept, reject, complete, cancel)
async function updateExchangeStatus(req, res) {
    try {
        const exchangeId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const validStatuses = ['accepted', 'rejected', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid exchange status.' });
        }

        const [exchanges] = await db.query(`
            SELECT er.*, ri.title as requested_title, oi.title as offered_title
            FROM exchange_requests er
            JOIN items ri ON er.requested_item_id = ri.id
            JOIN items oi ON er.offered_item_id = oi.id
            WHERE er.id = ?
        `, [exchangeId]);

        if (!exchanges || exchanges.length === 0) {
            return res.status(404).json({ success: false, message: 'Exchange request not found.' });
        }

        const exchange = exchanges[0];

        // Owner can accept or reject
        if ((status === 'accepted' || status === 'rejected') && exchange.owner_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Only the item owner can accept or reject this request.' });
        }

        // Either party or admin can mark completed or cancelled
        if ((status === 'completed' || status === 'cancelled') &&
            exchange.owner_id !== userId && exchange.requester_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        await db.query('UPDATE exchange_requests SET status = ? WHERE id = ?', [status, exchangeId]);

        // If completed, update both items to 'exchanged'
        if (status === 'completed') {
            await db.query("UPDATE items SET status = 'exchanged' WHERE id IN (?, ?)", [
                exchange.requested_item_id,
                exchange.offered_item_id
            ]);

            // Notify both users
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES 
                (?, 'exchange', 'Exchange Completed! 🎉', ?, '/dashboard.html?tab=exchanges'),
                (?, 'exchange', 'Exchange Completed! 🎉', ?, '/dashboard.html?tab=exchanges')
            `, [
                exchange.requester_id,
                `Your clothing swap ("${exchange.offered_title}" for "${exchange.requested_title}") is marked as completed!`,
                exchange.owner_id,
                `Your clothing swap ("${exchange.requested_title}" for "${exchange.offered_title}") is marked as completed!`
            ]);
        } else if (status === 'accepted') {
            // Mark items as reserved
            await db.query("UPDATE items SET status = 'reserved' WHERE id IN (?, ?)", [
                exchange.requested_item_id,
                exchange.offered_item_id
            ]);

            // Notify requester
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES (?, 'exchange', 'Exchange Accepted! ✨', ?, '/dashboard.html?tab=exchanges')
            `, [
                exchange.requester_id,
                `Great news! Your exchange request for "${exchange.requested_title}" was accepted. Coordinate shipping or meetup.`
            ]);
        } else if (status === 'rejected') {
            await db.query(`
                INSERT INTO notifications (user_id, type, title, message, link)
                VALUES (?, 'exchange', 'Exchange Declined', ?, '/dashboard.html?tab=exchanges')
            `, [
                exchange.requester_id,
                `Your exchange proposal for "${exchange.requested_title}" was declined by the owner.`
            ]);
        }

        return res.json({
            success: true,
            message: `Exchange proposal status updated to ${status}.`
        });
    } catch (err) {
        console.error('[Exchange updateExchangeStatus Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating exchange status.' });
    }
}

module.exports = {
    createExchange,
    getSentExchanges,
    getReceivedExchanges,
    updateExchangeStatus
};
