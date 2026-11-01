const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Categories
router.get('/categories', itemController.getCategories);

// My listings
router.get('/my-listings', authenticateToken, itemController.getMyListings);

// Public/Optional auth exploration
router.get('/', optionalAuth, itemController.getItems);
router.get('/:id', optionalAuth, itemController.getItemById);

// Protected item CRUD
router.post('/', authenticateToken, upload.array('images', 5), itemController.createItem);
router.put('/:id', authenticateToken, upload.array('images', 5), itemController.updateItem);
router.delete('/:id', authenticateToken, itemController.deleteItem);

module.exports = router;
