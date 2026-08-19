# E6 results — conventional baseline under valid selection discipline

**Date**: 2026-08-19 · **Design**: [`ai-engine/experiments/e6-design.md`](../ai-engine/experiments/e6-design.md),
preregistered and committed **before** the implementation existed.
**Raw output**: `ai-engine/results/e6/e6-results.json`

**Headline: Outcome A′** — the outcome flagged as likely in the preregistration, reached on the
preregistered criteria. Brier is saturated; per-state error is not.

Reported in the requested order.

---

## 1. Gates and reproducibility

| Gate | Result |
|---|---|
| **Oracle specification** (design §8) — oracle excess Brier on test must not be materially worse than on validation | **PASS**. Validation 0.00312, test 0.00327. Candidate comparisons are admissible. |
| **Beats the constant baseline** (design §8) | **PASS**. C0 Brier 0.24875; best candidate 0.11227. |
| **Byte-identical rerun** (design §6) | **PASS**. Second run produced an identical `e6-results.json`. |
| **Test set read once** | Held. The step-0 output deliberately omitted the test base rate; no selection path in `e6_baseline.py` reads test labels. |

Environment recorded in the report: git SHA, sklearn 1.3.0, numpy 1.24.3, Python 3.9.6, split-file
SHA-256 prefix, seed 20260819.

---

## 2. Candidate training and validation selections

Split: **346 / 115 / 116 matches** (6,264 / 2,085 / 2,092 rows).

| Candidate | Selected on validation | Val Brier |
|---|---|---|
| C1 logistic, 4 raw features | — | 0.14542 |
| C2 logistic, 5 chase terms | — | 0.11617 |
| **C3 regularized logistic, rich basis** | **C = 0.01**, 11 non-zero coefficients | **0.11569** |
| C4 random forest | **min_samples_leaf = 50**, max_depth None | 0.12858 |
| C5 gradient boosting | 100 trees, depth 2, lr 0.05 | 0.11660 |
| C6 | base = C3 (validation winner) + isotonic | — |

### The single most direct confirmation of Part 1's diagnosis

The **deployed configuration was in C4's grid**, and it came last:

| min_samples_leaf | max_depth | Val Brier |
|---|---|---|
| 50 | None | **0.12858** ← selected |
| 50 | 10 | 0.12858 |
| 100 | 6 | 0.12886 |
| 1 | 6 | 0.13195 |
| 1 | 10 | 0.14594 |
| **1** | **None** | **0.15760** ← *what production runs* |

Capacity control alone improves validation Brier by **0.029 (18% relative)** within the same model
family. Part 1 inferred the memorisation from perturbation behaviour; this measures its cost
directly.

---

## 3. Test results — single evaluation

Test: 116 matches, 2,092 rows, base rate 0.4641.

| Candidate | Brier | Oracle MAE | Paired D | 95% CI | Outcome |
|---|---|---|---|---|---|
| C0 constant base rate | 0.24875 | 0.35087 | +0.13680 | [+0.10192, +0.16811] | B |
| C1 logistic (raw) | 0.12856 | 0.09258 | +0.01661 | [+0.00689, +0.02675] | B |
| C2 logistic (chase terms) | 0.11494 | 0.03261 | +0.00298 | [−0.00039, +0.00620] | A′ |
| **C3 regularized logistic (rich)** | **0.11227** | **0.01856** | **+0.00031** | **[−0.00241, +0.00301]** | **A′** |
| C4 random forest (tuned) | 0.12155 | 0.07638 | +0.00959 | [−0.00270, +0.02130] | A′ |
| C5 gradient boosting (tuned) | 0.11571 | 0.03477 | +0.00375 | [+0.00077, +0.00668] | B |
| C6 C3 + isotonic | 0.11791 | 0.04602 | +0.00595 | [+0.00096, +0.01134] | B |
| *Oracle (floor)* | *0.11196* | *0* | *0* | — | — |

---

## 4. Paired excess-Brier differences

The winner, **C3**, sits **+0.00031** above the exact oracle, with a 95% CI of
[−0.00241, +0.00301] that comfortably includes zero. On the aggregate metric it is
**indistinguishable from the theoretically optimal predictor for this world**.

For scale: the deployed model measured in RO1a sat **+0.0345** above the floor — about **110×**
further out.

---

## 5. Oracle MAE

