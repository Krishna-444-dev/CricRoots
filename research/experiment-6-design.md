# Experiment 6 design - World C, temporal drift

**Status: APPROVED WITH MODIFICATIONS, IMPLEMENTED, NOT YET RUN.** The design below incorporates
the ten review modifications. Implementation and the drift-generation verification are complete;
**the experiment itself has not been run** and will not be until the design diff is reviewed.

Written before implementation, same discipline as `league-design.md`, `world-b-design.md`,
`experiment-4-design.md`, `experiment-5-design.md`. Submitted for review before any Experiment 6
code existed, so that the previous experiment's result did not quietly decide what the next one is
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
season. That is deliberately aggressive and is named **stress-level** rather than realistic (§5).

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

## 3. Stationary controls - two of them, so split effect and drift effect are separable

Review modification 1. A single control would confound two changes, since §4 alters the train/test
split as well as introducing drift. Two controls decompose it:

| Run | Split | `m` | Isolates |
|---|---|---:|---|
| **C0a** | random 85/15 (as Experiments 2-5) | 0.00 | nothing - the anchor |
| **C0b** | temporal 85/15 (new) | 0.00 | effect of changing the split |
| C1-C4 | temporal 85/15 | > 0 | effect of drift |

So:

```
Brier(C0a) -> Brier(C0b)   =  effect of the evaluation split alone
Brier(C0b) -> Brier(C4)    =  effect of drift alone
```

Without C0a, any degradation under drift would be partly attributable to the split change with no
way to separate the two. **All drift comparisons are anchored on C0b, never on C0a.**

Expected property, stated in advance: with `m = 0` both controls have ground truth mathematically
identical to World A's. C0a should reproduce Experiment 5's World A numbers closely (the drift
machinery is inert at `m = 0`); any material divergence would indicate the drift code perturbed
the stationary path and must be resolved before anything else is read. If C0b's *ordering* of
methods diverges from C0a's, that is a finding about split sensitivity and must be reported before
any drift result is interpreted.

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
Experiments 2-5. Only within-Experiment-6 comparisons, anchored on **C0b**, are valid. C0a exists
to measure the split's own contribution (§3), not as a drift baseline.

---

## 5. Drift magnitude levels

| Level | `m` | Meaning |
|---|---:|---|
| none (C0a, C0b) | 0.00 | stationary controls |
| mild | 0.25 | drift a quarter of the between-entity spread |
| moderate | 0.50 | half |
| **stress-level** | 1.00 | a full between-entity standard deviation |

Review modification 4: `m = 1.00` is named **stress-level**, not "realistic" and not "severe". The
purpose of the grid is to establish whether the models have a predictable *dose-response* to
increasing distribution shift, not to argue that any single magnitude corresponds to a real
cricket season. **F1 and F3 thresholds are NOT relaxed on realism grounds** - if nothing
deteriorates measurably even under stress-level synthetic drift, that is itself the finding.

---

## 6. Preregistered run grid

Primary grid, World A base only. Drift accumulates from `t = 0` **through the training period as
well as the test period** (review modification 3): the alternative - stationary training followed
by a sudden shift at the split point - is a distribution discontinuity rather than concept drift,
and would let a model succeed by detecting one boundary. As specified, the training data itself
contains conflicting historical regimes, which is the situation a season of real cricket actually
presents.

| Run | Split | Drift type | `m` | Purpose |
|---|---|---|---:|---|
| 6-C0a | random | none | 0.00 | anchor; isolates split effect with C0b |
| 6-C0b | temporal | none | 0.00 | control all drift runs are compared against |
| 6-C1 | temporal | player | 0.50 | isolate main-effect drift |
| 6-C2 | temporal | interaction | 0.50 | isolate matchup drift |
| 6-C3 | temporal | context | 0.50 | isolate line/length drift |
| 6-C4-mild | temporal | combined | 0.25 | dose-response point 1 |
| 6-C4-mod | temporal | combined | 0.50 | dose-response point 2 |
| 6-C4-stress | temporal | combined | 1.00 | dose-response point 3 |

