# Research log

Chronological record of every experiment: what was run, what came back, and what it changed.
Raw numbers live in `research/results/<timestamp>/`; this file is the index and the narrative.

Companion documents: `research/protocol.md` (the governing principle), `research/decisions.md`
(methodological choices and why), `research/hypotheses.md` (what is currently supported).

**Standing rule**: experiment results are reported raw first, and interpreted only in joint review.
This log records interpretations only after that review has happened.

---

## Directory map

| Path | Contents |
|---|---|
| `protocol.md` | The Research Principle and Phase 1's objective |
| `prediction-target.md` | What is being predicted, and why not something else |
| `dataset-assumptions.md` | Track A (synthetic) vs Track B (real, blocked) |
| `decisions.md` · `hypotheses.md` · `research-log.md` | Shared research memory |
| `experiment-4-design.md` · `experiment-5-design.md` | Pre-registered designs |
| `synthetic/` | Generator, league design, World B design, generator tests |
| `harness/` | Evaluation harness (leakage control) and experiment runners |
| `models/` | The joint regularized model, its tests, the online fidelity check |
| `diagnostics/` | Ground-truth decomposition and the Experiment 2 diagnostic |
| `oracles.js` · `baselines.js` · `metrics.js` | Diagnostic instruments, methods, metrics |
| `results/` | Raw output, one timestamped directory per run |

Note on structure: an earlier proposal suggested `experiments/` and `algorithms/` directories.
Not adopted, deliberately - `harness/` and `models/` already hold those roles, and renaming
directories mid-programme would break the paths recorded inside already-committed results files.
The mapping above is the reconciliation.

---

## Phase 0 - engineering foundation

**Commits**: `20e7b69` and neighbours

Test infrastructure (38 tests), CI, fail-closed production secret checks, auth rate limiting,
model-artifact hygiene. Notable: `maxWorkers: 1` pinned in Jest after reproducing genuine
`mongodb-memory-server` parallel-startup flakiness; CI's backend job pinned to Node 18 to match
the production Docker image.

**Honest limitation recorded at the time**: the CI workflow could not be verified live (no `gh`
CLI or token available in the environment).

---

## Research-readiness audit

**Commit**: `930ac2f` · **Doc**: `documentation/research-readiness-audit.md`

Audited every claim against the actual repository rather than trusting a prior review.

**Central finding**: `matchSimulator.js` draws dismissals as `Math.random() < 0.045`, independent
of batter, bowler, line, and length. The ~579-match product database therefore contains no matchup
structure to recover, and cannot evaluate the matchup engine (decision D2). This redirected the
entire programme toward a structured synthetic environment.

Also found: `getLiveMatchupPlan` double-counts in-progress-match balls (D4).

---

## Experiment 1 (pilot) - INVALID BY DESIGN FAILURE

**Code**: `a85d6d2` · **Results**: `results/2026-08-15T22-44-34-033Z/`

**Outcome**: rejected as evidence about any algorithm. 1,657 of 1,750 checkpoints (94.7%) landed in
the 50+ exact-matchup-balls bucket - the opposite of the sparse regime under study. Cause: a fixed
two-team roster reused across all matches, plus a non-randomized batting order.

**Value**: the pilot did its job. The flaw was reported before the numbers were interpreted, and
no parameters were re-tuned until the distribution "looked better".

---

## Experiment 2 - first valid run; H1 unsupported

**Code**: `46008ef` · **Results**: `results/2026-08-15T23-06-42-795Z/` · **Design**: `synthetic/league-design.md`

16-team double round-robin, randomized batting order. Sparsity target met: **every** checkpoint had
≤14 exact-matchup balls (0:737, 1:555, 2-4:882, 5-9:328, 10-14:18).

**Brier**: global 0.046960 · singleLevelShrinkage 0.046956 · **fullHierarchy 0.047501** ·
archetypeOnly 0.047941. **Spearman**: global 0.309 · single 0.310 · fullHierarchy 0.185.

**Conclusion after joint review**: the hierarchy is not supported. Not refuted - unsupported.

---

## Diagnostic audit - why

**Commit**: `eb40bcb` · **Doc**: `diagnostics/experiment-2-diagnostic.md`

Full enumeration of all 709,632 matchup tuples (zero sampling error), self-checked against the real
`trueProbability()` (exact agreement).

