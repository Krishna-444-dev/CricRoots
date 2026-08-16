# Experiment 4 design - is the limitation the hierarchy, or the estimator?

Written before implementing, same discipline as `league-design.md` and `world-b-design.md`.

## The question Experiment 4 exists to answer

Experiment 3b established that making archetype genuinely informative (8.84% of logit-space
variance) was **not sufficient** for the current sequential hierarchy to beat the global or
single-level baselines. That rules out "the archetypes are meaningless" as a complete explanation
and leaves at least four distinct candidate causes, which Experiment 4 is designed to separate:

1. **Sequential blending itself** - repeatedly applying `blendWithPrior` through a chain may
   dilute genuine structure as readily as it suppresses noise, regardless of how good each level's
   estimate is.
2. **Noisy empirical estimation of the intermediate levels** - the architecture might be fine, but
   the archetype-level *empirical rates* it feeds on are too noisy at this data scale to help.
3. **Insufficient information available at the hierarchy levels** - even a perfect archetype
   estimate might not carry enough signal to beat global at this sparsity.
4. **The overall model formulation** - estimating dismissal rates per (line, length) bucket and
   blending them may be the wrong decomposition entirely, versus jointly estimating additive
   effects.

Two sub-experiments, run in **both** World A and World B, on the identical checkpoints, seeds,
metrics, and evaluation protocol as Experiments 2/3a/3b.

## Experiment 4A - oracle-informed hierarchy (diagnostic upper bound)

**This is a diagnostic instrument, not a deployable method.** It reads the synthetic world's hidden
ground-truth parameters, which no real-data method could ever do. Its only purpose is to answer:
*if the intermediate level's estimate were perfect, would this architecture recover the signal?*
Any result it produces is an **upper bound** on what perfect intermediate estimation could deliver
within the current architecture - never a claim about achievable real-world performance. It must
never be exported into the product or reported as a method that "works."

Two methods:

- **`oracleArchetypeOnly`** - predicts the true archetype-pool probability directly:
  the exact mean of `trueProbability(batter, bowler, line, length)` over *every* batter sharing the
  target batter's `battingStyle` and *every* bowler sharing the target bowler's `bowlingStyle`,
  computed by full enumeration over the population (no sampling error). This is the perfect
  version of the `archetypeOnly` baseline, and measures the **ceiling of archetype information
  alone** - directly addressing candidate cause 3.
- **`oracleInformedHierarchy`** - the real, unmodified `hierarchicalBlend` (the same function
  `getMatchupPlan` calls) with two levels: the *empirical* exact-matchup rate on top, and the
  *oracle* archetype probability as the coarsest level, trusted as-is. So the exact-matchup
  estimate is shrunk toward a perfect prior with the same `k=15` mechanism as everywhere else.
  If this beats global substantially while `fullHierarchy` does not, that isolates candidate cause
  2 (noisy intermediate estimation) from cause 1 (sequential blending as such).

**Why the oracle level is trusted as-is rather than blended into global**: it is by construction
the exact conditional mean, so there is nothing a global rate could add - and giving it a
*finite* pseudo-sample-size would make the result depend on an arbitrary choice of that number
rather than on the architecture being tested. This is the strongest, cleanest form of the
"what if the archetype estimate were perfect" question.

**Falsifiability**: if `oracleInformedHierarchy` does not beat `global`, then perfect intermediate
estimation is not enough, and the problem lies in sequential blending or the formulation
(causes 1/4), not in estimation noise. If it does beat `global` clearly, then the architecture can
use archetype signal and the empirical estimation of that level is the bottleneck.

**Expected property, noted in advance** (observed in a small-scale smoke test of the wiring, before
any full run): `oracleInformedHierarchy` and `oracleArchetypeOnly` will produce *identical*
predictions on every checkpoint where the exact matchup has no balls in the specific (line, length)
bucket - `hierarchicalBlend` skips zero-`n` levels entirely, leaving only the oracle. Per the
diagnostic's Finding 5 that was ~96% of checkpoints in Experiment 3a, so these two methods should
be expected to agree on the large majority of rows and diverge only on the ~4% with bucket-level
exact-matchup data. That is correct behavior, not a bug, and it is exactly parallel to how
`fullHierarchy`'s own exact-matchup rung behaves - which is what keeps the
`oracleInformedHierarchy` vs `fullHierarchy` comparison apples-to-apples.

## Experiment 4B - jointly-estimated regularized hierarchical logistic model

The statistical comparator, addressing candidate cause 4. Instead of estimating per-bucket rates
and blending sequentially, jointly fit, by regularized maximum likelihood:

```
logit(p) = mu + batter[i] + bowler[j] + archetypePair[a] + lineLength[l] + interaction[i,j]
```

with L2 penalties on every term except `mu`. This is deliberately the same functional form as the
synthetic generator's own ground truth (`BASE_RATE_LOGIT + vulnerability + effectiveness +
archetype + lineLength + interaction`, plus a `batterLineLengthResponse` term the model does
**not** include - see "known limitations" below), which makes it a strong comparator rather than a
strawman.

**Hyperparameter selection without touching test data**: the L2 strength `lambda` is chosen by
3-fold cross-validation **over the training matches only**. No test checkpoint influences it in
any way. The grid is fixed in advance: `lambda in {1, 5, 20, 100}`, with the interaction term's
penalty fixed a priori at `4 x lambda` (interaction has by far the most parameters relative to
available observations, so it gets the heavier penalty; the 4x multiplier is an a priori
structural choice, not a tuned one). This is a legitimate, standard procedure and is explicitly
*not* the same thing as tuning `k` against experimental results, which remains off-limits.

**Known asymmetry, disclosed up front**: the joint model is fit **once**, on the training matches
only, before the test loop begins - refitting at all 2,520 checkpoints is computationally
prohibitive. The sequential baselines re-query the database at every checkpoint and therefore
*do* see the current test match's already-revealed balls; the joint model does not. This gives the
joint model strictly **less** information than its competitors. That direction matters for
interpretation: a win for the joint model would be despite this handicap, while a loss for it is
partially confounded by the handicap and must not be read as a clean defeat. The magnitude of the
handicap will be reported alongside the results (mean within-test-match balls available at a
checkpoint that the joint model cannot see).

**Known limitations, stated in advance**: the model omits the generator's
`batterLineLengthResponse` term (2.6% of ground-truth variance in World A) - a per-batter
per-(line,length) effect would add ~7,400 parameters, more than there are training observations.
No model in this comparison, including the current hierarchy, attempts to capture it. It also
treats (line, length) as one 42-level factor rather than separable main effects, matching how the
generator actually draws them (see the diagnostic's secondary observation).

## What stays fixed

The evaluation protocol, leakage prevention, checkpoints, metrics, seeds, and all six existing
methods are unchanged. `backend/src/utils/statUtils.js` and
`backend/src/services/tendencyAnalytics.js` - the production algorithm - are **not modified**.
`k` is not tuned. No adaptive evidence weighting is implemented. Raw results are reported first,
without interpretation.