**Eight runs**, ~28 minutes each. World B is deliberately excluded: its archetype term adds a
dimension orthogonal to the drift question, and running both worlds would double the surface on
which a favourable subset could be selected after the fact. Step-change drift, extra magnitudes,
and extra methods are likewise excluded (review modification 5). Any of these becomes a follow-up
only if the primary grid produces a positive result, and only with its own preregistration.

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

- **Online-vs-offline improvement per temporal block** (review modification 6). For each block:
  offline Brier, online Brier, and the improvement between them. Rationale: `A(m)` in F3 is an
  *aggregate*, and a method could improve on aggregate while getting *worse* in precisely the late
  test period where drift is strongest - which would make F3 misleading in exactly the case the
  experiment cares about. If the mechanism is real the improvement should grow across blocks
  (small early, largest late).

  **This is DESCRIPTIVE ONLY and must not become a pass/fail criterion, nor be promoted into one
  after the results are seen.** It is implemented in a separate script
  (`research/diagnostics/temporal-block-analysis.js`) that reads committed raw results, rather than
  in `research/metrics.js` - so the descriptive-only status is structural, not merely a promise,
  and `metrics.js` stays byte-identical across every experiment to date.

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
> Unsupported if, at `m = 1.00` (6-C4-stress), no method's Brier degrades relative to **C0b** by
> more than 100x the noise floor (8.7e-5). If nothing degrades, the drift is too weak to study and
> the magnitudes must be revised *before* any other criterion is evaluated. Thresholds are not
> relaxed on the grounds that `m = 1.00` is aggressive (§5).

**F2 - is the joint model differentially fragile under drift?**
> Define degradation for method `M` at magnitude `m` relative to the stationary temporal control:
> `D_m(M) = Brier_m(M) - Brier_C0b(M)`. Measuring *degradation* rather than absolute Brier matters
> because methods start from different C0b levels, and an absolute comparison would confound
> starting position with fragility.
>
> The joint model is differentially fragile if
> `D_1.00(jointRegularizedLogit) - D_1.00(singleLevelShrinkage) > 100x` the noise floor (8.7e-5).
> This is a genuine risk, not a formality: a model with thousands of fitted parameters may be more
> attached to a stale regime than a method that mostly reports a global rate.

**F3 - does online adaptation help more as drift increases?** *(the core question)*
> Let `A(m) = Brier(jointRegularizedLogit) - Brier(jointRegularizedLogitOnline)` at magnitude `m`.
> H6-under-drift is supported only if `A(m)` is **monotonically non-decreasing** across
> `m ∈ {0, 0.25, 0.50, 1.00}` (where `A(0)` is measured on C0b) AND `A(1.00) - A(0) > 100x` the
> noise floor. A flat or non-monotonic `A(m)` means online updating is not tracking the regime
> shift, whatever its stationary-world value.
>
> The per-block breakdown (§8) is consulted alongside this but **cannot overturn or substitute for
> it in either direction** - it is diagnostic context for interpreting F3, not a second test.

**F4 - is any of this specific to the joint formulation?** *(tightened, review modification 7)*
> Using the same `D_m(M)` definition as F2, and explicitly against **`singleLevelShrinkage`** - the
> strongest sequential baseline in every experiment so far, not `fullHierarchy`, which has lost
> throughout and would be a strawman comparator:
>
> Drift is *not* a discriminator between formulations if
> `|D_1.00(jointRegularizedLogit) - D_1.00(singleLevelShrinkage)| <= 100x` the noise floor - i.e.
> both degrade by a comparable amount. In that case drift is a property of the problem, and it does
> not on its own motivate a new algorithm.

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

## 12. Review decisions (resolved) and implementation status

The four open questions from the submitted draft were resolved in review:

1. **Temporal split, plus a second control.** Both C0a (random split) and C0b (temporal split) are
   run at `m = 0`, decomposing split effect from drift effect. Adopted (§3).
2. **`m = 1.00` retained**, renamed **stress-level** rather than described as realistic. F1/F3
   thresholds explicitly *not* relaxed on realism grounds. Adopted (§5).
