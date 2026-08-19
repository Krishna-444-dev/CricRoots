# AI Engine forensic audit

**Date**: 2026-08-19 · **Scope**: `ai-engine/` and its backend integration · **Method**: code and data
inspection only. No code was modified, no model retrained, no experiment run.

Conducted under `research/protocol.md`. The two standing rules apply here as they do to Track A:

> Before testing whether X predicts Y, establish that Y is measurable in the regime being tested.
>
> Before concluding that X failed, establish that X was active and correctly implemented.

The second rule is why this document separates *"the model is bad"* from *"the model is being asked
the wrong question at serving time"*. Most of what is wrong here is the second kind, and it would
have been misattributed to the first without tracing the call sites.

**One distinction governs the whole document.** `ai-engine/data/` contains two kinds of file, and
the difference is not the one the filenames suggest:

| File | What it actually is |
|---|---|
| `matches.csv`, `fielding.csv`, `players.csv` | **Synthetic demo data.** Written by `src/utils/data_generator.py` with `random.*`. Labels are either uniform noise or a hand-written formula. |
| `real_matches.csv` | **Real outcomes of simulated matches.** Extracted from the product database by `backend/src/scripts/extractWinProbabilityData.js`. The *label* is a genuine consequence of a played-out innings. The *cricket* is `matchSimulator.js`. |

Neither is real cricket. They fail differently, and the failures are not interchangeable — §2.

---

## Summary of findings

| # | Finding | Severity |
|---|---|---|
| F1 | Two of the four deployed models are trained on **uniform random labels**. There is no target to learn. | Critical |
| F2 | `real_matches.csv` is **simulator output**. 577 matches were created in ~20 distinct seconds; 3,505 rows come from matches stamped to a single second. | Critical (provenance) |
| F3 | The training path performs **no train/test split of any kind**. All four models fit 100% of rows. The deployed artifacts have never been evaluated. | Critical |
| F4 | A **correct** evaluation exists (`evaluate_win_probability.py`, match-level split, decile calibration) but evaluates a *different model instance*, is not wired to anything, and **no results are committed**. | High |
| F5 | **Win probability is served during the first innings**, where `target_score` is set to the batting team's own current score. The model is trained exclusively on chases. | Critical |
| F6 | **Train/serve feature skew**: `current_run_rate` is computed from cricket-notation overs (`3.4` = 3 overs 4 balls) at all three serving sites, and from true decimal overs (`3.667`) in training. | High |
| F7 | The "tactical advisor" is a **three-branch `if/elif` on win probability** returning three fixed strings. Its `match_data` argument is never read. | High |
| F8 | The advisor's thresholds (0.8/0.5) **disagree with the status thresholds (0.7/0.4)** in the same response object. Both are rendered together. | Medium |
| F9 | The advice at `p < 0.5` — "Defensive strategy needed… preserving wickets" — is **tactically inverted for a chase**, which is the only situation the model is trained on. | Medium |
| F10 | `docker-compose.yml` mounts a **named volume over `trained_models/`**, contradicting the source comment that says there is no mount, and making the "self-healing retrain" fire only on first boot. | Medium |
| F11 | The container runs Flask with **`debug=True` bound to `0.0.0.0`**, published on the host and proxied by nginx at `/ai/`. `POST /train` is unauthenticated. | High (operational) |

---

## 1. What is the exact prediction target?

There is no single target. There are four models with four targets of radically different quality.

### 1a. `win_prob_model` — a real target

**P(the chasing team wins the match | match state at an over boundary)**, as a regression on a
binary label.

- **Label**: `1` if the chasing team won, `0` otherwise. Constant across all ~20 rows of a match
  (`extractWinProbabilityData.js:120`) — the final outcome replicated onto every state. This is
  standard and correct for win-probability modelling, *provided the split is match-level*.
- **Features** (`recommendation_model.py:49`): `overs_remaining`, `wickets_down`,
  `current_run_rate`, `target_score`. Four, all numeric.
