const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') });
dotenv.config({ path: path.join(__dirname, '../.env') });

const db = require('./config/db');

// Route imports
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const itemRoutes = require('./routes/itemRoutes');
const orderRoutes = require('./routes/orderRoutes');
const exchangeRoutes = require('./routes/exchangeRoutes');
const donationRoutes = require('./routes/donationRoutes');
const wishlistRoutes = require('./routes/wishlistRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const adminRoutes = require('./routes/adminRoutes');
const sustainabilityRoutes = require('./routes/sustainabilityRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security and utility middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve uploaded clothing images
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve frontend static assets
app.use(express.static(path.join(__dirname, '../frontend')));

// Health Check API
app.get('/api/health', (req, res) => {
    res.json({
        status: 'UP',
        service: 'ReWear Sustainable Fashion API',
        timestamp: new Date().toISOString(),
        database: db.getDriver()
    });
});

// REST API Endpoints
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/items', itemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sustainability', sustainabilityRoutes);

// Fallback for SPA/HTML navigation: serve index.html for root or unknown HTML requests
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: `API endpoint '${req.originalUrl}' not found.`
    });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    console.error('[Unhandled Error]', err.stack || err);

    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: 'Image file size cannot exceed 5MB.' });
        }
        return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
    }

    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'An unexpected server error occurred.'
    });
});

// Global Process & Error Handlers
process.on('uncaughtException', (err) => {
    console.error('[CRITICAL] Uncaught Exception:', err.stack || err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[CRITICAL] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('exit', (code) => {
    console.log(`[PROCESS EXIT] Node process exiting with code: ${code}`);
});

process.on('SIGINT', () => {
    console.log('[PROCESS SIGNAL] SIGINT received, gracefully closing...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('[PROCESS SIGNAL] SIGTERM received, gracefully closing...');
    process.exit(0);
});

// Resilient Port Listener with automatic fallback
function listenResilient(targetPort) {
    return new Promise((resolve, reject) => {
        const s = app.listen(targetPort, '0.0.0.0', () => {
            console.log(`=======================================================`);
            console.log(`🌱 ReWear Server running at: http://localhost:${targetPort}`);
            console.log(`   Database Driver: [${db.getDriver().toUpperCase()}]`);
            console.log(`   Frontend served from: /frontend`);
            console.log(`=======================================================`);
            resolve({ server: s, port: targetPort });
        });

        s.on('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                console.warn(`[PORT WARNING] Port ${targetPort} is occupied by another process.`);
                if (targetPort !== 5050) {
                    console.log(`[PORT FALLBACK] Attempting fallback to port 5050...`);
                    listenResilient(5050).then(resolve).catch(reject);
                } else {
                    reject(err);
                }
            } else {
                reject(err);
            }
        });
    });
}

// Start Server after Database Initialization
async function startServer() {
    try {
        await db.initDatabase();

        const { port } = await listenResilient(PORT);

        // Keep-alive heartbeat interval
        setInterval(() => {
            // Heartbeat
        }, 1000 * 60 * 60);

    } catch (err) {
        console.error('Failed to start ReWear server:', err);
        process.exit(1);
    }
}

startServer();
