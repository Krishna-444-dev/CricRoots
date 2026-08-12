const mongoose = require('mongoose');
const Match = require('../models/Match');
const Player = require('../models/Player');
const { hierarchicalBlend, blendWithPrior } = require('../utils/statUtils');

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
 * Per-(line,length)-bucket breakdown restricted to any combination of batsman/bowler
 * ID sets - the shared aggregation behind every line/length feature, including the
 * hierarchical matchup backoff chain in getMatchupPlan. Passing an array pools
 * across everyone in it (an archetype-level rung: e.g. every right-arm-fast bowler
 * a given batsman has faced); omitting a side means "any batsman"/"any bowler" for
 * that dimension - the ultimate global pool has both omitted.
 */
async function getLineLengthBreakdown({ batsmanIds, bowlerIds } = {}) {
  const match = { 'innings.balls.line': { $ne: 'unknown' }, 'innings.balls.length': { $ne: 'unknown' } };
  if (batsmanIds && batsmanIds.length > 0) {
    match['innings.balls.batsmanId'] = { $in: batsmanIds.map(oid) };
  }
  if (bowlerIds && bowlerIds.length > 0) {
    match['innings.balls.bowlerId'] = { $in: bowlerIds.map(oid) };
  }

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
 * Per-(line,length)-bucket breakdown for a batsman: balls faced, runs scored,
 * dismissals - the input to both shot advice and bowling-plan features.
 * Thin wrapper over getLineLengthBreakdown for the single-batsman-only case.
 */
async function getBatsmanLineLengthBreakdown(batsmanId) {
  return getLineLengthBreakdown({ batsmanIds: batsmanId ? [batsmanId] : undefined });
}

/**
 * Player _ids sharing a given archetype (batting handedness and/or bowling style) -
 * the population an individual player's matchup data backs off to when there isn't
 * enough of their own head-to-head history yet (see getMatchupPlan). Bootstrapped
 * from the categorical fields already captured at player registration rather than a
 * learned cluster - deliberately simple given how little data exists to cluster on
 * reliably at grassroots scale.
 */
async function getPlayerIdsByArchetype({ battingStyle, bowlingStyle } = {}) {
  const query = {};
  if (battingStyle) query.battingStyle = battingStyle;
  if (bowlingStyle) query.bowlingStyle = bowlingStyle;
  if (Object.keys(query).length === 0) return [];
  const players = await Player.find(query).select('_id');
  return players.map(p => p._id);
}

/**
 * The core differentiated feature: a bowling-line-and-length recommendation for a
 * SPECIFIC batter-vs-bowler matchup, shrunk through a four-level backoff chain
 * (exact matchup -> batter vs bowler-archetype -> batter-archetype vs
 * bowler-archetype -> global) via statUtils.hierarchicalBlend, rather than either
 * (a) a raw exact-matchup average, which is nearly always built from 0-15 balls at
 * club level and wildly overconfident, or (b) a single-player-only tendency (what
 * getBowlingPlan already does), which ignores who's actually bowling. Everything
 * needed already exists in the data model - batsmanId/bowlerId per ball, and
 * battingStyle/bowlingStyle on Player - this just chains the existing shrinkage
 * primitive across the levels that data naturally forms.
 */
async function getMatchupPlan(batsmanId, bowlerId) {
  const [batsman, bowler] = await Promise.all([
    Player.findById(batsmanId).select('battingStyle'),
    Player.findById(bowlerId).select('bowlingStyle')
  ]);
  if (!batsman || !bowler) return null;

  const [bowlerArchetypeIds, batterArchetypeIds] = await Promise.all([
    getPlayerIdsByArchetype({ bowlingStyle: bowler.bowlingStyle }),
    getPlayerIdsByArchetype({ battingStyle: batsman.battingStyle })
  ]);

  const [exactMatchup, batterVsBowlerArchetype, archetypeVsArchetype, global] = await Promise.all([
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] }),
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: bowlerArchetypeIds }),
    getLineLengthBreakdown({ batsmanIds: batterArchetypeIds, bowlerIds: bowlerArchetypeIds }),
    getLineLengthBreakdown({})
  ]);

  // Union every bucket key seen at any level - a bucket only the archetype/global
  // levels have ever seen is still worth reporting on (backoff needs somewhere to
  // land), not just buckets the exact matchup happens to have touched.
  const bucketKeys = new Set();
  for (const breakdown of [exactMatchup, batterVsBowlerArchetype, archetypeVsArchetype, global]) {
    for (const b of breakdown.buckets) bucketKeys.add(`${b.line}|${b.length}`);
  }

  const findBucket = (breakdown, line, length) =>
    breakdown.buckets.find(b => b.line === line && b.length === length) || null;

  const blendedBuckets = [...bucketKeys].map((key) => {
    const [line, length] = key.split('|');
    const levels = [
      { source: exactMatchup, label: 'this exact matchup' },
      { source: batterVsBowlerArchetype, label: `this batter vs ${bowler.bowlingStyle} bowling` },
      { source: archetypeVsArchetype, label: `${batsman.battingStyle} batters vs ${bowler.bowlingStyle} bowling` },
      { source: global, label: 'every tagged delivery' }
    ].map(({ source, label }) => {
      const bucket = findBucket(source, line, length);
      return { value: bucket ? bucket.dismissalRate : 0, n: bucket ? bucket.balls : 0, label };
    });

    const blended = hierarchicalBlend(levels);
    return {
      line,
      length,
      blendedDismissalRate: blended.value !== null ? Math.round(blended.value * 100) / 100 : null,
      confidence: blended.confidence,
      basedOn: blended.level !== null ? levels[blended.level].label : 'no data',
      // The effective sample size backing blendedDismissalRate (whichever level actually
      // contributed) - exposed so getLiveMatchupPlan can treat this whole historical
      // estimate as a single prior with a real weight, instead of re-deriving one.
      historicalSampleSize: blended.sampleSize,
      rawBallsAtFinestLevel: exactMatchup.buckets.find(b => b.line === line && b.length === length)?.balls ?? 0
    };
  });

  blendedBuckets.sort((a, b) => (b.blendedDismissalRate ?? -1) - (a.blendedDismissalRate ?? -1));

  return {
    batsmanId,
    bowlerId,
    battingStyle: batsman.battingStyle,
    bowlingStyle: bowler.bowlingStyle,
    directMatchupBalls: exactMatchup.totalBalls,
    buckets: blendedBuckets
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

const ACHIEVEMENT_DEFS = [
  { key: 'century-maker', label: 'Century Maker', description: '100+ runs in a single innings' },
  { key: 'half-century-hero', label: 'Half-Century Hero', description: '50-99 runs in a single innings' },
  { key: 'five-wicket-haul', label: 'Five-Wicket Haul', description: '5+ wickets in a single innings' },
  { key: 'hat-trick-hero', label: 'Hat-trick Hero', description: '3 wickets on 3 consecutive legal deliveries in a single innings' },
  { key: 'golden-duck', label: 'Golden Duck', description: 'Dismissed for 0 off the very first ball faced in an innings' },
  { key: 'century-of-wickets', label: 'Century of Wickets', description: '50+ career wickets' },
  { key: 'all-rounder', label: 'All-Rounder', description: '500+ career runs and 50+ career wickets' },
  { key: 'wicketkeeper-great', label: 'Wicketkeeper Great', description: '50+ combined career catches and stumpings' }
];

/**
 * Achievement/badge computation for a single player.
 *
 * Reuses getCareerStats() for the aggregate figures most badges need directly
 * (career runs, career wickets, centuries, half-centuries, fielding dismissals -
 * getCareerStats already computes centuries/halfCenturies per match, which is
 * equivalent to per-innings here since each team bats/bowls exactly once per
 * match in this data model).
 *
 * Three badges - five-wicket haul, hat-trick, golden duck - need per-innings/
 * per-ball sequencing that getCareerStats' return value doesn't expose (it only
 * returns career-aggregated totals, not per-innings breakdowns), so this function
 * does one additional match-iteration pass, shaped the same way as getCareerStats'
 * own query/loop, to compute those. Kept separate rather than threading extra
 * state through getCareerStats itself, so that function's existing return shape
 * and behavior are left completely untouched.
 *
 * @param {string} playerId
 * @param {object} [precomputedCareerStats] - optional getCareerStats(playerId)
 *   result, if the caller already has one on hand (e.g. the player-stats
 *   endpoint fetches it anyway) - pass it through to avoid computing it twice.
 */
async function getAchievements(playerId, precomputedCareerStats) {
  const careerStats = precomputedCareerStats || await getCareerStats(playerId);

  const matches = await Match.find({
    status: 'Completed',
    $or: [
      { 'innings.balls.batsmanId': oid(playerId) },
      { 'innings.balls.bowlerId': oid(playerId) }
    ]
  }).select('innings');

  let fiveWicketHauls = 0;
  let hatTricks = 0;
  let goldenDucks = 0;

  for (const match of matches) {
    for (const innings of match.innings) {
      let sawFirstBattingBall = false;
      const bowlerLegalWicketSeq = [];

      for (const ball of innings.balls) {
        const isBatsman = ball.batsmanId && ball.batsmanId.toString() === playerId.toString();
        const isBowler = ball.bowlerId && ball.bowlerId.toString() === playerId.toString();

        // Golden duck: only the very first ball on which this player appears as
        // batsman in this innings matters. Checked fresh for every innings (the
        // flag is innings-scoped, declared inside the innings loop) so a clean
        // earlier innings can never suppress a golden duck in a later one.
        if (isBatsman && !sawFirstBattingBall) {
          sawFirstBattingBall = true;
          if (ball.isWicket && (ball.runs || 0) === 0) {
            goldenDucks += 1;
          }
        }

        // Hat-trick: build this player's own subsequence of legal deliveries
        // bowled in this innings, in original chronological order, then look for
        // 3 consecutive wickets in that subsequence below. Documented
        // simplification: "consecutive" means consecutive within this bowler's
        // own legal-ball sequence (overs bowled by other players in between are
        // simply not part of the subsequence), not literally back-to-back overall
        // deliveries - reasonable since bowlers in this data model bowl their
        // overs as unbroken spells.
        if (isBowler) {
          const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
          if (isLegal) {
            const credited = ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType);
            bowlerLegalWicketSeq.push(credited);
          }
        }
      }

      // Five-wicket haul: this player's credited wickets in this innings.
      const inningsWickets = bowlerLegalWicketSeq.filter(Boolean).length;
      if (inningsWickets >= 5) fiveWicketHauls += 1;

      // Hat-trick scan: count once per unbroken streak of >= 3 consecutive
      // wickets - a 4- or 5-wicket streak is still one hat-trick, matching
      // real-world convention, not (streakLength - 2) overlapping hat-tricks.
      let streak = 0;
      let countedThisStreak = false;
      for (const wasWicket of bowlerLegalWicketSeq) {
        if (wasWicket) {
          streak += 1;
          if (streak >= 3 && !countedThisStreak) {
            hatTricks += 1;
            countedThisStreak = true;
          }
        } else {
          streak = 0;
          countedThisStreak = false;
        }
      }
    }
  }

  const { batting, bowling, fielding } = careerStats;
  const wkDismissals = (fielding.catches || 0) + (fielding.stumpings || 0);
  const isAllRounder = batting.runs >= 500 && bowling.wickets >= 50;
  const isCenturyOfWickets = bowling.wickets >= 50;
  const isWkGreat = wkDismissals >= 50;

  const counts = {
    'century-maker': batting.centuries,
    'half-century-hero': batting.halfCenturies,
    'five-wicket-haul': fiveWicketHauls,
    'hat-trick-hero': hatTricks,
    'golden-duck': goldenDucks,
    'century-of-wickets': isCenturyOfWickets ? 1 : 0,
    'all-rounder': isAllRounder ? 1 : 0,
    'wicketkeeper-great': isWkGreat ? 1 : 0
  };

  return ACHIEVEMENT_DEFS.map((def) => ({
    ...def,
    earned: counts[def.key] > 0,
    count: counts[def.key]
  }));
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

const LIVE_K = 5;

/**
 * Layers "how is this batter playing TODAY" on top of the all-time historical matchup
 * plan from getMatchupPlan - the real-time extension proposed in
 * documentation/hierarchical-matchup-shrinkage-research.md. Deliberately scoped to this
 * batter's deliveries in the CURRENT match against ANY bowler (not just the specific
 * bowler passed in): a handful of balls faced today reflects conditions - pitch
 * behavior, weather, current form - that no historical stat captures, and in a short
 * match there's rarely enough live data against one specific bowler alone to be useful.
 * This is a genuinely different axis from getMatchupPlan's identity-based specificity
 * (who's playing) - recency/context, not who - so it's blended as one extra step on top
 * of the historical composite via the same blendWithPrior primitive, using a smaller
 * pseudo-count (LIVE_K=5 vs the usual 15): a ball faced five minutes ago under today's
 * actual conditions should outweigh a historical archetype-level data point faster than
 * a typical archetype/global blend would allow.
 */
async function getLiveMatchupPlan(matchId, batsmanId, bowlerId) {
  const [historical, match] = await Promise.all([
    getMatchupPlan(batsmanId, bowlerId),
    Match.findById(matchId).select('innings.balls')
  ]);
  if (!historical || !match) return null;

  // Today's balls faced by this batter, any bowler, grouped by line/length - a single
  // match document is small enough (well under a few hundred balls even for a full
  // innings) that reducing it in JS is simpler than a second aggregation pipeline for
  // what's inherently already-loaded data.
  const liveBuckets = new Map();
  for (const innings of match.innings || []) {
    for (const ball of innings.balls || []) {
      if (String(ball.batsmanId) !== String(batsmanId)) continue;
      if (ball.line === 'unknown' || ball.length === 'unknown') continue;
      const key = `${ball.line}|${ball.length}`;
      const entry = liveBuckets.get(key) || { balls: 0, dismissals: 0 };
      entry.balls += 1;
      if (ball.isWicket) entry.dismissals += 1;
      liveBuckets.set(key, entry);
    }
  }

  const buckets = historical.buckets.map((bucket) => {
    const live = liveBuckets.get(`${bucket.line}|${bucket.length}`);
    const liveN = live ? live.balls : 0;
    const liveRate = live ? round((live.dismissals / live.balls) * 100) : null;

    if (bucket.blendedDismissalRate === null) {
      // No historical signal anywhere for this bucket - live data, if any, is all there is.
      return { ...bucket, liveBalls: liveN, liveDismissalRate: liveRate, todayAdjustedRate: liveRate };
    }

    const adjusted = blendWithPrior(
      liveRate ?? 0, liveN,
      bucket.blendedDismissalRate, bucket.historicalSampleSize,
      LIVE_K
    );

    return {
      ...bucket,
      liveBalls: liveN,
      liveDismissalRate: liveRate,
      todayAdjustedRate: adjusted.value !== null ? Math.round(adjusted.value * 100) / 100 : bucket.blendedDismissalRate
    };
  });

  buckets.sort((a, b) => (b.todayAdjustedRate ?? -1) - (a.todayAdjustedRate ?? -1));

  return { ...historical, buckets };
}

module.exports = {
  getZoneBreakdown,
  getLineLengthBreakdown,
  getBatsmanLineLengthBreakdown,
  getBowlerLineLengthEffectiveness,
  getPlayerIdsByArchetype,
  getMatchupPlan,
  getLiveMatchupPlan,
  getFieldingStats,
  getCareerStats,
  getAchievements,
  getBattingLeaderboard,
  getBowlingLeaderboard,
  getTournamentBattingLeaderboard,
  getTournamentBowlingLeaderboard
};
