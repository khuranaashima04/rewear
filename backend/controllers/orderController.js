const db = require('../config/db');

// Create Order (Simulated checkout for listed Sell item)
async function createOrder(req, res) {
    try {
        const buyerId = req.user.id;
        const { itemId, shippingAddress, shippingCity, shippingPostalCode, paymentMethod = 'Simulated Eco-Pay' } = req.body;

        if (!itemId || !shippingAddress || !shippingCity || !shippingPostalCode) {
            return res.status(400).json({
                success: false,
                message: 'Please provide full shipping details.'
            });
        }

        // Fetch item
        const [items] = await db.query('SELECT * FROM items WHERE id = ?', [itemId]);
        if (!items || items.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found.' });
        }

        const item = items[0];

        if (item.status !== 'active') {
            return res.status(400).json({ success: false, message: 'This item is no longer available for purchase.' });
        }

        if (item.listing_type !== 'sell') {
            return res.status(400).json({ success: false, message: 'This item is not listed for direct sale.' });
        }

        if (item.user_id === buyerId) {
            return res.status(400).json({ success: false, message: 'You cannot purchase your own clothing listing.' });
        }

        const orderNumber = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;

        // Insert order
        const [orderResult] = await db.query(`
            INSERT INTO orders (
                order_number, item_id, buyer_id, seller_id, amount,
                shipping_address, shipping_city, shipping_postal_code,
                payment_method, payment_status, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', 'confirmed')
        `, [
            orderNumber,
            item.id,
            buyerId,
            item.user_id,
            item.price,
            shippingAddress.trim(),
            shippingCity.trim(),
            shippingPostalCode.trim(),
            paymentMethod
        ]);

        // Update item status to sold
        await db.query("UPDATE items SET status = 'sold' WHERE id = ?", [item.id]);

        // Send notification to Seller
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'order', 'Clothing Sold! 🎉', ?, '/dashboard.html?tab=orders')
        `, [
            item.user_id,
            `${req.user.name} just purchased your item "${item.title}" for $${item.price.toFixed(2)}. Order #${orderNumber}.`
        ]);

        // Send notification to Buyer
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'order', 'Order Confirmed! 🌿', ?, '/dashboard.html?tab=orders')
        `, [
            buyerId,
            `Your purchase of "${item.title}" (${orderNumber}) is confirmed! Thank you for choosing pre-loved fashion.`
        ]);

        return res.status(201).json({
            success: true,
            message: 'Order placed successfully! Thank you for supporting circular fashion.',
            orderId: orderResult.insertId,
            orderNumber
        });
    } catch (err) {
        console.error('[Order createOrder Error]', err);
        return res.status(500).json({ success: false, message: 'Server error processing order.' });
    }
}

// Get user orders (both purchases and sales)
async function getOrders(req, res) {
    try {
        const userId = req.user.id;

        // Purchases
        const [purchases] = await db.query(`
            SELECT 
                o.*,
                i.title as item_title,
                i.brand as item_brand,
                i.size as item_size,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as item_image,
                s.name as seller_name,
                s.email as seller_email
            FROM orders o
            JOIN items i ON o.item_id = i.id
            JOIN users s ON o.seller_id = s.id
            WHERE o.buyer_id = ?
            ORDER BY o.created_at DESC
        `, [userId]);

        // Sales
        const [sales] = await db.query(`
            SELECT 
                o.*,
                i.title as item_title,
                i.brand as item_brand,
                i.size as item_size,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as item_image,
                b.name as buyer_name,
                b.email as buyer_email,
                b.location as buyer_location
            FROM orders o
            JOIN items i ON o.item_id = i.id
            JOIN users b ON o.buyer_id = b.id
            WHERE o.seller_id = ?
            ORDER BY o.created_at DESC
        `, [userId]);

        return res.json({
            success: true,
            purchases,
            sales
        });
    } catch (err) {
        console.error('[Order getOrders Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving orders.' });
    }
}

// Get single order details
async function getOrderById(req, res) {
    try {
        const orderId = parseInt(req.params.id, 10);
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const [orders] = await db.query(`
            SELECT 
                o.*,
                i.title as item_title,
                i.price as item_price,
                i.brand as item_brand,
                i.size as item_size,
                (SELECT image_url FROM item_images WHERE item_id = i.id ORDER BY is_primary DESC, id ASC LIMIT 1) as item_image,
                b.name as buyer_name,
                b.email as buyer_email,
                s.name as seller_name,
                s.email as seller_email
            FROM orders o
            JOIN items i ON o.item_id = i.id
            JOIN users b ON o.buyer_id = b.id
            JOIN users s ON o.seller_id = s.id
            WHERE o.id = ?
        `, [orderId]);

        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = orders[0];

        if (order.buyer_id !== userId && order.seller_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Access denied.' });
        }

        return res.json({ success: true, order });
    } catch (err) {
        console.error('[Order getOrderById Error]', err);
        return res.status(500).json({ success: false, message: 'Server error retrieving order.' });
    }
}

// Update order status (by seller or admin)
async function updateOrderStatus(req, res) {
    try {
        const orderId = parseInt(req.params.id, 10);
        const { status } = req.body;
        const userId = req.user.id;
        const isAdmin = req.user.role === 'admin';

        const validStatuses = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid order status specified.' });
        }

        const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = orders[0];

        if (order.seller_id !== userId && !isAdmin) {
            return res.status(403).json({ success: false, message: 'Only the seller or an administrator can update this order status.' });
        }

        await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, orderId]);

        // If cancelled, revert item back to active
        if (status === 'cancelled') {
            await db.query("UPDATE items SET status = 'active' WHERE id = ?", [order.item_id]);
        }

        // Notify buyer of status update
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'order', 'Order Status Updated', ?, '/dashboard.html?tab=orders')
        `, [
            order.buyer_id,
            `Order #${order.order_number} status was updated to: ${status.toUpperCase()}.`
        ]);

        return res.json({
            success: true,
            message: `Order status updated to ${status}.`
        });
    } catch (err) {
        console.error('[Order updateOrderStatus Error]', err);
        return res.status(500).json({ success: false, message: 'Server error updating order status.' });
    }
}

