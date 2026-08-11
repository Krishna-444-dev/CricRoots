// Settles all pending predictions for a match once it's Completed - awards points, never
// subtracts. Purely additive scoring (no negative points for a wrong guess) is deliberate: this
// is a free engagement/fantasy layer, not a wagering system where you can "lose" something, and
// keeping it strictly non-punitive is part of what keeps it clearly on the legal side of that line.
const Prediction = require('../models/Prediction');

const POINTS_FOR_WINNER = 10;
const POINTS_FOR_MOTM_BONUS = 15;

/**
 * @param {object} match - a completed Match document (match.result and match.manOfTheMatch set)
 */
async function settlePredictions(match) {
  const predictions = await Prediction.find({ match: match._id, status: 'pending' });
  if (predictions.length === 0) return;

  const winningTeamId = match.result?.winningTeam ? match.result.winningTeam.toString() : null;
  const motmId = match.manOfTheMatch ? match.manOfTheMatch.toString() : null;

  await Promise.all(predictions.map((prediction) => {
    // A tie/no-result has no winning team - predictions can't be right or wrong about the
    // unpredictable, so they settle at 0 points rather than being scored against a null winner.
    const wonOnWinner = winningTeamId !== null && prediction.predictedWinner.toString() === winningTeamId;
    const wonOnMotm = !!prediction.predictedMotm && motmId !== null && prediction.predictedMotm.toString() === motmId;

    prediction.wonOnWinner = wonOnWinner;
    prediction.wonOnMotm = wonOnMotm;
    prediction.points = (wonOnWinner ? POINTS_FOR_WINNER : 0) + (wonOnMotm ? POINTS_FOR_MOTM_BONUS : 0);
    prediction.status = 'settled';
    return prediction.save();
  }));
}

module.exports = { settlePredictions, POINTS_FOR_WINNER, POINTS_FOR_MOTM_BONUS };
