/**
 * Per-over aggregation of ball-by-ball data, powering the Manhattan chart
 * (runs per over) and Worm chart (cumulative total per over) on the match
 * detail page. Pure JS-side reduction over an already-fetched Match document -
 * this needs ordered, sequential state per over (running legal-ball count),
 * which is awkward to express as a Mongo aggregation pipeline.
 */

/**
 * Walks a single innings' balls array in chronological order and buckets each
 * ball into the over it was bowled in, mirroring the over-counting convention
 * in matchController.recordBall exactly: wides and no-balls do not count as
 * legal deliveries toward completing an over (so they don't advance the over
 * index), but their runs still land in whichever over is currently in
 * progress. Legal balls both advance the counter and land in the current over.
 *
 * Example: legal, legal, wide, legal, legal, legal, legal (6 legal + 1 wide)
 * all land in over 0 - the wide doesn't tip play into over 1, only the 6th
 * legal ball completes it, and the next ball after that starts over 1.
 */
function computeOverBreakdown(balls) {
  const overs = [];
  let legalBallCount = 0;

  for (const ball of balls || []) {
    const overIndex = Math.floor(legalBallCount / 6);
    if (!overs[overIndex]) {
      overs[overIndex] = { over: overIndex, runs: 0, wickets: 0 };
    }
    overs[overIndex].runs += ball.runs || 0;
    if (ball.isWicket) overs[overIndex].wickets += 1;

    const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
    if (isLegal) legalBallCount += 1;
  }

  return overs;
}

/**
 * Turns a per-over breakdown into a running total after each over - the
 * Worm chart's data.
 */
function computeCumulative(overs) {
  let total = 0;
  return overs.map((o) => {
    total += o.runs;
    return { over: o.over, total };
  });
}

const EXTRA_TYPES = ['wide', 'no-ball', 'bye', 'leg-bye', 'penalty'];

/**
 * Total runs contributed by each extra type across an innings. ball.runs
 * already carries the full run value for an extra delivery - for wides/
 * no-balls that includes the mandatory 1 (matchController.recordBall's
 * caller adds it in before the ball is ever persisted, see
 * BallByBallScoring.tsx's handleRecordBall), for byes/leg-byes/penalty
 * it's just whatever runs were run - so no type-specific arithmetic is
 * needed here beyond grouping by extraType.
 */
function computeExtrasBreakdown(balls) {
  const totals = Object.fromEntries(EXTRA_TYPES.map((type) => [type, 0]));
  for (const ball of balls || []) {
    if (ball.isExtra && ball.extraType in totals) {
      totals[ball.extraType] += ball.runs || 0;
    }
  }
  return EXTRA_TYPES.map((type) => ({ type, runs: totals[type] }));
}

const RUNS_TYPE_BUCKETS = ['0', '1', '2', '3', '4', '5', '6+'];

/**
 * How many deliveries produced each run value off the bat. Extra-type balls
 * (wides/no-balls/byes/leg-byes/penalty) are excluded - this is about shot
 * outcomes, not extras, and computeExtrasBreakdown above already covers
 * those runs. Wicket deliveries with no run scored still land in the '0'
 * bucket since they're real deliveries faced, same as a genuine dot ball.
 */
function computeRunsTypeBreakdown(balls) {
  const totals = Object.fromEntries(RUNS_TYPE_BUCKETS.map((bucket) => [bucket, 0]));
  for (const ball of balls || []) {
    if (ball.isExtra) continue;
    const runs = ball.runs || 0;
    const bucket = runs >= 6 ? '6+' : String(runs);
    totals[bucket] = (totals[bucket] || 0) + 1;
  }
  return RUNS_TYPE_BUCKETS.map((runs) => ({ runs, count: totals[runs] }));
}

/**
 * Given a Match document (with `innings` populated or not - only
 * innings.team's identity is read here, not its full shape), returns
 * Manhattan/Worm/Extras/Runs-type chart data for both innings, in
 * team1/team2 order.
 */
function getMatchCharts(match) {
  return (match.innings || []).map((innings) => {
    const overs = computeOverBreakdown(innings.balls);
    return {
      team: innings.team,
      overs,
      cumulative: computeCumulative(overs),
      extrasBreakdown: computeExtrasBreakdown(innings.balls),
      runsTypeBreakdown: computeRunsTypeBreakdown(innings.balls)
    };
  });
}

module.exports = {
  computeOverBreakdown,
  computeCumulative,
  computeExtrasBreakdown,
  computeRunsTypeBreakdown,
  getMatchCharts
};
