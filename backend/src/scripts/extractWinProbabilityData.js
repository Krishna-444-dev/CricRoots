// Read-only extraction: walks every Completed match's chasing innings ball-by-ball and emits
// one win-probability training row per completed over, using a REAL outcome (did the chasing
// team actually win?) as the label instead of data_generator.py's hand-written heuristic
// formula. Output feeds ai-engine/src/models/recommendation_model.py's win_prob_model.
//
// Run from host (Mongo exposed at localhost:27017):
//   MONGO_URI='mongodb://admin:...@localhost:27017/cricsync?authSource=admin' \
//     node backend/src/scripts/extractWinProbabilityData.js
//
// Never writes/updates/deletes any Match/Tournament/Team/Player document - Match.find(...).lean()
// only.

const fs = require('fs');
const path = require('path');
const connectDB = require('../config/database');
const Match = require('../models/Match');
const { isLegalBall, chaseFeatures } = require('../services/matchStateFeatures');

const OUT_PATH = path.join(__dirname, '..', '..', '..', 'ai-engine', 'data', 'real_matches.csv');

// Feature construction now comes from services/matchStateFeatures.js, shared with every serving
// path. This file previously carried a comment warning that the DB's stored "3.4" cricket-notation
// overs field "isn't a valid divisor for a run rate" - correct, and correctly applied here, while
// three serving sites divided by it anyway. The warning was right and did nothing. Importing the
// same function is what actually enforces it; matchStateFeatures.test.js asserts the parity.

// A completed innings' balls array is only consistent with having been capped at `target` if
// cumulative runs never reach it before the very last recorded ball (the simulator - and any
// real scorer following the same rule - stops the instant runs >= target).
//
// NOTE this is a ONE-SIDED test: the lower-scoring side of any match trivially satisfies it for
// almost any target above its own final score, whether or not it was really the chase - so it
// must only ever be applied to the HIGHER-scoring side (see resolveChaseIndex below). An earlier
// version of this function ran it symmetrically on both innings and treated "both pass" as
// ambiguous; since the lower scorer's side always trivially passes, that discarded every match
// where the chasing team actually won (both sides "validated") while keeping every match where
// the chase failed - silently producing a training set that was 100% losses. Caught by checking
// the label distribution of the first extraction run before trusting it (win rows: 0 out of
// 5922) - see git history for that version if useful context.
function isConsistentWithCap(balls, target) {
  let cum = 0;
  for (let i = 0; i < balls.length - 1; i++) {
    cum += balls[i].runs || 0;
    if (cum >= target) return false;
  }
  return true;
}

// Recovers which of innings[0]/innings[1] was the actual chase even though Match has no stored
// toss/batting-order field beyond the fixed team1<->innings[0], team2<->innings[1] mapping (see
// matchOrchestration.js - team1BatsFirst is a per-match coin flip, so array position alone
// doesn't say who batted second). Every match has exactly one capped (chasing) innings and one
// uncapped (batted-first) innings, so proving the higher scorer can't be the chase is enough to
// conclude the lower scorer is, by elimination - no need to independently test the lower side.
//
//   1. Higher scorer finished before using all wickets/overs -> the only way an innings ends
//      early is by reaching its target, so the higher scorer is definitely the chase, and won.
//   2. Higher scorer was bowled out (10 wickets) -> a real capped chase stops the instant it
//      reaches target (wicket or not), so a side that kept batting all the way to its 10th
//      wicket cannot have already reached one - the higher scorer can't be the chase here, so
//      the lower scorer is, and lost.
//   3. Higher scorer used the full quota without being bowled out -> genuinely ambiguous
//      (could be an uncapped first innings that simply outscored the other, or a chase won off
//      the very last ball of the innings). Resolved with the crossing check: if the higher
//      scorer's cumulative ever reaches the lower scorer's total+1 before its last ball, it
//      can't have been capped there (loss for the lower scorer); otherwise treat it as a
//      last-ball chase win. This has residual false-positive risk for very close matches (the
//      higher scorer could coincidentally never cross the mark until its own final ball purely
//      by luck) - accepted as a documented limitation rather than discarding this bucket
//      entirely, since for real match-deciding margins it's a reliable signal.
function resolveChaseIndex(match) {
  const i0 = match.innings[0];
  const i1 = match.innings[1];
  if (!i0 || !i1 || !i0.balls?.length || !i1.balls?.length) return null;
  if (i0.runs === i1.runs) return null; // tie - no winner to label against

  const totalOvers = match.totalOvers || 20;
  const higherIdx = i0.runs > i1.runs ? 0 : 1;
  const lowerIdx = higherIdx === 0 ? 1 : 0;
  const higher = match.innings[higherIdx];
  const lower = match.innings[lowerIdx];

  const higherEndedEarly = higher.wickets < 10 && higher.overs < totalOvers;
  if (higherEndedEarly) {
    return { chaseIdx: higherIdx, target: lower.runs + 1 };
  }
  if (higher.wickets >= 10) {
    return { chaseIdx: lowerIdx, target: higher.runs + 1 };
  }
  const target = lower.runs + 1;
  if (isConsistentWithCap(higher.balls, target)) {
    return { chaseIdx: higherIdx, target };
  }
  return { chaseIdx: lowerIdx, target: higher.runs + 1 };
}

