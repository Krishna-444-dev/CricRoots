// Measures the training/serving feature skew documented in documentation/ai-engine-audit.md §7,
// BEFORE any of it is fixed, so the post-remediation comparison is possible at all.
//
// Why this needs simulated states rather than data/real_matches.csv: the extraction emits rows
// only at COMPLETED overs, where cricket notation ("3.4") and true decimal overs (3.667) agree
// exactly. The training file therefore cannot exhibit the skew. The live push
// (matchController.js:491) fires after EVERY ball, so most served states are mid-over. Measuring
// the skew requires states the training file structurally does not contain.
//
// Read-only. Touches no database and no production code path.

const fs = require('fs');
const path = require('path');
const { mulberry32, replayChase } = require('./simulatorProcess');

const OUT_DIR = path.join(__dirname, '..', 'results', 'pre-remediation');
const REAL_CSV = path.join(__dirname, '..', 'data', 'real_matches.csv');
const SEED = 20260819;
const N_CHASES = 4000;

// --- the two feature constructions, transcribed from the code that performs them --------------

// backend/src/controllers/matchController.js:470 - what the DB actually stores.
function storedOvers(legalBalls) {
  return Math.floor(legalBalls / 6) + ((legalBalls % 6) / 10);
}

// matchController.js:491-497 / :626-633 / :823-830 - all three sites build it this way.
function servedFeatures({ legalBalls, runs, wickets, target }) {
  const overs = storedOvers(legalBalls);
  return {
    overs_remaining: 20 - overs,
    wickets_down: wickets,
    current_run_rate: runs / (overs || 1),
    target_score: target - 1 // sites pass innings[0].runs; the true target is that + 1
  };
}

// backend/src/scripts/extractWinProbabilityData.js - what training actually saw.
function trainingFeatures({ legalBalls, runs, wickets, target, totalOvers }) {
  const oversUsed = legalBalls / 6;
  return {
    overs_remaining: totalOvers - oversUsed,
    wickets_down: wickets,
    current_run_rate: oversUsed > 0 ? runs / oversUsed : 0,
    target_score: target
  };
}

// --- realistic targets, drawn from the empirical distribution in the training file -------------

function empiricalTargets() {
  const rows = fs.readFileSync(REAL_CSV, 'utf8').trim().split('\n').slice(1);
  const byMatch = new Map();
  for (const line of rows) {
    const f = line.split(',');
    byMatch.set(f[0], Number(f[4]));
  }
  return [...byMatch.values()];
}

function quantile(sorted, q) {
  const i = (sorted.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

function describe(label, values) {
  const s = [...values].sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  return {
    label,
    n: s.length,
    mean: +mean.toFixed(5),
    p50: +quantile(s, 0.5).toFixed(5),
    p90: +quantile(s, 0.9).toFixed(5),
    p99: +quantile(s, 0.99).toFixed(5),
    max: +s[s.length - 1].toFixed(5)
  };
}

function main() {
  const rand = mulberry32(SEED);
  const targets = empiricalTargets();

  const rows = [];
  for (let i = 0; i < N_CHASES; i++) {
    const target = targets[Math.floor(rand() * targets.length)];
    const { states } = replayChase({ target, totalOvers: 20, rand });
    for (const st of states) rows.push(st);
  }

  const crrAbs = [];
  const crrRel = [];
  const oversAbs = [];
  const midOverCrrRel = [];
  let midOver = 0;

  const csv = ['legal_balls,balls_into_over,runs,wickets,target,' +
    'served_overs_remaining,served_wickets_down,served_current_run_rate,served_target_score,' +
    'train_overs_remaining,train_wickets_down,train_current_run_rate,train_target_score'];

  for (const st of rows) {
    const s = servedFeatures(st);
    const t = trainingFeatures(st);
    const dCrr = Math.abs(s.current_run_rate - t.current_run_rate);
    const dOvers = Math.abs(s.overs_remaining - t.overs_remaining);
    crrAbs.push(dCrr);
    oversAbs.push(dOvers);
    if (t.current_run_rate > 0) crrRel.push(dCrr / t.current_run_rate);
    const into = st.legalBalls % 6;
    if (into !== 0) {
      midOver += 1;
      if (t.current_run_rate > 0) midOverCrrRel.push(dCrr / t.current_run_rate);
    }
    csv.push([
      st.legalBalls, into, st.runs, st.wickets, st.target,
      s.overs_remaining, s.wickets_down, s.current_run_rate, s.target_score,
      t.overs_remaining, t.wickets_down, t.current_run_rate, t.target_score
    ].join(','));
  }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'serving-skew-states.csv'), csv.join('\n') + '\n');

  const report = {
    seed: SEED,
    n_chases: N_CHASES,
    n_served_states: rows.length,
    mid_over_states: midOver,
    mid_over_fraction: +(midOver / rows.length).toFixed(4),
    current_run_rate_absolute_error: describe('|Δ current_run_rate| (runs/over)', crrAbs),
    current_run_rate_relative_error: describe('|Δ current_run_rate| / true', crrRel),
    current_run_rate_relative_error_mid_over_only: describe('|Δ CRR|/true, mid-over only', midOverCrrRel),
    overs_remaining_absolute_error: describe('|Δ overs_remaining| (overs)', oversAbs),
    target_score_error: 'exactly -1 on every served state (sites pass innings[0].runs, training used +1)'
  };

  fs.writeFileSync(path.join(OUT_DIR, 'serving-skew.json'), JSON.stringify(report, null, 2) + '\n');

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nWrote ${rows.length} states to ${path.join(OUT_DIR, 'serving-skew-states.csv')}`);
}

main();
