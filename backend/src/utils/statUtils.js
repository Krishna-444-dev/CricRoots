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

/**
 * Multi-level generalization of blendWithPrior: backs off through a chain of
 * increasingly coarse pools instead of jumping straight from "this exact player" to
 * "everyone." Built for matchup-level recommendations (see
 * tendencyAnalytics.getMatchupPlan), where the natural chain is:
 *   exact batter-vs-bowler matchup
 *     -> this batter vs bowlers sharing the same bowling-style archetype
 *       -> batters sharing this batter's handedness vs that bowling-style archetype
 *         -> global (every tagged ball, no player identity at all)
 *
 * This is structurally the same idea as Katz/Kneser-Ney backoff smoothing in n-gram
 * language modeling: prefer the most specific estimate you have enough evidence for,
 * fall back to a coarser-but-more-stable one otherwise - applied here to tactical
 * cricket stats instead of word sequences, and chained through blendWithPrior's
 * existing James-Stein-style blend at each rung rather than a hard cutoff.
 *
 * `levels` must be ordered finest-to-coarsest, each `{ value, n, k? }`. The coarsest
 * level (typically global) is trusted as-is with no further backoff target. A level
 * with n=0 contributes nothing and is skipped entirely (not zero-weighted) - it's
 * genuinely absent data, not a data point worth zero.
 */
function hierarchicalBlend(levels) {
  if (!levels || levels.length === 0) {
    return { value: null, confidence: 'none', sampleSize: 0, level: null };
  }

  const coarsest = levels[levels.length - 1];
  let blended = {
    value: coarsest.n > 0 ? coarsest.value : null,
    confidence: coarsest.n > 0 ? 'pool' : 'none',
    sampleSize: coarsest.n,
    level: levels.length - 1
  };

  for (let i = levels.length - 2; i >= 0; i--) {
    const level = levels[i];
    if (level.n === 0) continue;
    const result = blendWithPrior(level.value, level.n, blended.value ?? level.value, blended.sampleSize, level.k ?? DEFAULT_K);
    blended = { value: result.value, confidence: result.confidence, sampleSize: level.n, level: i };
  }

  return blended;
}

module.exports = { blendWithPrior, hierarchicalBlend, DEFAULT_K };