- **Unit of observation**: one row per completed over of the chase, deliberately (the extraction
  script justifies this at length: it avoids 6× oversampling near-duplicate consecutive-ball states
  and matches the checkpoint a real tactical call happens at).
- **Estimator**: `RandomForestRegressor(n_estimators=50, random_state=42)`, all other
  hyperparameters at sklearn defaults — unbounded depth, `min_samples_leaf=1`.

This target is legitimate. Everything wrong with it is downstream.

### 1b. `batsman_model` and `bowler_model` — no target exists

```python
recommended_batsman = random.randint(0, num_players - 1)   # data_generator.py:56
recommended_bowler  = random.randint(0, num_players - 1)   # data_generator.py:57
```

The labels are **uniform random integers drawn independently of every feature**. 198 and 197
distinct classes over 1,000 rows; the largest class holds 12 rows.

A 200-class `RandomForestClassifier` is then fit to predict them from four match-state numbers
(`recommendation_model.py:33-40`). There is no signal to recover, by construction. The models are
memorising a random permutation — which is why `batsman_model.pkl` and `bowler_model.pkl` are
**100 MB each** while `fielding_model.pkl` is 260 KB: fifty unbounded trees isolating a thousand
near-unique labels.

The generator's own comment says so plainly: *"Target: Recommended Batsman/Bowler ID (simplified for
simulation) — In a real model, this would be based on historical success."* That comment is a
correct statement about a demo scaffold. What is not correct is that the scaffold is running in the
deployed container and its `confidence` field is being returned over the API.

**Prior mitigation, credited.** `mobile-app/src/components/AITacticalAdvisor.tsx:15-19` already
declines to render `key_recommendations`, and the stated reason is accurate: *"a raw numeric class
label from a model trained purely on match-state numbers with zero roster awareness, so it never
corresponds to any real player."* The panel shows `getNextBowlerRecommendation` instead — a real
backend feature grounded in the actual roster. So the noise is **not user-visible**. It is still
computed, still served over `/api/recommendations/batsman` and `/bowler`, and still 200 MB of the
image.

### 1c. `fielding_model` — a target, but a circular one

`optimal_position` is a **deterministic two-variable rule** the generator wrote three lines earlier
(`data_generator.py:89-94`):

```python
if player['fielding_skill'] > 8 and batsman_tendency > 7:  position = 1  # Slips
elif player['fielding_skill'] < 6:                          position = 2  # Boundary
else:                                                        position = 3  # Inner Circle
```

The model is fit on five features, three of which (`throwing_accuracy`, `speed_agility`,
`catching_ability`) are **independent noise** never consulted by the rule. It will achieve
essentially perfect accuracy, because it is an expensive lookup table for an `if/else` that already
exists in the repository. Nothing is learned; the rule is simply laundered through a classifier.

---

## 2. What is the exact training dataset, and where did it come from?

### `real_matches.csv` — 11,233 rows, 577 matches

Produced by `backend/src/scripts/extractWinProbabilityData.js`, which walks every `Completed`
match's chasing innings and emits one row per completed over. The script is **the best-engineered
component in this audit** and deserves saying so: it is read-only, it documents its over-counting
convention, and it records in a comment a real bug it previously had (a symmetric cap test that
silently produced a training set of *100% losses*, caught by checking the label distribution before
trusting it — `extractWinProbabilityData.js:31-40`). That is exactly the discipline `protocol.md`
asks for.

**But the matches it read are simulator output.** Decoding the MongoDB ObjectId timestamp prefixes
of the 577 `match_id`s:

| Creation second (UTC) | Matches' rows |
|---|---|
| 2026-08-14 23:16:12 | 3,505 |
| 2026-08-15 03:11:35 | 3,441 |
| 2026-08-14 23:58:45 | 1,774 |
| 2026-08-14 23:57:09 | 1,320 |
| …16 further seconds | the remainder |

Twenty distinct seconds account for every match in the file. Matches scored by humans do not arrive
in bursts of 3,505 rows per second. These are bulk `insertMany` writes from
`backend/src/scripts/matchSimulator.js` and the tournament simulation scripts.

