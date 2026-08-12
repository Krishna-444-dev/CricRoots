const Player = require('../models/Player');
const Team = require('../models/Team');
const tendencyAnalytics = require('../services/tendencyAnalytics');
const { blendWithPrior } = require('../utils/statUtils');

const MIN_BALLS_FOR_OWN_DATA = 6;

/**
 * Picks which data source to base a recommendation on: the player's own tagged
 * balls if there are enough of them, otherwise the wider pool (all tagged balls
 * across all matches), otherwise neither - callers fall back to static generic
 * advice rather than presenting fake-precision numbers built from zero real balls.
 */
function resolveSource(individual, pool, minBalls = MIN_BALLS_FOR_OWN_DATA) {
  if (individual.totalBalls >= minBalls) return { source: 'own-data', data: individual, sampleSize: individual.totalBalls };
  if (pool.totalBalls >= minBalls) return { source: 'pool-data', data: pool, sampleSize: pool.totalBalls };
  return { source: 'none', data: null, sampleSize: 0 };
}

// @desc    Shot advice for a batsman: which zones they score best in
// @route   GET /api/insights/batsman/:playerId/shot-advice
// @access  Public
exports.getShotAdvice = async (req, res) => {
  try {
    const { playerId } = req.params;
    const [individual, pool] = await Promise.all([
      tendencyAnalytics.getZoneBreakdown(playerId),
      tendencyAnalytics.getZoneBreakdown(null)
    ]);

    const resolved = resolveSource(individual, pool);

    if (resolved.source === 'none') {
      return res.status(200).json({
        success: true,
        source: 'generic',
        sampleSize: 0,
        message: 'Not enough tagged ball data yet to give personalized shot advice. Generic tip: focus on playing straight (mid-on/mid-off) early, and look to score through the areas where you feel most balanced before playing across the line.'
      });
    }

    const topZones = [...resolved.data.zones].sort((a, b) => b.runsPercent - a.runsPercent).slice(0, 3);

    res.status(200).json({
      success: true,
      source: resolved.source,
      sampleSize: resolved.sampleSize,
      confidence: resolved.sampleSize >= 40 ? 'high' : resolved.sampleSize >= 15 ? 'medium' : 'low',
      strongZones: topZones,
      message: resolved.source === 'own-data'
        ? `Based on your own ${resolved.sampleSize} tagged balls, you score best through ${topZones.map(z => z.zone).join(', ')}. Look to target these areas more deliberately.`
        : `Not enough of your own data yet (using the wider player pool, ${resolved.sampleSize} balls). Balanced club-level batsmen tend to score well through ${topZones.map(z => z.zone).join(', ')} - a reasonable starting point until your own numbers build up.`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bowling plan vs a specific batsman: which line/length dismisses them most
// @route   GET /api/insights/batsman/:playerId/bowling-plan
// @access  Public
exports.getBowlingPlan = async (req, res) => {
  try {
    const { playerId } = req.params;
    const [individual, pool] = await Promise.all([
      tendencyAnalytics.getBatsmanLineLengthBreakdown(playerId),
      tendencyAnalytics.getBatsmanLineLengthBreakdown(null)
    ]);

    const resolved = resolveSource(individual, pool);

    if (resolved.source === 'none') {
      return res.status(200).json({
        success: true,
        source: 'generic',
        sampleSize: 0,
        message: 'Not enough tagged delivery data yet for a specific bowling plan. Generic tip: a consistent good-length line around off stump dismisses more club-level batsmen than any other single delivery - start there and adjust once you see how the batsman is playing.'
      });
    }

    // Rank by dismissal rate (weakest zones), require at least 2 balls in a bucket
    // so a single fluke wicket off one ball doesn't dominate the recommendation.
    const weakBuckets = resolved.data.buckets
      .filter(b => b.balls >= 2)
      .sort((a, b) => b.dismissalRate - a.dismissalRate || a.strikeRate - b.strikeRate)
      .slice(0, 3);

    res.status(200).json({
      success: true,
      source: resolved.source,
      sampleSize: resolved.sampleSize,
      confidence: resolved.sampleSize >= 40 ? 'high' : resolved.sampleSize >= 15 ? 'medium' : 'low',
      targetBuckets: weakBuckets,
      message: weakBuckets.length > 0
        ? `${resolved.source === 'own-data' ? "This batsman's" : "Similar batsmen's"} weakest zone: ${weakBuckets[0].length} ${weakBuckets[0].line} (${weakBuckets[0].dismissalRate}% dismissal rate over ${weakBuckets[0].balls} balls). Build the over around that line and length.`
        : 'No single line/length stands out yet with enough balls to be confident - keep tagging deliveries to sharpen this plan.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Fielding placement recommendation for a specific batsman
// @route   GET /api/insights/batsman/:playerId/fielding-plan
// @access  Public
exports.getFieldingPlan = async (req, res) => {
  try {
    const { playerId } = req.params;
    const [individual, pool] = await Promise.all([
      tendencyAnalytics.getZoneBreakdown(playerId),
      tendencyAnalytics.getZoneBreakdown(null)
    ]);

    const resolved = resolveSource(individual, pool);

    if (resolved.source === 'none') {
      return res.status(200).json({
        success: true,
        source: 'generic',
        sampleSize: 0,
        message: 'Not enough tagged shot data yet for a personalized field. Generic tip: a balanced field with a slightly stronger off-side presence covers most club-level batsmen reasonably well until you have real data on this player.'
      });
    }

    const topZones = [...resolved.data.zones].sort((a, b) => b.runsPercent - a.runsPercent).slice(0, 3);

    res.status(200).json({
      success: true,
      source: resolved.source,
      sampleSize: resolved.sampleSize,
      confidence: resolved.sampleSize >= 40 ? 'high' : resolved.sampleSize >= 15 ? 'medium' : 'low',
      recommendedZones: topZones,
      message: topZones.length > 0
        ? `Stack fielders toward ${topZones.map(z => z.zone).join(' and ')} - that's where ${resolved.source === 'own-data' ? 'this batsman' : 'similar batsmen'} scores ${topZones[0].runsPercent}%+ of their runs.`
        : 'No dominant scoring zone yet with enough data to recommend a specific field.'
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Bowling plan for a SPECIFIC batter-vs-bowler matchup, blended through a
//          four-level backoff chain (exact matchup -> batter vs bowler-archetype ->
//          archetype vs archetype -> global) so a real recommendation is possible
//          even with 0-15 direct balls between these two specific players - the
//          single-player-only getBowlingPlan above can't do this since it never
//          knows who's actually bowling.
// @route   GET /api/insights/matchup/:batsmanId/:bowlerId/bowling-plan
// @access  Public
exports.getMatchupPlan = async (req, res) => {
  try {
    const { batsmanId, bowlerId } = req.params;
    const plan = await tendencyAnalytics.getMatchupPlan(batsmanId, bowlerId);

    if (!plan) {
      return res.status(404).json({ success: false, message: 'Batsman or bowler not found' });
    }

    const actionable = plan.buckets.filter(b => b.confidence !== 'none' && b.blendedDismissalRate !== null);

    if (actionable.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'generic',
        directMatchupBalls: 0,
        message: 'No tagged delivery data anywhere yet for either player - too early for even an archetype-level plan. Generic tip: a consistent good-length line around off stump is the safest default opening plan.'
      });
    }

    const top = actionable.slice(0, 3);

    res.status(200).json({
      success: true,
      source: plan.directMatchupBalls >= 6 ? 'own-matchup-data' : 'blended',
      directMatchupBalls: plan.directMatchupBalls,
      battingStyle: plan.battingStyle,
      bowlingStyle: plan.bowlingStyle,
      targetBuckets: top,
      message: `Best line/length vs this batter: ${top[0].length} ${top[0].line} (~${top[0].blendedDismissalRate}% blended dismissal rate, ${top[0].confidence} confidence, based on ${top[0].basedOn}${plan.directMatchupBalls > 0 ? ` - ${plan.directMatchupBalls} balls of direct history between these two players` : ' - no direct history between these two players yet'}).`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Live in-match version of the matchup plan above - blends the same historical
//          hierarchical estimate with this batter's deliveries so far IN THIS MATCH, so
//          the recommendation shifts as the innings actually unfolds (pitch behaving a
//          certain way today, this batter's form today) rather than staying frozen at
//          whatever history says. See tendencyAnalytics.getLiveMatchupPlan.
// @route   GET /api/insights/matchup/:batsmanId/:bowlerId/live-bowling-plan?matchId=...
// @access  Public
exports.getLiveMatchupPlan = async (req, res) => {
  try {
    const { batsmanId, bowlerId } = req.params;
    const { matchId } = req.query;

    if (!matchId) {
      return res.status(400).json({ success: false, message: 'matchId query param is required' });
    }

    const plan = await tendencyAnalytics.getLiveMatchupPlan(matchId, batsmanId, bowlerId);
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Batsman, bowler, or match not found' });
    }

    const actionable = plan.buckets.filter(b => b.todayAdjustedRate !== null);
    if (actionable.length === 0) {
      return res.status(200).json({
        success: true,
        source: 'generic',
        message: 'No tagged delivery data anywhere yet - too early for even an archetype-level plan. Generic tip: a consistent good-length line around off stump is the safest default opening plan.'
      });
    }

    const top = actionable.slice(0, 3);
    const todayNote = top[0].liveBalls > 0
      ? ` - including ${top[0].liveBalls} ball${top[0].liveBalls === 1 ? '' : 's'} bowled to them at this length/line already today`
      : ' - no deliveries at this length/line to them yet today, so this is the historical read';

    res.status(200).json({
      success: true,
      directMatchupBalls: plan.directMatchupBalls,
      battingStyle: plan.battingStyle,
      bowlingStyle: plan.bowlingStyle,
      targetBuckets: top,
      message: `Right now, best line/length vs this batter: ${top[0].length} ${top[0].line} (~${top[0].todayAdjustedRate}% dismissal rate${todayNote}).`
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Scouting report on a team's bowlers (for the opposing batting side)
// @route   GET /api/insights/teams/:teamId/bowler-scouting
// @access  Public
exports.getBowlerScouting = async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId).populate({
      path: 'players',
      populate: { path: 'user', select: 'name' }
    });
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    // Include the whole roster, not just players tagged 'Bowler' - in club cricket
    // part-timers bowl too, and any real tracked-ball data is worth surfacing.
    const bowlers = team.players;

    const poolStats = await tendencyAnalytics.getBowlerLineLengthEffectiveness(null);

    const report = await Promise.all(bowlers.map(async (player) => {
      const stats = await tendencyAnalytics.getBowlerLineLengthEffectiveness(player._id);
      const hasData = stats.totalBalls >= MIN_BALLS_FOR_OWN_DATA;

      let threat = null;
      if (hasData) {
        const blendedEconomy = blendWithPrior(
          stats.economy, stats.totalBalls,
          poolStats.economy ?? stats.economy, poolStats.totalBalls
        );
        threat = {
          economy: stats.economy,
          strikeRate: stats.strikeRate,
          wickets: stats.totalWickets,
          balls: stats.totalBalls,
          blendedEconomy: blendedEconomy.value !== null ? Math.round(blendedEconomy.value * 100) / 100 : null,
          confidence: blendedEconomy.confidence
        };
      }

      return {
        playerId: player._id,
        name: player.user?.name ?? 'Unknown',
        specialization: player.specialization,
        bowlingStyle: player.bowlingStyle,
        hasData,
        stats: threat,
        note: hasData
          ? `${stats.totalWickets} wickets in ${stats.totalBalls} tracked balls, economy ${stats.economy}`
          : `No tracked deliveries yet - ${player.bowlingStyle !== 'None' ? player.bowlingStyle : 'bowling style unknown'}, assess by eye early in the match`
      };
    }));

    // Rank bowlers with real data first (lowest blended economy = biggest threat), then the rest
    report.sort((a, b) => {
      if (a.hasData && b.hasData) return (a.stats.blendedEconomy ?? 99) - (b.stats.blendedEconomy ?? 99);
      if (a.hasData) return -1;
      if (b.hasData) return 1;
      return 0;
    });

    res.status(200).json({ success: true, team: team.name, count: report.length, bowlers: report });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
