const mongoose = require('mongoose');
const Match = require('../models/Match');

function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

/**
 * Per-shot-zone breakdown for a batsman: how many balls faced and runs scored in
 * each zone. Only balls with a tagged shotZone count (untagged balls are excluded,
 * not treated as zero-runs-everywhere).
 */
async function getZoneBreakdown(batsmanId) {
  const match = batsmanId
    ? { 'innings.balls.batsmanId': oid(batsmanId), 'innings.balls.shotZone': { $ne: null } }
    : { 'innings.balls.shotZone': { $ne: null } };

  const rows = await Match.aggregate([
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: match },
    { $group: { _id: '$innings.balls.shotZone', balls: { $sum: 1 }, runs: { $sum: '$innings.balls.runs' } } }
  ]);

  const totalBalls = rows.reduce((s, r) => s + r.balls, 0);
  const totalRuns = rows.reduce((s, r) => s + r.runs, 0);

  return {
    totalBalls,
    totalRuns,
    zones: rows.map(r => ({
      zone: r._id,
      balls: r.balls,
      runs: r.runs,
      runsPercent: totalRuns > 0 ? round((r.runs / totalRuns) * 100) : 0
    }))
  };
}

/**
 * Per-(line,length)-bucket breakdown for a batsman: balls faced, runs scored,
 * dismissals - the input to both shot advice and bowling-plan features.
 */
async function getBatsmanLineLengthBreakdown(batsmanId) {
  const match = batsmanId
    ? { 'innings.balls.batsmanId': oid(batsmanId), 'innings.balls.line': { $ne: 'unknown' }, 'innings.balls.length': { $ne: 'unknown' } }
    : { 'innings.balls.line': { $ne: 'unknown' }, 'innings.balls.length': { $ne: 'unknown' } };

  const rows = await Match.aggregate([
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: match },
    {
      $group: {
        _id: { line: '$innings.balls.line', length: '$innings.balls.length' },
        balls: { $sum: 1 },
        runs: { $sum: '$innings.balls.runs' },
        dismissals: { $sum: { $cond: ['$innings.balls.isWicket', 1, 0] } }
      }
    }
  ]);

  const totalBalls = rows.reduce((s, r) => s + r.balls, 0);
  const totalDismissals = rows.reduce((s, r) => s + r.dismissals, 0);

  return {
    totalBalls,
    totalDismissals,
    buckets: rows.map(r => ({
      line: r._id.line,
      length: r._id.length,
      balls: r.balls,
      runs: r.runs,
      dismissals: r.dismissals,
      strikeRate: r.balls > 0 ? round((r.runs / r.balls) * 100) : 0,
      dismissalRate: r.balls > 0 ? round((r.dismissals / r.balls) * 100) : 0
    }))
  };
}

/**
 * Per-(line,length)-bucket effectiveness for a bowler: balls bowled, runs conceded,
 * wickets taken - the input to bowler scouting.
 */
async function getBowlerLineLengthEffectiveness(bowlerId) {
  const match = bowlerId
    ? { 'innings.balls.bowlerId': oid(bowlerId) }
    : {};

  const rows = await Match.aggregate([
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: match },
    {
      $group: {
        _id: { line: '$innings.balls.line', length: '$innings.balls.length' },
        balls: { $sum: 1 },
        runs: { $sum: '$innings.balls.runs' },
        wickets: { $sum: { $cond: ['$innings.balls.isWicket', 1, 0] } }
      }
    }
  ]);

  const totalBalls = rows.reduce((s, r) => s + r.balls, 0);
  const totalRuns = rows.reduce((s, r) => s + r.runs, 0);
  const totalWickets = rows.reduce((s, r) => s + r.wickets, 0);

  return {
    totalBalls,
    totalRuns,
    totalWickets,
    economy: totalBalls > 0 ? round((totalRuns / totalBalls) * 6) : null,
    strikeRate: totalWickets > 0 ? round(totalBalls / totalWickets) : null,
    buckets: rows.map(r => ({
      line: r._id.line,
      length: r._id.length,
      balls: r.balls,
      runs: r.runs,
      wickets: r.wickets,
      economy: r.balls > 0 ? round((r.runs / r.balls) * 6) : 0
    }))
  };
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getZoneBreakdown,
  getBatsmanLineLengthBreakdown,
  getBowlerLineLengthEffectiveness
};
