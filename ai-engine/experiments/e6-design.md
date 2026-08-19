# E6 design — establish a scientifically trustworthy conventional baseline

**Preregistered 2026-08-19, before any candidate estimator is fitted.** Committed separately from
its implementation so the git history shows the criteria preceded the results — the same discipline
`research/protocol.md` applies to Experiments 4–9.

---

## What E6 is, and what it is not

**It is not** "make the Random Forest better." Part 1 established that the deployed forest is
capacity-uncontrolled and behaves close to a lookup table; tuning it to look good would answer no
question.

**It is**: *what does a properly selected conventional estimator achieve, once the engineering
pipeline is valid?*

The distinction matters because Part 1 removed the excuses. Features are now constructed once and
asserted identical across training and serving; the domain is guarded; the data has no duplicate
checkpoints. Whatever gap remains after E6 is a property of the estimator and the world, not of the
plumbing.

---

## 1. The split — fixed, seeded, committed

Three-way, over **matches**, seed `20260819`. Recorded in `results/e6/split-match-ids.json`, which
is committed, so any rerun uses the identical partition.

| | matches | rows | base rate |
|---|---|---|---|
| train | 346 | 6,264 | 0.4834 |
| validation | 115 | 2,085 | 0.4312 |
| **test** | **116** | **2,092** | **deliberately unread** |

**The test set is read exactly once**, at the end, after every selection decision is final. Its base
rate is not computed until then — it is not in the committed step-0 output.

**A flag raised by the split itself**: train and validation base rates differ by 5.2 points (0.483
vs 0.431). Experiment 6 of the matchup programme established that absolute Brier is confounded by
realized base rate across splits, and that **oracle MAE is the sound instrument when the test
distribution moves**. That is a second, independent reason for the two-axis reporting in §5 — not a
stylistic preference.

---

## 2. Candidate set — fixed now, not extended later

Adding a candidate after seeing results is how a selection procedure becomes a search for a
flattering number. The set is closed:

| # | Candidate | Why it is in the set |
|---|---|---|
| C0 | Constant base rate | The floor any model must beat to be worth deploying |
| C1 | Logistic on the four raw stored features | What the deployed features support with a linear form |
| C2 | Logistic on derived chase terms (required rate, wickets in hand, balls remaining, interactions) | The "strong interpretable baseline" the research question is about; the RO1a champion |
| C3 | Regularized logistic, penalty selected on validation | Tests whether C2 is under- or over-specified |
| C4 | Random Forest, **capacity selected on validation** | The deployed family, given the discipline it never had |
| C5 | Gradient boosting, capacity selected on validation | A stronger conventional learner, to bound what the family achieves |
| C6 | Best of C1–C5 + post-hoc calibration (isotonic, fitted on validation) | Separates ranking quality from calibration quality |
| — | Exact oracle | Not a candidate. The floor, from `diagnostics/oracle.js`. |

Capacity grids for C3–C5 are declared in the implementation before it is run, and every grid point's
validation score is reported — not only the winner's.

---

## 3. Selection protocol

1. Fit on **train** only.
2. Select every hyperparameter on **validation** only. The test set is not touched, not peeked at,
   not used for early stopping.
3. Refit the selected configuration on **train + validation**, which is standard and is what
   deployment would do.
4. Evaluate **once** on test. No re-selection afterwards.
5. Feature construction on every path goes through `backend/src/services/matchStateFeatures.js`'s
   convention, so the E3 parity guarantee holds inside the experiment too.

---

## 4. The preregistered fork — with numbers, fixed in advance

### The instrument

Comparing a candidate against the oracle on the same holdout is a **paired** comparison. The
irreducible term is identical in both arms and cancels exactly:

```
excessBrier(model) − excessBrier(oracle)  ==  Brier(model) − Brier(oracle)
```

Match-to-match difficulty cancels with it. Using the one-sample standard error instead would have
set the threshold at 0.0246 — roughly **40× too loose**, and almost anything would have passed.
That error was caught by computing both.

### The detection floor, measured without fitting anything

The oracle was degraded by Gaussian noise of known size and the paired bootstrap (1,500 resamples
over validation matches) asked whether the degradation was detectable:

| Degradation | mean \|Δ\| from oracle | paired Brier-diff 95% CI | detectable? |
|---|---|---|---|
| σ = 0.01 | 0.0073 | [−0.00043, +0.00018] | **no** |
| σ = 0.02 | 0.0141 | [+0.00034, +0.00156] | yes |
| σ = 0.05 | 0.0337 | [+0.00061, +0.00318] | yes |
| σ = 0.10 | 0.0649 | [+0.00163, +0.00830] | yes |