This is the **same blocker** that gates Track B of the research programme, restated for the AI
engine. `research/protocol.md` records it: `matchSimulator.js` assigns dismissal probability as
`Math.random() < 0.045`, independent of batter, bowler, line, or length.

**What that does and does not invalidate.** The distinction matters and is easy to get wrong:

- **The label is genuine.** It is the true outcome of a fully played-out simulated innings, not a
  formula. Replacing `matches.csv`'s heuristic `win_probability` with it was a real improvement, and
  the code comment claiming so (`recommendation_model.py:42-46`) is accurate.
- **The state–outcome relationship is the simulator's, not cricket's.** Descriptively, in this file:

  | Feature | corr with outcome |
  |---|---|
  | `target_score` | **−0.548** |
  | `current_run_rate` | +0.259 |
  | `wickets_down` | −0.114 |
  | `overs_remaining` | +0.073 |

  `target_score` dominates. In a simulator where both innings are drawn from the same process and
  teams are near-homogeneous, "how big was the target" is close to the whole story. Real cricket
  has team strength, pitch, and format effects the simulator does not contain. A model fit here has
  learned the simulator's balance, and its feature importances are a statement about
  `matchSimulator.js`.

- **Base rate**: 0.492 at match level, 0.473 at row level. Well balanced — no class-imbalance issue.
- **Coverage**: `overs_remaining` spans **[1.00, 19.00]** across all 11,233 rows. Never 20, never 0
  (rows are emitted only at completed overs, strictly inside the innings), and never above 19 —
  which proves **every one of the 577 matches was a 20-over match**. There is no ODI in the training
  set at all. This matters at §7.

### `matches.csv`, `fielding.csv`, `players.csv` — 1,000 / 5,000 / 200 rows

Pure `random.*` output from `data_generator.py`. Beyond the label problems in §1, the *states* are
physically incoherent: `overs_remaining`, `wickets_down`, `current_run_rate` and `target_score` are
drawn **independently**, so the file contains states like "19.9 overs remaining, 9 wickets down, run
rate 11.8" that cannot occur. `runs_scored` is `random.randint(0, target_score)`, unrelated to the
run rate and overs on the same row.

`matches.csv` is still a live fallback path: `recommendation_model.py:48` uses it for the win
probability model whenever `real_matches.csv` is absent. Its distribution does not cover the
deployment domain — 5.4% of real rows have a run rate outside the synthetic `[4, 12]`, and 2.0% have
a target outside `[120, 220]`. On those, the fallback model extrapolates flat.

---

## 3. What is the training methodology?

**There is none beyond `.fit()`.**

`train_all_models` (`recommendation_model.py:22-62`) reads each CSV, selects columns, and calls
`.fit()` on the full frame. In sequence, for all four models:

```python
self.win_prob_model = RandomForestRegressor(n_estimators=50, random_state=42)
self.win_prob_model.fit(X_win, y_win)          # X_win is 100% of the rows
```

- **No train/test split.** No `train_test_split`, no `cross_val_score`, no holdout.
- **No hyperparameter selection.** `n_estimators=50` and `random_state=42` are the only values ever
  set; everything else is a sklearn default. Nothing was ever tuned or compared.
- **No feature scaling.** `self.scaler = StandardScaler()` is constructed at
  `recommendation_model.py:18` and **never referenced again**. Harmless for a forest, but it signals
  an intent that was not carried out.
- **No temporal ordering.** Not applicable to the current file (everything was created in 20
  seconds), but see §5.
- **No convergence or capacity check.** Not applicable to a forest, but no depth or leaf-size
  constraint is set either, so the trees grow until pure.

**Consequence for validity gate 3 ("is the method correctly implemented?"): unchecked.** Nothing in
the repository verifies that these models recover structure when structure is unambiguously present.

---

## 4. What model is actually used at serving time?

Not the `.pkl` files on this machine. The 201 MB in `ai-engine/src/models/trained_models/` is
**untracked** — `git ls-files` returns nothing for that directory. Two consequences:

