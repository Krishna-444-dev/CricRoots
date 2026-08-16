// Experiment 8 arm B/C - the joint model plus a rank-K bilinear term. See experiment-8-design.md.
//
//   logit p = mu + batter[b] + bowler[w] + archetypePair[a] + lineLength[l] + interaction[b,w]
//           + u_b . v_{line,len}
//
// Deliberately a SEPARATE module rather than an extension of regularizedHierarchicalLogit.js. That
// file is left byte-identical so Experiments 4-7 stay exactly reproducible; the shared pieces
// (buildDesign, sigmoid) are imported rather than copied. The optimiser loop is duplicated because
// the bilinear term changes it materially - the same Adam schedule, decay, and convergence rule are
// used so the comparison against the existing model is fair.
//
// NON-CONVEXITY: this is the first non-convex objective in this programme. Every earlier model had
// a unique optimum. Three fixed seeded initialisations give a LIMITED optimisation-stability
// diagnostic - explicitly not a guarantee of finding the global optimum. Per the design, the
// restart count is frozen and will not be raised after seeing instability.
const { buildDesign, sigmoid } = require('./regularizedHierarchicalLogit');

const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPSILON = 1e-8;
const INIT_SCALE = 0.01; // zero-init leaves the bilinear gradient at exactly zero

