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

function fit(encoded, sizes, { lambda, lambdaInteraction, iterations, learningRate }) {
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

  for (let t = 1; t <= iterations; t++) {
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
    const adamStep = (paramVal, gradVal, mVal, vVal) => {
      const mNext = ADAM_BETA1 * mVal + (1 - ADAM_BETA1) * gradVal;
      const vNext = ADAM_BETA2 * vVal + (1 - ADAM_BETA2) * gradVal * gradVal;
      const update = learningRate * (mNext / bc1) / (Math.sqrt(vNext / bc2) + ADAM_EPSILON);
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
  }

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
  iterations = 300,
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
        lambda, lambdaInteraction: lambda * interactionPenaltyMultiplier, iterations, learningRate
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
    iterations,
    learningRate
  });

  return {
    predict: makePredictor(finalParams, design),
    chosenLambda: best.lambda,
    cvResults,
    params: finalParams,
    design,
    trainingRowCount: rows.length
  };
}

module.exports = { fitWithCrossValidatedLambda, buildDesign, fit, makePredictor, logLossOn, sigmoid };