1. **Every deployed container trains its own models at import time.** `recommendations.py:14-16`
   runs `load_models()`, which fails on a fresh image (no pickles), and falls through to
   `train_all_models(data_dir='data')` at **module import**, before the first request is served.
   `data/` *is* committed — all four CSVs — so this is at least reproducible.

2. **`docker-compose.yml:81` mounts a named volume over that directory**, and the source comment
   directly above the fallback says the opposite:

   > *"The ai-engine container has no volume mount (unlike backend), so it only ever sees whatever
   > .pkl files were baked into the image at build time…"* — `recommendations.py:7-9`

   **That comment is false.** `ai_models:/app/src/models/trained_models` exists. The behaviour it
   produces is: first boot finds the volume empty → trains → `save_models()` writes into the volume
   → **every subsequent boot loads from the volume**, regardless of what changed in `data/` or in
   the image. The self-healing property the comment argues for is defeated by a mount the comment
   says isn't there. A model refresh now requires deleting the volume or calling `POST /train`.

The `load_models()` exception handler (`recommendation_model.py:184-190`) is good — it logs the
class and message rather than swallowing them, with a comment explaining that a bare `except` had
previously made version-mismatch failures undiagnosable.

---

## 5. What evaluation exists?

### For the win-probability model: one script, correct, disconnected

`evaluate_win_probability.py` is methodologically sound and its central choice is the right one:

```python
def match_level_split(df, holdout_frac=0.2, seed=RANDOM_STATE):
    # Split by match_id, not by row - rows from the same match share one outcome and a smooth
    # trajectory, so a row-level split would leak the label into "unseen" evaluation data.
```

It splits on `match_id`, computes Brier score on the holdout, prints decile calibration for both a
real-trained and a synthetic-trained model on the same holdout situations, and reports the holdout
base rate alongside mean predictions. That is a genuinely well-designed comparison — it isolates
*data provenance* as the variable while holding the estimator fixed.

**Four things stop it counting as an evaluation of the deployed system:**

1. **It evaluates a different artifact.** It constructs and fits its *own* `RandomForestRegressor`
   on 80% of the data (`evaluate_win_probability.py:48-52`). It never loads `win_prob_model.pkl`.
   This is defensible as an estimate of the *procedure's* generalisation — the deployed refit-on-all
   is standard — but it must be stated that way, and it currently isn't stated anywhere.
2. **No results are committed.** There is no output file, no results directory, no number recorded
   in any document in the repository. Nobody can currently say what the Brier score is without
   re-running it.
3. **It is not wired to anything** — not to `train_models.py`, not to the API, not to CI. It runs
   only if a human runs it.
4. **The split is random over match IDs, not chronological.** Correct today (all 577 matches share a
   creation timestamp, so there is no chronology to preserve). **Wrong the moment real matches
   arrive**, at which point it will train on later matches and test on earlier ones.

### For the other three models: nothing

No script, no metric, no accuracy number, anywhere in the repository. Two of them are fit on random
labels, and no evaluation exists that would have revealed it.

---

## 6. What does the tactical advisor actually do?

```python
def _generate_advice(self, win_prob, match_data):          # recommendation_model.py:163-169
    if win_prob > 0.8:
        return "Maintain current momentum. Focus on steady scoring and minimizing risks."
    elif win_prob > 0.5:
        return "Aggressive approach recommended. Increase run rate to pressure the opposition."
    else:
        return "Defensive strategy needed. Focus on building partnerships and preserving wickets."
```

That is the entire tactical advisor. Three fixed strings selected by two thresholds on a single
scalar. **`match_data` is a parameter and is never read** — overs remaining, wickets in hand, and
the target do not influence the advice except through their effect on `win_prob`.

`get_tactical_summary` (`recommendation_model.py:146-161`) wraps it: it calls the three models and
returns `match_status`, `win_probability`, `key_recommendations` (the noise from §1b), and this
string.

**F8 — the thresholds disagree with themselves.** `predict_win_probability` assigns `status` at
0.7/0.4; `_generate_advice` branches at 0.8/0.5. Both are in the same response object, and
`AITacticalAdvisor.tsx:183-197` renders them one above the other. A state at p = 0.75 therefore
displays:

