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

---

## D16 - The verification gate failed on Experiment 5's first run; results discarded and re-run

**Date**: 2026-08-16 · **Superseded results**: `results/2026-08-16T01-17-34-874Z/` (World A),
`results/2026-08-16T01-17-40-040Z/` (World B)

**What happened**: `research/diagnostics/verify-information-flow.js` was run before looking at any
score, per the agreed review order. Every information-flow and update-mechanics check passed - the
per-match reset was exact (36 test-match starts, 0 violations, max deviation 0.00e+0), updates
demonstrably occurred (98.9% / 98.8% of post-evidence checkpoints moved more than the fidelity
tolerance), and divergence grew with accumulated evidence. But the convergence check **failed in
both worlds**: `hitIterationCap: true`, `finalFitIterations: 8000`.

**Measured impact**: the `maxIterations = 8000` cap set in D13 was simply too low. On the exact
experiment data the fit converges at **12,000** iterations, and that is a genuine fixed point -
caps of 24,000 and 48,000 both stop at 12,000 and produce **bit-identical** predictions. The
truncated 8,000-iteration fit differs from the converged one by mean 9.6e-6 / max 8.0e-5 in
probability, which propagates to roughly 1e-6 in Brier: about **500x smaller** than the ~5e-4
differences between methods.

**Decision: discard and re-run anyway.** The measured impact is almost certainly immaterial, and
that is precisely the argument that must not be allowed to carry. A gate that gets waived the
first time it fires on grounds of "I measured it and it is probably fine" is not a gate. The fix
is cheap (raise the cap; the fit then converges on its own at 12,000), so there is no real tension
between rigour and cost here.

**Also recorded**: the failed run's raw results are committed rather than deleted, so the gate
firing is part of the record and not just a claim in this file.

**Change made**: `maxIterations` default raised from 8,000 to 24,000 in both `fit` and
`fitWithCrossValidatedLambda`. No tolerance, learning rate, decay schedule, online budget, or any
other parameter was touched - and no experimental score was consulted in making the change.

---

## D17 - Worlds A and B cannot test behavioural transfer; the null result does not count against it

**Date**: 2026-08-16 · **Diagnostic**: `diagnostics/player-response-structure-diagnostic.js`

**Finding**: in the current generator, of the terms that vary by batter, `V_b` is an independently
drawn scalar, `I_bw` and `R_b` are independently drawn per pair/per cell, and `A` depends only on
`battingStyle`. **There are no shared latent factors.** Two batters resemble each other only via a
similar scalar offset or the same declared style.

**Measured confirmation**: residual response-surface correlation is mean 0.0101 across all batter
pairs and is the same for same-style (0.0115) as different-style (0.0088) pairs. Oracle
neighbourhoods - chosen using the *hidden true* surfaces, a strict upper bound - scored 0.0642
oracle MAE against 0.0704 for **random** neighbourhoods of the same size, and both lost to plain
global (0.0305).

**Decisions, fixed now:**

1. Behavioural transfer is **structurally untestable** in Worlds A and B.
2. **The null result does not count against the algorithmic idea.** Treating it as evidence would
   repeat Experiment 1's error: concluding about a method from a property of the data generator.
3. **Do not build World D merely to produce a positive result.** A world constructed so that
   similarity helps will show that similarity helps, and would prove nothing.
4. If World D is built, the latent structure, effect size, residual variance, archetype
   contribution, sparsity regime, and evaluation criteria are all fixed **before** implementation.
5. It must include a **negative-control world** in which latent factors exist but are irrelevant to
   the prediction target - so that a method which blindly transfers between similar entities is
   penalised rather than rewarded. Without this the benchmark is gameable.

**Also standing**: the strongest existing baselines must be identified and implemented *before* any
novel method is designed. For this problem the bar is a **low-rank/factorised joint model**, not the
sequential hierarchy - that bar was cleared long ago by a simpler method.

---

## D18 - An estimate must carry its epistemic provenance, not merely its value

**Date**: 2026-08-16 · **Doc**: `documentation/evidence-provenance-backlog.md`

**Standing principle**, adopted from the Experiments 8-9 arc and intended to outlast it.

A predictive output should make it possible to understand *why the system is entitled to think it* —
not only how confident it claims to be. Concretely, for any pooled or backed-off estimate: report
which level of abstraction produced it, and how much evidence exists at that level **and at the
finest level**.

**Why this became a decision rather than a note**: `getMatchupPlan` already computed exactly this
(`basedOn`, `historicalSampleSize`, `rawBallsAtFinestLevel`), already sent it to the client, and the
client already typed it — and then displayed only a confidence badge derived from whichever level
happened to contribute. A bucket could therefore read "medium confidence" while the batter's own
contribution was zero. The system was computing the honest answer and discarding it at the final
step.

**The distinction this protects**: **model accuracy** (does the estimate match reality) versus
**claim accuracy** (does the presentation match what the evidence supports). The research programme
improved the second, not the first, and conflating them would overstate what was achieved.

**Scope**: applies to any future estimator in this codebase that pools across levels, not only to
`getMatchupPlan`. Not yet implemented anywhere — production is frozen under D8.

