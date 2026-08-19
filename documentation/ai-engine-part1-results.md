# AI Engine Part 1 — results

**Date**: 2026-08-19 · **Scope**: the approved Part 1 sequence, executed. Part 2 not started.
**Inputs**: [`ai-engine-audit.md`](ai-engine-audit.md), [`ai-engine-remediation-plan.md`](ai-engine-remediation-plan.md)
**Raw output**: `ai-engine/results/pre-remediation/` and `ai-engine/results/latest/`

Every number below is a committed measurement, not an assertion. Where a measurement contradicted
what I expected, the contradiction is recorded rather than smoothed over.

---

## 1. The skew, measured before it was fixed

The training file **structurally cannot exhibit this defect**: the extraction emits rows only at
completed overs, where cricket notation (`3.4`) and true decimal overs (`3.667`) agree exactly. The
live socket push fires after every ball. So the skew had to be measured on states the training file
does not contain, generated from the simulator's own transition kernel.

**483,671 served states. 83.5% are mid-over** — precisely where the two conventions disagree.

### Feature space

| Quantity | mean | p50 | p90 | p99 |
|---|---|---|---|---|
| \|Δ current_run_rate\| / true | 5.4% | 1.8% | 9.5% | 66.7% |
| …mid-over states only | 6.4% | 2.2% | 11.1% | 66.7% |
| \|Δ overs_remaining\| (overs) | 0.166 | 0.133 | 0.333 | 0.333 |
| target_score | exactly −1 on every served state | | | |

### Prediction space

Scored through the model the deployment actually builds:

| Defect | mean \|Δp\| | >0.05 | >0.10 | max |
|---|---|---|---|---|
| **All three together** | **0.126** | 48.7% | 36.4% | 1.00 |
| …mid-over only | 0.131 | 50.3% | 37.8% | 1.00 |
| Overs-notation alone | 0.065 | 32.2% | 20.7% | 0.94 |
| Target off-by-one alone | 0.099 | 40.9% | 29.3% | 1.00 |

**This answers the question I said I could not answer.** The skew was not cosmetic: over a third of
served states moved by more than ten probability points, and mean prediction drifted from 0.482 to
0.515.

### The result that had to be checked before it could be reported

The decomposition is counterintuitive — a **one-run** off-by-one moved predictions *more* than the
overs bug. Two readings: the off-by-one is specifically bad, or the model is unstable to any
perturbation. Those imply different fixes, so the reading was established rather than assumed.

Perturbing the model's **own in-distribution training rows** by one minimal unit:

| Perturbation | mean \|Δp\| | rows moving >0.10 |
|---|---|---|
| `target_score` +1 run | **0.110** | 29.3% |
| `wickets_down` +1 | 0.080 | 23.5% |
| `current_run_rate` +0.1 | 0.051 | 15.5% |
| `overs_remaining` +1 ball | 0.001 | 0.01% |

A one-run change on data the model was **fit on** moves it by 0.110 — as much as the bug did. And
**49.7% of training rows are predicted within 0.01 of their own 0/1 label**.

> The off-by-one is not special. The model is a near-lookup-table with `min_samples_leaf=1`, and
> general input instability is the finding. The skew fix is credited with correcting the inputs,
> **not** with making the model stable — it does not.

`overs_remaining` barely responds because it takes only 19 distinct integer values in training, so a
one-ball perturbation rarely crosses a split. That is why the overs-notation defect scored lower
than the target defect despite being the headline bug.

---

## 2. E1 — three models deleted, proven safe rather than argued safe

`capture_client_visible_output.py` captured every field both clients render, across **1,944 match
states**, before and after.

```
PASS: all 1944 states identical across match_status, win_probability, tactical_advice
      — E1 changed nothing a user can see
```

- `trained_models/`: **201 MB → 8.6 MB** (AT-E1.4 ceiling was 15 MB)
- `AIService` lost four methods that had zero call sites
- `data/`: `matches.csv`, `fielding.csv`, `players.csv` and the generator removed
- **The synthetic fallback is gone.** `train_all_models` now raises if `real_matches.csv` is absent.

That last one is justified by measurement, not taste. The pre-remediation evaluation scored the
synthetic-trained model at **Brier 0.4001** against the real holdout — *worse than predicting the
base rate* (0.2472), with mean predicted 0.861 against an actual 0.450. A fallback that produces
that silently is worse than a dead service.

---

## 3. E3 — one feature definition, and the assertion that enforces it

`backend/src/services/matchStateFeatures.js` is now the only place model input is constructed. It is
imported by the extraction script **and** all four serving paths, which is what makes parity a
guarantee rather than a convention.

### AT-E3.1 failed on its first run and found a real defect

Not in the new code — in the **committed training data**.

`legalBalls % 6 === 0` stays true across trailing wides and no-balls, because those do not increment
`legalBalls`. The extraction therefore re-emitted the same over boundary once per trailing extra,
with runs inflated each time.

```
duplicate checkpoints : 732
extra rows            : 792  (7.1% of 11,233)
matches affected      : 414 of 577  (72%)
```

Corrected in place, verifiably: the fixed extraction keeps the first checkpoint at each boundary (an
over ends the instant its sixth legal ball is bowled; a following wide belongs to the next over), and
rows are written in ball order, so "keep the first row per `(match_id, overs_remaining)`" is the same
operation. The script asserts the duplicate groups vary **only** in `current_run_rate` — the
signature of this defect and no other — before touching anything.

**Aggregate effect: negligible.** Brier 0.15626 → 0.15638; log loss 0.625 → 0.586. Reported as a real
data-integrity defect with a small measured impact, which is what it is.

This is the strongest argument for the assertion. The original extraction carried a *correct written
warning* about the very field that caused the skew, and used the right convention itself. The warning
prevented nothing. The assertion found a second, unrelated defect on its first execution.