```
Status: Dominant          💪
Strategic Advice: "Aggressive approach recommended. Increase run rate to pressure the opposition."
```

Any state in [0.5, 0.7) or [0.7, 0.8) produces a mismatched pair. That is roughly a fifth of the
probability range, and it is visible to the user as a self-contradiction.

**F9 — the advice at `p < 0.5` is backwards for the only situation the model models.** The
win-probability model is exclusively a chase model. A chasing team below 50% is, in the great
majority of states, behind the required rate. The correct tactical response to being behind the
required rate is to take more risk, not less. "Defensive strategy needed. Focus on building
partnerships and preserving wickets" describes the losing line. This is not a statistical defect —
it is domain logic that was written without being checked against the domain, and it is the single
most visible AI output in the product.

---

## 7. Deployment parity: is the model served the states it was trained on?

**No.** There are four consumers. One is correct; three share the same three defects.

### The three defective sites

| Site | Purpose |
|---|---|
| `backend/src/controllers/matchController.js:491-497` | live push after every ball, via `socketManager.emitBallRecorded` |
| `backend/src/controllers/matchController.js:626-633` | scorecard endpoint |
| `backend/src/controllers/matchController.js:823-830` | `GET /api/matches/:id/ai-insights` |

All three build the payload the same way. All three are wrong the same three ways.

**7a — The model is called during the first innings, where its central feature is nonsense.**

```js
function currentInningsIndex(match) {          // matchController.js:43
  return match.innings[1]?.balls?.length > 0 ? 1 : 0;
}
```

During the first innings this returns `0`, so `innings` *is* `innings[0]`, and then:

```js
targetScore: match.innings[0]?.runs || 150
```

`target_score` is set to **the batting team's own current score**. The model was trained exclusively
on chase rows (`extractWinProbabilityData.js` emits nothing else, by design). Every first-innings
"Win Probability: 63.2%" the app has ever displayed is a chase model answering about a state that
cannot occur in a chase — the target rises ball by ball as the team scores, so the prediction moves
in response to a feature that means the opposite of what it meant in training.

This is a **validity gate 1 failure at serving time**: the question is not answerable in the
environment where it is being asked. There is no reading of the output that is meaningful.

**7b — Train/serve feature skew on `current_run_rate`.**

`innings.overs` is stored in **cricket notation** — `matchController.js:470`:

```js
match.innings[inningsIndex].overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
```

So 3 overs and 4 balls is stored as `3.4`. The three sites divide by it:

```js
currentRunRate: match.innings[inningsIdx]?.runs / (match.innings[inningsIdx]?.overs || 1)
```

The extraction script used true decimal overs and **explicitly warned about this exact field**:

> *"…kept in true decimal form (legalBalls / 6) … rather than the DB's stored "3.4" cricket-notation
> overs field, which isn't a valid divisor for a run rate."* — `extractWinProbabilityData.js:21-24`

The warning was written and then not applied on the serving side. Dividing by `n + b/10` instead of
`n + b/6` inflates the run rate by `(n + b/6)/(n + b/10) − 1`, which is **zero at over boundaries and
largest early in an innings**:

| State | Stored `overs` | True decimal | Served CRR inflated by |
|---|---|---|---|
| 0 overs, 5 balls | 0.5 | 0.833 | **+67%** |
| 1 over, 5 balls | 1.5 | 1.833 | +22% |
| 3 overs, 4 balls | 3.4 | 3.667 | +7.8% |
| 12 overs, 5 balls | 12.5 | 12.833 | +2.7% |

Training rows are all *at* over boundaries, where the two conventions agree exactly. So the skew is
zero on every state the model was trained on and non-zero on every state between overs — and the
live socket push (`matchController.js:491`) fires after **every ball**, so most served states are
mid-over. The powerplay, where the distortion is worst, is also where the advisor is most watched.

`oversRemaining: 20 - innings.overs` carries the same error in the opposite direction.

