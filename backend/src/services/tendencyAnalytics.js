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

/**
 * Wicketkeeper/fielding dismissal counts for a player: catches, run outs, and
 * stumpings they were credited with as fielder across all completed matches.
 */
async function getFieldingStats(fielderId) {
  const rows = await Match.aggregate([
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.fielderId': oid(fielderId), 'innings.balls.isWicket': true } },
    { $group: { _id: '$innings.balls.wicketType', count: { $sum: 1 } } }
  ]);

  const byType = Object.fromEntries(rows.map((r) => [r._id, r.count]));
  return {
    catches: byType['caught'] || 0,
    runOuts: byType['run out'] || 0,
    stumpings: byType['stumped'] || 0
  };
}

const NON_BOWLER_WICKET_TYPES = ['run out', 'retired hurt', 'retired out'];

/**
 * Full career stats for a single player, computed directly from Match ball data
 * rather than the separate (unpopulated) PlayerStats collection - matches are the
 * source of truth. Batting/bowling are aggregated per match first so per-innings
 * figures like highest score and not-outs come out right.
 */
async function getCareerStats(playerId) {
  const matches = await Match.find({
    status: 'Completed',
    $or: [
      { 'innings.balls.batsmanId': oid(playerId) },
      { 'innings.balls.bowlerId': oid(playerId) }
    ]
  }).select('innings result manOfTheMatch');

  const battingByMatch = new Map();
  const bowlingByMatch = new Map();
  let manOfTheMatchCount = 0;
  let wins = 0;
  let matchesWithKnownResult = 0;

  for (const match of matches) {
    const matchId = match._id.toString();
    let battedForTeam = null;
    let bowledAgainstTeam = null;

    for (const innings of match.innings) {
      for (const ball of innings.balls) {
        if (ball.batsmanId && ball.batsmanId.toString() === playerId.toString()) {
          const entry = battingByMatch.get(matchId) || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false };
          entry.runs += ball.runs || 0;
          if (!(ball.isExtra && ball.extraType === 'wide')) entry.balls += 1;
          if (!ball.isExtra && ball.runs === 4) entry.fours += 1;
          if (!ball.isExtra && ball.runs === 6) entry.sixes += 1;
          if (ball.isWicket) entry.out = true;
          battingByMatch.set(matchId, entry);
          battedForTeam = innings.team ? innings.team.toString() : battedForTeam;
        }
        if (ball.bowlerId && ball.bowlerId.toString() === playerId.toString()) {
          const entry = bowlingByMatch.get(matchId) || { balls: 0, runs: 0, wickets: 0 };
          const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
          if (isLegal) entry.balls += 1;
          if (!(ball.isExtra && ['bye', 'leg-bye'].includes(ball.extraType))) entry.runs += ball.runs || 0;
          if (ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) entry.wickets += 1;
          bowlingByMatch.set(matchId, entry);
          bowledAgainstTeam = innings.team ? innings.team.toString() : bowledAgainstTeam;
        }
      }
    }

    if (match.manOfTheMatch && match.manOfTheMatch.toString() === playerId.toString()) {
      manOfTheMatchCount += 1;
    }

    // Infer which team the player was on: the team they batted for, or the
    // opponent of the team they bowled against. Skip the win/loss count for
    // this match if neither can be determined (e.g. fielded only).
    const playerTeam = battedForTeam || (bowledAgainstTeam
      ? match.innings.find((i) => i.team && i.team.toString() !== bowledAgainstTeam)?.team?.toString()
      : null);
    if (playerTeam && match.result?.winningTeam) {
      matchesWithKnownResult += 1;
      if (match.result.winningTeam.toString() === playerTeam) wins += 1;
    }
  }

  const battingEntries = [...battingByMatch.values()];
  const bowlingEntries = [...bowlingByMatch.values()];

  const totalRuns = battingEntries.reduce((s, e) => s + e.runs, 0);
  const totalBallsFaced = battingEntries.reduce((s, e) => s + e.balls, 0);
  const dismissals = battingEntries.filter((e) => e.out).length;
  const notOuts = battingEntries.length - dismissals;

  const totalBowlingRuns = bowlingEntries.reduce((s, e) => s + e.runs, 0);
  const totalBowlingBalls = bowlingEntries.reduce((s, e) => s + e.balls, 0);
  const totalWickets = bowlingEntries.reduce((s, e) => s + e.wickets, 0);

  const fielding = await getFieldingStats(playerId);

  const involvedMatches = new Set([...battingByMatch.keys(), ...bowlingByMatch.keys()]).size;

  return {
    batting: {
      matches: battingEntries.length,
      innings: battingEntries.length,
      runs: totalRuns,
      balls: totalBallsFaced,
      highestScore: battingEntries.reduce((max, e) => Math.max(max, e.runs), 0),
      average: dismissals > 0 ? round(totalRuns / dismissals) : totalRuns,
      strikeRate: totalBallsFaced > 0 ? round((totalRuns / totalBallsFaced) * 100) : 0,
      centuries: battingEntries.filter((e) => e.runs >= 100).length,
      halfCenturies: battingEntries.filter((e) => e.runs >= 50 && e.runs < 100).length,
      fours: battingEntries.reduce((s, e) => s + e.fours, 0),
      sixes: battingEntries.reduce((s, e) => s + e.sixes, 0),
      ducks: battingEntries.filter((e) => e.out && e.runs === 0).length,
      notOuts
    },
    bowling: {
      matches: bowlingEntries.length,
      innings: bowlingEntries.length,
      balls: totalBowlingBalls,
      runs: totalBowlingRuns,
      wickets: totalWickets,
      average: totalWickets > 0 ? round(totalBowlingRuns / totalWickets) : 0,
      economyRate: totalBowlingBalls > 0 ? round((totalBowlingRuns / totalBowlingBalls) * 6) : 0
    },
    fielding,
    overall: {
      matches: involvedMatches,
      wins,
      losses: matchesWithKnownResult - wins,
      winPercentage: matchesWithKnownResult > 0 ? round((wins / matchesWithKnownResult) * 100) : 0,
      manOfTheMatch: manOfTheMatchCount
    }
  };
}

