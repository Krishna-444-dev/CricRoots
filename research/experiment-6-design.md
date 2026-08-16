# Experiment 6 design - World C, temporal drift

**Status: DESIGN ONLY. No code has been written. Nothing in this document has been run.**

Written before implementation, same discipline as `league-design.md`, `world-b-design.md`,
`experiment-4-design.md`, `experiment-5-design.md`. Submitted for review before any Experiment 6
code exists, so that the previous experiment's result does not quietly decide what the next one is
supposed to prove.

---

## 1. Why this experiment, and why not sparsity

Experiment 5's H5 verdict removed the obvious candidate. Applied literally, the preregistered
criterion showed the joint model's advantage is **not** concentrated in the sparse regime - in
World B it was roughly 4x larger at n=5-9 than at n=0-1. So "vary sparsity harder" would be
elaborating a question the evidence has already declined to support.

What remains genuinely open, and matters for a product that runs during live cricket, is
**stationarity**. Every method evaluated so far assumes the relationship learned from history still
holds at prediction time. Cricket does not oblige: batters develop, bowlers change, conditions and
tactics move across a season.

This also gives H6 a falsifiable *mechanism* rather than a plausible-sounding one. Under drift,
stale historical estimates should decay in value while controlled online updating should track the
current regime. If that is real, online adaptation should help *more* as drift increases. If it is
not, H6 stays a small stationary-world effect and H8 (adaptive evidence allocation) loses its
motivating evidence.

---

## 2. Exact drift-generating equations

World A's ground truth is (`synthetic/generator.js`):

```
logit p(i, j, k, l) = BASE + V_i + E_j + I_ij + LL_kl + R_ikl
```

with `BASE = logit(0.045)`, `V_i ~ N(0, 0.4)`, `E_j ~ N(0, 0.4)`, `I_ij ~ N(0, 0.6)` (12% of
pairs), `LL_kl ~ N(0, 0.3)`, `R_ikl ~ N(0, 0.3)` (15% of batter-line-length cells). World B adds
`A_ab ~ N(0, 0.35)`.

World C makes selected terms functions of **normalized season time**
`t = matchIndex / (numMatches - 1) ∈ [0, 1]`, where `matchIndex` is position in the fixture
sequence produced by `generateFixtures`. Every ball in a match shares that match's `t`.

Each drifting term gets a per-entity drift coefficient drawn **once**, then applied linearly:

```
C1 (player drift)
    V_i(t) = V_i + t · δ^V_i        δ^V_i ~ N(0, m · 0.4)
    E_j(t) = E_j + t · δ^E_j        δ^E_j ~ N(0, m · 0.4)

C2 (interaction drift)
    I_ij(t) = I_ij + t · δ^I_ij     δ^I_ij ~ N(0, m · 0.6),  only for pairs that already have an
                                    interaction entry - drift modifies existing relationships
                                    rather than inventing new ones

C3 (context drift)
    LL_kl(t) = LL_kl + t · δ^LL_kl  δ^LL_kl ~ N(0, m · 0.3)

C4 (combined) = C1 + C2 + C3 applied simultaneously, each with its own independent draws
```

`m` is the **drift magnitude multiplier**, expressed as a fraction of each term's own base
standard deviation so that "moderate drift" means the same thing for every term. At `m = 1.0` a
typical entity's parameter moves by about one full between-entity standard deviation across the
season - large, but not absurd for a player's development over a year.

`R_ikl` and `A_ab` are deliberately held **stationary** in all C variants. Keeping two terms fixed
means any observed degradation can be attributed to the terms that actually moved, and gives the
models some genuinely stable structure to retain rather than making everything a moving target.

**Linear ramp is the preregistered primary form.** A step change at the train/test boundary is the
maximally adversarial alternative and is listed in §11 as a secondary variant, explicitly *not*
part of the primary grid - running both and reporting whichever is more favourable would be
exactly the kind of selection this programme exists to prevent.

**Implementation constraint**: `trueProbability` must take an optional time argument defaulting to
stationary behaviour, and `generatePopulation` must draw drift coefficients **last**, after every
existing table, so that Worlds A and B remain byte-identical for the same seed. Same discipline as
`archetypeSignal` (D6).

---

## 3. Stationary control