// Cancel order (by buyer if still pending/confirmed)
async function cancelOrder(req, res) {
    try {
        const orderId = parseInt(req.params.id, 10);
        const userId = req.user.id;

        const [orders] = await db.query('SELECT * FROM orders WHERE id = ?', [orderId]);
        if (!orders || orders.length === 0) {
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        const order = orders[0];

        if (order.buyer_id !== userId) {
            return res.status(403).json({ success: false, message: 'You can only cancel your own orders.' });
        }

        if (order.status !== 'pending' && order.status !== 'confirmed') {
            return res.status(400).json({
                success: false,
                message: `Order cannot be cancelled because it is already marked as ${order.status}.`
            });
        }

        await db.query("UPDATE orders SET status = 'cancelled' WHERE id = ?", [orderId]);
        await db.query("UPDATE items SET status = 'active' WHERE id = ?", [order.item_id]);

        // Notify seller
        await db.query(`
            INSERT INTO notifications (user_id, type, title, message, link)
            VALUES (?, 'order', 'Order Cancelled', ?, '/dashboard.html?tab=orders')
        `, [
            order.seller_id,
            `Order #${order.order_number} was cancelled by the buyer. The item is now back active in your listings.`
        ]);

        return res.json({
            success: true,
            message: 'Your order has been cancelled and the item returned to active listings.'
        });
    } catch (err) {
        console.error('[Order cancelOrder Error]', err);
        return res.status(500).json({ success: false, message: 'Server error cancelling order.' });
    }
}

module.exports = {
    createOrder,
    getOrders,
    getOrderById,
    updateOrderStatus,
    cancelOrder
};
