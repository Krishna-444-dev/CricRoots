// The merge gate for production changes made while the research record must stay reproducible.
//
// D8 (amended 2026-08-25) permits unbackfillable production instrumentation on isolated branches
// provided existing research behaviour is unchanged. File-hash equality is the right test for MOST
// of the reproducibility surface, but it is NOT sufficient, and assuming it would have missed the
// actual risk:
//
//   backend/src/services/tendencyAnalytics.js   byte-identical   <- hash is enough
//   backend/src/utils/statUtils.js              byte-identical   <- hash is enough
//   backend/src/services/mvpCalculator.js       byte-identical   <- reached via tendencyAnalytics
//   backend/src/models/Match.js                 *** CHANGED ***  <- hash is NOT enough
//
// research/harness/evaluate.js seeds real Match/Player documents and calls the real
// getLineLengthBreakdown, so Match.js is inside the reproducibility surface. The instrumentation
// branch adds optional fields to its ball subdocument. Additive-and-optional *should* be inert -
// but "should" is precisely what this project keeps getting burned by, so this measures it.
//
// Produces a deterministic fingerprint of research-relevant behaviour. Run on both refs; the
// hashes must match.
//
//   NODE_PATH=$PWD/backend/node_modules node research/harness/reproducibility-fingerprint.js

const crypto = require('crypto');
const path = require('path');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const { makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { hierarchicalBlend, blendWithPrior } = require(
  path.join(__dirname, '..', '..', 'backend', 'src', 'utils', 'statUtils'));
const { getLineLengthBreakdown } = require(
  path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'tendencyAnalytics'));
const Player = require(path.join(__dirname, '..', '..', 'backend', 'src', 'models', 'Player'));
const Match = require(path.join(__dirname, '..', '..', 'backend', 'src', 'models', 'Match'));

const SEED = 424242;
const N_BATTERS = 8;
const N_BOWLERS = 6;
const N_MATCHES = 5;
const BALLS_PER_MATCH = 90;

// Fixed ObjectIds so the fingerprint does not depend on generated ids.
const oid = (n) => new mongoose.Types.ObjectId(String(n).padStart(24, '0'));

// Arrays are canonicalised by SORTING their serialised elements, not by preserving order.
// getLineLengthBreakdown is a Mongo aggregation and its row order is not guaranteed - the first
// version of this script preserved order and produced a different hash on every run of the SAME
// ref, which would have reported a spurious gate failure against the instrumentation branch.
//
// This is sound because the breakdown is consumed as a keyed set of line/length buckets (see
// research/baselines.js), never as an ordered list. If a future consumer depends on row order,
// this canonicalisation would hide that change and must be revisited.
function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).sort().join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v).sort().map((k) => `${k}:${stable(v[k])}`).join(',')}}`;
  }
  if (typeof v === 'number') return Number.isFinite(v) ? v.toFixed(10) : String(v);
  return String(v);
}

async function main() {
  const parts = [];

  // 1. Pure statUtils - the shrinkage arithmetic every baseline in the programme rests on.
  for (const args of [[0.3, 10, 0.05, 500], [0.0, 0, 0.05, 500], [0.085, 200, 0.05, 9000]]) {
    parts.push(`blendWithPrior(${args.join(',')})=${stable(blendWithPrior(...args))}`);
  }
  parts.push(`hierarchicalBlend=${stable(hierarchicalBlend([
    { value: 0.12, n: 4, label: 'exact' },
    { value: 0.09, n: 40, label: 'batter-vs-style' },
    { value: 0.06, n: 400, label: 'archetype' },
    { value: 0.045, n: 9000, label: 'population' }
  ], 20))}`);

  // 2. The database-backed path, where a Match schema change could bite.
  const mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  const batterIds = Array.from({ length: N_BATTERS }, (_, i) => oid(1000 + i));
  const bowlerIds = Array.from({ length: N_BOWLERS }, (_, i) => oid(2000 + i));
  // Same required fields evaluate.js's seedPlayers supplies - `user` and `specialization` are
  // required by the Player schema, and the fingerprint must exercise the real schema, not bypass it.
  await Player.insertMany([
    ...batterIds.map((id, i) => ({
      _id: id, user: oid(4000 + i), specialization: 'Batsman',
      battingStyle: i % 2 ? 'Left-hand' : 'Right-hand', bowlingStyle: 'None'
    })),
    ...bowlerIds.map((id, i) => ({
      _id: id, user: oid(5000 + i), specialization: 'Bowler',
      battingStyle: 'Right-hand', bowlingStyle: i % 2 ? 'Right-arm Spin' : 'Right-arm Fast'
    }))
  ]);

  const rng = makeRng(SEED);
  const matchDocs = [];
  for (let m = 0; m < N_MATCHES; m++) {
    const balls = [];
    for (let b = 0; b < BALLS_PER_MATCH; b++) {
      balls.push({
        ballNumber: b + 1,
        batsmanId: batterIds[Math.floor(rng.uniform() * N_BATTERS)],
        bowlerId: bowlerIds[Math.floor(rng.uniform() * N_BOWLERS)],
        runs: rng.pick([0, 0, 1, 1, 2, 4, 6]),
        isWicket: rng.uniform() < 0.05,
        wicketType: null,
        isExtra: false,
        extraType: 'none',
        line: rng.pick(LINES),
        length: rng.pick(LENGTHS),
        shotType: null,
        shotZone: null,
        fielderId: null,
        fielderPosition: null
      });
    }
    matchDocs.push({
      _id: oid(3000 + m),
      title: `fingerprint-${m}`,
      team1: oid(6001), team2: oid(6002),
      venue: 'fingerprint', createdBy: oid(6003),
      scheduledDate: new Date('2026-01-01T00:00:00.000Z'),
      matchType: 'T20', totalOvers: 20,
      status: 'Completed',
      innings: [{ runs: 0, wickets: 0, overs: 15, balls }]
    });
  }
  await Match.insertMany(matchDocs, { validateBeforeSave: false });

  // 3. The real production query the harness depends on - overall, and per batter.
  parts.push(`breakdown(all)=${stable(await getLineLengthBreakdown({}))}`);
  for (const id of batterIds) {
    parts.push(`breakdown(${id})=${stable(await getLineLengthBreakdown({ batsmanIds: [id.toString()] }))}`);
  }
  for (const id of bowlerIds.slice(0, 3)) {
    parts.push(`breakdownBowler(${id})=${stable(await getLineLengthBreakdown({ bowlerIds: [id.toString()] }))}`);
  }

  await mongoose.disconnect();
  await mongod.stop();

  const hash = crypto.createHash('sha256').update(parts.join('\n')).digest('hex');
  console.log(`research reproducibility fingerprint: ${hash}`);
  console.log(`  components: ${parts.length}  seed: ${SEED}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
