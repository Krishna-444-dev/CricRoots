# Diagnostic audit: does the synthetic world contain the structure the hierarchy needs?

Scope, per explicit instruction after Experiment 2
(`research/results/2026-08-15T23-06-42-795Z/`): **diagnostic report only**. No changes to
`research/synthetic/generator.js`'s probability model, `backend/src/utils/statUtils.js`,
`backend/src/services/tendencyAnalytics.js`, `research/harness/evaluate.js`, or `research/metrics.js`.
No Experiment 3. No tuning of `k`. No verdict on whether hierarchical shrinkage "works." This
document reports what was measured and how it was measured; interpretation is reserved for the
same joint review Experiments 1 and 2 went through.

All numbers below come from running
[`ground-truth-decomposition.js`](./ground-truth-decomposition.js) and are also saved verbatim in
[`ground-truth-decomposition-results.json`](./ground-truth-decomposition-results.json). Nothing here is hand-computed or estimated.

## Methodology

- **Same population as Experiment 2** - `generatePopulation({ numBatters: 176, numBowlers: 96, seed: 1 })`,
  matching `run-experiment.js`'s `CONFIG` (16 teams x 11 batters, 16 teams x 6 bowlers,
  `populationSeed: 1`). This diagnostic describes the actual world Experiment 2 evaluated, not a
  freshly-drawn one.
- **Full enumeration, not Monte Carlo.** `trueProbability`'s logit is an exact sum of five
  components (`generator.js:129-140`): `BASE_RATE_LOGIT + vulnerability(batter) +
  effectiveness(bowler) + interaction(batter,bowler) + lineLengthEffect(line,length) +
  batterLineLengthResponse(batter,line,length)`. The full matchup space is
  176 x 96 x 6 lines x 7 lengths = **709,632 tuples**, small enough to enumerate exactly rather
  than sample - so the variance decomposition below has zero sampling error. (Caveat: this treats
  every batter/bowler/line/length combination as equally likely, which is a reasonable first-order
  description of the generator's own uniform `rng.pick()` calls but is not an exact reproduction of
  a single match's exposure pattern, where only 11 batters and 6 bowlers from two specific teams
  are in play at once.)
- **Self-check before trusting anything.** Rather than re-deriving the formula, the script reads
  the population's own hidden parameter tables (the exact ones `trueProbability` reads) and, on a
  random 5,000-sample subset, compares its manual sum against calling the real, unmodified
  `trueProbability()` function. **Result: `maxAbsProbabilityDifference = 0`** - exact agreement,
  every time. The decomposition below is verified to be describing the real function, not a
  reimplementation of it.

## Finding 1 - Ground-truth variance decomposition (logit space)

`BASE_RATE_LOGIT = -3.055049` (`logit(0.045)`) is a **constant** added to every matchup - it sets
the average dismissal rate (5.58% realized mean across the full space, range 0.09%-64.95%,
std 4.08%), not the spread. Variance is only produced by the five terms that actually vary:

| Component | Meaning | Variance (logit space) | Share of total variance |
|---|---|---:|---:|
| V | batter vulnerability | 0.185562 | **34.4%** |
| E | bowler effectiveness | 0.178297 | **33.0%** |
| LL | line x length effect | 0.118883 | **22.0%** |
| I | batter x bowler interaction | 0.046244 | **8.6%** |
| R | batter's personal line/length response | 0.013814 | **2.6%** |

Total variance = 0.539691. Sum of the five component variances = 0.542800 - 100.6% of total,
i.e. a small (0.58%) net negative covariance among components rather than a positive one. The
components are independent by construction (each drawn from its own independent RNG call), and
this near-exact match confirms that empirically; the small residual is the expected
finite-population artifact of drawing 176 batters / 96 bowlers / a sparse interaction table once,
not a modeling error.

**Reading this**: the generator's structure is dominated by batter and bowler *main effects*
(67.4% combined) and the line/length effect (22.0%). The batter x bowler *interaction* - the thing
`getMatchupPlan`'s exact-matchup and batter-vs-bowler-archetype levels exist specifically to
capture - is real (it is not zero) but is the smallest of the five terms at 8.6%.

