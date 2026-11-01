const express = require('express');
const router = express.Router();
const donationController = require('../controllers/donationController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');

// Browse donations (public)
router.get('/', optionalAuth, donationController.getDonations);

// Protected actions
router.post('/', authenticateToken, donationController.createDonationRequest);
router.get('/requests', authenticateToken, donationController.getDonationRequests);
router.put('/:id/status', authenticateToken, donationController.updateDonationStatus);

module.exports = router;