| | Oracle MAE |
|---|---|
| Deployed RF (RO1a, previous split) | 0.1295 |
| C4 tuned RF | 0.07638 |
| C2 chase-terms logistic (the RO1a champion) | 0.03261 |
| **C3 (E6 winner)** | **0.01856** |
| Preregistered practical threshold | **0.01** |
| Detection floor measured in step 0 | between 0.0073 and 0.0141 |

Proper selection more than halved the per-state error of the previous champion (0.0407 → 0.0186).
It is still **1.9× the threshold**, and above the measured detection floor — so the residual error
is real, not an artefact of holdout size.

---

## 6. Classification: **A′**

Per the preregistered fork:

- **Statistical criterion (S)**: met — CI includes 0.
- **Practical criterion (P)**: **not** met — 0.01856 > 0.01.
- → **A′: Brier-saturated, per-state error remains.**

This is exactly the state predicted in the design, on the record before the run:

> *"I am flagging it as the **likely** outcome in advance: the RO1a champion measured oracle MAE
> 0.0407 while sitting within 0.00014 excess Brier of the floor. A binary fork would have forced
> that into Outcome A and lost the distinction."*

**Had we used Brier alone, we would now be stopping the branch.** The two-axis rule is what kept the
question open, and §8 shows there was something to find.

### A defect in my preregistered design, disclosed rather than patched

The S criterion — "the CI includes 0" — is a test of *non-significance*, not of *equivalence*. A
sufficiently imprecise estimate passes it by default.

**C4 exposes this.** Its CI is [−0.00270, +0.02130]: it met S with a point estimate of +0.00959 and
an oracle MAE of 0.076, four times the winner's. It is not "nearly optimal"; it is imprecisely
measured. The correct instrument is a TOST-style equivalence test requiring the CI to fall *within*
a margin, not merely to straddle zero.

The classifications above are reported **as preregistered**. The criteria are not being changed
after seeing results. Recording the flaw is the correct response; C4's A′ should be read as "not
resolved by this holdout", and any future use of this fork should specify equivalence rather than
non-significance.

---

## 7. Calibration

Aggregate ECE for C3 is 0.0489 — down from the deployed model's 0.0998, but not small.

**By regime (C3):**

| Regime | n | ECE | mean predicted | actual |
|---|---|---|---|---|
| overs remaining 15–19 | 580 | 0.0542 | 0.488 | 0.491 |
| overs remaining 6–14 | 1037 | 0.0485 | 0.465 | 0.488 |
| overs remaining 1–5 | 475 | 0.0530 | 0.352 | 0.379 |
| wickets in hand 0–3 | 98 | 0.0597 | 0.215 | 0.173 |
| wickets in hand 4–6 | 543 | 0.0434 | 0.363 | 0.381 |
| wickets in hand 7–10 | 1451 | 0.0409 | 0.493 | 0.515 |
| required rate < 6 | 263 | 0.0163 | 0.983 | 0.977 |
| required rate 6–10 | 1012 | 0.0532 | 0.627 | 0.635 |
| required rate > 10 | 817 | 0.0377 | 0.049 | 0.087 |

C3 is uniform across regimes — no hidden pocket of failure, which is the property the regime
breakdown exists to detect.

**C4 is not.** At *wickets in hand 0–3* it posts ECE **0.1257** (predicted 0.285, actual 0.173) —
2.6× its own aggregate. A tail-end collapse is precisely when a captain looks at the number, and an
aggregate ECE of 0.05 would have concealed it entirely. This is the two-axis requirement earning its
place a second time.

**C6 — post-hoc calibration made things worse.** Isotonic shifted validation predictions by a mean
of 0.046 and degraded test Brier from 0.11227 to 0.11791 and oracle MAE from 0.0186 to 0.0460.
Fitting a flexible monotone transform on 115 matches, on top of a model already at the Brier floor,
adds more variance than it removes. Recorded as a genuine negative result.

---

## 8. Did the mechanisms activate? (validity gate 4)

| Candidate | Mechanism under test | Activated? |
|---|---|---|
| C3 | regularization | **Yes** — selected C = 0.01, a strong penalty, 11 non-zero coefficients retained |
| C4 | capacity control | **Yes** — selected min_samples_leaf 50, against 1 in production; the leaf-1 configurations rank last |
| C5 | boosting capacity | **Yes** — selected the *smallest* grid point (100 trees, depth 2, lr 0.05), i.e. maximal restraint |
| C6 | isotonic calibration | **Yes** — mean shift 0.046, and it made things worse |