function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function penalisedObjective(encoded, P, K, lambda, lambdaInteraction, lambdaLowRank, useInteraction) {
  const eps = 1e-12;
  let nll = 0;
  for (const r of encoded) {
    let bilinear = 0;
    for (let k = 0; k < K; k++) bilinear += P.U[r.b * K + k] * P.V[r.l * K + k];
    const z = P.mu + P.batter[r.b] + P.bowler[r.w] + P.arch[r.a] + P.ll[r.l]
      + (useInteraction ? P.pair[r.p] : 0) + bilinear;
    const p = Math.min(Math.max(sigmoid(z), eps), 1 - eps);
    nll += r.y === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  let pen = 0;
  for (const n of ['batter', 'bowler', 'arch', 'll']) for (let j = 0; j < P[n].length; j++) pen += lambda * P[n][j] ** 2;
  if (useInteraction) for (let j = 0; j < P.pair.length; j++) pen += lambdaInteraction * P.pair[j] ** 2;
  for (let j = 0; j < P.U.length; j++) pen += lambdaLowRank * P.U[j] ** 2;
  for (let j = 0; j < P.V.length; j++) pen += lambdaLowRank * P.V[j] ** 2;
  return nll + 0.5 * pen;
}

/** One fit from one initialisation. Same Adam + lr-decay + relative-improvement stopping rule as
 * the convex model, so arms differ in structure rather than in optimiser treatment. */
function fitOnce(encoded, sizes, {
  K, lambda, lambdaInteraction, lambdaLowRank, useInteraction = true,
  learningRate = 0.05, maxIterations = 24000, tolerance = 1e-8, checkEvery = 200, decayScale = 500, seed = 1
}) {
  const rand = mulberry32(seed);
  const normal = () => {
    const u1 = Math.max(rand(), 1e-12), u2 = rand();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  };
  const P = {
    mu: 0,
    batter: new Float64Array(sizes.batter), bowler: new Float64Array(sizes.bowler),
    arch: new Float64Array(sizes.arch), ll: new Float64Array(sizes.ll), pair: new Float64Array(sizes.pair),
    U: new Float64Array(sizes.batter * K), V: new Float64Array(sizes.ll * K)
  };
  for (let j = 0; j < P.U.length; j++) P.U[j] = normal() * INIT_SCALE;
  for (let j = 0; j < P.V.length; j++) P.V[j] = normal() * INIT_SCALE;

  const zeros = () => ({
    mu: 0,
    batter: new Float64Array(sizes.batter), bowler: new Float64Array(sizes.bowler),
    arch: new Float64Array(sizes.arch), ll: new Float64Array(sizes.ll), pair: new Float64Array(sizes.pair),
    U: new Float64Array(sizes.batter * K), V: new Float64Array(sizes.ll * K)
  });
  const G = zeros(), M = zeros(), Vm = zeros();
  const VECS = ['batter', 'bowler', 'arch', 'll', 'pair', 'U', 'V'];

  let prev = Infinity, iterationsRun = 0;
  for (let t = 1; t <= maxIterations; t++) {
    iterationsRun = t;
    G.mu = 0;
    for (const n of VECS) G[n].fill(0);

    for (let i = 0; i < encoded.length; i++) {
      const r = encoded[i];
      let bilinear = 0;
      for (let k = 0; k < K; k++) bilinear += P.U[r.b * K + k] * P.V[r.l * K + k];
      const z = P.mu + P.batter[r.b] + P.bowler[r.w] + P.arch[r.a] + P.ll[r.l]
        + (useInteraction ? P.pair[r.p] : 0) + bilinear;
      const e = sigmoid(z) - r.y;
      G.mu += e;
      G.batter[r.b] += e; G.bowler[r.w] += e; G.arch[r.a] += e; G.ll[r.l] += e;
      if (useInteraction) G.pair[r.p] += e;
      for (let k = 0; k < K; k++) {
        G.U[r.b * K + k] += e * P.V[r.l * K + k];
        G.V[r.l * K + k] += e * P.U[r.b * K + k];
      }
    }
    for (const n of ['batter', 'bowler', 'arch', 'll']) for (let j = 0; j < G[n].length; j++) G[n][j] += lambda * P[n][j];
    if (useInteraction) for (let j = 0; j < G.pair.length; j++) G.pair[j] += lambdaInteraction * P.pair[j];
    for (let j = 0; j < G.U.length; j++) G.U[j] += lambdaLowRank * P.U[j];
    for (let j = 0; j < G.V.length; j++) G.V[j] += lambdaLowRank * P.V[j];

    const bc1 = 1 - Math.pow(ADAM_BETA1, t), bc2 = 1 - Math.pow(ADAM_BETA2, t);
    const lr = learningRate / Math.sqrt(1 + t / decayScale);
    const mMu = ADAM_BETA1 * M.mu + (1 - ADAM_BETA1) * G.mu;
    const vMu = ADAM_BETA2 * Vm.mu + (1 - ADAM_BETA2) * G.mu * G.mu;
    P.mu -= lr * (mMu / bc1) / (Math.sqrt(vMu / bc2) + ADAM_EPSILON);
    M.mu = mMu; Vm.mu = vMu;
    for (const n of VECS) {
      const p = P[n], g = G[n], m = M[n], v = Vm[n];
      for (let j = 0; j < p.length; j++) {
        m[j] = ADAM_BETA1 * m[j] + (1 - ADAM_BETA1) * g[j];
        v[j] = ADAM_BETA2 * v[j] + (1 - ADAM_BETA2) * g[j] * g[j];
        p[j] -= lr * (m[j] / bc1) / (Math.sqrt(v[j] / bc2) + ADAM_EPSILON);
      }
    }

    if (t % checkEvery === 0) {
      const obj = penalisedObjective(encoded, P, K, lambda, lambdaInteraction, lambdaLowRank, useInteraction);
      const rel = (prev - obj) / Math.max(Math.abs(prev), 1e-12);
      if (rel >= 0 && rel < tolerance) break;
      prev = obj;
    }
  }
  P.iterationsRun = iterationsRun;
  P.K = K;
  P.trainingObjective = penalisedObjective(encoded, P, K, lambda, lambdaInteraction, lambdaLowRank, useInteraction);
  P.useInteraction = useInteraction;
  return P;
}

function makePredictor(P, design, K, useInteraction) {
  const at = (vec, map, key) => { const i = map.get(key); return i === undefined ? 0 : vec[i]; };
  return ({ batterId, bowlerId, battingStyle, bowlingStyle, line, length }) => {
    const bi = design.batterIdx.get(batterId);
    const li = design.llIdx.get(`${line}|${length}`);
    let bilinear = 0;
    if (bi !== undefined && li !== undefined) {
      for (let k = 0; k < K; k++) bilinear += P.U[bi * K + k] * P.V[li * K + k];
    }
    const z = P.mu
      + at(P.batter, design.batterIdx, batterId)
      + at(P.bowler, design.bowlerIdx, bowlerId)
      + at(P.arch, design.archIdx, `${battingStyle}|${bowlingStyle}`)
      + at(P.ll, design.llIdx, `${line}|${length}`)
      + (useInteraction ? at(P.pair, design.pairIdx, `${batterId}|${bowlerId}`) : 0)
      + bilinear;
    return sigmoid(z);
  };
}

function logLossOn(encoded, P, K, useInteraction) {
  const eps = 1e-12;
  let s = 0;
  for (const r of encoded) {
    let bilinear = 0;
    for (let k = 0; k < K; k++) bilinear += P.U[r.b * K + k] * P.V[r.l * K + k];
    const z = P.mu + P.batter[r.b] + P.bowler[r.w] + P.arch[r.a] + P.ll[r.l]
      + (useInteraction ? P.pair[r.p] : 0) + bilinear;
    const p = Math.min(Math.max(sigmoid(z), eps), 1 - eps);
    s += r.y === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  return s / encoded.length;
}

/**
 * Selects K and lambdaLowRank by k-fold cross-validation over TRAINING ROWS ONLY (D12 discipline),
 * then refits on all training rows from `restarts` fixed seeds, keeping the best by TRAINING
 * objective only. CV uses a single initialisation per candidate - restarts are a stability
 * diagnostic for the final fit, not part of hyperparameter selection.
 */
function fitWithCrossValidation(rows, {
  kGrid = [1, 2, 3, 5, 8],
  lowRankGrid = [1, 5, 20, 100],
  lambda = 5, lambdaInteraction = 20,
  useInteraction = true, folds = 3, restarts = 3, restartSeeds = [11, 22, 33],
  cvMaxIterations = 8000, finalMaxIterations = 24000
} = {}) {
  const design = buildDesign(rows);
  const sizes = {
    batter: design.batterIdx.size, bowler: design.bowlerIdx.size, arch: design.archIdx.size,
    ll: design.llIdx.size, pair: Math.max(design.pairIdx.size, 1)
  };
  const foldOf = (i) => i % folds;

  const cvResults = [];
  let best = null;
  for (const K of kGrid) {
    for (const lambdaLowRank of lowRankGrid) {
      let total = 0;
      for (let f = 0; f < folds; f++) {
        const tr = design.encoded.filter((_, i) => foldOf(i) !== f);
        const va = design.encoded.filter((_, i) => foldOf(i) === f);
        const P = fitOnce(tr, sizes, { K, lambda, lambdaInteraction, lambdaLowRank, useInteraction, seed: restartSeeds[0], maxIterations: cvMaxIterations });
        total += logLossOn(va, P, K, useInteraction);
      }
      const meanLoss = total / folds;
      cvResults.push({ K, lambdaLowRank, meanValidationLogLoss: meanLoss });
      if (best === null || meanLoss < best.meanValidationLogLoss) best = { K, lambdaLowRank, meanValidationLogLoss: meanLoss };
    }
  }

  const fits = restartSeeds.slice(0, restarts).map((seed) => fitOnce(design.encoded, sizes, {
    K: best.K, lambda, lambdaInteraction, lambdaLowRank: best.lambdaLowRank, useInteraction, seed, maxIterations: finalMaxIterations
  }));
  const chosen = fits.reduce((a, b) => (b.trainingObjective < a.trainingObjective ? b : a));
  const objectives = fits.map((f) => f.trainingObjective);

  return {
    params: chosen,
    design,
    K: best.K,
    lambdaLowRank: best.lambdaLowRank,
    cvResults,
    predict: makePredictor(chosen, design, best.K, useInteraction),
    restartObjectives: objectives,
    restartSpread: Math.max(...objectives) - Math.min(...objectives),
    iterationsRun: chosen.iterationsRun,
    hitIterationCap: chosen.iterationsRun >= finalMaxIterations
  };
}

module.exports = { fitWithCrossValidation, fitOnce, makePredictor, logLossOn };