**C0** is a full run with drift machinery present but `m = 0`. It is not optional and not a
formality: §4 changes the train/test split, so C0 is the only thing that separates "degradation
caused by drift" from "different numbers because the split changed."

Expected property, stated in advance: with `m = 0`, C0's ground truth is mathematically identical
to World A's. Predictions will nonetheless differ from Experiment 5's because the split differs.
If C0's *ordering* of methods diverges from Experiment 5's, that is a finding about split
sensitivity and must be reported before any drift result is interpreted.

---

## 4. Train/test information boundary - a required protocol change

Experiments 2-5 shuffled matches and drew a random 15% as test. **Under drift that is leakage**:
the model would train on matches from after the test period and see the future regime.

Experiment 6 therefore uses a **temporal split**: train on the first 85% of the fixture sequence
(matches 0-203), test on the final 15% (matches 204-239), no shuffling. The test period is the
most-drifted region, which is the point.

Everything else is unchanged and inherited: predict-then-reveal per ball, per-test-match document
teardown, per-test-match online model reset (D15), lambda by cross-validation over training rows
only (D12), `k = 15` untouched (D7), production code untouched (D8).

**Consequence to state plainly**: Experiment 6's absolute numbers are **not** comparable to
Experiments 2-5. Only within-Experiment-6 comparisons, anchored on C0, are valid.

---

## 5. Drift magnitude levels

| Level | `m` | Meaning |
|---|---:|---|
| none (C0) | 0.00 | stationary control |
| mild | 0.25 | drift a quarter of the between-entity spread |
| moderate | 0.50 | half |
| severe | 1.00 | a full between-entity standard deviation |

---

## 6. Preregistered run grid

Primary grid, World A base only, all with the temporal split:

| Run | Drift type | `m` | Purpose |
|---|---|---:|---|
| 6-C0 | none | 0.00 | control |
| 6-C1 | player | 0.50 | isolate main-effect drift |
| 6-C2 | interaction | 0.50 | isolate matchup drift |
| 6-C3 | context | 0.50 | isolate line/length drift |
| 6-C4-mild | combined | 0.25 | dose-response point 1 |
| 6-C4-mod | combined | 0.50 | dose-response point 2 |
| 6-C4-sev | combined | 1.00 | dose-response point 3 |

Seven runs, ~28 minutes each. World B is deliberately excluded from the primary grid: its
archetype term adds a dimension orthogonal to the drift question, and running both worlds would
double the surface on which a favourable subset could be selected after the fact. It becomes a
follow-up only if the primary grid produces a positive result.

---

## 7. Participating methods

Unchanged from Experiment 5, so the drift comparison rides on an already-verified harness:
`global`, `rawExactMatchup`, `singleLevelShrinkage`, `archetypeOnly`, `fullHierarchyNoArchetype`,
`oracleArchetypeOnly`*, `oracleInformedHierarchy`*, `jointRegularizedLogit`,
`jointRegularizedLogitOnline`, `fullHierarchy`.

*The oracle methods must read the **time-varying** true probability at the checkpoint's `t`. That
keeps them a genuine upper bound. An oracle frozen at training-time parameters would be measuring
staleness, not the ceiling.

No new method is introduced in Experiment 6. Adaptive evidence allocation is **not** implemented
here - §10 defines what would have to happen first.

---

## 8. Metrics and stratifications

Metrics unchanged (`research/metrics.js`): Brier, log loss, decile calibration, oracle MAE/MSE,
Spearman, sample-efficiency bins. Adding one stratification, no metric changes:

- **By test-match position** (test matches 1-12, 13-24, 25-36). Under a linear ramp the later test
  matches are the most drifted, so degradation should grow across these blocks. This is the
  within-run signature of drift, and its absence would suggest the drift never materialised in the
  data regardless of what `m` was set to.

**Data-side verification before any score is read** (mirroring `league-design.md`'s sparsity
assertion): a generator test must confirm that realized dismissal rates for drifting entities
actually differ between the first and last deciles of the season, at each `m`. If the drift does
not show up in the generated data, the experiment measures nothing.

`research/diagnostics/verify-information-flow.js` must pass on every run before scores are read,
exactly as in Experiment 5.

---

## 9. Preregistered falsification criteria

All margins are judged against the **measured optimizer-noise floor of 8.7e-7 Brier** (Experiment
5), not against a probability-scale tolerance - the unit error that compromised H6's original
criterion is not repeated here.

