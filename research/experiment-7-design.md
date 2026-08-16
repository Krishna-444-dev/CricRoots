# Experiment 7 design - H9, nested-pool contamination

**Status: DESIGN ONLY, SUBMITTED FOR REVIEW. No code written. Nothing run.**

Tests whether the sequential hierarchy's failure is caused by its shrinkage targets containing the
observations being shrunk, and — critically — whether that mechanism can be **separated** from the
archetype-noise explanation, which Experiment 3a could not do.

---

## 1. The confound this experiment exists to break

Two explanations survive every result so far:

- **H-A (archetype noise)** — the archetype rungs pool on a variable carrying ~0% ground-truth
  variance in World A, injecting noise as a confident prior.
- **H-B (nested contamination)** — the archetype rungs' estimates contain the exact matchup's own
  observations (measured: mean **15.6%**, median 11.8%, p90 31.3%, **max 100%** of the finest
  rung's pool), so the prior is pulled toward the estimate and the blend under-shrinks.

`fullHierarchyNoArchetype` removed **both at once** — it deleted the archetype rungs *and* dropped
contamination from 15.6% to 0.02%. Hence the confound.

**A three-way comparison breaks it**, because leave-one-out removes contamination while *keeping*
the archetype level:

| Arm | Archetype rungs | Contamination | If it performs like… |
|---|---|---|---|
| **A** `fullHierarchy` (current) | present | present (15.6%) | — baseline |
| **B** `fullHierarchyLOO` (new) | present | removed | …**A** → contamination is not the mechanism → H-A stands |
| **C** `fullHierarchyNoArchetype` | absent | absent | …**C** → contamination *was* the mechanism → H-B supported |

An intermediate result means both contribute, which is also informative.

---

## 2. What leave-one-out means precisely

Currently (`tendencyAnalytics.js:137-147`) the pools are strictly nested because
`getPlayerIdsByArchetype` never excludes the target. Arm B makes each level exclude the finer level
inside it, giving **disjoint incremental evidence**:

```
L1  exact         = {b} x {w}
L2  batter-vs-arch(LOO)  = {b} x (arch(w) \ {w})          this batter vs OTHER bowlers of that style
L3  arch-vs-arch(LOO)    = (arch(b) \ {b}) x (arch(w) \ {w})
L4  global(LOO)          = all balls involving neither b nor w
```

Every level then contributes information the finer levels do not already contain — the incremental
decomposition, rather than four overlapping views of one dataset.

**Implementation constraint**: built in `research/baselines.js` by passing filtered id lists to the
**real, unmodified** `getLineLengthBreakdown` and `hierarchicalBlend`. `tendencyAnalytics.js` and
`statUtils.js` stay untouched (D8), so arms A and B differ in exactly one respect: which ids are in
the pool.

---

## 3. Both worlds are required, and World B is the more informative one

**This is the design's most important choice.** In World A archetype carries ~0% ground-truth
variance, so a leave-one-out archetype pool is a *cleaner version of an uninformative pool* — arm B
could fail there simply because there is nothing at that level worth having, telling us nothing
about contamination.

World B (archetype = 8.84% of logit variance) is where the archetype level has real signal, so it
is where removing contamination can actually pay. **A null result in World A alone would not refute
H9.** Both worlds run; World B carries the weight.

---

## 4. Primary metric: oracle MAE, not Brier

Adopted from Experiment 6's second methodological hazard. Arms are compared on the same
checkpoints within a run, so Brier's irreducible component largely cancels — but oracle MAE
measures distance from the true probability directly and is the better instrument. Brier, log loss,
Spearman, and calibration are all still reported.

Run config identical to Experiments 4/5 (16 teams, random split, `populationSeed 1`, `matchSeed 2`,
`splitSeed 3`), so results are directly comparable to those. **Not** the temporal split — drift is
not under test here, and Experiment 6 showed the split shift alone moves Brier by ~20x the
between-method gaps.

---

## 5. The mechanism measurement

Brier moving in the predicted direction is not evidence the predicted mechanism caused it — the
lesson from H5. So the mechanism is measured directly.

Per checkpoint, record:

- `overlapFraction r = |E_exact| / |E_bVsArch|` — the contamination at that checkpoint
- `S_A = |p_exact_raw - p_final|` under arm A (achieved shrinkage, contaminated)
- `S_B = |p_exact_raw - p_final|` under arm B (achieved shrinkage, uncontaminated)

Then stratify `S_A` and `S_B` by `r` ∈ {0-5%, 5-10%, 10-20%, 20-50%, 50%+}.

**H9 predicts `S_A < S_B`, with the gap widening as `r` rises** — under-shrinkage that scales with
contamination. A flat gap across `r` would mean arm B differs for some reason *other* than
contamination, which would undercut the mechanism even if arm B won.

---

## 6. Preregistered falsification criteria

Thresholds against the measured optimizer-noise floor (8.7e-7 Brier); oracle-MAE thresholds stated
in their own units.

**G1 — does removing contamination help at all?**
> Supported only if arm B's oracle MAE is lower than arm A's by > 1e-4 in **World B**. If arm B
> does not beat arm A where the archetype level carries real signal, contamination is not costing
> anything material and **H9 is unsupported**.

**G2 — is the mechanism the one claimed?**
> Supported only if achieved shrinkage `S_A < S_B` AND the gap increases monotonically across the
> `r` strata. If arm B wins without this signature, it wins for some other reason and H9 is **not**
> the explanation — report the win, reject the mechanism.

**G3 — does it break the H-A / H-B confound?**
> Descriptive-but-decisive: report where arm B falls between arms A and C. Near C → contamination
> explains most of the hierarchy's deficit. Near A → archetype noise does. Between → both.

**G4 — does the corrected hierarchy become competitive?**
> The strongest possible outcome: arm B matching or beating `jointRegularizedLogit` on oracle MAE.
> **Expected to fail.** Stated so that if it does fail — a corrected hierarchy still losing to joint
> estimation — that is recorded as evidence the hierarchy's problem is not only contamination.

**Stated in advance**: G1 and G2 must **both** hold for H9 to be supported. A Brier or oracle-MAE
win without the shrinkage signature is not support for this hypothesis.

---

## 7. Runs

| Run | World | Arms |
|---|---|---|
| 7-A | World A | all existing methods + `fullHierarchyLOO` |
| 7-B | World B | all existing methods + `fullHierarchyLOO` |

Two runs, ~30 min each. Arms A and C already exist as `fullHierarchy` and
`fullHierarchyNoArchetype`, so only one method is added and every comparison is within-run.

---

## 8. Novelty position, restated so it cannot drift

Leave-one-out pooling targets are **textbook empirical Bayes**. Correctly specified hierarchical
Bayes handles nesting generatively. If H9 is supported, the finding is:

> A widely-used practical shortcut — chaining pairwise shrinkage steps over nested pools —
> systematically under-shrinks, by an amount that scales with pool overlap, in a measured sparse
> regime.

That is a **measurement of a known-in-principle failure mode**, not a new method. If G4 unexpectedly
succeeds, that is a product result (fix the engine), still not an algorithmic contribution.

---

## 9. Out of scope

- Any change to `tendencyAnalytics.js` or `statUtils.js`.
- Fixing the production defect (deferred until the research programme concludes; changing it now
  breaks comparability with Experiments 1-6).
- Drift, temporal splits, adaptive forgetting — closed by Experiment 6.
- Any new estimator beyond arm B.

---

## 10. Open questions for review

1. **Should L4 (global) also be leave-one-out?** As specified it excludes all balls involving either
   player. That is the consistent choice, but global's contamination is only ~0.02%, so it adds
   implementation surface for no measurable effect. Simplifying L4 to plain global would make arms
   A and B differ *only* at the rungs where contamination is material — arguably cleaner.
2. **Is `r` the right contamination statistic?** It measures overlap at the finest rung only. A
   weighted measure across all rungs may be better, but is harder to interpret.
3. **Should a fourth arm hold archetype fixed but LOO only the batter-vs-arch rung?** That would
   isolate which rung's contamination matters, at the cost of a third run.