**Ground-truth variance**: batter vulnerability 34.4% · bowler effectiveness 33.0% · line×length
22.0% · **batter×bowler interaction 8.6%** · batter line/length response 2.6%.

**Archetype carries ~0%**: confirmed twice - `trueProbability` never reads `battingStyle` or
`bowlingStyle` (code fact), and ANOVA eta-squared is 0.04-0.93% (empirical).

**Also established**: `k=15` gives individual data ≤16% of blend weight for 86% of checkpoints;
`rawExactMatchup`'s 110/2520 coverage is a bucket-level vs pair-level granularity effect, so its
apparently-good Brier is not comparable.

---

## Experiment 3a - archetype ablation; mechanism isolated

**Results**: `results/2026-08-15T23-50-30-783Z/` · **Code**: `90afc29`

`fullHierarchyNoArchetype` (real `hierarchicalBlend`, archetype rungs removed) scored
**0.04695576757826045** - bit-for-bit identical to `singleLevelShrinkage`. The two archetype rungs
are precisely and solely what separates `fullHierarchy` (0.047501) from the simpler method.

---

## Experiment 3b - World B; H2 refuted as a complete explanation

**Results**: `results/2026-08-15T23-53-27-655Z/` · **Code**: `09a9c2d` · **Design**: `synthetic/world-b-design.md`

Archetype made genuinely informative (8.84% of logit variance, measured). **The hierarchy still
lost**: global 0.061510 · single 0.061527 · **fullHierarchy 0.061925**.

**Conclusion after joint review**: making the archetype level informative is not sufficient. The
problem is not only *what* the intermediate level pools on.

---

## Experiment 4 - joint estimation wins; numbers later superseded

**Results**: `results/2026-08-16T00-23-37-836Z/` (World A), `.../00-23-42-982Z/` (World B) ·
**Code**: `2485077` · **Design**: `experiment-4-design.md`

Added two diagnostic oracle methods (D9) and a jointly-estimated regularized logistic model (D11,
D12).

**World A Brier**: joint **0.046400** · oracleInformedHierarchy 0.046766 · global 0.046960 ·
fullHierarchy 0.047501. **Spearman**: joint **0.550** vs global 0.309.
**World B Brier**: joint **0.061122** · oracleArchetypeOnly 0.061372 · global 0.061510 ·
fullHierarchy 0.061925. **Spearman**: joint **0.682** vs global 0.312.

The joint model won while fit once on training data only - seeing a mean of 34.5 fewer within-match
balls per checkpoint than every database-querying method.

**⚠ SUPERSEDED IN PART (D13)**: the optimizer was not converged. Prediction error from
non-convergence (~1.3e-3) propagates to ~1.3e-4 in Brier, about 23% of the 5.6e-4 margin over
`singleLevelShrinkage`. The *ordering* is likely robust - the Spearman gap is far too large to be
convergence noise - but the Brier values should not be cited. Experiment 5 re-measures them.

---

## Experiment 5 - online estimation under an equal information boundary

**Code**: `34799a9` · **Design**: `experiment-5-design.md` · **Status**: running

Adds `jointRegularizedLogitOnline`: the same model updated from each revealed ball, at the same
instant the database sees it, with a full per-match reset (D15). Removes Experiment 4's
information handicap and tests H5 (is the advantage concentrated in sparse bins?) and H6 (does
within-match evidence help?).

Also re-runs every Experiment 4 method under the corrected optimizer, so a converged and directly
comparable set of numbers will exist in one place.

**Defect found while building it**: see D13. Recorded here because it was my own implementation
error, found by a verification step rather than by the results looking wrong - which is the only
reason it was caught at all.

**First run: gate FAILED** (`results/2026-08-16T01-17-34-874Z/`, `.../T01-17-40-040Z/`). Information
flow and update mechanics passed; the convergence check did not (`hitIterationCap: true` at 8000).
Discarded and re-run rather than waived - see D16. Results committed anyway so the gate firing is
part of the record.

**Second run: gate PASSED** (`results/2026-08-16T01-47-39-346Z/` World A,
`.../T01-47-44-705Z/` World B). Converged at 12,000 iterations in both worlds. 25,200 rows each.