## Finding 2 - Archetype (battingStyle / bowlingStyle) carries ~0% of ground-truth variance

Two independent checks, not just one:

1. **Code-level fact**: `trueProbability` (`generator.js:129-140`) reads
   `batter.vulnerability`, `bowler.effectiveness`, `interactions`, `lineLengthEffect`, and
   `batterLineLengthResponse`. It never reads `battingStyle` or `bowlingStyle`. Those fields exist
   on generated players (`generator.js:70-80`) only so the generated documents satisfy the real
   Player schema - they play no role in the probability formula.
2. **Empirical confirmation** (one-way ANOVA, eta-squared, on logitP across the full 709,632-tuple
   space):

   | Grouping | eta-squared (% of variance explained) |
   |---|---:|
   | battingStyle (2 groups) | 0.04% |
   | bowlingStyle (4 groups) | 0.89% |
   | battingStyle x bowlingStyle (8 groups) | 0.93% |

   All three are indistinguishable from zero (the group means cluster tightly around
   `BASE_RATE_LOGIT ≈ -3.05`, e.g. battingStyle group means -3.0438 vs -3.0729). The small
   nonzero values are exactly what finite-population random assignment produces by chance, not a
   real effect.

**This is the load-bearing fact for Finding 3.** `getPlayerIdsByArchetype`
(`tendencyAnalytics.js:109-116`) pools players by exactly these two fields. In this synthetic
world, that pooling variable has no relationship to the outcome being predicted.

## Finding 3 - a mechanical explanation for fullHierarchy underperforming singleLevelShrinkage

This is offered as a **falsifiable explanation**, not a proven cause - it was not tested with a
controlled ablation (see "What this diagnostic does NOT conclude" below). It follows directly from
re-reading the actual chain, not from the Experiment 2 numbers alone.

`singleLevelShrinkage` (`baselines.js:41-54`) blends the exact-matchup rate directly against the
**raw global rate** via `blendWithPrior(exact, exactN, global, globalN, k=15)` - one step.

`fullHierarchy` calls the real, unmodified `getMatchupPlan`, which builds four levels - exact
matchup, batter-vs-bowler-archetype, archetype-vs-archetype, global - and passes them to
`hierarchicalBlend` (`statUtils.js:44-65`). That function iterates coarsest-to-finest: it starts
from global, blends the archetype-vs-archetype rate into it (`k=15`, since no level in
`tendencyAnalytics.js:162-170` sets a custom `k`), then blends batter-vs-bowler-archetype into
*that* result, then finally blends the exact matchup into *that* result
(`tendencyAnalytics.js:142-172`).