/**
 * Batting leaderboard across all players, ranked by average (min 1 dismissal-free
 * run to appear at all - players who've never batted don't show up).
 */
async function getBattingLeaderboard(limit = 10) {
  return Match.aggregate([
    { $match: { status: 'Completed' } },
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.batsmanId': { $ne: null } } },
    {
      $group: {
        _id: { match: '$_id', batsman: '$innings.balls.batsmanId' },
        runs: { $sum: '$innings.balls.runs' },
        ballsFaced: { $sum: { $cond: [{ $eq: ['$innings.balls.extraType', 'wide'] }, 0, 1] } },
        out: { $max: { $cond: ['$innings.balls.isWicket', 1, 0] } }
      }
    },
    {
      $group: {
        _id: '$_id.batsman',
        matches: { $sum: 1 },
        runs: { $sum: '$runs' },
        ballsFaced: { $sum: '$ballsFaced' },
        dismissals: { $sum: '$out' },
        highestScore: { $max: '$runs' }
      }
    },
    {
      $project: {
        matches: 1,
        runs: 1,
        highestScore: 1,
        average: { $cond: [{ $eq: ['$dismissals', 0] }, '$runs', { $divide: ['$runs', '$dismissals'] }] },
        strikeRate: { $cond: [{ $eq: ['$ballsFaced', 0] }, 0, { $multiply: [{ $divide: ['$runs', '$ballsFaced'] }, 100] }] }
      }
    },
    { $match: { runs: { $gt: 0 } } },
    { $sort: { average: -1 } },
    { $limit: limit }
  ]);
}

/**
 * Bowling leaderboard across all players, ranked by average (ascending - lower is
 * better). Requires at least one wicket to rank, matching standard convention.
 */
