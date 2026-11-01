const express = require('express');
const router = express.Router();
const exchangeController = require('../controllers/exchangeController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.post('/', exchangeController.createExchange);
router.get('/sent', exchangeController.getSentExchanges);
router.get('/received', exchangeController.getReceivedExchanges);
router.put('/:id/status', exchangeController.updateExchangeStatus);

module.exports = router;
