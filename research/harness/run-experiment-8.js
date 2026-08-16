// Experiment 8 - H12, low-rank joint estimation under sparsity. See experiment-8-design.md.
//
// Three arms in each of World D+ and D-:
//   A  joint (existing)                  mu + batter + bowler + arch + ll + interaction
//   B  joint + low-rank                  A + u_b . v_ll
//   C  low-rank, no free interaction     mu + batter + bowler + arch + ll + u_b . v_ll
//
// B vs C is the decisive comparison: does the unconstrained pairwise term absorb structure the
// latent term should be representing?
//
// Runs as pure computation, no database. Legitimate because every arm here is fit once and its
// prediction depends only on (batter, bowler, styles, line, length) - not on any revealed-ball
// state - so fitting on training balls and evaluating on test balls reproduces the harness's
// fit-once methods exactly. Same population/split seeds as Experiments 4/5/7.
//
// Metrics only, no interpretation.
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { generatePopulation, generateLeagueMatches, trueProbability, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { fitWithCrossValidatedLambda } = require('../models/regularizedHierarchicalLogit');
const { fitWithCrossValidation } = require('../models/lowRankJointLogit');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const LATENT = { K: 3, sigmaPhi: 0.22 };
const BINS = [[0, 0], [1, 1], [2, 4], [5, 9], [10, 14], [15, Infinity]];

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

function buildWorld(mode) {
  const pop = generatePopulation({ ...BASE_POP, latentFactors: { ...LATENT, mode } });
  const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE });
  const shuffled = seededShuffle(matches, 3);
  const numTest = Math.round(matches.length * 0.15);
  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const toRows = (ms) => {
    const rows = [];
    for (const m of ms) for (const inn of m.innings) for (const ball of inn.balls) rows.push({
      batterId: ball.batsmanId, bowlerId: ball.bowlerId,
      battingStyle: bStyle.get(ball.batsmanId), bowlingStyle: wStyle.get(ball.bowlerId),
      line: ball.line, length: ball.length, isWicket: ball.isWicket
    });
    return rows;
  };
  const trainRows = toRows(shuffled.slice(0, matches.length - numTest));
  const testRows = toRows(shuffled.slice(matches.length - numTest));
  // exact-matchup n from training data, for the sample-efficiency stratification
  const pairN = new Map();
  for (const r of trainRows) pairN.set(`${r.batterId}|${r.bowlerId}`, (pairN.get(`${r.batterId}|${r.bowlerId}`) || 0) + 1);
  for (const r of testRows) {
    r.pTrue = trueProbability(pop, r.batterId, r.bowlerId, r.line, r.length);
    r.exactN = pairN.get(`${r.batterId}|${r.bowlerId}`) || 0;
  }
  // global rate per (line,length) from training
  const g = new Map();
  for (const r of trainRows) {
    const k = `${r.line}|${r.length}`;
    if (!g.has(k)) g.set(k, [0, 0]);
    const e = g.get(k); e[0]++; if (r.isWicket) e[1]++;
  }
  return { pop, trainRows, testRows, globalAt: (line, length) => { const e = g.get(`${line}|${length}`); return e && e[0] > 0 ? e[1] / e[0] : null; } };
}

function evaluate(predict, testRows) {
  const errs = testRows.map((r) => Math.abs(predict(r) - r.pTrue));
  const brier = mean(testRows.map((r) => (predict(r) - (r.isWicket ? 1 : 0)) ** 2));
  const byBin = BINS.map(([lo, hi]) => {
    const bin = testRows.filter((r) => r.exactN >= lo && r.exactN <= hi);
    return { range: hi === Infinity ? `${lo}+` : lo === hi ? `${lo}` : `${lo}-${hi}`, n: bin.length, mae: bin.length ? mean(bin.map((r) => Math.abs(predict(r) - r.pTrue))) : null };
  });
  return { mae: mean(errs), brier, byBin };
}

function latentRecovery(pop, params, design, K) {
  const fitv = [], truev = [];
  for (const b of pop.batters) {
    const bi = design.batterIdx.get(b._id);
    if (bi === undefined) continue;
    for (const line of LINES) for (const length of LENGTHS) {
      const li = design.llIdx.get(`${line}|${length}`);
      if (li === undefined) continue;
      let f = 0;
      for (let k = 0; k < K; k++) f += params.U[bi * K + k] * params.V[li * K + k];
      fitv.push(f);
      truev.push(latentTerm(pop, b._id, line, length, 'target'));
    }
  }
  // In D- the true target-channel latent term is identically zero, so correlation is undefined
  // rather than low; report null so it is not silently read as "recovered nothing".
  const allZero = truev.every((x) => x === 0);
  return allZero ? null : corr(fitv, truev);
}