---

## D19 - Before concluding that a mechanism failed, establish that it was active

**Date**: 2026-08-16 · **Origin**: Experiment 8's bilinear zero-collapse

**Standing experimental invariant**, companion to the M1 rule (*before testing whether X predicts Y,
establish that Y is measurable*).

A model can fail for at least six reasons, and they are **six different scientific conclusions**:

| # | Failure mode | How we detect it | Have it? |
|---|---|---|---|
| 1 | The idea is genuinely bad | only by elimination, after 2-6 are excluded | inferential only |
| 2 | The representation is wrong for the structure | oracle comparison — give the method the true quantity and see if the architecture can use it (Experiment 4A) | partial |
| 3 | The data is insufficient | measurability gate (M1); model-based information limits | **yes** |
| 4 | Optimisation failed to converge | convergence criterion on the objective, `iterationsRun`, `hitIterationCap`, restart spread | **yes** |
| 5 | Regularisation suppressed the mechanism | magnitude of the fitted component — `sd(fitted latent)` — reported alongside its accuracy | **yes** |
| 6 | The implementation does not represent the intended method | verify on data generated *from* the intended structure before use (rank-2 recovery at r=0.9413 before Experiment 8) | **yes** |

**Every one of these checks was retrofitted after being burned by its absence**, which is the honest
reason this is a decision rather than a guideline:

- #4 came from D13/D16 — Experiment 4's optimiser was never converged, and Experiment 6's first run
  hit the iteration cap silently.
- #5 came from Experiment 8 — `r_latent = -0.044` was read as "the model tried and failed to
  recover the structure" when `sd(fitted latent) = 1e-9` meant it had produced no latent term at
  all. Two entirely different conclusions.
- #3 came from M1 — six proxies were about to be built against a target with negative reliability.
- #6 came from writing the low-rank model and realising a null result would otherwise be
  uninterpretable.

**Rule going forward**: any experiment reporting that a mechanism did not help must report, in the
same breath, evidence that the mechanism was *present and active* — magnitude of the fitted
component, convergence status, and a prior verification that the implementation recovers the
structure when it is unambiguously there.

**Note on modes 1 and 2**: these remain inferential. We cannot directly detect "bad idea" or "wrong
representation" — only conclude them once 3-6 are excluded. That is a real limitation and should be
stated whenever such a conclusion is drawn.

---

## Research board (not hypotheses — open questions, deliberately unformalised)

Recorded so they are not lost, and explicitly **not** registered in `hypotheses.md`, because
promoting a question to a hypothesis before it has a falsification criterion is how the last four
were formed.

**RQ1 — Can a prediction system learn the appropriate *level of personalisation* per prediction from
evidence, rather than fixing one model complexity globally?**

The evidence ladder this programme has actually mapped:

```
Population -- Archetype -- Player -- Context -- Interaction
                                ^
                    CricRoots can currently justify
                    up to roughly here (~81 balls/batter)
```

Everything measured feeds into this question: sample size matters, sample *quality* matters
(within-quartile spread was 99% of overall spread), signal strength matters, complexity has a cost,
richer representations become useful only above ~325-649 balls/batter, confidence and correctness
are not the same thing, provenance matters (D18), and sometimes the correct output is *"I do not
have enough evidence for this claim."*

**Testability, given M1**: aggregate performance of an evidence-aware complexity policy against a
global one IS testable at current scale. Per-entity attribution of *why* it helped is not.

**RQ2 — Does similarity used as a constraint, rather than as a substitute, behave differently under
sparsity?** H11 refuted substitution. A fused penalty retains the entity's own evidence and only
limits drift. Untested. Requires a prior-art pass over graph/fused/network-lasso regularisation
before any novelty claim.

---

## D20 - Never overwrite observational data to fit today's research question

**Date**: 2026-08-16 · **Origin**: the eligible-ball definition

Store what happened. Define eligibility as a **function of the question**, applied at analysis time:

```
Eligible(question, delivery)
```

not as a filter applied at capture time. The raw event keeps every observed field; each analytical
layer declares its own rule and states it.

**Why this is a decision and not a preference**: the alternative fails silently. Someone asks why
tagging completeness moved from 88% to 93%, and the answer turns out to be that the denominator
changed — with no record of when or why. Season-over-season comparisons then quietly stop meaning
anything, and there is no way to reconstruct the earlier figure.

**Worked case** — `wide` is eligible for a *bowler-tendency* question (it has a line and length;
that is generally why it was called) and not for a *batter-response* question (the batter never
played it). One delivery, two correct answers, determined by the question rather than the data.
`penalty` is excluded everywhere: no delivery occurred.

**This reconciles something flagged earlier as a defect.** `line` and `length` defaulting to
`'unknown'` looked like a data-quality hole. Under D20 it is the *correct* capture behaviour — it
records "not observed" rather than fabricating a value or refusing the write. The actual gap is
that **nothing measures the rate of `'unknown'`**, which is an instrumentation problem, not a schema
one. Fix the measurement, keep the default.

**Scope**: applies to any observational data this system captures, not only deliveries.
