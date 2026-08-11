/**
 * Shrinkage (empirical-Bayes-style) blending for sparse per-player stats.
 *
 * Blends an individual rate with a broader pool average, weighted by how much
 * individual data actually exists. With k=15: a player with 0 balls gets 100% pool
 * average, a player with 15 balls gets a 50/50 blend, a player with 60 balls gets
 * mostly their own data. This is the standard James-Stein-style approach used for
 * sparse-sample sports stats (e.g. baseball batting averages) - not a trained model,
 * just a defensible way to avoid overreacting to small samples.
 */
const DEFAULT_K = 15;

function blendWithPrior(individualValue, individualN, poolValue, poolN, k = DEFAULT_K) {
  const prior = poolN > 0 ? poolValue : individualValue;
  if (individualN === 0 && poolN === 0) {
    return { value: null, confidence: 'none', sampleSize: 0 };
  }
  const blended = (individualN * individualValue + k * prior) / (individualN + k);
  const confidence = individualN >= 40 ? 'high' : individualN >= 15 ? 'medium' : individualN > 0 ? 'low' : 'very-low';
  return { value: blended, confidence, sampleSize: individualN };
}

module.exports = { blendWithPrior, DEFAULT_K };