**7c — Format is hardcoded to 20 overs.** `20 - (innings?.overs || 0)` assumes a T20 at all three
sites. An ODI (50 overs) yields negative `overs_remaining` for the majority of the innings, against
a model whose training range is `[1, 19]`.

**7d — Two features are frozen constants.** `oppositionStrength: 7, pitchType: 1` are hardcoded at
all three sites. These are the only inputs distinguishing the batsman recommender from the bowler
recommender, so both are effectively functions of three variables — moot given §1b, but it means
the `pitch_type` feature has never taken a second value in production.

**7e — Off-by-one on the target.** Training uses `lower.runs + 1` (the actual target to win);
serving passes `innings[0].runs`. One run, consistently.

### The correct consumer

`backend/src/services/keyMoments.js` is right, and its header comment explains why in the model's own
terms: it restricts to `innings[1]`, uses `targetScore = innings[0].runs + 1`, converts overs as
`legalBalls / 6`, and excludes Test matches. It is the one place the model is asked its own question.

Two residual domain issues remain even there:

- The first checkpoint is `{ oversRemaining: totalOvers }` = 20, and the final checkpoints approach
  0. Training covers `[1, 19]` only. A random forest **extrapolates flat**, so the win probability
  at ball 0 is identical to the value at 19 overs remaining — which directly biases the delta
  attributed to the first ball, and the deltas near the end of a close chase.
- `OVERS_BY_MATCH_TYPE.ODI = 50` sends every ODI checkpoint to `overs_remaining` up to 50, against a
  training set that (per §2) contains **no ODI matches at all**. Every ODI prediction is a
  saturated extrapolation.

---

## 8. Are the predictions calibrated?

**Unknown, and unclaimed — but rendered as though known.**

- **The machinery exists and is correct.** `decile_calibration` (`evaluate_win_probability.py:24-35`)
  buckets predictions into deciles and compares mean predicted against actual win rate. That is the
  right instrument.
- **No calibration result is recorded anywhere in the repository.** The function has no committed
  output.
- **No calibration is applied at serving.** `predict_win_probability` returns the raw regressor
  output. `AITacticalAdvisor.tsx:180` renders it as `{(win_probability * 100).toFixed(1)}%` on a
  progress bar — one decimal place of implied precision, from a model with no measured reliability.
- **A structural note.** Averaging 0/1 labels across a forest's leaves does produce something in
  [0,1] with the right shape. But with unbounded depth on 11,233 rows and four features, leaves
  reach near-purity, so in-sample predictions concentrate near 0 and 1. Whether out-of-sample
  predictions are calibrated is precisely what the uncommitted holdout would tell us. The
  `np.clip(pred, 0, 1)` at `evaluate_win_probability.py:57-58` is defensive and unnecessary for a
  regressor on 0/1 labels — harmless.

Under validity gate 2, calibration of the win-probability target **is** measurable at this data
volume: 577 matches with a 0.492 base rate supports decile calibration with ~1,100 rows per bucket.
The measurement has simply not been taken and recorded.

---

## 9. Does the model leak future match information?

Three distinct questions, three different answers.

**9a — Within-match label leakage: structural, and correctly mitigated in the evaluation.** All ~20
rows of a match share one label and a smooth feature trajectory. A row-level split would put nearly
identical rows in train and test with the same label — the classic, severe failure mode for
win-probability models, which routinely produces headline accuracy figures that are pure
memorisation. `match_level_split` prevents it, and the comment explaining the choice is correct.
This is the audit's clearest example of something done right on purpose.

**9b — Leakage in the training path: not applicable, because there is no split.** With no holdout,
there is nothing to leak *into*. This is worse than leakage, not better: the deployed model has no
performance estimate at all, unbiased or otherwise.

**9c — Temporal leakage: not currently possible, and not currently guarded.** The split is random
over match IDs. Since every match was created within a 20-second window, no chronology exists to
violate. The moment real matches accumulate, this becomes a real leak — a random match split will
train on August and test on July. The guard does not exist and would need to be added *before* the
first real matches land, not after.

