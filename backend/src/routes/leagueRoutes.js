const express = require('express');
const router = express.Router();
const {
  createLeague,
  getAllLeagues,
  getMyLeagues,
  getLeague,
  updateLeague,
  deleteLeague
} = require('../controllers/leagueController');
const { protect } = require('../middleware/auth');

// Public routes
// GET /:id already includes this league's tournaments in the response (see getLeague), so a
// separate /:id/tournaments endpoint would be redundant - skipped on purpose.
// /mine must be registered before /:id, or Express would match it as {id: 'mine'} instead.
router.get('/', getAllLeagues);
router.get('/mine', protect, getMyLeagues);
router.get('/:id', getLeague);

// Protected routes
router.post('/', protect, createLeague);
router.put('/:id', protect, updateLeague);
router.delete('/:id', protect, deleteLeague);

module.exports = router;