---

## 4. E2 — first-innings serving stopped at the network boundary

All three sites now return `available: false` instead of passing the batting side's own live score as
the chase target. Both clients render an honest empty state.

The assertion is on the **axios mock's call count**, not the response body, because *"stopped
rendering it"* and *"stopped asking"* are different fixes and only the second is correct.

Also removed: the `|| 20` / `|| 150` defaults in `AIService`, which were the actual mechanism — a
missing target silently became 150. An incomplete chase state now throws.

The end-to-end test caught a leftover I had missed: `getTacticalAdvice` was still shipping
`opposition_strength: 7` and `pitch_type: 1` to models that no longer existed. Those two features
never varied in production.

---

## 5. E5 — a defensible sentence now exists

| Metric | Value |
|---|---|
| Brier (115-match holdout) | **0.15638** |
| Constant-predictor baseline | 0.24717 |
| Brier skill vs constant | 0.367 |
| Log loss | 0.58589 |
| Expected calibration error | **0.0998** |
| Holdout base rate | 0.4468 |

Calibration is **systematically overconfident at both extremes** — predicted 0.995 → actual 0.880;
predicted 0.123 → actual 0.307. Consistent with the memorisation measured in §1.

CI now has an `ai-engine` job (it previously had **none** — all three jobs were Node). It runs the
oracle verification, the data/serving contract tests, and the evaluation with its Brier ceiling.

A temporal guard now raises if matches ever span multiple dates, **before** a random match-level
split silently becomes a leak.

---

## 6. RO1a — the estimator against exact ground truth

Because `matchSimulator.js` draws every delivery i.i.d. of batter, bowler, team and state, a chase is
a first-passage problem and the true win probability is computable **exactly** by dynamic
programming — not estimated. `diagnostics/oracle.js` builds the full `V(balls, wickets, runs needed)`
table.

**Validity gate 3 first**: the DP was verified against Monte Carlo on the same kernel before being
used to judge anything, because "estimator is poor" and "oracle is wrong" are otherwise
indistinguishable. Six checks pass, including agreement with 60,000-sample Monte Carlo across five
states.

### Result

| | oracle MAE | Brier | irreducible | **excess Brier** | corr w/ oracle |
|---|---|---|---|---|---|
| **Deployed RandomForest** | 0.1295 | 0.15638 | 0.10988 | **0.04649** | 0.873 |
| **Closed-form logistic (5 terms)** | **0.0407** | 0.12197 | 0.10988 | **0.01209** | 0.988 |
| Oracle (floor) | 0 | 0.12184 | 0.10988 | 0.01195 | 1.000 |

Three things follow, and the third is the important one.

**a. The closed-form baseline is essentially at the theoretical floor.** Its excess Brier (0.01209)
is within 0.00014 of the oracle's own (0.01195). Five terms over required rate, wickets in hand and
balls remaining recover almost everything recoverable. This is exactly what Fact 2 of the remediation
plan predicted, now measured.

**b. The deployed model leaves most of the recoverable signal unused.** Its excess Brier is **3.8×**
the baseline's; its oracle MAE is **3.2×**. Of its total Brier, 70% is irreducible stochasticity and
the remainder is estimator error the baseline mostly avoids.

**c. Therefore RO1's original framing was refuted in the direction that was actually informative.**
The expected finding was "ML cannot beat the baseline, which teaches nothing". The finding is
sharper: **the deployed configuration is materially worse than a five-term logistic regression**, and
the gap is consistent with the memorisation independently measured in §1. That is a real, actionable
result about our estimator.

### What this does not establish

This is a statement about `matchSimulator.js`. The closed form is near-optimal **because the
simulator is i.i.d.** — in real cricket it would not be, and the ordering could reverse. Nothing here
is evidence about cricket, and RO1b remains Track B, blocked on pilot data.

---

## 7. What was deliberately not done

**In the plan, not in the approved sequence** — untouched, awaiting your call:

- **E4** domain guard (`in_domain` flag + training manifest). `keyMoments` still requests
  `overs_remaining = 20` and values near 0, both outside the `[1, 19]` training range, where a forest
  extrapolates flat.
- **E6** split in the *training* path. The evaluation splits; `train_all_models` still fits 100%.
- **E7** operational: `debug=True` on `0.0.0.0`, unauthenticated `POST /train`, and the
  `ai_models` volume that shadows the image's models. The false comment asserting there is no mount
  **was** corrected (AT-E7.4).

**Known defects left in place on purpose**: the advisor's 0.8/0.5 thresholds still disagree with the
status 0.7/0.4 thresholds, `match_data` is still unread, and the `p < 0.5` branch still advises
defence in a chase. Every fix there is by definition a user-visible change, which would have broken
E1's equivalence gate. They are annotated in `_generate_advice` and want their own deliberate change.

**One new item this work created**, not previously in the plan: the model has **no capacity control**
(`min_samples_leaf=1`). §1 and §6 both point at it, and it is now the largest measured contributor to
estimator error. It cannot be fixed responsibly without E6, since choosing the parameter requires a
validation split.

---

## 8. Position

The engine now computes only what something consumes, is fed the features it was trained on, refuses
questions it has no model for, and has a recorded out-of-sample number with a CI gate under it.

The measurements also say plainly that **it is not a good model**: overconfident at both extremes
(ECE 0.0998), unstable to one-run input changes (mean \|Δp\| 0.110 in-distribution), and 3.8× further
from the achievable floor than a five-term logistic regression on the same four features.

Part 1 asked whether the serving/training boundary was trustworthy. It now is, and that is what makes
the second sentence measurable rather than speculative.

**Stopping here. Part 2 not started.**
