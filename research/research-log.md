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