The consequence: `fullHierarchy`'s exact-matchup blend does not use the raw global rate as its
prior - it uses a prior that has already been pulled toward two archetype-level empirical rates.
Per Finding 2, archetype-vs-archetype and batter-vs-bowler-archetype pools have no true
relationship to the outcome - their *own* empirical rates differ from the true global rate purely
by sampling noise, and because archetype pools are large (see `getPlayerIdsByArchetype`, which
returns every player sharing a style, not just this match's rosters), `blendWithPrior` gives that
noisy-but-large-sample estimate real weight. `singleLevelShrinkage` never picks up that noise
because it skips straight to the raw global rate.

This is consistent with (but not proven by) the observed Brier ordering:
`archetypeOnly` (raw, unshrunk archetype rate, worst: 0.04794) > `fullHierarchy` (archetype noise
present but shrunk down: 0.04750) > `singleLevelShrinkage` ≈ `global` (archetype rungs skipped
entirely: 0.04696 / 0.04696).

## Finding 4 - k=15 shrinkage-weight mechanics

`blendWithPrior`'s individual weight is `n / (n + k)`. With the project default `k=15`:

| exact-matchup n | individual weight |
|---:|---:|
| 0 | 0% |
| 1 | 6.25% |
| 2 | 11.76% |
| 5 | 25.0% |
| 10 | 40.0% |
| 14 | 48.28% |

Applying this to **Experiment 2's actual `exactMatchupN` distribution** (not a hypothetical one):

| Sample-efficiency bin | Checkpoints | Mean exactMatchupN | Mean individual weight at k=15 |
|---|---:|---:|---:|
| 0 | 737 | 0 | 0% |
| 1 | 555 | 1 | 6.25% |
| 2-4 | 882 | 2.77 | 15.57% |
| 5-9 | 328 | 6.08 | 28.85% |
| 10-14 | 18 | 10.72 | 41.68% |

For 1,292 of 2,520 checkpoints (bins 0 and 1 combined: 737 + 555), individual data contributes
6.25% or less of the blend weight, and for 2,174 of 2,520 (bins 0 through 2-4) it never exceeds
~16% - which mechanically explains why `singleLevelShrinkage`'s predictions stay close to the
global rate at these `n`: not a bug, a direct consequence of `k=15` at this sample-size regime.

**This cuts both ways and is not resolved here**: a raw empirical rate from 1-14 balls at a true
rate near 4.5% is itself extremely noisy (e.g. at n=1 the realized rate is either 0% or 100%), so
heavily discounting it could be exactly correct behavior. Or `k=15` could be too conservative to
let genuine batter x bowler interaction signal (Finding 1: a real, nonzero 8.6% of ground-truth
variance) through at all in this sparsity regime. Distinguishing these requires a `k`-sweep
experiment, which per the standing instruction is not run in this diagnostic.

## Finding 5 - rawExactMatchup's coverage gap has a precise, verified mechanical cause

Two different quantities were being discussed loosely as though they were the same thing:

- **`exactMatchupN`** (used for sample-efficiency binning): total balls this exact batter has
  faced this exact bowler, summed across *all* line/length buckets. 1,783 of 2,520 checkpoints
  (bins 1 through 10-14) have `exactMatchupN > 0`.
- **`rawExactMatchup`'s own prediction** requires a nonzero ball count in the *one specific*
  (line, length) bucket the checkpoint is asking about - a finer granularity, since there are 42
  possible buckets to spread those 1-14 balls across.

Verified counts: of the 1,783 checkpoints with some pair-level history, only **110** had a ball in
the specific bucket needed - the other **1,673** had pair-level history that simply wasn't in the
right bucket. `rawExactMatchup`'s Brier score of 0.03636 is computed over those 110 cases only,
against `global`'s 2,520 - not a fair comparison, confirming the caveat already raised: this number
should not be read as "raw exact matchup is the best method," only as a description of the narrow
subset of cases where it can make a prediction at all.

## Secondary observation - the line x length "effect" is a single flat table, not separable line/length main effects

A 2-way ANOVA was run on the 42 `lineLengthEffect` cells purely out of curiosity about whether the
8.6%/33%/34.4%-style breakdown extends inside the LL term too:

| | Share of LL's own variance |
|---|---:|
| line (row) main effect | 8.4% |
| length (column) main effect | 19.1% |
| residual ("interaction") | 72.6% |

**This should not be read as "the generator has an 8% line effect and 19% length effect."**
`generatePopulation` (`generator.js:98-103`) draws one independent `Normal(0, 0.3)` value per
(line, length) cell with no row or column structure imposed at all - line and length are not
separable main effects in this generator's design, they're one joint 42-cell lookup table. The
8.4%/19.1% split above is what a naive 2-way ANOVA finds in a single random draw of 42 i.i.d.
values purely by chance, not a designed property of the generator. Included for completeness, not
as a finding to act on.

## What this diagnostic does NOT conclude

- No verdict on whether hierarchical shrinkage "works" or should be changed.
- No recommendation on `k`.
- Finding 3's causal claim (archetype noise is *why* fullHierarchy underperforms) is a falsifiable
  explanation consistent with the code and Finding 2, but was not isolated with a controlled
  ablation (e.g., a version of `getMatchupPlan` with the two archetype levels removed, evaluated
  head-to-head against the real one on the same checkpoints) - that would be a new experiment,
  not run here per instruction.
- No changes were made to `generator.js`'s probability model, `statUtils.js`, `tendencyAnalytics.js`,
  `evaluate.js`, or `metrics.js`.