**9d — Feature-level future information: no, in training; yes, at serving.** `target_score` is
first-innings runs + 1, which in a chase is legitimately known at every ball. Within its intended
domain the feature set is clean. At serving, §7a inverts this: during the first innings
`target_score` is the *live, still-growing* score of the batting side — not future information
exactly, but a feature whose meaning is the reverse of its training meaning, which is the same class
of defect and has the same consequence.

---

## 10. Classification table (D19 form)

| | `win_prob_model` | `batsman_model` | `bowler_model` | `fielding_model` |
|---|---|---|---|---|
| **Target** | P(chase wins), binary label per match | `recommended_batsman` — **uniform random int** | `recommended_bowler` — **uniform random int** | `optimal_position` — deterministic 2-var `if/else` |
| **Data** | `real_matches.csv`, 11,233 rows / 577 matches, **all simulator-generated** | `matches.csv`, 1,000 synthetic rows, physically incoherent states | same | `fielding.csv`, 5,000 synthetic rows; 3 of 5 features are noise |
| **Leakage** | within-match: structural, mitigated **in evaluation only**; temporal: unguarded; training path: no split, so no estimate | N/A — no signal to leak | N/A | N/A — label is a function of 2 input features (total circularity) |
| **Evaluation** | one uncommitted script; correct method, evaluates a **re-fit instance**, no results recorded | **none** | **none** | **none** |
| **Calibration** | instrument exists, **never recorded**, none applied at serving; rendered to 0.1% | N/A | N/A | N/A |
| **Model active in deployment** | **Yes** — 3 backend sites + `keyMoments` | Yes (computed, served, **not rendered**) | Yes (computed, served, **not rendered**) | Yes via `/fielding`; not reached by any backend caller found |
| **Deployment parity** | **Broken at 3 of 4 sites** — first-innings domain violation, cricket-notation CRR skew, T20 hardcode. `keyMoments.js` correct except range extrapolation | N/A | N/A | N/A |
| **Research opportunity** | **RO1, RO2** below | **None** — deletion decision, not a research question | **None** | **None** |

### Validity gates applied to the AI engine

| Gate | Status |
|---|---|
| 1 — Is the question answerable in this environment? | **FAILS** for any claim about real cricket: the database is simulator output (same blocker as Track B, `protocol.md`). **Passes** for claims about the simulator. |
| 2 — Is the target measurable at this evidence volume? | **Passes** for win probability (577 matches, base rate 0.492 — aggregate calibration and Brier are measurable). **Fails by construction** for batsman/bowler: no target exists. |
| 3 — Is the method correctly implemented? | **Unchecked.** Nothing verifies these estimators recover known structure. |
| 4 — Was the method active? | Win-prob and both recommenders are active. The `.pkl` files on disk are **not** — deployment trains fresh (§4). |
| 5 — Did the optimiser converge? | N/A for a random forest. |
| 6 — Is the representation adequate? | **Unchecked, and specifically doubtful**: four features cannot express *runs still required* independently of match format. It is recoverable only under the fixed assumption that every match is 20 overs — which holds in training and is violated at serving. |

---

## 11. Research opportunities

Per instruction, listed **only** where a concrete failure mode or an unvalidated claim exists. Two
qualify. Most of what is wrong here is engineering, not research, and is labelled as such.

### RO1 — Does the win-probability model beat a closed-form chase baseline?

**Concrete unvalidated claim.** The product renders "AI Tactical Advisor · Win Probability" with a
progress bar. No number anywhere establishes that the forest outperforms a two-line function of
runs required, balls remaining and wickets in hand — the standard baseline any cricket win
probability must clear. `target_score` alone correlates −0.548 with the outcome in this data, so a
substantial fraction of what the model "knows" may be a single feature.

Testable **now**, on committed data, with the split already implemented in
`evaluate_win_probability.py`. Cost: small.

**Gate 1 caveat, load-bearing**: this measures the model against `matchSimulator.js`, not against
cricket. A win here licenses *"beats the baseline in our simulator"* and nothing more. Under the
programme's Track A / Track B separation, that is a Track A result and must be reported as one.

