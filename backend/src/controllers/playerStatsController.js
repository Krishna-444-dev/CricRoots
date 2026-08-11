const Player = require('../models/Player');
const PlayerStats = require('../models/PlayerStats');
const tendencyAnalytics = require('../services/tendencyAnalytics');

async function toPlayerSummary(playerId) {
  const player = await Player.findById(playerId).populate('user', 'name');
  if (!player) return null;
  return {
    _id: player._id,
    name: player.user?.name ?? 'Unknown',
    specialization: player.specialization
  };
}

// @desc    Get a player's career statistics, computed live from completed matches
// @route   GET /api/player-stats/:playerId
// @access  Public
exports.getPlayerStats = async (req, res) => {
  try {
    const player = await toPlayerSummary(req.params.playerId);
    if (!player) {
      return res.status(404).json({
        success: false,
        message: 'Player not found'
      });
    }

    const [careerStats, wagonWheel] = await Promise.all([
      tendencyAnalytics.getCareerStats(req.params.playerId),
      tendencyAnalytics.getZoneBreakdown(req.params.playerId)
    ]);
    // Pass the already-computed careerStats through so getAchievements doesn't
    // re-run the same career-stats match query a second time.
    const achievements = await tendencyAnalytics.getAchievements(req.params.playerId, careerStats);

    res.status(200).json({
      success: true,
      stats: {
        player,
        ...careerStats,
        recentForm: [],
        wagonWheel: wagonWheel.zones,
        achievements
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get all (legacy, manually-entered) player statistics with filters
// @route   GET /api/player-stats
// @access  Public
exports.getAllPlayerStats = async (req, res) => {
  try {
    const { sortBy = 'batting.average', order = -1, limit = 20, skip = 0 } = req.query;

    const stats = await PlayerStats.find()
      .populate('player')
      .sort({ [sortBy]: parseInt(order) })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await PlayerStats.countDocuments();

    res.status(200).json({
      success: true,
      count: stats.length,
      total,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get top batsmen, ranked by career batting average
// @route   GET /api/player-stats/rankings/batsmen
// @access  Public
exports.getTopBatsmen = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const rows = await tendencyAnalytics.getBattingLeaderboard(parseInt(limit));

    const batsmen = await Promise.all(rows.map(async (r) => {
      const player = await toPlayerSummary(r._id);
      if (!player) return null;
      return {
        player,
        batting: {
          matches: r.matches,
          runs: r.runs,
          highestScore: r.highestScore,
          average: Math.round(r.average * 100) / 100,
          strikeRate: Math.round(r.strikeRate * 100) / 100,
          centuries: 0
        }
      };
    }));

    const filtered = batsmen.filter(Boolean);
    res.status(200).json({
      success: true,
      count: filtered.length,
      batsmen: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get top bowlers, ranked by career bowling average
// @route   GET /api/player-stats/rankings/bowlers
// @access  Public
exports.getTopBowlers = async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const rows = await tendencyAnalytics.getBowlingLeaderboard(parseInt(limit));

    const bowlers = await Promise.all(rows.map(async (r) => {
      const player = await toPlayerSummary(r._id);
      if (!player) return null;
      return {
        player,
        bowling: {
          matches: r.matches,
          wickets: r.wickets,
          average: Math.round(r.average * 100) / 100,
          economyRate: Math.round(r.economyRate * 100) / 100
        }
      };
    }));

    const filtered = bowlers.filter(Boolean);
    res.status(200).json({
      success: true,
      count: filtered.length,
      bowlers: filtered
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get player performance trends
// @route   GET /api/player-stats/:playerId/trends
// @access  Public
exports.getPlayerTrends = async (req, res) => {
  try {
    const playerStats = await PlayerStats.findOne({ player: req.params.playerId });

    if (!playerStats) {
      return res.status(404).json({
        success: false,
        message: 'Player statistics not found'
      });
    }

    res.status(200).json({
      success: true,
      trends: {
        recentForm: playerStats.recentForm,
        batsmanTrend: playerStats.trends.batsmanTrend,
        bowlerTrend: playerStats.trends.bowlerTrend,
        achievements: playerStats.achievements
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update player statistics after match
// @route   POST /api/player-stats/:playerId/update
// @access  Private
exports.updatePlayerStats = async (req, res) => {
  try {
    const { matchData } = req.body;

    let playerStats = await PlayerStats.findOne({ player: req.params.playerId });

    if (!playerStats) {
      // Create new stats if doesn't exist
      playerStats = await PlayerStats.create({
        player: req.params.playerId
      });
    }

    // Update batting stats
    if (matchData.batting) {
      playerStats.batting.matches += 1;
      playerStats.batting.innings += 1;
      playerStats.batting.runs += matchData.batting.runs || 0;
      playerStats.batting.fours += matchData.batting.fours || 0;
      playerStats.batting.sixes += matchData.batting.sixes || 0;

      if (matchData.batting.runs > playerStats.batting.highestScore) {
        playerStats.batting.highestScore = matchData.batting.runs;
      }

      if (matchData.batting.runs === 0) {
        playerStats.batting.ducks += 1;
      }

      if (matchData.batting.runs >= 100) {
        playerStats.batting.centuries += 1;
      } else if (matchData.batting.runs >= 50) {
        playerStats.batting.halfCenturies += 1;
      }

      playerStats.calculateBattingAverage();
    }

    // Update bowling stats
    if (matchData.bowling) {
      playerStats.bowling.matches += 1;
      playerStats.bowling.innings += 1;
      playerStats.bowling.balls += matchData.bowling.balls || 0;
      playerStats.bowling.runs += matchData.bowling.runs || 0;
      playerStats.bowling.wickets += matchData.bowling.wickets || 0;

      playerStats.calculateBowlingAverage();
      playerStats.calculateEconomyRate();
    }

    // Update fielding stats
    if (matchData.fielding) {
      playerStats.fielding.matches += 1;
      playerStats.fielding.catches += matchData.fielding.catches || 0;
      playerStats.fielding.runOuts += matchData.fielding.runOuts || 0;
      playerStats.fielding.stumpings += matchData.fielding.stumpings || 0;
    }

    // Add match performance
    playerStats.addMatchPerformance(matchData);

    await playerStats.save();

    res.status(200).json({
      success: true,
      message: 'Player statistics updated',
      stats: playerStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get player comparison
// @route   GET /api/player-stats/compare
// @access  Public
exports.comparePlayerStats = async (req, res) => {
  try {
    const { playerIds } = req.query;

    if (!playerIds || playerIds.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'At least 2 player IDs required for comparison'
      });
    }

    const playerArray = Array.isArray(playerIds) ? playerIds : [playerIds];
    const stats = await PlayerStats.find({ player: { $in: playerArray } })
      .populate('player');

    res.status(200).json({
      success: true,
      count: stats.length,
      comparison: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