**F1 - does drift actually damage anything?**
> Unsupported if, at `m = 1.0` (6-C4-sev), no method's Brier degrades relative to C0 by more than
> 100x the noise floor (8.7e-5). If nothing degrades, the drift is too weak to study and the
> magnitudes must be revised *before* any other criterion is evaluated.

**F2 - is the joint model differentially fragile under drift?**
> The joint model is differentially fragile if its Brier degradation from C0 to 6-C4-sev exceeds
> `singleLevelShrinkage`'s by more than 100x the noise floor. This is a genuine risk, not a
> formality: a model with many fitted parameters may be more attached to a stale regime than a
> method that mostly reports a global rate.

**F3 - does online adaptation help more as drift increases?** *(the core question)*
> Let `A(m) = Brier(jointRegularizedLogit) - Brier(jointRegularizedLogitOnline)` at magnitude `m`.
> H6-under-drift is supported only if `A(m)` is **monotonically non-decreasing** across
> `m ∈ {0, 0.25, 0.50, 1.00}` AND `A(1.00) - A(0) > 100x` the noise floor. A flat or
> non-monotonic `A(m)` means online updating is not tracking the regime shift, whatever its
> stationary-world value.

**F4 - is any of this specific to the joint formulation?**
> If the sequential hierarchy degrades no more than the joint model and both degrade similarly,
> drift is a property of the problem rather than a discriminator between formulations, and it does
> not motivate a new algorithm.

**F5 - which drift type dominates?**
> Descriptive, not pass/fail: compare degradation across 6-C1 / 6-C2 / 6-C3 at equal `m = 0.50`.
> Recorded because it determines *what* an adaptive method would need to adapt to, and reported
> whichever way it lands.

**Stated in advance**: with 7 runs and 10 methods there is ample room to find *something*
favourable. Only F1-F4 count as tests. F5 and the test-match-position stratification are
descriptive and may not be promoted into a claim after the fact.

---

## 10. What result would justify pursuing adaptive evidence allocation (H8)

H8 becomes evidence-motivated only if **all** of the following hold:

1. **F1 passes** - drift measurably damages predictions, so there is a problem to solve.
2. **F3 passes** - a *fixed* online update rule already recovers some of that damage, and
   increasingly so with drift magnitude. This shows adaptation is the right lever.
3. **A ceiling remains** - even the best online variant at `m = 1.00` stays meaningfully worse
   than C0's best method, so there is headroom a smarter allocator could plausibly claim.

If F3 fails, H8's motivating premise is absent and the honest conclusion is that adaptation does
not help here - regardless of how appealing the algorithm sounds.

If F1 fails, no drift-adaptive algorithm is warranted, and the next question becomes real data
rather than a more elaborate synthetic world.

If all three hold, the *specific* algorithm is chosen by F5: interaction drift dominating points
toward matchup-level adaptive forgetting; player drift toward entity-level recency weighting;
context drift toward context-conditional regularization. **The failure mode selects the algorithm,
not the other way round.**

---

## 11. Explicitly out of scope

- Step-change drift at the train/test boundary (secondary variant; would need its own
  preregistration, and is not to be run alongside the primary grid and reported selectively).
- World B under drift.
- Any adaptive-forgetting or evidence-allocation implementation.
- Tuning `k`, lambda, the online iteration budget, or any other hyperparameter.
- Real cricket data (Track B remains blocked, D2/D3).
- Any change to production code.

---

## 12. Open questions for review, before implementation

1. **Is the temporal split the right call, or should C0 be run under *both* splits** to quantify
   the split's own effect separately from drift? The latter costs one extra run and would make the
   C0 anchor stronger.
2. **Is `m = 1.00` realistic for a single season?** It is deliberately at the aggressive end. If it
   is implausible, F1 and F3's thresholds should move down before anything runs.
3. **Should drift apply within the training period too, or only from the split point?** As
   specified it accumulates from `t = 0`, so the training data itself is non-stationary and the
   model sees a blurred average. Restricting drift to the test period is cleaner but less
   realistic.
4. **Is 7 runs the right budget?** Dropping the mild point would weaken F3's monotonicity test to
   three points; adding magnitudes strengthens it at ~28 minutes each.
