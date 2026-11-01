const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireAdmin } = require('../middleware/authMiddleware');

// User report endpoint (Any logged in user can report a listing)
router.post('/reports', authenticateToken, adminController.createReport);

// Admin-only endpoints
router.use(authenticateToken);
router.use(requireAdmin);

router.get('/dashboard', adminController.getDashboardStats);
router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.toggleUserRole);
router.get('/listings', adminController.getListings);
router.delete('/listings/:id', adminController.deleteListing);
router.get('/reports', adminController.getReports);
router.put('/reports/:id/status', adminController.updateReportStatus);

module.exports = router;