function runWorld(mode, label) {
  console.log(`\n${'='.repeat(100)}\n${label}\n${'='.repeat(100)}`);
  const world = buildWorld(mode);
  const { pop, trainRows, testRows } = world;

  const out = { label, mode, arms: {} };

  // Reference points
  const globalPredict = (r) => world.globalAt(r.line, r.length);
  out.arms.global = evaluate(globalPredict, testRows);
  const oraclePredict = (r) => {
    const g = world.globalAt(r.line, r.length);
    return sigmoid(logit(Math.min(Math.max(g, 1e-6), 1 - 1e-6)) + latentTerm(pop, r.batterId, r.line, r.length, 'target'));
  };
  out.arms.oracleLatentCeiling = evaluate(oraclePredict, testRows);

  // Arm A - existing joint model, unchanged
  console.log('  fitting arm A (joint, existing)...');
  let t = Date.now();
  const A = fitWithCrossValidatedLambda(trainRows);
  out.arms.A_joint = { ...evaluate((r) => A.predict(r), testRows), chosenLambda: A.chosenLambda, iterations: A.finalFitIterations, hitCap: A.hitIterationCap, seconds: (Date.now() - t) / 1000 };
  console.log(`    done ${((Date.now() - t) / 1000).toFixed(0)}s  lambda=${A.chosenLambda}  mae=${out.arms.A_joint.mae.toFixed(6)}`);

  // Arm B - joint + low-rank
  console.log('  fitting arm B (joint + low-rank)...');
  t = Date.now();
  const B = fitWithCrossValidation(trainRows, { useInteraction: true });
  out.arms.B_lowRank = {
    ...evaluate((r) => B.predict(r), testRows),
    K: B.K, lambdaLowRank: B.lambdaLowRank, restartObjectives: B.restartObjectives, restartSpread: B.restartSpread,
    iterations: B.iterationsRun, hitCap: B.hitIterationCap,
    rLatent: latentRecovery(pop, B.params, B.design, B.K), seconds: (Date.now() - t) / 1000
  };
  console.log(`    done ${((Date.now() - t) / 1000).toFixed(0)}s  K=${B.K} lambdaLR=${B.lambdaLowRank}  mae=${out.arms.B_lowRank.mae.toFixed(6)}  rLatent=${out.arms.B_lowRank.rLatent === null ? 'n/a' : out.arms.B_lowRank.rLatent.toFixed(4)}`);

  // Arm C - low-rank, no free interaction
  console.log('  fitting arm C (low-rank, no interaction)...');
  t = Date.now();
  const C = fitWithCrossValidation(trainRows, { useInteraction: false });
  out.arms.C_lowRankNoInteraction = {
    ...evaluate((r) => C.predict(r), testRows),
    K: C.K, lambdaLowRank: C.lambdaLowRank, restartObjectives: C.restartObjectives, restartSpread: C.restartSpread,
    iterations: C.iterationsRun, hitCap: C.hitIterationCap,
    rLatent: latentRecovery(pop, C.params, C.design, C.K), seconds: (Date.now() - t) / 1000
  };
  console.log(`    done ${((Date.now() - t) / 1000).toFixed(0)}s  K=${C.K} lambdaLR=${C.lambdaLowRank}  mae=${out.arms.C_lowRankNoInteraction.mae.toFixed(6)}  rLatent=${out.arms.C_lowRankNoInteraction.rLatent === null ? 'n/a' : out.arms.C_lowRankNoInteraction.rLatent.toFixed(4)}`);

  return out;
}

function main() {
  const startedAt = new Date().toISOString();
  const dPlus = runWorld('target', 'WORLD D+ (latent drives the TARGET)');
  const dMinus = runWorld('runs', 'WORLD D- (negative control: latent drives RUN-SCORING)');

  const gitCommit = execSync('git rev-parse HEAD', { cwd: path.join(__dirname, '..', '..') }).toString().trim();
  const runDir = path.join(__dirname, '..', 'results', `8_${startedAt.replace(/[:.]/g, '-')}`);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ startedAt, codeVersion: gitCommit, latent: LATENT, dPlus, dMinus }, null, 2));

  console.log(`\n${'='.repeat(100)}\nRAW SUMMARY (no interpretation applied)\n${'='.repeat(100)}`);
  for (const w of [dPlus, dMinus]) {
    console.log(`\n${w.label}`);
    console.log(`  ${'arm'.padEnd(28)} ${'oracle MAE'.padStart(11)} ${'Brier'.padStart(11)} ${'rLatent'.padStart(9)} ${'K'.padStart(3)}`);
    for (const [name, a] of Object.entries(w.arms)) {
      console.log(`  ${name.padEnd(28)} ${a.mae.toFixed(6).padStart(11)} ${a.brier.toFixed(6).padStart(11)} ${(a.rLatent === null || a.rLatent === undefined ? '-' : a.rLatent.toFixed(4)).padStart(9)} ${(a.K === undefined ? '-' : a.K).toString().padStart(3)}`);
    }
    console.log(`\n  Oracle MAE by exact-matchup n:`);
    const bins = w.arms.global.byBin.map((b) => `${b.range}(n=${b.n})`);
    console.log(`  ${'arm'.padEnd(28)}${bins.map((b) => b.padStart(14)).join('')}`);
    for (const [name, a] of Object.entries(w.arms)) {
      console.log(`  ${name.padEnd(28)}${a.byBin.map((b) => (b.mae === null ? '-' : b.mae.toFixed(6)).padStart(14)).join('')}`);
    }
  }
  console.log(`\nWritten to ${runDir}`);
}

main();
