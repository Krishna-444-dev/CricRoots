// Experiment 4B's statistical comparator - see research/experiment-4-design.md.
//
// Jointly estimates all effects by regularized maximum likelihood, instead of estimating
// per-bucket empirical rates and blending them sequentially the way getMatchupPlan does:
//
//   logit(p) = mu + batter[i] + bowler[j] + archetypePair[a] + lineLength[l] + interaction[i,j]
//
// L2 penalty on every term except mu. Deliberately the same functional form as the synthetic
// generator's own ground truth, so this is a strong comparator rather than a strawman (the one
// generator term it omits - batterLineLengthResponse - would need ~7,400 parameters, more than
// there are training observations; no method in this comparison attempts it).
//
// Dependency-free by design (research/ has no node_modules of its own) - Adam optimizer written
// out directly, verified against a known-coefficient toy problem in the accompanying test file
// before being trusted with any experiment.

const ADAM_BETA1 = 0.9;
const ADAM_BETA2 = 0.999;
const ADAM_EPSILON = 1e-8;

function sigmoid(z) {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

/** Assigns dense integer indices to each categorical level present in the training rows. Levels
 * never seen in training get no coefficient, and predict() treats them as 0 (i.e. the population
 * average for that dimension) - the natural, honest behavior for an unseen player. */
function buildDesign(rows) {
  const index = (map, key) => {
    if (!map.has(key)) map.set(key, map.size);
    return map.get(key);
  };
  const batterIdx = new Map();
  const bowlerIdx = new Map();
  const archIdx = new Map();
  const llIdx = new Map();
  const pairIdx = new Map();

  const encoded = rows.map((r) => ({
    b: index(batterIdx, r.batterId),
    w: index(bowlerIdx, r.bowlerId),
    a: index(archIdx, `${r.battingStyle}|${r.bowlingStyle}`),
    l: index(llIdx, `${r.line}|${r.length}`),
    p: index(pairIdx, `${r.batterId}|${r.bowlerId}`),
    y: r.isWicket ? 1 : 0
  }));

  return { encoded, batterIdx, bowlerIdx, archIdx, llIdx, pairIdx };
}

/** Penalized negative log-likelihood - the objective `fit` actually minimizes. Used for the
 * convergence test, so stopping is based on the quantity being optimized rather than on an
 * arbitrary iteration count. */
function penalizedObjective(encoded, params, lambda, lambdaInteraction) {
  const eps = 1e-12;
  let nll = 0;
  for (const row of encoded) {
    const z = params.mu + params.batter[row.b] + params.bowler[row.w] + params.arch[row.a]
      + params.ll[row.l] + params.pair[row.p];
    const p = Math.min(Math.max(sigmoid(z), eps), 1 - eps);
    nll += row.y === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  let penalty = 0;
  for (const name of ['batter', 'bowler', 'arch', 'll']) {
    for (let j = 0; j < params[name].length; j++) penalty += lambda * params[name][j] ** 2;
  }
  for (let j = 0; j < params.pair.length; j++) penalty += lambdaInteraction * params.pair[j] ** 2;
  return nll + 0.5 * penalty;
}

/**
 * Fits by L2-regularized maximum likelihood with Adam, stopping on a CONVERGENCE CRITERION rather
 * than a fixed iteration count.
 *
 * The fixed-300-iteration version this replaces was not converged: predictions moved by ~1.3e-3
 * between 300 and 600 iterations, roughly 23% of the smallest Brier-score difference between the
 * methods being compared - so iteration count, not model quality, could have driven part of the
 * result. Two changes fix that:
 *
 *  1. LEARNING-RATE DECAY (lr_t = learningRate / sqrt(1 + t/decayScale)). Plain constant-step Adam
 *     was measured to plateau on this data rather than settle: successive doublings of the budget
 *     kept moving predictions by ~1e-4 (mean) / ~5e-4 (max) indefinitely, because the step size
 *     never shrank enough to stop overshooting near the optimum. With decay the same doublings
 *     move predictions by ~1e-5 (mean) / ~9e-5 (max), comfortably below the ~5e-4 differences
 *     being measured between methods.
 *  2. Stopping on relative improvement in the penalized objective rather than a fixed count, with
 *     iterationsRun reported so a run that hit the cap instead of converging is visible in the
 *     results file rather than invisible.
 *
 * maxIterations default (24000) is set well above the measured convergence point on the real
 * experiment data (12000 iterations, verified as a genuine fixed point: caps of 24000 and 48000
 * both stop at 12000 and produce bit-identical predictions). An earlier 8000 default truncated
 * the fit - see decision D16.
 */
function fit(encoded, sizes, {
  lambda, lambdaInteraction, learningRate = 0.05,
  maxIterations = 24000, tolerance = 1e-8, checkEvery = 200, decayScale = 500
}) {
  const params = {
    mu: 0,
    batter: new Float64Array(sizes.batter),
    bowler: new Float64Array(sizes.bowler),
    arch: new Float64Array(sizes.arch),
    ll: new Float64Array(sizes.ll),
    pair: new Float64Array(sizes.pair)
  };
  const grads = {
    mu: 0,
    batter: new Float64Array(sizes.batter),
    bowler: new Float64Array(sizes.bowler),
    arch: new Float64Array(sizes.arch),
    ll: new Float64Array(sizes.ll),
    pair: new Float64Array(sizes.pair)
  };
  const makeMoments = () => ({
    mu: 0,
    batter: new Float64Array(sizes.batter),
    bowler: new Float64Array(sizes.bowler),
    arch: new Float64Array(sizes.arch),
    ll: new Float64Array(sizes.ll),
    pair: new Float64Array(sizes.pair)
  });
  const m = makeMoments();
  const v = makeMoments();

  const VECTORS = ['batter', 'bowler', 'arch', 'll', 'pair'];

  let previousObjective = Infinity;
  let iterationsRun = 0;
  for (let t = 1; t <= maxIterations; t++) {
    iterationsRun = t;
    grads.mu = 0;
    for (const name of VECTORS) grads[name].fill(0);

    for (let i = 0; i < encoded.length; i++) {
      const row = encoded[i];
      const z = params.mu + params.batter[row.b] + params.bowler[row.w] + params.arch[row.a]
        + params.ll[row.l] + params.pair[row.p];
      const residual = sigmoid(z) - row.y;
      grads.mu += residual;
      grads.batter[row.b] += residual;
      grads.bowler[row.w] += residual;
      grads.arch[row.a] += residual;
      grads.ll[row.l] += residual;
      grads.pair[row.p] += residual;
    }

    // L2 penalty gradients - mu deliberately unregularized (it carries the base rate, which we
    // have no reason to shrink toward zero).
    for (const name of ['batter', 'bowler', 'arch', 'll']) {
      for (let j = 0; j < grads[name].length; j++) grads[name][j] += lambda * params[name][j];
    }
    for (let j = 0; j < grads.pair.length; j++) grads.pair[j] += lambdaInteraction * params.pair[j];

    const bc1 = 1 - Math.pow(ADAM_BETA1, t);
    const bc2 = 1 - Math.pow(ADAM_BETA2, t);
    const lr = learningRate / Math.sqrt(1 + t / decayScale);
    const adamStep = (paramVal, gradVal, mVal, vVal) => {
      const mNext = ADAM_BETA1 * mVal + (1 - ADAM_BETA1) * gradVal;
      const vNext = ADAM_BETA2 * vVal + (1 - ADAM_BETA2) * gradVal * gradVal;
      const update = lr * (mNext / bc1) / (Math.sqrt(vNext / bc2) + ADAM_EPSILON);
      return { value: paramVal - update, m: mNext, v: vNext };
    };

    const muStep = adamStep(params.mu, grads.mu, m.mu, v.mu);
    params.mu = muStep.value; m.mu = muStep.m; v.mu = muStep.v;
    for (const name of VECTORS) {
      const p = params[name], g = grads[name], mm = m[name], vv = v[name];
      for (let j = 0; j < p.length; j++) {
        const step = adamStep(p[j], g[j], mm[j], vv[j]);
        p[j] = step.value; mm[j] = step.m; vv[j] = step.v;
      }
    }

    if (t % checkEvery === 0) {
      const objective = penalizedObjective(encoded, params, lambda, lambdaInteraction);
      const relativeImprovement = (previousObjective - objective) / Math.max(Math.abs(previousObjective), 1e-12);
      if (relativeImprovement >= 0 && relativeImprovement < tolerance) break;
      previousObjective = objective;
    }
  }

  params.iterationsRun = iterationsRun;
  return params;
}

function makePredictor(params, design) {
  const { batterIdx, bowlerIdx, archIdx, llIdx, pairIdx } = design;
  const coef = (vec, map, key) => {
    const i = map.get(key);
    return i === undefined ? 0 : vec[i];
  };
  return function predict({ batterId, bowlerId, battingStyle, bowlingStyle, line, length }) {
    const z = params.mu
      + coef(params.batter, batterIdx, batterId)
      + coef(params.bowler, bowlerIdx, bowlerId)
      + coef(params.arch, archIdx, `${battingStyle}|${bowlingStyle}`)
      + coef(params.ll, llIdx, `${line}|${length}`)
      + coef(params.pair, pairIdx, `${batterId}|${bowlerId}`);
    return sigmoid(z);
  };
}

function logLossOn(encoded, params) {
  const eps = 1e-12;
  let sum = 0;
  for (const row of encoded) {
    const z = params.mu + params.batter[row.b] + params.bowler[row.w] + params.arch[row.a]
      + params.ll[row.l] + params.pair[row.p];
    const p = Math.min(Math.max(sigmoid(z), eps), 1 - eps);
    sum += row.y === 1 ? -Math.log(p) : -Math.log(1 - p);
  }
  return sum / encoded.length;
}

/**
 * Fits the model, selecting lambda by k-fold cross-validation over the TRAINING ROWS ONLY - no
 * test checkpoint influences the choice in any way (see experiment-4-design.md; this is a
 * standard, legitimate procedure and explicitly not the same thing as tuning k against
 * experimental results). The lambda grid and the interaction penalty multiplier are both fixed in
 * advance rather than adjusted after seeing anything.
 *
 * @param rows training observations: { batterId, bowlerId, battingStyle, bowlingStyle, line, length, isWicket }
 * @returns { predict, chosenLambda, cvResults, params, design }
 */
function fitWithCrossValidatedLambda(rows, {
  lambdaGrid = [1, 5, 20, 100],
  interactionPenaltyMultiplier = 4, // a priori structural choice - interaction has by far the most parameters per observation
  folds = 3,
  maxIterations = 24000,
  tolerance = 1e-8,
  learningRate = 0.05
} = {}) {
  const design = buildDesign(rows);
  const sizes = {
    batter: design.batterIdx.size,
    bowler: design.bowlerIdx.size,
    arch: design.archIdx.size,
    ll: design.llIdx.size,
    pair: design.pairIdx.size
  };

  // Deterministic fold assignment by position - rows arrive in a deterministic order from the
  // harness, so no RNG is needed and the result is reproducible.
  const foldOf = (i) => i % folds;

  const cvResults = [];
  let best = null;
  for (const lambda of lambdaGrid) {
    let totalLoss = 0;
    for (let f = 0; f < folds; f++) {
      const trainRows = design.encoded.filter((_, i) => foldOf(i) !== f);
      const validRows = design.encoded.filter((_, i) => foldOf(i) === f);
      const params = fit(trainRows, sizes, {
        lambda, lambdaInteraction: lambda * interactionPenaltyMultiplier, maxIterations, tolerance, learningRate
      });
      totalLoss += logLossOn(validRows, params);
    }
    const meanLoss = totalLoss / folds;
    cvResults.push({ lambda, meanValidationLogLoss: meanLoss });
    if (best === null || meanLoss < best.meanValidationLogLoss) best = { lambda, meanValidationLogLoss: meanLoss };
  }

  const finalParams = fit(design.encoded, sizes, {
    lambda: best.lambda,
    lambdaInteraction: best.lambda * interactionPenaltyMultiplier,
    maxIterations,
    tolerance,
    learningRate
  });

  return {
    predict: makePredictor(finalParams, design),
    chosenLambda: best.lambda,
    chosenLambdaInteraction: best.lambda * interactionPenaltyMultiplier,
    cvResults,
    params: finalParams,
    design,
    trainingRowCount: rows.length,
    // Recorded so a run that silently hit the iteration cap instead of converging is visible in
    // the results file rather than invisible.
    finalFitIterations: finalParams.iterationsRun,
    hitIterationCap: finalParams.iterationsRun >= maxIterations
  };
}

// --- Online estimation (Experiment 5) --------------------------------------------------------
// See research/experiment-5-design.md for the protocol this implements, defined before it was
// written. The short version: warm-start Adam updates on the full current dataset after each
// revealed ball, with full state reset at test-match boundaries so nothing learned in one
// held-out match can leak into another.

function cloneParams(params) {
  return {
    mu: params.mu,
    batter: Float64Array.from(params.batter),
    bowler: Float64Array.from(params.bowler),
    arch: Float64Array.from(params.arch),
    ll: Float64Array.from(params.ll),
    pair: Float64Array.from(params.pair)
  };
}

function cloneDesignMaps(design) {
  return {
    batterIdx: new Map(design.batterIdx),
    bowlerIdx: new Map(design.bowlerIdx),
    archIdx: new Map(design.archIdx),
    llIdx: new Map(design.llIdx),
    pairIdx: new Map(design.pairIdx)
  };
}

/** Grows a Float64Array to `size`, preserving existing values and zero-filling the rest. New
 * coefficients start at zero, i.e. "no effect known yet" - the honest initialization for a
 * batter/bowler pair the model has never observed. */
function grown(vec, size) {
  if (vec.length >= size) return vec;
  const next = new Float64Array(size);
  next.set(vec);
  return next;
}

/**
 * An online-updatable model: predicts, then absorbs revealed observations one at a time.
 *
 * Deliberately built around the SAME `fit`-style gradient/Adam arithmetic used for the batch fit,
 * rather than a separate approximate update rule, so that "online" differs from "offline" only in
 * how many iterations run and when - not in what is being optimized.
 *
 * @param baseParams parameters from the training-only batch fit (deep-copied, never mutated here)
 * @param baseDesign index maps from the training-only fit (deep-copied)
 * @param lambda / lambdaInteraction fixed from the training-only cross-validation; never re-tuned
 * @param onlineIterations warm-start Adam iterations per revealed ball (fixed in advance)
 */
function createOnlineModel({
  baseParams, baseDesign, baseEncoded, lambda, lambdaInteraction,
  onlineIterations = 100, learningRate = 0.05, decayScale = 500
}) {
  const params = cloneParams(baseParams);
  const design = cloneDesignMaps(baseDesign);
  // Training rows are shared read-only; revealed rows are appended to this per-match copy.
  const encoded = baseEncoded.slice();

  const makeZeroLike = () => ({
    mu: 0,
    batter: new Float64Array(params.batter.length),
    bowler: new Float64Array(params.bowler.length),
    arch: new Float64Array(params.arch.length),
    ll: new Float64Array(params.ll.length),
    pair: new Float64Array(params.pair.length)
  });
  let m = makeZeroLike();
  let v = makeZeroLike();
  let step = 0;

  const VECTORS = ['batter', 'bowler', 'arch', 'll', 'pair'];

  const indexFor = (map, key, vectorName) => {
    let i = map.get(key);
    if (i === undefined) {
      i = map.size;
      map.set(key, i);
      // Grow parameter and optimizer-state vectors together so indices stay aligned.
      params[vectorName] = grown(params[vectorName], i + 1);
      m[vectorName] = grown(m[vectorName], i + 1);
      v[vectorName] = grown(v[vectorName], i + 1);
    }
    return i;
  };

  const lookupOnly = (map, key) => {
    const i = map.get(key);
    return i === undefined ? null : i;
  };

  function predict({ batterId, bowlerId, battingStyle, bowlingStyle, line, length }) {
    const at = (vectorName, map, key) => {
      const i = lookupOnly(map, key);
      return i === null ? 0 : params[vectorName][i];
    };
    const z = params.mu
      + at('batter', design.batterIdx, batterId)
      + at('bowler', design.bowlerIdx, bowlerId)
      + at('arch', design.archIdx, `${battingStyle}|${bowlingStyle}`)
      + at('ll', design.llIdx, `${line}|${length}`)
      + at('pair', design.pairIdx, `${batterId}|${bowlerId}`);
    return sigmoid(z);
  }

  function runIterations(iterations) {
    const grads = {
      mu: 0,
      batter: new Float64Array(params.batter.length),
      bowler: new Float64Array(params.bowler.length),
      arch: new Float64Array(params.arch.length),
      ll: new Float64Array(params.ll.length),
      pair: new Float64Array(params.pair.length)
    };

    for (let t = 0; t < iterations; t++) {
      step++;
      grads.mu = 0;
      for (const name of VECTORS) grads[name].fill(0);

      for (let i = 0; i < encoded.length; i++) {
        const row = encoded[i];
        const z = params.mu + params.batter[row.b] + params.bowler[row.w] + params.arch[row.a]
          + params.ll[row.l] + params.pair[row.p];
        const residual = sigmoid(z) - row.y;
        grads.mu += residual;
        grads.batter[row.b] += residual;
        grads.bowler[row.w] += residual;
        grads.arch[row.a] += residual;
        grads.ll[row.l] += residual;
        grads.pair[row.p] += residual;
      }
      for (const name of ['batter', 'bowler', 'arch', 'll']) {
        for (let j = 0; j < grads[name].length; j++) grads[name][j] += lambda * params[name][j];
      }
      for (let j = 0; j < grads.pair.length; j++) grads.pair[j] += lambdaInteraction * params.pair[j];

      const bc1 = 1 - Math.pow(ADAM_BETA1, step);
      const bc2 = 1 - Math.pow(ADAM_BETA2, step);
      // Same decay schedule as the batch fit, for the same reason - constant-step Adam was
      // measured to orbit the optimum rather than settle into it.
      const lr = learningRate / Math.sqrt(1 + step / decayScale);

      const mMu = ADAM_BETA1 * m.mu + (1 - ADAM_BETA1) * grads.mu;
      const vMu = ADAM_BETA2 * v.mu + (1 - ADAM_BETA2) * grads.mu * grads.mu;
      params.mu -= lr * (mMu / bc1) / (Math.sqrt(vMu / bc2) + ADAM_EPSILON);
      m.mu = mMu; v.mu = vMu;

      for (const name of VECTORS) {
        const p = params[name], g = grads[name], mm = m[name], vv = v[name];
        for (let j = 0; j < p.length; j++) {
          const mNext = ADAM_BETA1 * mm[j] + (1 - ADAM_BETA1) * g[j];
          const vNext = ADAM_BETA2 * vv[j] + (1 - ADAM_BETA2) * g[j] * g[j];
          p[j] -= lr * (mNext / bc1) / (Math.sqrt(vNext / bc2) + ADAM_EPSILON);
          mm[j] = mNext; vv[j] = vNext;
        }
      }
    }
  }

  /** Absorbs one revealed ball, then runs the fixed warm-start budget. */
  function observe({ batterId, bowlerId, battingStyle, bowlingStyle, line, length, isWicket }) {
    encoded.push({
      b: indexFor(design.batterIdx, batterId, 'batter'),
      w: indexFor(design.bowlerIdx, bowlerId, 'bowler'),
      a: indexFor(design.archIdx, `${battingStyle}|${bowlingStyle}`, 'arch'),
      l: indexFor(design.llIdx, `${line}|${length}`, 'll'),
      p: indexFor(design.pairIdx, `${batterId}|${bowlerId}`, 'pair'),
      y: isWicket ? 1 : 0
    });
    runIterations(onlineIterations);
  }

  return { predict, observe, observationCount: () => encoded.length };
}

module.exports = {
  fitWithCrossValidatedLambda, buildDesign, fit, makePredictor, logLossOn, sigmoid,
  createOnlineModel, cloneParams
};