Every candidate's mechanism was active. No null result here is attributable to a mechanism that
silently did nothing — the failure mode D19 exists to catch.

### The most informative diagnostic: perturbation sensitivity

Mean |Δp| for one minimal unit, on in-distribution test rows:

| Perturbation | Deployed RF (Part 1) | C4 tuned RF | **C3 winner** |
|---|---|---|---|
| target_score +1 run | 0.1104 | 0.0280 | **0.0131** |
| wickets_down +1 | 0.0796 | 0.0043 | **0.0102** |
| overs_remaining +1 ball | 0.0015 | **0.0000** | 0.0070 |
| current_run_rate +0.1 | 0.0506 | 0.0139 | **0.0132** |

C3 is **8.4× more stable** than production to a one-run change. And C4's exact **0.00000** response
to a one-ball change is a defect, not a virtue: in the final over a single ball is decisive, and the
tuned forest cannot see it at all.

---

## 9. Unexpected findings

### 9a. The model is most wrong exactly where matches are decided

Extrapolation probing (design §5.3) produced the largest single result in this experiment. State:
target 160, run rate 8.0, 2 wickets down — i.e. **8 runs needed off the last over**.

| overs remaining | C3 | Oracle | \|Δ\| | in training range? |
|---|---|---|---|---|
| 20.0 | 0.823 | 0.767 | 0.057 | no |
| 19.0 | 0.806 | 0.775 | 0.032 | yes |
| **1.0** | **0.887** | **0.591** | **0.296** | **yes** |
| **0.5** | **0.896** | **0.554** | **0.342** | no |
| **0.1** | **0.967** | **0.641** | **0.326** | no |

**A 30-point error at one over remaining, well inside the training range.** The aggregate says
"indistinguishable from optimal"; the last over says otherwise. Only 475 of 2,092 test rows sit in
overs 1–5, so the endgame contributes little to the mean and the aggregate metric cannot see this.

The mechanism is legible: the model's basis is built on *required run rate*, and a required rate of
8 is comfortable across most of an innings. With six balls left, the **discreteness and variance of
the endgame** dominate, and no term in the basis expresses it. This is a concrete, named candidate
for "what structured information is missing" — not a vague appeal to more capacity.

### 9b. The A′ classification and finding 9a are consistent, and both matter

Residual oracle MAE (0.0186, ~1.9× threshold) and a 0.30 error in the last over are the same fact
seen at two resolutions. The endgame is where the residual lives.

### 9c. Implementation notes

- **The Python side never re-implements the oracle.** `oracle_query.js` is queried as a subprocess
  so ground truth has one definition — the same principle as `matchStateFeatures.js`, applied before
  it could go wrong rather than after.
- **A protocol gap in my own design**: §3 requires refitting the selected config on train+val, but
  an isotonic calibrator fitted on validation cannot sit on a base refit *including* validation. C6's
  base was therefore fit on train only, so C6 saw fewer rows than C0–C5. Recorded in the source and
  here; no candidate was added or removed.
- C1 (logistic on the four raw stored features) is markedly worse than C2 (the same model class on
  derived chase terms): Brier 0.12856 vs 0.11494, oracle MAE 0.093 vs 0.033. **The feature
  parameterisation matters more than the model family** — a point that would have been invisible
  without C1 in the closed set.

---

## 10. Position

Under valid selection discipline the conventional baseline is, on the aggregate metric,
**indistinguishable from the theoretically optimal predictor for this simulator** — and it is a
regularized logistic regression on five derived terms, not a learned model of any complexity.

But the two-axis rule held the question open, and the answer it protected is specific: the residual
error is concentrated in the **endgame**, where the model is wrong by up to 30 points and where
matches are actually decided.

Whether that is worth pursuing is your call, and §9a names the candidate structure rather than
leaving it open. **Everything here remains a statement about `matchSimulator.js`.** The endgame gap
is a property of a model fitted to a world whose ball process is i.i.d.; whether real cricket's
endgame has the same shape is Track B and unblocked only by pilot data.

**Nothing deployed. E4, E7 and the tactical-advisor thresholds remain untouched, per the design's
out-of-scope list.**
