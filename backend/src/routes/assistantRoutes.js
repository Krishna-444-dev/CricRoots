const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getStatus, ask } = require('../controllers/assistantController');

router.get('/status', protect, getStatus);
router.post('/ask', protect, ask);

module.exports = router;
