// Metrics tied to the actual prediction target (research/prediction-target.md) - dismissal
// probability, a real-valued [0,1] estimate compared against a realized binary outcome (or, for
// Track A, a KNOWN true probability). Each metric here has a stated falsifiability role -
// documented per function - rather than being included because it's easy to compute.

const SAMPLE_SIZE_BINS = [0, 1, 2, 5, 10, 15, 25, 50, Infinity];

function nonNull(rows) {
  return rows.filter((r) => r.prediction !== null && r.prediction !== undefined);
}

/**
 * Brier score - mean squared error between the predicted probability and the realized 0/1
 * outcome. 0 = perfect, 0.25 = a coin-flip-blind constant-0.5 predictor, matches the exact
 * metric evaluate_win_probability.py already uses for the win-probability model, extended here
 * to the matchup engine. Falsifiability: if the full hierarchical method's Brier score is not
 * lower than singleLevelShrinkage's (let alone the naive baselines), that directly disproves the
 * hypothesis that the archetype levels in the backoff chain add value.
 */
function brierScore(rows) {
  const usable = nonNull(rows);
  if (usable.length === 0) return null;
  const sum = usable.reduce((s, r) => s + (r.prediction - r.trueOutcome) ** 2, 0);
  return sum / usable.length;
}

/**
 * Log loss - penalizes confident wrong predictions much more harshly than Brier score does.
 * Clipped away from exactly 0/1 (undefined there) - the same clipping evaluate_win_probability.py
 * applies via np.clip before scoring. Falsifiability: a method that's well-calibrated on average
 * (good Brier score) but occasionally very confidently wrong will show that failure here even
 * when Brier score doesn't - if hierarchical shrinkage's whole point is avoiding overconfident
 * estimates from small samples, this is the metric most likely to catch it failing to do that.
 */
function logLoss(rows, epsilon = 1e-6) {
  const usable = nonNull(rows);
  if (usable.length === 0) return null;
  const clip = (p) => Math.min(Math.max(p, epsilon), 1 - epsilon);
  const sum = usable.reduce((s, r) => {
    const p = clip(r.prediction);
    return s + (r.trueOutcome === 1 ? Math.log(p) : Math.log(1 - p));
  }, 0);
  return -sum / usable.length;
}

/**
 * Decile calibration - buckets predictions by predicted probability into equal-count deciles,
 * compares mean predicted probability against the realized outcome rate within each decile.
 * Mirrors evaluate_win_probability.py's decile_calibration exactly (same approach, extended to
 * this target). Falsifiability: "70% predicted" should mean "actually happens ~70% of the time"
 * - a method whose deciles systematically diverge from the diagonal is miscalibrated even if its
 * Brier score looks reasonable on average.
 */
function decileCalibration(rows, numBuckets = 10) {
  const usable = nonNull(rows).slice().sort((a, b) => a.prediction - b.prediction);
  if (usable.length === 0) return [];
  const bucketSize = Math.ceil(usable.length / numBuckets);
  const buckets = [];
  for (let i = 0; i < usable.length; i += bucketSize) {
    const slice = usable.slice(i, i + bucketSize);
    const meanPredicted = slice.reduce((s, r) => s + r.prediction, 0) / slice.length;
    const actualRate = slice.reduce((s, r) => s + r.trueOutcome, 0) / slice.length;
    buckets.push({ n: slice.length, meanPredicted: round(meanPredicted), actualRate: round(actualRate) });
  }
  return buckets;
}

/**
 * Oracle comparison - Track A only, meaningless without a known true probability. Mean absolute
 * error and MSE between the estimate and the actual generating probability, not the noisy
 * realized outcome. Falsifiability: this is the most direct test of the central hypothesis -
 * "does the estimator recover the true underlying probability" is a different (and harder)
 * question than "does the estimator fit the noisy observations," and this is the only metric
 * here that can answer it, because it's the only one with access to ground truth at all.
 */
