// Automatic "Man of the Match" (MVP) calculator.
//
// This is a documented approximation of the scoring principles publicly
// described by CricHeroes for their algorithmic MVP feature - it is NOT a
// reverse-engineered clone (their exact coefficients aren't public). The
// three principles it implements:
//   1. Runs and wickets are converted to a common "MVP points" scale.
//   2. Batting position matters: an opener's runs count for more than a
//      tail-ender's runs, because openers had more opportunity to score.
//   3. A wicket's value depends on who got out: dismissing an opener is
//      worth noticeably more than dismissing a #9, because top-order
//      batters are harder to remove and more damaging to lose.
//
// Data-model note: Match does not store an explicit batting-position field.
// We derive it per-innings as a proxy: the order in which a player first
// appears as `batsmanId` in that innings' `balls` array (already stored in
// chronological order), 0-indexed. First batsman to face a ball = position 0.

// Mirrors NON_BOWLER_WICKET_TYPES in tendencyAnalytics.js / tournamentController.js -
// run outs and retirements are never credited to the bowler.
const NON_BOWLER_WICKET_TYPES = ['run out', 'retired hurt', 'retired out'];

// Wicket types where a fielder (via ball.fielderId) assisted the bowler and
// earns an additive bonus on top of the bowler's full credit.
const ASSISTED_WICKET_TYPES = ['caught', 'stumped'];

// Extra types whose runs are not personally credited to the batsman on strike
// (they're extras added to the team total, not runs the batsman "scored").
// No-ball runs off the bat are still credited - only the ball's extraType
// governs this, matching how the innings/team run total is built elsewhere.
const NON_BATTING_EXTRA_TYPES = ['wide', 'bye', 'leg-bye'];

// 10 runs scored ~= 1 MVP point.
const RUNS_PER_BATTING_POINT = 10;

// Base bowling credit per wicket, in the same runs-equivalent scale as
// batting (12 "runs-equivalent" per wicket), before position weighting.
const BASE_WICKET_POINTS = 1.2;

// A fielder who assists a caught/stumped dismissal gets an additional 20%
// of the bowler's credit for that dismissal (additive, not a split of it).
const FIELDER_ASSIST_BONUS_RATE = 0.2;

// Position-weight curve: linear decay from `start` down to a `floor`, losing
// `slope` per batting position. Two separate calibrations are used below -
// same shape, different coefficients - because batting-runs weighting and
// wicket-value weighting are calibrated against different reference points
// (see comments on each constant). Neither curve is an official published
// formula; both are judgment calls documented here for future tuning.
function positionWeight(position, { start, floor, slope }) {
  return Math.max(floor, start - position * slope);
}

// Batting weight: position 0 (opener) -> 1.3x, decaying 0.05 per position,
// floored at 0.7x (reached at position 12+). E.g. position 5 -> 1.05x.
const BATTING_WEIGHT = { start: 1.3, floor: 0.7, slope: 0.05 };

// Wicket-value weight, applied to the *dismissed batsman's* position. Chosen
// so that (BASE_WICKET_POINTS * weight) roughly reproduces CricHeroes'
// documented T20 example ratio - dismissing an opener (~1.8 pts) is worth
// noticeably more than dismissing a #9 (~1.08 pts), i.e. about 1.5-1.8x:
//   position 0: 1.2 * 1.5  = 1.80
//   position 8: 1.2 * 0.9  = 1.08
const BOWLING_WEIGHT = { start: 1.5, floor: 0.9, slope: 0.075 };

/**
 * Computes the automatic Man of the Match for a completed (or in-progress)
 * Match document, from its raw ball-by-ball data alone.
 *
 * For every ball, in order:
 *   - the batsman on strike earns batting points for runs personally scored
 *     (excludes wide/bye/leg-bye runs, which aren't "their" runs), weighted
 *     by their batting position in that innings;
 *   - on a wicket, credit is attributed per the wicket-type rules below,
 *     weighted by the *dismissed batsman's* batting position.
 *
 * Wicket-type credit rules (mirrors NON_BOWLER_WICKET_TYPES convention):
 *   - bowled / lbw / hit wicket / caught / stumped: bowler gets full
 *     position-weighted wicket credit. For caught/stumped specifically, the
 *     fielder (ball.fielderId) additionally gets +20% of that credit.
 *   - run out: bowler gets nothing; the fielder gets the full
 *     position-weighted wicket credit instead.
 *   - retired hurt / retired out: nobody is credited (no dismissal to assign).
 *
 * Match MVP = whichever player (either team) has the highest total of
 * (batting points + bowling points + fielding bonus points).
 *
 * @param {object} match - a Match document (or plain object with the same
 *   shape: `innings: [{ balls: [...] }]`). Team/player refs need not be
 *   populated - only the raw ObjectIds on each ball are used.
 * @returns {string|null} the winning player's id as a string, or null if the
 *   match has no ball data at all (e.g. an abandoned match with zero balls).
 */
function computeMatchMVP(match) {
  const points = new Map(); // playerId (string) -> total MVP points

  const add = (id, amount) => {
    if (!id || !amount) return;
    const key = id.toString();
    points.set(key, (points.get(key) || 0) + amount);
  };

  for (const innings of match?.innings || []) {
    const balls = innings?.balls || [];

    // First pass: establish each batsman's position in this innings as the
    // order they first appear as batsmanId, chronologically (0-indexed).
    const battingPositions = new Map(); // batsmanId (string) -> position
    for (const ball of balls) {
      if (ball.batsmanId == null) continue;
      const key = ball.batsmanId.toString();
      if (!battingPositions.has(key)) {
        battingPositions.set(key, battingPositions.size);
      }
    }

    for (const ball of balls) {
      const batsmanKey = ball.batsmanId != null ? ball.batsmanId.toString() : null;
      const battingPosition = batsmanKey != null ? battingPositions.get(batsmanKey) : 0;

      // Batting points.
      if (batsmanKey != null) {
        const countsForBatsman = !(ball.isExtra && NON_BATTING_EXTRA_TYPES.includes(ball.extraType));
        if (countsForBatsman) {
          const weight = positionWeight(battingPosition, BATTING_WEIGHT);
          add(ball.batsmanId, ((ball.runs || 0) / RUNS_PER_BATTING_POINT) * weight);
        }
      }

      if (!ball.isWicket) continue;

      // Bowling / fielding points, weighted by the dismissed batsman's position.
      const wicketWeight = positionWeight(battingPosition || 0, BOWLING_WEIGHT);
      const wicketCredit = BASE_WICKET_POINTS * wicketWeight;

      if (NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) {
        if (ball.wicketType === 'run out') {
          // No bowler credit to take a cut of - fielder gets the full amount.
          add(ball.fielderId, wicketCredit);
        }
        // retired hurt / retired out: no one is credited.
      } else {
        add(ball.bowlerId, wicketCredit);
        if (ASSISTED_WICKET_TYPES.includes(ball.wicketType) && ball.fielderId) {
          add(ball.fielderId, wicketCredit * FIELDER_ASSIST_BONUS_RATE);
        }
      }
    }
  }

  if (points.size === 0) return null;

  let bestId = null;
  let bestScore = -Infinity;
  for (const [id, score] of points) {
    if (score > bestScore) {
      bestScore = score;
      bestId = id;
    }
  }
  return bestId;
}

module.exports = { computeMatchMVP, NON_BOWLER_WICKET_TYPES, BATTING_WEIGHT, BOWLING_WEIGHT };
