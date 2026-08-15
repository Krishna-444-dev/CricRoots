const mongoose = require('mongoose');
const Match = require('../models/Match');
const Player = require('../models/Player');
const { hierarchicalBlend, blendWithPrior } = require('../utils/statUtils');
const { computeMatchMVPPoints } = require('./mvpCalculator');

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
 * Accumulates one player's batting/bowling figures from a single match's `innings`
 * array - the shared per-match ball-accumulation logic behind getMatchByMatchBreakdown
 * (one call per match, across a player's whole history) and getMatchPerformanceReport
 * (a single specific match's numbers, applied directly to one already-loaded match
 * document instead of re-querying). Mirrors the extras rules exactly: wides don't
 * count as a legal ball faced, wides/no-balls don't count as a legal ball bowled,
 * byes/leg-byes aren't runs conceded by the bowler. Also surfaces the ball that
 * dismissed this player as batsman, if any - the report's tactical tie-back needs the
 * dismissing bowler/line/length, which nothing else here computes.
 */
function accumulateMatchFigures(innings, playerId) {
  let battingEntry = null;
  let bowlingEntry = null;
  let battedForTeam = null;
  let bowledAgainstTeam = null;
  const dismissals = [];

  for (const inn of innings) {
    for (const ball of inn.balls) {
      if (ball.batsmanId && ball.batsmanId.toString() === playerId.toString()) {
        battingEntry = battingEntry || { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, wicketType: null };
        battingEntry.runs += ball.runs || 0;
        if (!(ball.isExtra && ball.extraType === 'wide')) battingEntry.balls += 1;
        if (!ball.isExtra && ball.runs === 4) battingEntry.fours += 1;
        if (!ball.isExtra && ball.runs === 6) battingEntry.sixes += 1;
        if (ball.isWicket) {
          battingEntry.out = true;
          battingEntry.wicketType = ball.wicketType || null;
          dismissals.push({
            bowlerId: ball.bowlerId ? ball.bowlerId.toString() : null,
            wicketType: ball.wicketType,
            line: ball.line,
            length: ball.length
          });
        }
        battedForTeam = inn.team ? inn.team.toString() : battedForTeam;
      }
      if (ball.bowlerId && ball.bowlerId.toString() === playerId.toString()) {
        bowlingEntry = bowlingEntry || { balls: 0, runs: 0, wickets: 0 };
        const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
        if (isLegal) bowlingEntry.balls += 1;
        if (!(ball.isExtra && ['bye', 'leg-bye'].includes(ball.extraType))) bowlingEntry.runs += ball.runs || 0;
        if (ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) bowlingEntry.wickets += 1;
        bowledAgainstTeam = inn.team ? inn.team.toString() : bowledAgainstTeam;
      }
    }
  }

  return { battingEntry, bowlingEntry, battedForTeam, bowledAgainstTeam, dismissals };
}

/**
 * Chronological match-by-match breakdown for a single player: one entry per completed
 * match they batted and/or bowled in (batted-only and bowled-only matches both
 * included, with the other side null), oldest to newest by scheduledDate. This is the
 * exact building block getCareerStats needs for its aggregate totals (extracted here so
 * it calls this instead of duplicating the ball loop) and what recent-form-trend /
 * this-match-vs-history features need directly - a real per-match sequence, not just an
 * aggregate.
 */
async function getMatchByMatchBreakdown(playerId) {
  const matches = await Match.find({
    status: 'Completed',
    $or: [
      { 'innings.balls.batsmanId': oid(playerId) },
      { 'innings.balls.bowlerId': oid(playerId) }
    ]
  }).select('innings result manOfTheMatch scheduledDate matchType').sort('scheduledDate');

  return matches.map((match) => {
    const { battingEntry, bowlingEntry, battedForTeam, bowledAgainstTeam } =
      accumulateMatchFigures(match.innings, playerId);

    // Infer which team the player was on: the team they batted for, or the
    // opponent of the team they bowled against. Left null if neither can be
    // determined (e.g. fielded only) - the win/loss count is skipped for this match.
    const playerTeam = battedForTeam || (bowledAgainstTeam
      ? match.innings.find((i) => i.team && i.team.toString() !== bowledAgainstTeam)?.team?.toString()
      : null);

    return {
      matchId: match._id.toString(),
      scheduledDate: match.scheduledDate,
      matchType: match.matchType,
      playerTeam: playerTeam || null,
      winningTeam: match.result?.winningTeam ? match.result.winningTeam.toString() : null,
      isManOfTheMatch: !!(match.manOfTheMatch && match.manOfTheMatch.toString() === playerId.toString()),
      batting: battingEntry,
      bowling: bowlingEntry
    };
  });
}

/**
 * Batting career stats grouped by Match.matchType (T20/ODI/Test/Friendly) - the
 * per-format breakdown table CricClubs shows (one row per format actually played).
 * Reuses the same per-match batting entries getCareerStats' own aggregate is built
 * from, just partitioned by format instead of pooled - so the "All Formats" row
 * getCareerStats already returns as `batting` and these per-format rows always add
 * up to the same totals. Mirrors getCareerStats.batting's field set exactly (including
 * ducks/fours/sixes, already this codebase's convention) rather than copying
 * CricClubs' "25s" column, which has no equivalent milestone elsewhere in this app.
 */
function buildBattingByFormat(breakdown) {
  const groups = new Map();
  for (const entry of breakdown) {
    if (!entry.batting) continue;
    const key = entry.matchType || 'Unknown';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry.batting);
  }

  return Array.from(groups.entries()).map(([matchType, entries]) => {
    const runs = entries.reduce((s, e) => s + e.runs, 0);
    const balls = entries.reduce((s, e) => s + e.balls, 0);
    const dismissalsCount = entries.filter((e) => e.out).length;

    return {
      matchType,
      matches: entries.length,
      innings: entries.length,
      notOuts: entries.length - dismissalsCount,
      runs,
      balls,
      average: dismissalsCount > 0 ? round(runs / dismissalsCount) : runs,
      strikeRate: balls > 0 ? round((runs / balls) * 100) : 0,
      highestScore: entries.reduce((max, e) => Math.max(max, e.runs), 0),
      centuries: entries.filter((e) => e.runs >= 100).length,
      halfCenturies: entries.filter((e) => e.runs >= 50 && e.runs < 100).length,
      ducks: entries.filter((e) => e.out && e.runs === 0).length,
      fours: entries.reduce((s, e) => s + e.fours, 0),
      sixes: entries.reduce((s, e) => s + e.sixes, 0)
    };
  }).sort((a, b) => b.matches - a.matches);
}

