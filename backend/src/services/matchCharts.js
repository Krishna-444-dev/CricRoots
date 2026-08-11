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

/**
 * Given a Match document (with `innings` populated or not - only
 * innings.team's identity is read here, not its full shape), returns
 * Manhattan/Worm chart data for both innings, in team1/team2 order.
 */
function getMatchCharts(match) {
  return (match.innings || []).map((innings) => {
    const overs = computeOverBreakdown(innings.balls);
    return {
      team: innings.team,
      overs,
      cumulative: computeCumulative(overs)
    };
  });
}

module.exports = {
  computeOverBreakdown,
  computeCumulative,
  getMatchCharts
};