function oracleError(rows) {
  const usable = nonNull(rows);
  if (usable.length === 0) return null;
  const mae = usable.reduce((s, r) => s + Math.abs(r.prediction - r.pTrue), 0) / usable.length;
  const mse = usable.reduce((s, r) => s + (r.prediction - r.pTrue) ** 2, 0) / usable.length;
  return { mae: round(mae), mse: round(mse, 6) };
}

/**
 * Spearman rank correlation between predicted probability and true probability (Track A only) -
 * a ranking-quality check distinct from calibration: a method could be miscalibrated (wrong
 * absolute values) while still correctly ordering buckets from safest to riskiest, which is
 * still useful for a bowling plan that only needs to pick the best option, not know its exact
 * probability. Falsifiability: near-zero or negative correlation means the method can't even
 * rank buckets correctly, a more basic failure than miscalibration.
 */
function spearmanCorrelation(rows) {
  const usable = nonNull(rows);
  if (usable.length < 2) return null;
  const rank = (values) => {
    const sorted = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const ranks = new Array(values.length);
    sorted.forEach(([, originalIndex], rankIndex) => { ranks[originalIndex] = rankIndex; });
    return ranks;
  };
  const predRanks = rank(usable.map((r) => r.prediction));
  const trueRanks = rank(usable.map((r) => r.pTrue));
  const n = usable.length;
  const dSquaredSum = predRanks.reduce((s, pr, i) => s + (pr - trueRanks[i]) ** 2, 0);
  return round(1 - (6 * dSquaredSum) / (n * (n * n - 1)));
}

/**
 * Sample-efficiency curve - the direct test of the core thesis (research/protocol.md): shrinkage
 * should help most precisely when individual data is scarce, and that advantage should shrink
 * (or vanish, or reverse) as the exact-matchup sample size grows and the naive baseline stops
 * being so noisy. Buckets by exactMatchupN (recorded once per checkpoint by the harness, not
 * specific to any one method) so every method is compared within the same sparsity regime at
 * each point on the curve. Falsifiability: if the hierarchical method's advantage over
 * rawExactMatchup does NOT shrink as n grows, something is wrong with either the method or this
 * measurement - the whole justification for shrinkage is that it should matter less once there's
 * enough individual data to trust on its own.
 */
function sampleEfficiencyCurve(rows) {
  const bins = [];
  for (let i = 0; i < SAMPLE_SIZE_BINS.length - 1; i++) {
    const lo = SAMPLE_SIZE_BINS[i];
    const hi = SAMPLE_SIZE_BINS[i + 1];
    const inBin = rows.filter((r) => r.exactMatchupN >= lo && r.exactMatchupN < hi);
    bins.push({
      range: hi === Infinity ? `${lo}+` : `${lo}-${hi - 1}`,
      n: inBin.length,
      brier: brierScore(inBin),
      oracleError: oracleError(inBin)
    });
  }
  return bins;
}

function round(n, places = 4) {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

/** Summarizes every metric above, per method, from one flat results array (as produced by
 * research/harness/evaluate.js's runExperiment). */
function summarizeByMethod(results) {
  const methods = [...new Set(results.map((r) => r.method))];
  const summary = {};
  for (const method of methods) {
    const rows = results.filter((r) => r.method === method);
    summary[method] = {
      totalCheckpoints: rows.length,
      nonNullPredictions: nonNull(rows).length,
      brierScore: brierScore(rows),
      logLoss: logLoss(rows),
      oracleError: oracleError(rows),
      spearmanCorrelation: spearmanCorrelation(rows),
      decileCalibration: decileCalibration(rows),
      sampleEfficiency: sampleEfficiencyCurve(rows)
    };
  }
  return summary;
}

module.exports = {
  brierScore, logLoss, decileCalibration, oracleError, spearmanCorrelation, sampleEfficiencyCurve,
  summarizeByMethod, SAMPLE_SIZE_BINS
};