/**
 * Full career stats for a single player, computed directly from Match ball data
 * rather than the separate (unpopulated) PlayerStats collection - matches are the
 * source of truth. Batting/bowling are aggregated per match first so per-innings
 * figures like highest score and not-outs come out right.
 */
async function getCareerStats(playerId) {
  const breakdown = await getMatchByMatchBreakdown(playerId);

  let manOfTheMatchCount = 0;
  let wins = 0;
  let matchesWithKnownResult = 0;

  for (const entry of breakdown) {
    if (entry.isManOfTheMatch) manOfTheMatchCount += 1;
    if (entry.playerTeam && entry.winningTeam) {
      matchesWithKnownResult += 1;
      if (entry.winningTeam === entry.playerTeam) wins += 1;
    }
  }

  const battingEntries = breakdown.filter((e) => e.batting).map((e) => e.batting);
  const bowlingEntries = breakdown.filter((e) => e.bowling).map((e) => e.bowling);

  const totalRuns = battingEntries.reduce((s, e) => s + e.runs, 0);
  const totalBallsFaced = battingEntries.reduce((s, e) => s + e.balls, 0);
  const dismissals = battingEntries.filter((e) => e.out).length;
  const notOuts = battingEntries.length - dismissals;

  const totalBowlingRuns = bowlingEntries.reduce((s, e) => s + e.runs, 0);
  const totalBowlingBalls = bowlingEntries.reduce((s, e) => s + e.balls, 0);
  const totalWickets = bowlingEntries.reduce((s, e) => s + e.wickets, 0);

  const fielding = await getFieldingStats(playerId);

  const involvedMatches = breakdown.length;

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
    },
    byFormat: buildBattingByFormat(breakdown)
  };
}

/**
 * Chronological runs-per-innings list for a single player - the data behind a
 * "Runs per Innings" bar chart (CricClubs-style). One entry per innings this
 * player batted in, oldest first (getMatchByMatchBreakdown is already sorted by
 * scheduledDate).
 */
