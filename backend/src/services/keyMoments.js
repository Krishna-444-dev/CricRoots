// "Key moments" - the biggest win-probability swings in a chase, ported from baseball
// sabermetrics' Win Probability Added (WPA) concept: rank every ball by the delta in win
// probability it caused, surface the largest swings as auto-highlights.
//
// Every video-based cricket highlight-detection approach (ball-tracking, broadcast footage)
// is irrelevant here - CricRoots has no video, only structured ball events. WPA is the one
// technique that works from that alone: it only needs a win-probability number before and
// after each ball, which the AI engine's /win-probability endpoint already provides.
//
// Scoped to the second (chasing) innings only - the win-probability model is inherently a
// "team batting second, chasing a target" model (it takes targetScore as an input), and
// Match.innings[1] is always team2's innings, team1 always team2's in this codebase's fixed
// team1/team2 <-> innings[0]/innings[1] convention. Test matches (multiple innings per side,
// no single limited-overs run-chase) are explicitly out of scope.

const AIService = require('../utils/aiService');

const OVERS_BY_MATCH_TYPE = { T20: 20, ODI: 50, Friendly: 20 };

function toDecimalOvers(legalBalls) {
  return legalBalls / 6;
}

/**
 * Replays a chasing innings ball-by-ball, computing win probability at each ball boundary via
 * the AI engine, and returns the deliveries with the largest |delta|.
 *
 * @param {object} match - a Match document (innings[1] is the chase, innings[0].runs is the target)
 * @param {number} topN - how many key moments to return, highest-delta first
 * @returns {Promise<{success: boolean, message?: string, keyMoments?: Array}>}
 */
async function getKeyMoments(match, topN = 5) {
  if (match.matchType === 'Test') {
    return { success: false, message: 'Key moments are not available for Test matches.' };
  }

  const totalOvers = OVERS_BY_MATCH_TYPE[match.matchType] || 20;
  const targetScore = (match.innings[0]?.runs || 0) + 1;
  const balls = match.innings[1]?.balls || [];

  if (balls.length === 0) {
    return { success: false, message: 'No deliveries recorded in the chase yet.' };
  }

  // Build all N+1 checkpoint states (before any ball, after each of the N balls) up front.
  const checkpoints = [];
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  checkpoints.push({ oversRemaining: totalOvers, wicketsDown: 0, currentRunRate: 0, targetScore });

  for (const ball of balls) {
    runs += ball.runs || 0;
    if (ball.isWicket) wickets += 1;
    const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
    if (isLegal) legalBalls += 1;

    const oversUsed = toDecimalOvers(legalBalls);
    checkpoints.push({
      oversRemaining: Math.max(0, totalOvers - oversUsed),
      wicketsDown: wickets,
      currentRunRate: oversUsed > 0 ? runs / oversUsed : 0,
      targetScore
    });
  }

  // Query the AI engine in small concurrent batches rather than all-at-once - it's a single
  // Flask dev-server instance (see ai-engine/app.py), not a production WSGI pool, so firing
  // 100+ simultaneous requests at it would be inconsiderate even though this only ever runs
  // on-demand (viewing a completed match's summary), not on every live ball.
  const BATCH_SIZE = 15;
  const winProbabilities = [];
  for (let i = 0; i < checkpoints.length; i += BATCH_SIZE) {
    const batch = checkpoints.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map((state) => AIService.getWinProbability(state)));
    winProbabilities.push(...results.map((r) => (r.success ? r.win_probability : null)));
  }

  if (winProbabilities.some((wp) => wp === null)) {
    return { success: false, message: 'Win probability model unavailable - could not compute key moments.' };
  }

  const moments = balls.map((ball, i) => ({
    ballIndex: i,
    ballNumber: ball.ballNumber,
    commentary: ball.commentary || '',
    isWicket: ball.isWicket,
    runs: ball.runs,
    winProbabilityBefore: winProbabilities[i],
    winProbabilityAfter: winProbabilities[i + 1],
    delta: Math.abs(winProbabilities[i + 1] - winProbabilities[i])
  }));

  moments.sort((a, b) => b.delta - a.delta);

  return { success: true, keyMoments: moments.slice(0, topN) };
}

module.exports = { getKeyMoments };
