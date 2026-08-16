# Decision log

Every methodological decision that shapes what the experiments can and cannot conclude, with the
evidence behind it and the alternatives rejected. Written so that neither reviewer has to rely on
conversation history - the repository is the shared research memory.

Append-only in spirit: superseded decisions are marked SUPERSEDED with a pointer, not deleted,
because *why* a choice was abandoned is part of the record.

---

## D1 - Prediction target is dismissal probability, not a composite runs+wickets utility

**Date**: 2026-08-15 · **Commit**: `304ea16` · **Doc**: `research/prediction-target.md`

**Decision**: The quantity every method predicts is `P(dismissal | batter, bowler, line, length)`.

**Evidence**: `getMatchupPlan` computes a strike-rate figure but discards it; `blendedDismissalRate`
is the only output the product actually consumes.

**Alternatives rejected**: A composite utility combining runs conceded and dismissal probability.
Rejected because it introduces a weighting parameter with no principled value, and a bad choice
of that weight could mask or manufacture a difference between methods. Deferred rather than
discarded.

---

## D2 - The product's own match database cannot evaluate the matchup engine

**Date**: 2026-08-15 · **Commit**: `930ac2f` · **Doc**: `documentation/research-readiness-audit.md` §5

**Decision**: Do not use the ~579 matches in the product database as evaluation data. Build a
structured synthetic environment (Track A) with known ground truth instead.

**Evidence**: `matchSimulator.js` draws dismissals as `Math.random() < 0.045` - a flat rate
independent of batter, bowler, line, and length. There is no matchup structure in that data to
recover, so any method would score identically up to noise.

**Consequence**: All results so far are Track A only. Track B (real data) remains blocked and no
claim about real-world performance has been made.

---

## D3 - Track A and Track B stay strictly separated

**Date**: 2026-08-15 · **Doc**: `research/dataset-assumptions.md`

**Decision**: Synthetic and real-data work are separated in code, data, and documents. Track A
results are never presented as validation of real-world performance.

**Why it matters**: The oracle methods (D9) are only possible on synthetic data. Without a hard
separation it would be easy to let a synthetic-only instrument leak into a real-data claim.

---

## D4 - Live-adjustment evaluation is deliberately out of scope

**Date**: 2026-08-15 · **Doc**: `research/harness/evaluate.js` header

**Decision**: `getLiveMatchupPlan` / `fullHierarchyWithLive` are implemented but not evaluated.

**Evidence**: `getMatchupPlan`'s underlying `getLineLengthBreakdown` query has no match-exclusion
filter, so the current match's balls are already inside the "historical" aggregate by the time
they are separately blended in again as "live" evidence. Any live-vs-historical comparison would
measure that double-count, not the live adjustment.

**Status**: Open product bug, tracked separately, not fixed as part of the research work.

---

## D5 - League/fixture redesign after the pilot's sparsity failure

**Date**: 2026-08-15 · **Commit**: `46008ef` · **Doc**: `research/synthetic/league-design.md`

**Decision**: Replace the pilot's fixed two-team roster with a 16-team double round-robin and
randomized per-innings batting order.

**Evidence**: The pilot put 1,657 of 1,750 checkpoints (94.7%) in the 50+ exact-matchup-balls
bucket - the opposite of the sparse regime the hypothesis is about. Two causes: the same two teams
played every match, and `strikerIdx` always started at 0 so early-order batters absorbed a
disproportionate share of balls.

**Guard against motivated reasoning**: The target distribution was written down and committed
*before* regenerating data, and the sparsity property is asserted in `generator.test.js` against
the generated data - never against evaluation metrics, which that test file has no access to.

---

## D6 - World B adds archetype signal without perturbing anything else

**Date**: 2026-08-15 · **Commit**: `09a9c2d` · **Doc**: `research/synthetic/world-b-design.md`

**Decision**: `archetypeSignal: true` draws one fixed effect per (battingStyle, bowlingStyle) pair,
drawn **last** in `generatePopulation` so every earlier table is byte-identical to World A for the
same seed.

**Evidence for the effect size**: measured 8.84% of logit-space variance - deliberately comparable
to World A's batter x bowler interaction term (8.6%), so it is a real effect rather than a token
one. Effect size chosen a priori from the existing `lineLengthEffect` scale, not tuned to produce
a particular outcome.

**Falsifiability served**: isolates "is archetype pooling bad in general?" from "is *this*
archetype variable uninformative?"

---

## D7 - `k = 15` has never been tuned

**Date**: standing, all experiments

**Decision**: The production shrinkage constant stays at its deployed value throughout. No sweep
has been run.

**Why**: Tuning `k` against experimental results would convert an evaluation into a fitting
exercise. A `k`-sweep remains a legitimate future experiment, but only as a pre-registered
experiment with its own design document.

---

## D8 - Production code is never modified by the research work

**Date**: standing, all experiments

**Decision**: `backend/src/utils/statUtils.js` and `backend/src/services/tendencyAnalytics.js`
are untouched. Every baseline calls the real exported functions.