async function getBowlingLeaderboard(limit = 10) {
  return Match.aggregate([
    { $match: { status: 'Completed' } },
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.bowlerId': { $ne: null } } },
    {
      $group: {
        _id: { match: '$_id', bowler: '$innings.balls.bowlerId' },
        legalBalls: { $sum: { $cond: [{ $in: ['$innings.balls.extraType', ['wide', 'no-ball']] }, 0, 1] } },
        runs: { $sum: { $cond: [{ $in: ['$innings.balls.extraType', ['bye', 'leg-bye']] }, 0, '$innings.balls.runs'] } },
        wickets: {
          $sum: {
            $cond: [
              { $and: ['$innings.balls.isWicket', { $not: [{ $in: ['$innings.balls.wicketType', NON_BOWLER_WICKET_TYPES] }] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$_id.bowler',
        matches: { $sum: 1 },
        balls: { $sum: '$legalBalls' },
        runs: { $sum: '$runs' },
        wickets: { $sum: '$wickets' }
      }
    },
    { $match: { wickets: { $gt: 0 } } },
    {
      $project: {
        matches: 1,
        wickets: 1,
        average: { $divide: ['$runs', '$wickets'] },
        economyRate: { $cond: [{ $eq: ['$balls', 0] }, 0, { $multiply: [{ $divide: ['$runs', '$balls'] }, 6] }] }
      }
    },
    { $sort: { average: 1 } },
    { $limit: limit }
  ]);
}

/**
 * Batting leaderboard scoped to a single tournament, ranked by average (min 1
 * completed innings with the bat, and > 0 runs - same convention as
 * getBattingLeaderboard above, just filtered down to one tournament's matches).
 */
async function getTournamentBattingLeaderboard(tournamentId, limit = 10) {
  return Match.aggregate([
    { $match: { status: 'Completed', tournament: oid(tournamentId) } },
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.batsmanId': { $ne: null } } },
    {
      $group: {
        _id: { match: '$_id', batsman: '$innings.balls.batsmanId' },
        runs: { $sum: '$innings.balls.runs' },
        ballsFaced: { $sum: { $cond: [{ $eq: ['$innings.balls.extraType', 'wide'] }, 0, 1] } },
        out: { $max: { $cond: ['$innings.balls.isWicket', 1, 0] } }
      }
    },
    {
      $group: {
        _id: '$_id.batsman',
        matches: { $sum: 1 },
        runs: { $sum: '$runs' },
        ballsFaced: { $sum: '$ballsFaced' },
        dismissals: { $sum: '$out' },
        highestScore: { $max: '$runs' }
      }
    },
    {
      $project: {
        matches: 1,
        runs: 1,
        highestScore: 1,
        average: { $cond: [{ $eq: ['$dismissals', 0] }, '$runs', { $divide: ['$runs', '$dismissals'] }] },
        strikeRate: { $cond: [{ $eq: ['$ballsFaced', 0] }, 0, { $multiply: [{ $divide: ['$runs', '$ballsFaced'] }, 100] }] }
      }
    },
    { $match: { runs: { $gt: 0 } } },
    { $sort: { average: -1 } },
    { $limit: limit }
  ]);
}

/**
 * Bowling leaderboard scoped to a single tournament, ranked by average (ascending -
 * lower is better). Requires at least one wicket to rank, same convention as
 * getBowlingLeaderboard above, just filtered down to one tournament's matches.
 */
async function getTournamentBowlingLeaderboard(tournamentId, limit = 10) {
  return Match.aggregate([
    { $match: { status: 'Completed', tournament: oid(tournamentId) } },
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.bowlerId': { $ne: null } } },
    {
      $group: {
        _id: { match: '$_id', bowler: '$innings.balls.bowlerId' },
        legalBalls: { $sum: { $cond: [{ $in: ['$innings.balls.extraType', ['wide', 'no-ball']] }, 0, 1] } },
        runs: { $sum: { $cond: [{ $in: ['$innings.balls.extraType', ['bye', 'leg-bye']] }, 0, '$innings.balls.runs'] } },
        wickets: {
          $sum: {
            $cond: [
              { $and: ['$innings.balls.isWicket', { $not: [{ $in: ['$innings.balls.wicketType', NON_BOWLER_WICKET_TYPES] }] }] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $group: {
        _id: '$_id.bowler',
        matches: { $sum: 1 },
        balls: { $sum: '$legalBalls' },
        runs: { $sum: '$runs' },
        wickets: { $sum: '$wickets' }
      }
    },
    { $match: { wickets: { $gt: 0 } } },
    {
      $project: {
        matches: 1,
        wickets: 1,
        average: { $divide: ['$runs', '$wickets'] },
        economyRate: { $cond: [{ $eq: ['$balls', 0] }, 0, { $multiply: [{ $divide: ['$runs', '$balls'] }, 6] }] }
      }
    },
    { $sort: { average: 1 } },
    { $limit: limit }
  ]);
}

function round(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  getZoneBreakdown,
  getBatsmanLineLengthBreakdown,
  getBowlerLineLengthEffectiveness,
  getFieldingStats,
  getCareerStats,
  getBattingLeaderboard,
  getBowlingLeaderboard,
  getTournamentBattingLeaderboard,
  getTournamentBowlingLeaderboard
};
