const express = require('express');
const router = express.Router();
const sustainabilityController = require('../controllers/sustainabilityController');

router.get('/stats', sustainabilityController.getSustainabilityStats);

module.exports = router;