function extractRows(match) {
  const resolved = resolveChaseIndex(match);
  if (!resolved) return { rows: [], skipReason: 'tie_or_malformed' };

  const winnerId = match.result?.winningTeam ? String(match.result.winningTeam) : null;
  if (!winnerId) return { rows: [], skipReason: 'no_result' };

  const { chaseIdx, target } = resolved;
  const chaseTeamId = String(chaseIdx === 0 ? match.team1 : match.team2);
  const label = winnerId === chaseTeamId ? 1 : 0;
  const totalOvers = match.totalOvers || 20;
  const maxLegalBalls = totalOvers * 6;

  const rows = [];
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;

  for (const ball of match.innings[chaseIdx].balls) {
    runs += ball.runs || 0;
    if (ball.isWicket) wickets += 1;
    if (isLegalBall(ball)) legalBalls += 1;

    // One row per completed over - fine enough granularity to capture the arc of a chase
    // (powerplay, middle overs, death overs) without 6x-oversampling near-duplicate
    // consecutive-ball states within the same over, and it's a natural checkpoint a real
    // tactical-advisor call would actually be made at (between overs).
    if (legalBalls > 0 && legalBalls % 6 === 0 && legalBalls < maxLegalBalls) {
      const f = chaseFeatures({ legalBalls, runs, wickets, target, totalOvers });
      rows.push({
        match_id: String(match._id),
        overs_remaining: f.oversRemaining,
        wickets_down: f.wicketsDown,
        current_run_rate: f.currentRunRate,
        target_score: f.targetScore,
        win_probability: label
      });
    }
  }

  return { rows, skipReason: null };
}

function toCsv(rows) {
  const header = 'match_id,overs_remaining,wickets_down,current_run_rate,target_score,win_probability';
  const lines = rows.map(
    (r) =>
      `${r.match_id},${r.overs_remaining},${r.wickets_down},${r.current_run_rate},${r.target_score},${r.win_probability}`
  );
  return [header, ...lines].join('\n') + '\n';
}

async function main() {
  await connectDB();

  const matches = await Match.find({ status: 'Completed' })
    .select('innings.runs innings.wickets innings.overs innings.balls result team1 team2 totalOvers')
    .lean();

  console.log(`Found ${matches.length} Completed matches.`);

  const allRows = [];
  const skipCounts = {};
  for (const match of matches) {
    const { rows, skipReason } = extractRows(match);
    if (skipReason) {
      skipCounts[skipReason] = (skipCounts[skipReason] || 0) + 1;
      continue;
    }
    allRows.push(...rows);
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, toCsv(allRows));

  console.log(`Matches used: ${matches.length - Object.values(skipCounts).reduce((a, b) => a + b, 0)}`);
  console.log(`Matches skipped:`, skipCounts);
  console.log(`Training rows written: ${allRows.length}`);
  console.log(`Output: ${OUT_PATH}`);

  await require('mongoose').disconnect();
}

// Guarded so the pure functions can be imported by the end-to-end parity test without the module
// trying to open a Mongo connection on require.
if (require.main === module) {
  main().catch((err) => {
    console.error('Extraction failed:', err);
    process.exit(1);
  });
}

module.exports = { extractRows, resolveChaseIndex, toCsv, isConsistentWithCap };