**Brier / Spearman** (World A, then World B): global 0.046960 / 0.309, 0.061510 / 0.312 ·
singleLevelShrinkage 0.046956 / 0.310, 0.061527 / 0.315 · fullHierarchy 0.047501 / 0.185,
0.061925 / 0.292 · *oracleInformedHierarchy* 0.046766 / 0.438, 0.061389 / 0.509 ·
jointRegularizedLogit 0.046380 / 0.553, 0.061102 / 0.683 · **jointRegularizedLogitOnline
0.046312 / 0.560, 0.061057 / 0.691**.

**Outcomes against pre-registered criteria** (full arithmetic in `hypotheses.md`):

- **H3** - the pre-registered *third* outcome. A perfect intermediate estimate does beat `global`
  (by 1.94e-4 / 1.21e-4), so the architecture can use archetype signal - but it still loses to
  joint estimation. Noisy intermediate estimation is *a* limitation, not *the* limitation.
- **H4 - SUPPORTED on converged numbers.** Margins ~500x the measured optimizer-noise floor. The
  D13 caveat is discharged.
- **H5 - NOT SUPPORTED as stated.** Applied literally the criterion fails in both worlds: the
  joint model's advantage is *larger* in the dense bins. Excluding the n=18/n=11 bins the picture
  splits (World A supports, World B does not). The joint model still wins overall - but the
  sparse-data framing is not what the evidence explains the win by.
- **H6 - SUPPORTED**, after correcting a unit error in the criterion (it compared a Brier
  difference to a probability-scale tolerance). Against a directly measured 8.7e-7 optimizer-noise
  floor, the online improvements are 78x and 52x. The literal failure in World B is recorded, not
  withdrawn.

**Useful by-product**: comparing the gate-failed run against the clean run isolates optimizer noise
exactly, since nothing else differs. Non-optimizer methods came back **bit-identical** across both
runs, confirming the harness is fully deterministic.

---

## Experiment 6 - CLOSED. World C, temporal drift

**Design**: `experiment-6-design.md` · **Criteria**: `diagnostics/experiment-6-criteria.js` ·
**Diagnostic**: `diagnostics/experiment-6-drift-diagnostic.js` · **Results**: `results/6-*/`

Eight preregistered runs, all passing the verification gate (identical checkpoints, exact
per-match reset, updates occurring and accumulating, every joint fit converged at
12,000-15,400 iterations).

### Preregistered mechanical outcomes, preserved as recorded

| Criterion | Verdict as computed |
|---|---|
| F1 | **met** (9/9 non-global methods over threshold; 7 still over excluding the weakly entity-dependent ones) |
| F2 | **not met** (difference -9.29e-5; joint degrades slightly *less*) |
| F3 | **NOT SUPPORTED** (A(m) non-monotonic; A(1.00)-A(0) = -2.95e-5, needed > +8.7e-5) |
| F4 | **met, marginally** (9.29e-5 vs 8.70e-5 threshold - clears by 7%) |

### Post-result diagnostic

The C4 dose-response reversed (C4-mod degraded more than C4-stress). Diagnosed without re-running
anything:

- Drift *direction* is bit-identical across magnitudes (δ(0.5)/δ(1.0) = 0.5 exactly, deviation
  0.0e+0), ruling out differential cancellation.
- Ground-truth movement is monotone in both spaces: logit 0.127/0.255/0.510, probability
  0.0067/0.0138/0.0300. Train→test distance monotone: 0.0271/0.0277/0.0323/0.0366.
- Realized test-period wicket rate is **not** monotone: 0.0409/0.0440/**0.0504**/0.0448.
- **Irreducible Brier** (mean `pTrue(1-pTrue)`, what a perfect predictor scores) is
  0.0481/0.0490/**0.0509**/0.0505 - non-monotone in the same shape as observed Brier.
- **Oracle MAE is cleanly monotone for every method** (joint online: 0.0204/0.0201/0.0252/0.0287).

### Interpretive consequence

Raw Brier degradation across runs contains a substantial realized-test-base-rate component. It is
therefore **not** a clean measure of model degradation. The criteria are not *false*; they are
**partially non-diagnostic for the mechanism they were meant to isolate.**

- **F1** - numerical criterion met, and independently corroborated: both the generated drift and
  oracle MAE increase monotonically, so entity-dependent prediction genuinely does get harder. But
  the Brier-based *magnitude* should not be read as a clean degradation estimate.
- **F2** - **contaminated / non-diagnostic.** Not "passed", not "failed". The -9.29e-5 margin sits
  far inside a base-rate distortion of much larger scale. It does **not** establish that the joint
  model is more robust.
