const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { register, login, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Login/register are the classic brute-force/credential-stuffing/spam-registration targets -
// scoped to just these two routes rather than applied blanket across the API, so it never
// interferes with legitimate high-frequency usage elsewhere (live-scoring polling, the
// notification unread-count check, etc.). 20 attempts per 15 minutes per IP is generous enough
// for a real user who fat-fingers a password a few times, tight enough to make credential
// stuffing impractical.
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts - please try again in a few minutes.' }
});

// Public routes
router.post('/register', authRateLimit, register);
router.post('/login', authRateLimit, login);

// Protected routes
router.get('/me', protect, getMe);

module.exports = router;
