const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'rewear_super_secret_jwt_key_2026_sustainable_fashion';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// Generate JWT Helper
function generateToken(user) {
    return jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

// User Registration
async function register(req, res) {
    try {
        const { name, email, phone, password, confirmPassword, location } = req.body;

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Passwords do not match.'
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user already exists
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);
        if (existing && existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email address already exists. Please log in.'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Insert new user
        const defaultAvatar = 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80';
        const [result] = await db.query(
            `INSERT INTO users (name, email, phone, password, location, avatar, role) VALUES (?, ?, ?, ?, ?, ?, 'user')`,
            [name.trim(), normalizedEmail, phone || null, hashedPassword, location || 'New Delhi, India', defaultAvatar]
        );

        const newUserId = result.insertId;

        // Create welcome notification
        await db.query(
            `INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)`,
            [
                newUserId,
                'system',
                'Welcome to ReWear! 🌱',
                'Thank you for joining our circular fashion movement. Explore listings or list your unused clothes.',
                '/explore.html'
            ]
        );

        const user = {
            id: newUserId,
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || null,
            location: location || 'New Delhi, India',
            avatar: defaultAvatar,
            role: 'user'
        };

        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: 'Registration successful! Welcome to ReWear.',
            token,
            user
        });
    } catch (err) {
        console.error('[Auth Register Error]', err);
        return res.status(500).json({
            success: false,
            message: 'Server error during registration. Please try again.'
        });
    }
}

// User Login
async function login(req, res) {
    try {
        const { email, password } = req.body;
        const normalizedEmail = email.toLowerCase().trim();

        const [users] = await db.query(
            'SELECT id, name, email, phone, password, location, avatar, bio, role FROM users WHERE email = ?',
            [normalizedEmail]
        );

        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email address or password.'
            });
        }

        const user = users[0];

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email address or password.'
            });
        }

        // Strip password before returning
        delete user.password;

        const token = generateToken(user);

        return res.json({
            success: true,
            message: 'Logged in successfully.',
            token,
            user
        });
    } catch (err) {
        console.error('[Auth Login Error]', err);
        return res.status(500).json({
            success: false,
            message: 'Server error during login. Please try again.'
        });
    }
}

// Get Authenticated User
async function getMe(req, res) {
    try {
        const [users] = await db.query(
            'SELECT id, name, email, phone, location, avatar, bio, role, created_at FROM users WHERE id = ?',
            [req.user.id]
        );

        if (!users || users.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User profile not found.'
            });
        }

        return res.json({
            success: true,
            user: users[0]
        });
    } catch (err) {
        console.error('[Auth Me Error]', err);
        return res.status(500).json({
            success: false,
            message: 'Server error fetching user details.'
        });
    }
}

module.exports = {
    register,
    login,
    getMe
};