- **F4** - technically met, but on a 7% margin inside that same distortion. **Not usable as
  evidence.**
- **F3** - **unaffected, and stands.** It compares offline against online *within* each run, on the
  same checkpoints, outcomes, base rate, and true probabilities, so the irreducible component is
  shared and cancels. Its NOT SUPPORTED verdict is the experiment's load-bearing result.

### What Experiment 6 establishes

Temporal drift makes prediction measurably harder (oracle MAE, monotone). **Increasing drift does
not increase the benefit of online adaptation.** The evidence therefore does **not** justify
building adaptive forgetting, dynamic player state, or temporal evidence allocation - roadmap
directions D-III, D-IV, and the temporal part of D-I lose their justification, exactly as the
pre-fixed branch procedure specified.

### Methodological findings, carried forward

Two distinct evaluation hazards, both discovered rather than anticipated:

1. **Information contamination** - nested evidence pools let an estimator partially see itself
   through its own prior (H9).
2. **Metric contamination** - absolute Brier degradation across changing test distributions carries
   a base-rate component unrelated to model deterioration. **Consequence adopted for all future
   experiments: oracle MAE, not Brier, is the primary instrument when the test distribution itself
   changes between runs.**

---

## Experiments 8-9 arc - CLOSED. What is estimable about an individual, and at what scale

Full chain: `experiment-8-design.md`, `world-d-design.md`, `experiment-9-design.md`, and the
diagnostics in `diagnostics/` (failure, adoption curve, per-entity, M1 gate).

### The central distinction, which the headline numbers obscure

"Can CricRoots personalise at 81 balls/batter?" has **two different answers** depending on what
kind of personalisation is meant, and conflating them would misstate the result badly.

| Per-entity component | Worth at 81 balls/batter (World D+, oracle MAE) |
|---|---|
| **Scalar batter/bowler effects** | `global` 0.036253 -> `A_joint` 0.027018 — **0.009235, a 25.5% reduction** |
| **Context-dependent latent representation** | `A_joint` 0.027018 -> `B_lowRank` 0.027019 — **−0.000001, nothing** |

So individual-level modelling is **not** beyond reach at this scale. A per-player *level* is
estimable and is the single most valuable component in the model — removing per-player terms was
the largest degradation measured anywhere in the programme (+4.91e-3, roughly 40x any other
ablation). What is beyond reach is the richer claim: *how this particular batter responds across
specific contexts*.

**The defensible product statement is therefore narrow and specific**: CricRoots can say how
vulnerable a batter is in general. It cannot yet say, on individual evidence, how that batter
responds to a particular line and length — and at 81 balls/batter it cannot even *measure* whether
such a claim would help.

### Three thresholds, independently measured, landing in the same regime

| Question | Threshold |
|---|---|
| When does the latent representation become worth activating? | between **325 and 649** balls/batter (adoption curve; CV switches penalty, benefit +1.03e-3) |
| When does per-entity utility become *measurable*? | reliability −0.11 at 81, **0.64 at 325**, 0.95 at 1298 (M1 gate) |
| When does the representation become recoverable at all? | r_latent 0.12 / 0.45 / 0.84 at 95 / 382 / 1527 (failure diagnostic) |

CricRoots operates at ~81. **Below all three.** These numbers are properties of this experimental
environment and must not be quoted as universal constants.

### What was refuted along the way

- **H11** behavioural-neighbourhood transfer — refuted with oracle neighbourhoods, under conditions
  maximally favourable to it.
- **H12** low-rank joint estimation — unsupported at this sparsity; supported above the threshold.
- **H13** observable evidence quality — **untestable at 81 balls/batter**, because the target
  variable itself is unmeasurable there. Testable at 325+.

### The methodological result, which may outlast the cricket one

Three separate times, a question turned out to be unanswerable in the environment where it was
asked — Experiment 1's sparsity distribution, Worlds A/B's absent latent structure, and now M1's
unmeasurable target. Each would have produced a confident, wrong, negative conclusion about a
*method*. The M1 gate is the first of the three that was caught **before** the effort was spent
rather than after.

**Standing rule adopted from this**: before testing whether X predicts Y, establish that Y is
measurable in the regime being tested.

### What was NOT concluded

That personalisation is impossible, that the joint model should be replaced, or that any algorithm
should be built. The open question is a product one and is deliberately left open here: what should
a system deliver when individual-level evidence supports a scalar claim but not a contextual one?