**The holdout's detection floor sits between oracle MAE 0.0073 and 0.0141.** Nothing was fitted to
produce this, so it cannot have been tuned toward a preferred answer.

### The criteria

Let **D** = paired bootstrap distribution of `Brier(candidate) − Brier(oracle)` on **test**,
resampled over matches, 4,000 draws.

- **Statistical criterion (S)**: the 95% CI for D includes 0.
- **Practical criterion (P)**: test **oracle MAE ≤ 0.01** — the measured detection floor above.

| | S met | S not met |
|---|---|---|
| **P met** | **Outcome A** | (incoherent — will be reported as a defect if it occurs) |
| **P not met** | **Outcome A′** | **Outcome B** |

**Outcome A — indistinguishable from optimal.** Stop the research branch. Any further gain requires
a richer world or real data, not a better estimator.

**Outcome A′ — Brier-saturated, per-state error remains.** The aggregate metric cannot separate the
model from the oracle, but its individual predictions still deviate measurably. This is a real and
informative state, and I am flagging it as the **likely** outcome in advance: the RO1a champion (C2)
measured oracle MAE **0.0407** on the previous split while sitting within 0.00014 excess Brier of
the floor. A binary fork would have forced that into "Outcome A" and lost the distinction.

**Outcome B — clear headroom.** Proceed to ask what structured information is missing.

### Why A′ is a separate outcome rather than a hedge

Brier is dominated by the irreducible term (0.113 of ~0.12 on validation). A model can be
Brier-indistinguishable from truth while its per-state predictions are 4 points off, because the
aggregate metric has no resolution left to spend. Oracle MAE has it. Collapsing the two would let
"our model is statistically indistinguishable from optimal" be said about a model that is visibly
wrong on individual states — which is exactly the overclaim this programme exists to prevent.

---

## 5. Two-axis reporting

Per explicit instruction. A model can carry a decent average Brier and still be dangerously unstable
in specific live states, and that is what would matter to a captain reading the number.

### Axis 1 — predictive quality

Brier · log loss · expected calibration error · decile calibration table · oracle MAE (mean, p90,
RMSE) · correlation with oracle · Brier skill vs C0.

### Axis 2 — operational behaviour

1. **Perturbation sensitivity** — mean \|Δp\| for one minimal unit of each feature (+1 run, +1
   wicket, +1 ball, +0.1 run rate), on in-distribution test rows. The instrument from Part 1 §1,
   which is what exposed the lookup-table behaviour.
2. **Calibration by regime** — ECE computed separately by phase (overs remaining 15–19 / 6–14 /
   1–5), by wickets in hand (0–3 / 4–6 / 7–10), and by required run rate (<6 / 6–10 / >10).
   Aggregate calibration can hide a model that is badly wrong in the death overs.
3. **Extrapolation behaviour** — predictions at states outside the training range (`overs_remaining`
   = 20 and → 0, which `keyMoments.js` genuinely requests), reported against the oracle's value
   there. This quantifies the E4 gap rather than assuming it.
4. **Train-vs-test feature distribution** — per-feature summary and overlap, so a performance
   difference attributable to distribution shift is not attributed to the estimator.

---

## 6. Reproducibility

Every seed fixed and recorded. Re-running the experiment must produce **byte-identical**
`metrics.json`; a test asserts it. Outputs carry the git SHA, the split file hash, and library
versions.

---

## 7. Explicitly out of scope

Per instruction, so causality stays intact — Part 1 measured the existing system; Part 2 changes one
defined aspect and re-evaluates:

- **E4** domain guard, **E7** operational items (`debug=True`, unauthenticated `/train`, the
  shadowing volume). Not touched.
- **The tactical advisor's contradictory thresholds** and the inverted `p < 0.5` advice. Each is a
  user-visible behavioural change and needs its own before/after gate.
- **Deploying whatever wins.** E6 produces a measurement, not a release. Swapping the served model
  is a separate change with its own equivalence capture.
- **World E, first-innings modelling, any novel method.** Not earned yet.

---

## 8. What would falsify the premise of this experiment

If C0 (constant base rate) turns out not to be beaten by any candidate on test, then the four
features carry no usable signal in this world and the whole framing is wrong. Recorded as a check,
not expected — RO1a already measured Brier skill of 0.367 against the constant baseline.

If the oracle's own excess Brier on test is materially larger than on validation (0.00312), the
oracle is mis-specified for part of the state space and **no candidate comparison is admissible**
until that is explained. This is validity gate 3 applied at evaluation time rather than only at
construction time.
