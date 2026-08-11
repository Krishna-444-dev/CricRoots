const Prediction = require('../models/Prediction');
const Match = require('../models/Match');
const User = require('../models/User');

// @desc    Submit (or update, before the match locks) a match-winner prediction, with an
//          optional Man-of-the-Match bonus guess
// @route   POST /api/predictions
// @access  Private
exports.submitPrediction = async (req, res) => {
  try {
    const { matchId, predictedWinnerId, predictedMotmId } = req.body;

    if (!matchId || !predictedWinnerId) {
      return res.status(400).json({
        success: false,
        message: 'Please provide matchId and predictedWinnerId'
      });
    }

    const match = await Match.findById(matchId);
    if (!match) {
      return res.status(404).json({
        success: false,
        message: 'Match not found'
      });
    }

    // Predictions lock once a match goes Live - allowing them after the toss/start would let
    // someone "predict" with information a genuine pre-match guess wouldn't have.
    if (match.status !== 'Scheduled') {
      return res.status(400).json({
        success: false,
        message: 'Predictions are only open before a match starts'
      });
    }

    const team1Id = match.team1.toString();
    const team2Id = match.team2.toString();
    if (![team1Id, team2Id].includes(predictedWinnerId)) {
      return res.status(400).json({
        success: false,
        message: 'predictedWinnerId must be one of the two teams playing'
      });
    }

    const prediction = await Prediction.findOneAndUpdate(
      { user: req.user.id, match: matchId },
      {
        user: req.user.id,
        match: matchId,
        predictedWinner: predictedWinnerId,
        predictedMotm: predictedMotmId || null,
        status: 'pending',
        points: 0,
        wonOnWinner: false,
        wonOnMotm: false
      },
      { upsert: true, new: true, runValidators: true }
    );

    res.status(200).json({ success: true, prediction });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the current user's prediction for a match, plus how the community split their
//          picks (social-proof element, no auth required to see the split)
// @route   GET /api/predictions/match/:matchId
// @access  Public (mine is null if unauthenticated)
exports.getMatchPrediction = async (req, res) => {
  try {
    const { matchId } = req.params;

    const all = await Prediction.find({ match: matchId });
    const communitySplit = all.reduce((acc, p) => {
      const key = p.predictedWinner.toString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    let mine = null;
    if (req.user) {
      mine = all.find((p) => p.user.toString() === req.user.id) || null;
    }

    res.status(200).json({
      success: true,
      mine,
      totalPredictions: all.length,
      communitySplit
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the current user's full prediction history and lifetime points
// @route   GET /api/predictions/me
// @access  Private
exports.getMyPredictions = async (req, res) => {
  try {
    const predictions = await Prediction.find({ user: req.user.id })
      .populate({ path: 'match', select: 'title matchType status venue scheduledDate team1 team2 result', populate: [{ path: 'team1', select: 'name' }, { path: 'team2', select: 'name' }] })
      .populate('predictedWinner', 'name')
      .sort({ createdAt: -1 });

    const totalPoints = predictions.reduce((sum, p) => sum + p.points, 0);

    res.status(200).json({ success: true, predictions, totalPoints });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Global points leaderboard across all settled predictions
// @route   GET /api/predictions/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

    const rows = await Prediction.aggregate([
      { $match: { status: 'settled' } },
      {
        $group: {
          _id: '$user',
          totalPoints: { $sum: '$points' },
          correctPredictions: { $sum: { $cond: ['$wonOnWinner', 1, 0] } },
          totalPredictions: { $sum: 1 }
        }
      },
      { $sort: { totalPoints: -1 } },
      { $limit: limit }
    ]);

    const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name');
    const nameById = new Map(users.map((u) => [u._id.toString(), u.name]));

    const leaderboard = rows.map((r, index) => ({
      rank: index + 1,
      userId: r._id,
      name: nameById.get(r._id.toString()) || 'Unknown',
      totalPoints: r.totalPoints,
      correctPredictions: r.correctPredictions,
      totalPredictions: r.totalPredictions
    }));

    res.status(200).json({ success: true, leaderboard });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
