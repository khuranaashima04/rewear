const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'rewear_super_secret_jwt_key_2026_sustainable_fashion';

// Middleware to authenticate JWT token
async function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: 'Access denied. No authentication token provided.'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Fetch current user from database
        const [users] = await db.query('SELECT id, name, email, role, location, avatar FROM users WHERE id = ?', [decoded.id]);
        
        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid session. User account no longer exists.'
            });
        }

        req.user = users[0];
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            message: 'Invalid or expired authentication token.'
        });
    }
}

// Optional authentication middleware (for public endpoints that customize for logged-in users)
async function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const [users] = await db.query('SELECT id, name, email, role, location, avatar FROM users WHERE id = ?', [decoded.id]);
        req.user = users.length > 0 ? users[0] : null;
    } catch (err) {
        req.user = null;
    }
    next();
}

// Middleware to verify admin role
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Administrator privileges required.'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requireAdmin
};
