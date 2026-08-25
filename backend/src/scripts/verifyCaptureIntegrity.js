// READ-ONLY launch gate: does the complete production path actually preserve the three
// unbackfillable observations we instrumented?
//
// The backend tests prove the controller writes them. This proves the whole chain does -
//   mobile UI -> API -> controller -> MongoDB -> persisted document
// - against a real match scored through the real client. A passing mobile test with a broken
// persistence path would produce exactly the silent data loss the instrumentation exists to
// prevent, and nothing else in the stack would notice.
//
// Run after the remote dry-run match (pilot-deployment-plan.md step 7):
//
//   MONGO_URI='mongodb+srv://...' node backend/src/scripts/verifyCaptureIntegrity.js
//   MONGO_URI='...' node backend/src/scripts/verifyCaptureIntegrity.js <matchId>
//
// Never writes. Match.find(...).lean() and Prediction.find(...).lean() only. Exits non-zero on
// any failure so it can gate a deploy script.

const mongoose = require('mongoose');
const connectDB = require('../config/database');
const Match = require('../models/Match');
const Prediction = require('../models/Prediction');

const NON_LEGAL_EXTRAS = ['wide', 'no-ball'];
const isLegal = (b) => !(b.isExtra && NON_LEGAL_EXTRAS.includes(b.extraType));

/**
 * Pure checker so the logic is testable without a database.
 * @returns {{checks: Array<{name, pass, detail}>, passed: boolean}}
 */
function verifyMatch(match, predictions = []) {
  const checks = [];
  const add = (name, pass, detail = '') => checks.push({ name, pass, detail });

  // ---- 1. per-ball match state --------------------------------------------------------------
  const innings = match.innings || [];
  let totalBalls = 0;
  let missing = 0;
  const chainErrors = [];

  innings.forEach((inn, idx) => {
    const balls = inn.balls || [];
    totalBalls += balls.length;

    let runs = 0;
    let wickets = 0;
    let legal = 0;
    balls.forEach((b, i) => {
      const has = b.runsBefore != null && b.wicketsBefore != null && b.legalBallsBefore != null;
      if (!has) { missing += 1; return; }

      // The state recorded on this ball must equal the state accumulated from every ball before
      // it. This is the check that catches a capture that exists but means the wrong thing -
      // an off-by-one, or state read after mutation instead of before.
      if (b.runsBefore !== runs || b.wicketsBefore !== wickets || b.legalBallsBefore !== legal) {
        chainErrors.push(
          `innings ${idx} ball ${i + 1}: stored (${b.runsBefore}/${b.wicketsBefore} off ${b.legalBallsBefore}) ` +
          `!= accumulated (${runs}/${wickets} off ${legal})`
        );
      }
      runs += b.runs || 0;
      if (b.isWicket) wickets += 1;
      if (isLegal(b)) legal += 1;
    });

    if (balls.length > 0) {
      const finalLegal = balls.filter(isLegal).length;
      const agrees = runs === (inn.runs || 0) && wickets === (inn.wickets || 0) && legal === finalLegal;
      add(`innings ${idx}: reconstructed totals match the innings`, agrees,
        agrees ? `${runs}/${wickets} off ${legal} legal` :
          `reconstructed ${runs}/${wickets} off ${legal}, innings says ${inn.runs}/${inn.wickets}`);
    }
  });

  add('every ball carries pre-delivery state', missing === 0 && totalBalls > 0,
    totalBalls === 0 ? 'no balls recorded - nothing to verify'
      : missing === 0 ? `${totalBalls} balls, all captured`
        : `${missing} of ${totalBalls} balls missing runsBefore/wicketsBefore/legalBallsBefore ` +
          '(balls scored before the instrumentation merge legitimately lack these)');

  add('pre-delivery state is consistent ball to ball', chainErrors.length === 0,
    chainErrors.length === 0 ? 'chain intact' : chainErrors.slice(0, 3).join(' | '));

  // ---- 2. man-of-the-match provenance -------------------------------------------------------
  if (match.status === 'Completed') {
    add('manOfTheMatchComputed recorded', match.manOfTheMatchComputed != null,
      match.manOfTheMatchComputed ? String(match.manOfTheMatchComputed)
        : 'MISSING - the algorithm pick was not stored, so agreement/disagreement is unrecoverable');

    const src = match.manOfTheMatchSource;
    add('manOfTheMatchSource set', src === 'algorithm' || src === 'human', String(src));

    if (src === 'human') {
      add('human pick records who and when',
        match.manOfTheMatchSelectedBy != null && match.manOfTheMatchSelectedAt != null,
        `by=${match.manOfTheMatchSelectedBy} at=${match.manOfTheMatchSelectedAt}`);
      add('the overridden algorithm pick is still recoverable', match.manOfTheMatchComputed != null,
        `human=${match.manOfTheMatch} algorithm=${match.manOfTheMatchComputed}`);
    } else if (src === 'algorithm') {
      add('agreement case is observable',
        String(match.manOfTheMatch) === String(match.manOfTheMatchComputed),
        'final selection equals the algorithm pick, and that is now recorded rather than inferred');
    }
  } else {
    add('man-of-the-match checks', true, `skipped - match status is ${match.status}, not Completed`);
  }

  // ---- 3. prediction revision history --------------------------------------------------------
  if (predictions.length === 0) {
    add('prediction revision history', true, 'no predictions on this match - nothing to verify');
  } else {
    const revised = predictions.filter((p) => (p.revisions || []).length > 0);
    add('prediction documents readable', true, `${predictions.length} prediction(s), ${revised.length} revised`);
    const ordinalErrors = revised.filter((p) =>
      p.revisions.some((r, i) => r.revision !== i + 1 || !r.predictedWinner || !r.supersededAt));
    add('revision ordinals and payloads intact', ordinalErrors.length === 0,
      ordinalErrors.length === 0 ? 'all revisions numbered from 1 with a winner and a timestamp'
        : `${ordinalErrors.length} prediction(s) with malformed revisions`);
  }

  return { checks, passed: checks.every((c) => c.pass) };
}

async function main() {
  await connectDB();
  const matchId = process.argv[2];

  const match = matchId
    ? await Match.findById(matchId).lean()
    : await Match.findOne({ status: 'Completed' }).sort({ updatedAt: -1 }).lean();

  if (!match) {
    console.error(matchId ? `Match ${matchId} not found.` : 'No Completed match found to verify.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const predictions = await Prediction.find({ match: match._id }).lean();
  const { checks, passed } = verifyMatch(match, predictions);

  console.log(`\nCapture integrity - match ${match._id} ("${match.title}", ${match.status})\n`);
  for (const c of checks) {
    console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}`);
    if (c.detail) console.log(`        ${c.detail}`);
  }
  console.log(`\n${passed ? 'ALL CHECKS PASSED' : 'FAILURES PRESENT - do not admit real users'}\n`);

  await mongoose.disconnect();
  process.exit(passed ? 0 : 1);
}

if (require.main === module) {
  main().catch((err) => { console.error('Verification failed to run:', err); process.exit(1); });
}

module.exports = { verifyMatch };
