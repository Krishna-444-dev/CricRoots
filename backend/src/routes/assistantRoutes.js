const express = require('express');
const { validateObjectIdParams } = require('../middleware/validateObjectId');
const router = express.Router();

// 400 instead of a 500 + raw CastError when a route param is not an ObjectId.
validateObjectIdParams(router);
const { protect } = require('../middleware/auth');
const { getStatus, ask } = require('../controllers/assistantController');

router.get('/status', protect, getStatus);
router.post('/ask', protect, ask);

module.exports = router;