### RO2 — First-innings win probability is a different target with no model

§7a is an engineering bug in one sense (the model should not be called there) and a genuine gap in
another: users are shown a win probability during the first innings, and there is no model for that
state. P(team batting first wins | current state) has different features — no target exists yet, so
`runs_scored` and `wickets_in_hand` carry the load — and needs its own labelled extraction. The
current extraction script emits chase rows only, by design.

The immediate fix is to stop serving a number there. Whether to *build* the first-innings model is
the research question, and it is downstream of RO1: there is no point extending a model that has not
cleared a baseline.

### Explicitly not research opportunities

- **`batsman_model` / `bowler_model`.** The labels are uniform noise. There is no experiment to run,
  no hypothesis to test, and no result that could change the conclusion. Removing them is a product
  decision. Any real successor is the *existing* `getNextBowlerRecommendation`, which is already
  built on real rosters and this app's own matchup engine — and which the research programme has
  already characterised (per-player scalar effects: 25.5% oracle-MAE reduction; context-dependent
  representation: no measurable value below ~325 balls/batter).
- **`fielding_model`.** Its label is a function of two of its inputs. It cannot generalise beyond
  the rule, and the rule is three lines in `data_generator.py`.
- **§7b–7e, F10, F11.** Bugs and configuration. Fixing them requires no research and should not
  wait for any.

---

## 12. What is missing

Ordered by what blocks what.

1. **Any performance number for the deployed model.** The single largest gap. `evaluate_win_probability.py`
   would produce one in seconds; its output has never been recorded.
2. **A train/test split in the training path.** The deployed artifact is fit on 100% of rows.
3. **A domain guard at the serving boundary.** Three call sites feed the model states it was never
   trained on. Nothing validates the payload — a chase model has no way to refuse a first-innings
   state.
4. **Format awareness.** `totalOvers` exists on the `Match` model and is used correctly by the
   extraction script. Three serving sites hardcode 20.
5. **A shared feature-construction path.** The cricket-notation skew (§7b) exists because training
   and serving compute `current_run_rate` in two places, by two conventions, one of which documented
   the other as wrong. One function, used by both, removes the entire class of defect.
6. **Real match data.** Everything above is measurable against the simulator. Nothing above is
   evidence about cricket. This is the same gate as Track B, and it opens with the first real
   pilot matches — which is a further argument for `documentation/evidence-provenance-backlog.md`'s
   item 1 (per-ball match state capture is unbackfillable).
7. **Auth on `POST /api/recommendations/train`** and `debug=True` off (F11). The endpoint's own
   comment says *"In a real app, this might be protected by an API key"*; it is reachable through
   nginx at `/ai/api/recommendations/train`, and `docker-compose.yml:76` also publishes 5001 on the
   host. `FLASK_ENV: production` in compose does **not** override the explicit `debug=True` argument
   at `app.py:45` — the Werkzeug debugger and reloader run in the production container.

---

## 13. Position

The AI engine is **a demo scaffold with one real model inside it**.

The win-probability model has a legitimate target, a genuinely well-built extraction script, and a
correct evaluation design — three things the rest of the engine does not have. What it lacks is any
recorded measurement, and what undermines it is a serving layer that asks it a question it was not
trained to answer in three of its four call sites.

The other three models should not be described as models. Two are fit on uniform random integers;
the third memorises an `if/else` from the file that generated its labels. The mobile client already
declines to render the worst of it, for a reason it states accurately.

The most important sentence in this document is the provenance one. `real_matches.csv` earns its
name only in the narrow sense that its **labels** are real outcomes rather than a formula. The
matches are `matchSimulator.js` output — 577 of them written in twenty seconds — and every
performance number this engine could produce today is a statement about that simulator. That is the
same constraint the research programme has operated under for nine experiments, and the same
resolution applies: it does not block measurement, it blocks *generalisation*, and conclusions must
say which one they are.

**Stopping here per instruction. No code changed, no model trained, no experiment run.**