**Why**: Evaluating a reimplementation would prove nothing about the deployed code. The ablation
in D10 is built by passing a different `levels` array to the *real* `hierarchicalBlend`, not by
writing a second blending function.

---

## D9 - Oracle methods are diagnostic instruments, never candidate methods

**Date**: 2026-08-16 · **Commit**: `2485077` · **Doc**: `research/experiment-4-design.md`

**Decision**: `oracleArchetypeOnly` and `oracleInformedHierarchy` read hidden ground truth. They
are labelled diagnostic-only in the source, in the design doc, and in every results report, and
may not be exported to the product.

**Purpose**: They answer "if the intermediate estimate were *perfect*, would this architecture
recover the signal?" - separating an architecture problem from an estimation problem. Every number
they produce is an upper bound, not an achievable result.

---

## D10 - The archetype ablation isolates exactly one variable

**Date**: 2026-08-15 · **Commit**: `90afc29`

**Decision**: `fullHierarchyNoArchetype` uses the real `hierarchicalBlend` with 2 levels (exact,
global) instead of 4.

**Verification before running**: confirmed numerically that `hierarchicalBlend([exact, global])`
and `blendWithPrior(exact, global)` produce identical output across spot-check cases - so the
ablation differs from `singleLevelShrinkage` in mechanism by nothing at all, and from
`fullHierarchy` only by the two archetype rungs.

**Result**: bit-for-bit identical Brier to `singleLevelShrinkage` (Experiment 3a), confirming the
isolation worked.

---

## D11 - The joint model omits `batterLineLengthResponse`

**Date**: 2026-08-16 · **Doc**: `research/experiment-4-design.md`

**Decision**: The joint regularized model fits
`mu + batter + bowler + archetypePair + lineLength + interaction`, omitting the generator's
per-batter per-(line,length) response term (2.6% of World A variance).

**Why**: it would add ~7,400 parameters against ~14,280 training observations. No method in the
comparison attempts it, so the omission is symmetric.

**Implication**: the joint model is *not* a ceiling - there is known, unmodelled structure left.

---

## D12 - Hyperparameter `lambda` chosen by cross-validation on training rows only

**Date**: 2026-08-16 · **Commit**: `2485077`

**Decision**: 3-fold CV over training observations, fixed grid `{1, 5, 20, 100}`, interaction
penalty fixed a priori at `4 x lambda`. No test checkpoint influences the choice.

**Distinction from D7**: selecting a hyperparameter on training data is standard practice;
selecting one by looking at test results is not. These are different acts and only the first is
performed.

---

## D13 - Optimizer convergence defect found and fixed; Experiment 4's precise numbers superseded

**Date**: 2026-08-16 · **Commit**: `34799a9` · **Doc**: `research/experiment-5-design.md`

**Decision**: Replace the fixed 300-iteration Adam budget with learning-rate decay
(`lr / sqrt(1 + t/500)`) plus stopping on relative improvement in the penalized objective.

**Evidence**: Experiment 4's fits were not converged. Predictions move ~1.3e-3 between 300 and 600
iterations, propagating to ~1.3e-4 in Brier - roughly **23% of the 5.6e-4 margin** by which
`jointRegularizedLogit` was reported to beat `singleLevelShrinkage`. Separately, constant-step
Adam was measured to plateau rather than settle: successive budget doublings kept moving
predictions ~1e-4 mean / ~5e-4 max indefinitely.

**Status of Experiment 4**: its *ordering* is likely robust (the Spearman gap, 0.31 -> 0.55, is far
too large to be convergence noise), but its precise Brier values should not be cited. Experiment 5
re-runs the fit-once joint model under the corrected optimizer so a converged, directly comparable
version exists.

**Guard added**: `finalFitIterations` and `hitIterationCap` are now recorded in every results file,
and a regression test asserts a 100x stricter tolerance barely moves predictions - so a
non-converged fit is visible rather than silent.

**This was an implementation defect of mine, not a property of any method under test.**

---

## D14 - The online update budget was chosen on optimizer fidelity, not on results

**Date**: 2026-08-16 · **Commit**: `34799a9` · **Script**: `research/models/online-fidelity-check.js`

**Decision**: 100 warm-start Adam iterations per revealed ball.

**Evidence**: measured worst-case disagreement with a fully converged cold refit - 50/ball:
2.0e-4 mean; 100/ball: 1.4e-5 mean, 5.7e-5 max; 200/ball: no better than 100. Chosen as the
smallest budget whose disagreement sits roughly an order of magnitude below the ~5e-4 differences
being measured between methods.

**Why this is not tuning**: the check compares the online optimizer against the batch optimizer on
identical data. It never evaluates a method's score, so no experimental outcome could influence it.

---

## D15 - Per-test-match reset of the online model

**Date**: 2026-08-16 · **Commit**: `34799a9`

**Decision**: At each test match, the online model is rebuilt from a deep copy of the base
parameters, base design maps, and fresh optimizer state.

**Why**: without it, a `(batter, bowler)` interaction coefficient learned during one held-out match
would carry into the next - the model-side equivalent of the cross-match leakage the harness
already prevents by deleting each test match document after evaluating it.