3. **Drift accumulates from `t = 0` through training and test.** The train-stationary/test-drift
   alternative was rejected as a distribution discontinuity rather than concept drift. Adopted
   (§6).
4. **Eight runs** (seven primary plus C0a). No World B, no step-change drift, no extra magnitudes,
   no extra methods. Adopted (§6, §11).

Plus: the descriptive per-block online-vs-offline breakdown (§8), and F2/F4 tightened to use
`D_m(M)` degradation against `singleLevelShrinkage` (§9).

### Implementation status

Implemented and verified; **the experiment has not been run.**

| Piece | Where |
|---|---|
| Drift coefficients, drawn last | `synthetic/generator.js` - `generatePopulation({ drift })` |
| Time-varying ground truth | `synthetic/generator.js` - `trueProbability(..., t)` |
| Per-match season time | `synthetic/generator.js` - `generateLeagueMatches` attaches `t` |
| Temporal split | `harness/evaluate.js` - `splitMode: 'random' \| 'temporal'` |
| Time-aware oracles | `oracles.js` - `buildOracleArchetypeTable(population, t)`, cached per test match |
| Drift verification | `synthetic/generator.test.js` |
| Descriptive block analysis | `diagnostics/temporal-block-analysis.js` (separate from `metrics.js`) |

**Verification results** (review modification 9 - drift must be measurable in the generated data
before the experiment is worth running) are recorded in §13.

**Nothing runs until this design diff is reviewed** (review modification 10).

---

## 13. Drift-generation verification

Confirms the prescribed drift actually materialises in generated ball-by-ball data, at each
magnitude, before any evaluation is attempted. If drift did not show up here, the experiment would
measure nothing regardless of what `m` was set to.

Measured as the realized dismissal rate among drifting entities in the **first** vs **last** decile
of the season, and as the mean absolute change in true probability between `t = 0` and `t = 1`.

Results (`research/diagnostics/drift-verification-results.json`, written by `generator.test.js`):

| `m` | mean \|p(t=1) − p(t=0)\| | realized rate, first decile | realized rate, last decile |
|---:|---:|---:|---:|
| 0.25 | 0.00665 | 4.58% | 4.35% |
| 0.50 | 0.01374 | 5.18% | 5.18% |
| 1.00 | 0.02985 | 5.18% | 4.76% |

**Drift is present and monotone in `m`** - the mean absolute change in true probability roughly
quadruples from `m = 0.25` to `m = 1.00`, so the dose-response grid is measuring something real.

**An important property surfaced by this check, which affects how F1 must be read.** The realized
*aggregate* dismissal rate barely moves between the first and last decile of the season, even at
`m = 1.00` (5.18% -> 4.76%). That is not a failure of the drift - it is a direct consequence of
drift being **mean-zero across entities**: some batters get more vulnerable, others less, and the
population average is close to unchanged. Individual matchup probabilities move substantially
while the aggregate stays put.

The consequence is structural and must be stated before results are read: **the `global` baseline
is very nearly drift-immune by construction**, because it estimates precisely the quantity drift
leaves alone. F1 ("does drift damage anything?") must therefore be judged on the entity-dependent
methods, and a finding that `global` is unaffected is a property of the design, not evidence about
drift robustness. This also means `global` becomes a *stronger* relative competitor as drift
increases, which is worth anticipating rather than discovering.

**Backward-compatibility, also verified**: with `drift` absent, `generatePopulation` and
`trueProbability` are byte-identical to World A / World B - asserted directly in
`generator.test.js`, along with the property that a World C population at `t = 0` reproduces World
A exactly (drift accumulates from the season start rather than offsetting it). All pre-existing
generator tests pass unchanged.

**Wiring verified end-to-end** on a reduced configuration (4 teams, 1 round - a smoke test, not an
experiment): the temporal split confines test matches to the end of the season (season times
0.800 and 1.000), drift raises oracle MAE for every method, and `runExperiment` refuses outright
to combine `drift` with `splitMode: 'random'` rather than silently leaking the post-test regime
into training.