async function getRunsPerInnings(playerId) {
  const breakdown = await getMatchByMatchBreakdown(playerId);
  return breakdown
    .filter((e) => e.batting)
    .map((e) => ({
      matchId: e.matchId,
      date: e.scheduledDate,
      runs: e.batting.runs,
      notOut: !e.batting.out
    }));
}

/**
 * Career dismissal-type breakdown for a single player - the data behind a
 * "Dismissal Type" pie chart. Counts how this player got OUT as a batsman
 * (bowled/caught/lbw/run out/stumped/hit wicket/retired), plus how many
 * innings they finished not out. Not to be confused with getFieldingStats,
 * which credits this player as the FIELDER on someone else's dismissal.
 */
async function getDismissalBreakdown(playerId) {
  const breakdown = await getMatchByMatchBreakdown(playerId);
  const battingEntries = breakdown.filter((e) => e.batting).map((e) => e.batting);

  const counts = {};
  let notOut = 0;
  for (const entry of battingEntries) {
    if (!entry.out) {
      notOut += 1;
      continue;
    }
    // 'retired hurt'/'retired out' are folded into one 'retired' bucket - the
    // distinction matters for scoring, not for a career "how did you get out" chart.
    const type = entry.wicketType === 'retired hurt' || entry.wicketType === 'retired out'
      ? 'retired'
      : (entry.wicketType || 'unknown');
    counts[type] = (counts[type] || 0) + 1;
  }

  return {
    totalInnings: battingEntries.length,
    notOut,
    dismissals: Object.entries(counts).map(([wicketType, count]) => ({ wicketType, count }))
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
 * Best bowling figures comparator: more wickets wins outright; on equal wickets,
 * fewer runs conceded wins - standard "career-best bowling figures" convention.
 */
function isBetterBowlingFigures(a, b) {
  if (a.wickets !== b.wickets) return a.wickets > b.wickets;
  return a.runs < b.runs;
}

/**
 * Scans a single match's innings for this player's single-innings-scoped milestones
 * (century/half-century, five-wicket haul, hat-trick, golden duck) - the same
 * definitions getAchievements uses (ACHIEVEMENT_DEFS), but evaluated against just this
 * match's balls rather than a whole career, so getMatchPerformanceReport can say
 * plainly which badges *this specific performance* satisfies. Reimplements the small
 * hat-trick/golden-duck sequence scan (rather than calling getAchievements, which is
 * career-cumulative and can't attribute a badge to one match) but keeps every rule -
 * consecutive-in-own-legal-ball-sequence hat-tricks, first-ball-of-innings golden
 * ducks, non-bowler wicket types excluded - identical to getAchievements.
 */
function getMatchMilestoneFlags(innings, playerId, thisMatchBatting, thisMatchBowling) {
  let goldenDuck = false;
  let hatTrick = false;

  for (const inn of innings) {
    let sawFirstBattingBall = false;
    const bowlerLegalWicketSeq = [];

    for (const ball of inn.balls) {
      const isBatsman = ball.batsmanId && ball.batsmanId.toString() === playerId.toString();
      const isBowler = ball.bowlerId && ball.bowlerId.toString() === playerId.toString();

      if (isBatsman && !sawFirstBattingBall) {
        sawFirstBattingBall = true;
        if (ball.isWicket && (ball.runs || 0) === 0) goldenDuck = true;
      }

      if (isBowler) {
        const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
        if (isLegal) {
          const credited = ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType);
          bowlerLegalWicketSeq.push(credited);
        }
      }
    }

    let streak = 0;
    for (const wasWicket of bowlerLegalWicketSeq) {
      if (wasWicket) {
        streak += 1;
        if (streak >= 3) hatTrick = true;
      } else {
        streak = 0;
      }
    }
  }

  return {
    'century-maker': !!thisMatchBatting && thisMatchBatting.runs >= 100,
    'half-century-hero': !!thisMatchBatting && thisMatchBatting.runs >= 50 && thisMatchBatting.runs < 100,
    'five-wicket-haul': !!thisMatchBowling && thisMatchBowling.wickets >= 5,
    'hat-trick-hero': hatTrick,
    'golden-duck': goldenDuck
  };
}

/**
 * The post-match player performance report - the differentiated feature tying
 * together everything else in this file for one player in one match:
 *
 * 1. This match's own batting/bowling figures, computed directly from the single
 *    already-loaded match document (accumulateMatchFigures) rather than the full
 *    career aggregation, since only one match's worth of balls is needed.
 * 2. A comparison of this match's numbers against the player's career averages
 *    (getCareerStats - which, now that this match is presumably saved/Completed,
 *    includes it; not worth excluding for a negligible effect on the average).
 * 3. A recent-form trend: the last 5 matches' batting runs / bowling wickets, in
 *    chronological order, from getMatchByMatchBreakdown.
 * 4. New personal bests this match (highest score / best bowling figures compared
 *    against every OTHER match) and which named achievement badges (getAchievements'
 *    definitions) this match's performance alone satisfies.
 * 5. The tactical tie-back: for each dismissal in this match, whether the dismissing
 *    ball's (line, length) falls in the top-3 highest-dismissal-rate buckets of the
 *    hierarchical matchup plan (getMatchupPlan) for this batter against the bowler
 *    who got them out - the one section of this report no generic stat card could
 *    produce, since it depends on the shrinkage-blended matchup engine.
 */
async function getMatchPerformanceReport(matchId, playerId) {
  const match = await Match.findById(matchId).select('innings scheduledDate title status');
  if (!match) return null;

  const player = await Player.findById(playerId).populate('user', 'name');
  if (!player) return null;

  const { battingEntry, bowlingEntry, dismissals } = accumulateMatchFigures(match.innings, playerId);
  const participated = !!(battingEntry || bowlingEntry);

  const playerSummary = {
    _id: player._id,
    name: player.user?.name ?? 'Unknown',
    specialization: player.specialization
  };

  if (!participated) {
    return {
      matchId,
      player: playerSummary,
      participated: false,
      message: 'This player neither batted nor bowled in this match - nothing to report.'
    };
  }

  const thisMatch = {
    batting: battingEntry ? {
      runs: battingEntry.runs,
      balls: battingEntry.balls,
      fours: battingEntry.fours,
      sixes: battingEntry.sixes,
      out: battingEntry.out,
      strikeRate: battingEntry.balls > 0 ? round((battingEntry.runs / battingEntry.balls) * 100) : 0
    } : null,
    bowling: bowlingEntry ? {
      balls: bowlingEntry.balls,
      overs: `${Math.floor(bowlingEntry.balls / 6)}.${bowlingEntry.balls % 6}`,
      runs: bowlingEntry.runs,
      wickets: bowlingEntry.wickets,
      economy: bowlingEntry.balls > 0 ? round((bowlingEntry.runs / bowlingEntry.balls) * 6) : 0
    } : null
  };

  const [careerStats, breakdown, achievements] = await Promise.all([
    getCareerStats(playerId),
    getMatchByMatchBreakdown(playerId),
    getAchievements(playerId)
  ]);

  // --- Career-average comparison ---------------------------------------------
  const careerComparison = {};
  if (thisMatch.batting) {
    const hasEnoughHistory = careerStats.batting.matches > 1;
    const runsDelta = round(thisMatch.batting.runs - careerStats.batting.average);
    const srDelta = round(thisMatch.batting.strikeRate - careerStats.batting.strikeRate);
    careerComparison.batting = {
      careerAverage: careerStats.batting.average,
      careerStrikeRate: careerStats.batting.strikeRate,
      runsDelta,
      strikeRateDelta: srDelta,
      hasEnoughHistory,
      message: hasEnoughHistory
        ? `${Math.abs(runsDelta)} run${Math.abs(runsDelta) === 1 ? '' : 's'} ${runsDelta >= 0 ? 'above' : 'below'} your career average of ${careerStats.batting.average}, at a strike rate ${Math.abs(srDelta)} point${Math.abs(srDelta) === 1 ? '' : 's'} ${srDelta >= 0 ? 'above' : 'below'} your career strike rate of ${careerStats.batting.strikeRate}.`
        : 'Not enough batting history yet for a meaningful career comparison - this is one of your first tracked innings.'
    };
  }
  if (thisMatch.bowling) {
    const hasEnoughHistory = careerStats.bowling.matches > 1;
    const careerAvgWicketsPerMatch = careerStats.bowling.matches > 0
      ? round(careerStats.bowling.wickets / careerStats.bowling.matches) : 0;
    const wicketsDelta = round(thisMatch.bowling.wickets - careerAvgWicketsPerMatch);
    const econDelta = round(thisMatch.bowling.economy - careerStats.bowling.economyRate);
    careerComparison.bowling = {
      careerAverageWicketsPerMatch: careerAvgWicketsPerMatch,
      careerEconomyRate: careerStats.bowling.economyRate,
      wicketsDelta,
      economyDelta: econDelta,
      hasEnoughHistory,
      message: hasEnoughHistory
        ? `${thisMatch.bowling.wickets} wicket${thisMatch.bowling.wickets === 1 ? '' : 's'} vs your career average of ${careerAvgWicketsPerMatch} per match, conceding runs at an economy ${Math.abs(econDelta)} ${econDelta >= 0 ? 'above (more expensive than)' : 'below (tighter than)'} your career economy of ${careerStats.bowling.economyRate}.`
        : 'Not enough bowling history yet for a meaningful career comparison - this is one of your first tracked spells.'
    };
  }

  // --- Recent-form trend: last 5 matches, chronological, this match included ---
  const recentForm = breakdown.slice(-5).map((entry) => ({
    matchId: entry.matchId,
    scheduledDate: entry.scheduledDate,
    isThisMatch: entry.matchId === String(matchId),
    runs: entry.batting ? entry.batting.runs : null,
    wickets: entry.bowling ? entry.bowling.wickets : null
  }));

  // --- New personal bests / milestones ----------------------------------------
  const otherEntries = breakdown.filter((e) => e.matchId !== String(matchId));
  const priorHighestScore = otherEntries.reduce((max, e) => (e.batting ? Math.max(max, e.batting.runs) : max), null);
  const isCareerBestBatting = !!thisMatch.batting &&
    (priorHighestScore === null || thisMatch.batting.runs > priorHighestScore);

  let priorBestBowling = null;
  for (const e of otherEntries) {
    if (e.bowling && (!priorBestBowling || isBetterBowlingFigures(e.bowling, priorBestBowling))) {
      priorBestBowling = e.bowling;
    }
  }
  const isCareerBestBowling = !!thisMatch.bowling &&
    (!priorBestBowling || isBetterBowlingFigures(thisMatch.bowling, priorBestBowling));

  const milestoneFlags = getMatchMilestoneFlags(match.innings, playerId, thisMatch.batting, thisMatch.bowling);
  const badgesThisMatch = ACHIEVEMENT_DEFS
    .filter((def) => milestoneFlags[def.key])
    .map((def) => ({ key: def.key, label: def.label, description: def.description }));

  const milestones = {
    isCareerBestBatting,
    priorHighestScore,
    battingMessage: thisMatch.batting
      ? (isCareerBestBatting
        ? (priorHighestScore === null
          ? 'This is your first tracked innings - nothing to compare yet.'
          : `New career-best score! Previous best was ${priorHighestScore}.`)
        : `Not a career best - your highest score remains ${priorHighestScore}.`)
      : null,
    isCareerBestBowling,
    priorBestBowlingFigures: priorBestBowling ? `${priorBestBowling.wickets}/${priorBestBowling.runs}` : null,
    bowlingMessage: thisMatch.bowling
      ? (isCareerBestBowling
        ? (priorBestBowling === null
          ? 'This is your first tracked bowling spell - nothing to compare yet.'
          : `New career-best bowling figures! Previous best was ${priorBestBowling.wickets}/${priorBestBowling.runs}.`)
        : `Not a career best - your best bowling figures remain ${priorBestBowling.wickets}/${priorBestBowling.runs}.`)
      : null,
    badgesThisMatch,
    careerAchievements: achievements
  };

  // --- Tactical tie-back: dismissal(s) vs the hierarchical matchup plan --------
  const tacticalTieBack = { dismissals: [] };
  for (const d of dismissals) {
    if (!d.bowlerId) {
      tacticalTieBack.dismissals.push({
        ...d,
        note: 'No bowler recorded for this dismissal (e.g. run out) - nothing to cross-reference against a bowling matchup.'
      });
      continue;
    }
    if (d.line === 'unknown' || d.length === 'unknown') {
      tacticalTieBack.dismissals.push({
        ...d,
        note: "This dismissal's line/length wasn't tagged, so it can't be checked against the tactical model."
      });
      continue;
    }

    const plan = await getMatchupPlan(playerId, d.bowlerId);
    if (!plan || plan.buckets.every((b) => b.blendedDismissalRate === null)) {
      tacticalTieBack.dismissals.push({
        ...d,
        note: 'Not enough matchup data anywhere yet to say whether this was a flagged risk zone.'
      });
      continue;
    }

    const topRisk = plan.buckets.filter((b) => b.blendedDismissalRate !== null).slice(0, 3);
    const rank = topRisk.findIndex((b) => b.line === d.line && b.length === d.length);
    const matched = rank !== -1;

    tacticalTieBack.dismissals.push({
      ...d,
      matchedRiskZone: matched,
      topRiskBuckets: topRisk,
      note: matched
        ? `This dismissal came from a ${d.length.replace(/-/g, ' ')} ball ${d.line.replace(/-/g, ' ')} - exactly the zone the data flagged as a top risk area for you against this bowling style (ranked #${rank + 1} of the highest-dismissal-rate zones, based on ${topRisk[rank].basedOn}).`
        : `This dismissal came from outside the identifiable risk pattern (${d.length.replace(/-/g, ' ')}, ${d.line.replace(/-/g, ' ')}) - well bowled regardless of the model. The model's top risk zones for you against this bowler were ${topRisk.map((b) => `${b.length.replace(/-/g, ' ')} ${b.line.replace(/-/g, ' ')}`).join(', ')}.`
    });
  }
  if (dismissals.length === 0) {
    tacticalTieBack.message = thisMatch.batting
      ? 'Not out this match - no dismissal to cross-reference against the matchup model.'
      : "Didn't bat this match - no dismissal to cross-reference.";
  }

  return {
    matchId,
    player: playerSummary,
    participated: true,
    thisMatch,
    careerComparison,
    recentForm,
    milestones,
    tacticalTieBack
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
 * Aggregate match statistics for a tournament (total runs/wickets across every completed
 * match, the highest and lowest single-innings totals, the highest individual batting score,
 * and the best single-match bowling figures) - computed live from the tournament's own
 * Completed matches rather than a stored/synced tournament.statistics sub-document, which
 * nothing in this codebase ever actually wrote to (it stayed at its schema defaults - all
 * zeros - regardless of how many matches were played). Mirrors the "compute live from Match
 * documents" pattern getCareerStats/getTournamentBattingLeaderboard already use, rather than
 * introducing a second, sync-prone source of truth.
 */
async function getTournamentMatchStatistics(tournamentId) {
  const matches = await Match.find({ tournament: oid(tournamentId), status: 'Completed' }).select('innings').lean();

  let totalRuns = 0;
  let totalWickets = 0;
  let highestScore = 0;
  let lowestScore = 0;
  let hasAnyInnings = false;
  let highestIndividualScore = 0;
  let bestBowling = null; // { wickets, runs }

  for (const match of matches) {
    for (const inn of match.innings) {
      if (!inn.balls || inn.balls.length === 0) continue; // innings never started (e.g. abandoned match)
      hasAnyInnings = true;
      totalRuns += inn.runs || 0;
      totalWickets += inn.wickets || 0;
      if (inn.runs > highestScore) highestScore = inn.runs;
      if (lowestScore === 0 || inn.runs < lowestScore) lowestScore = inn.runs;

      const battingByPlayer = new Map();
      const bowlingByPlayer = new Map();
      for (const ball of inn.balls) {
        if (ball.batsmanId && !ball.isExtra) {
          const key = ball.batsmanId.toString();
          battingByPlayer.set(key, (battingByPlayer.get(key) || 0) + (ball.runs || 0));
        }
        if (ball.bowlerId) {
          const key = ball.bowlerId.toString();
          const figures = bowlingByPlayer.get(key) || { runs: 0, wickets: 0 };
          if (!(ball.isExtra && ['bye', 'leg-bye'].includes(ball.extraType))) figures.runs += ball.runs || 0;
          if (ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) figures.wickets += 1;
          bowlingByPlayer.set(key, figures);
        }
      }
      for (const runs of battingByPlayer.values()) {
        if (runs > highestIndividualScore) highestIndividualScore = runs;
      }
      for (const figures of bowlingByPlayer.values()) {
        if (!bestBowling || isBetterBowlingFigures(figures, bestBowling)) bestBowling = figures;
      }
    }
  }

  return {
    completedMatches: matches.length,
    totalRuns,
    totalWickets,
    highestScore,
    lowestScore: hasAnyInnings ? lowestScore : 0,
    highestIndividualScore,
    bestBowlingFigures: bestBowling ? `${bestBowling.wickets}/${bestBowling.runs}` : '0/0'
  };
}

/**
 * Batting leaderboard scoped to a single tournament, ranked by average (min 1
 * completed innings with the bat, and > 0 runs - same convention as
 * getBattingLeaderboard above, just filtered down to one tournament's matches).
 */
async function getTournamentBattingLeaderboard(tournamentId, limit = 10, divisionName = null) {
  return Match.aggregate([
    { $match: { status: 'Completed', tournament: oid(tournamentId), division: divisionName } },
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
async function getTournamentBowlingLeaderboard(tournamentId, limit = 10, divisionName = null) {
  return Match.aggregate([
    { $match: { status: 'Completed', tournament: oid(tournamentId), division: divisionName } },
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
 * Fielding leaderboard scoped to a single tournament, ranked by total dismissals
 * (catches + run outs + stumpings) descending. Same match-query + division-scoping
 * shape as getTournamentBattingLeaderboard (division: null matters for a non-divisioned
 * tournament, same reason as there); dismissal counting mirrors getFieldingStats, just
 * grouped across all fielders in one pass instead of one player at a time.
 */
async function getTournamentFieldingLeaderboard(tournamentId, limit = 20, divisionName = null) {
  return Match.aggregate([
    { $match: { status: 'Completed', tournament: oid(tournamentId), division: divisionName } },
    { $unwind: '$innings' },
    { $unwind: '$innings.balls' },
    { $match: { 'innings.balls.fielderId': { $ne: null }, 'innings.balls.isWicket': true } },
    {
      $group: {
        _id: { match: '$_id', fielder: '$innings.balls.fielderId' },
        catches: { $sum: { $cond: [{ $eq: ['$innings.balls.wicketType', 'caught'] }, 1, 0] } },
        runOuts: { $sum: { $cond: [{ $eq: ['$innings.balls.wicketType', 'run out'] }, 1, 0] } },
        stumpings: { $sum: { $cond: [{ $eq: ['$innings.balls.wicketType', 'stumped'] }, 1, 0] } }
      }
    },
    {
      $group: {
        _id: '$_id.fielder',
        // Counts matches where this fielder was credited with >=1 dismissal, not every
        // match they fielded in - the ball schema has no "fielded but no wicket" signal.
        matches: { $sum: 1 },
        catches: { $sum: '$catches' },
        runOuts: { $sum: '$runOuts' },
        stumpings: { $sum: '$stumpings' }
      }
    },
    {
      $project: {
        matches: 1,
        catches: 1,
        runOuts: 1,
        stumpings: 1,
        dismissals: { $add: ['$catches', '$runOuts', '$stumpings'] }
      }
    },
    { $match: { dismissals: { $gt: 0 } } },
    { $sort: { dismissals: -1 } },
    { $limit: limit }
  ]);
}

/**
 * "Top Performer of Series": sums each player's computeMatchMVPPoints (the same
 * points used to auto-pick each individual match's Man of the Match) across every
 * Completed match in the tournament (division) - a genuine tournament-wide MVP
 * ranking, internally consistent with what wins each match's MVP award, rather than
 * a separately-invented metric. division: null matters for the same reason as the
 * batting/bowling leaderboards above.
 */
async function getTournamentTopPerformers(tournamentId, limit = 20, divisionName = null) {
  const matches = await Match.find({ status: 'Completed', tournament: oid(tournamentId), division: divisionName })
    .select('innings')
    .lean();

  const totals = new Map(); // playerId (string) -> summed MVP points across matches
  for (const match of matches) {
    for (const [playerId, matchPoints] of computeMatchMVPPoints(match)) {
      totals.set(playerId, (totals.get(playerId) || 0) + matchPoints);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([playerId, points]) => ({ _id: playerId, points: round(points) }));
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
  getRunsPerInnings,
  getDismissalBreakdown,
  getMatchByMatchBreakdown,
  getMatchPerformanceReport,
  getAchievements,
  getBattingLeaderboard,
  getBowlingLeaderboard,
  getTournamentBattingLeaderboard,
  getTournamentBowlingLeaderboard,
  getTournamentFieldingLeaderboard,
  getTournamentTopPerformers,
  getTournamentMatchStatistics
};
