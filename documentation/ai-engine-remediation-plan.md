# AI Engine remediation plan

**Date**: 2026-08-19 · **Status**: PLAN ONLY — nothing implemented, production still frozen.
**Input**: [`ai-engine-audit.md`](ai-engine-audit.md) · **Governing protocol**: `research/protocol.md`

Separates **engineering blockers** (do these; they need no research) from **valid research
questions** (do not start these yet). Every engineering item carries an explicit acceptance test —
a check that fails before the fix and passes after, so "done" is not a judgement call.

---

## Two facts found while scoping this, both of which change the plan

### Fact 1 — Deleting three of the four models changes nothing any user sees

I checked every call site rather than assuming. The result is better than the audit implied:

| AI-engine capability | Backend caller | Rendered? |
|---|---|---|
| `getWinProbability` | `keyMoments.js:75` | yes |
| `getTacticalAdvice` | `matchController.js:491,626,823` | yes (`win_probability`, `match_status`, `tactical_advice`) |
| `recommendBatsman` | **none** | — |
| `recommendBowler` | **none** | — |
| `recommendFielding` | **none** | — |
| `healthCheck` | **none** | — |

- `AIService.recommendBatsman/recommendBowler/recommendFielding/healthCheck` are **dead methods**.
  Nothing in `backend/src` calls them.
- The **fielding model is reached by nothing at all**. `FieldingPlan.tsx` fetches
  `insightsRoutes.js:14` → `/batsman/:playerId/fielding-plan`, a separate, real backend feature with
  no connection to the AI engine.
- The batsman/bowler models reach production **only** via `get_tactical_summary`'s
  `key_recommendations` — and **both clients deliberately decline to render it**
  (`mobile-app/src/components/AITacticalAdvisor.tsx:15-19`,
  `web-app/components/AITacticalAdvisor.tsx:176-179`).

**So E1 below is a pure deletion with a zero-pixel diff that removes ~200 MB.** That makes it the
safest possible first move, not the riskiest. Your instinct to not delete blindly was right; the
answer is that the call graph makes it safe, and the acceptance test proves it.

### Fact 2 — The simulator has no team strength, no batter quality, and no state dependence

This is the one that reshapes the research section, so it needs to be exact. In
`backend/src/scripts/matchSimulator.js`, every ball is drawn from **fixed distributions**:

```js
const ballType = pickWeighted({ normal: 88, wide: 5, 'no-ball': 2, bye: 3, 'leg-bye': 2 });
const isWicket = Math.random() < 0.045;
```

`striker` and `currentBowler` are read only to **label** the ball. They never influence its outcome.
There is no team rating, no batting order effect, no momentum, no pitch, no phase.

Therefore a chase in this data is a **first-passage problem for a sum of i.i.d. draws against an
absorbing wicket counter**, and:

> Given `(runs so far, wickets down, balls remaining, target)`, the true conditional win probability
> under this generator is **exactly computable in closed form**. There is no hidden state.

Three consequences, all load-bearing:

1. **The four features currently in use are a sufficient statistic for this data.** The audit's
   Gate 6 concern — that four features cannot express *runs required* independently of format — is a
   real defect **for cricket** but not for `real_matches.csv`, where every match is 20 overs.
2. **A well-specified closed-form baseline is not merely "strong" here — it is plausibly optimal.**
   Any ML model can at best approximate it. A measured *win* over it would most likely be
   overfitting or leakage, not skill.
3. **`target_score`'s −0.548 correlation is a property of `matchSimulator.js`, not of cricket.**
   With no team-strength variation, "how big was the target" is close to the whole story by
   construction.

I flag this now rather than after an experiment because it is precisely the D17 error the programme
already made once: asking a question in a world that does not contain the structure the question is
about. See §Research, RO1 and RO3.

---

# Part 1 — Engineering blockers

Not research. No hypothesis, no experiment, no result that could change whether they should be done.

## E0 — Measure before touching anything

**Why first.** Every fix below changes what the model is fed. Without a recorded pre-fix number
there is no way to say afterwards whether remediation helped, hurt, or did nothing — and "we fixed
it and performance changed" is not a sentence anyone can currently write.

Run `evaluate_win_probability.py` as it stands, commit its output verbatim to
`ai-engine/results/pre-remediation/`, with the provenance sentence attached.

**Acceptance tests**
- **AT-E0.1** `ai-engine/results/pre-remediation/metrics.json` exists and records: Brier
  (real-trained), Brier (synthetic-trained), the full decile calibration table, holdout base rate,
  n_matches, n_rows, seed, and the git SHA.
- **AT-E0.2** Re-running with the same seed reproduces it **byte-identically**.
- **AT-E0.3** The file states, in prose, that the data is `matchSimulator.js` output.

---

## E1 — Delete the three invalid models

**Scope**: remove from `train_all_models` the batsman, bowler and fielding models; delete the
`/batsman`, `/bowler`, `/fielding` endpoints; drop `key_recommendations` from
`get_tactical_summary`; delete the four dead `AIService` methods; delete `data/fielding.csv`,
`data/players.csv`, and the recommendation columns from the generator; remove the now-unused
`key_recommendations?` field from both clients' `AIInsightData` type.

**One decision embedded here, and I recommend the stricter option.** `recommendation_model.py:48`
currently falls back to `matches.csv`'s heuristic label when `real_matches.csv` is absent. **Remove
the fallback and fail loudly at startup instead.** A fallback that silently produces plausible-looking
percentages from a hand-written formula is the exact failure mode this audit exists to document. If
the training data is missing, the correct behaviour is a dead service, not a confident one.

**Acceptance tests**
- **AT-E1.1** `grep -rn "recommended_batsman\|recommended_bowler\|optimal_position\|key_recommendations" ai-engine/ backend/src mobile-app/src web-app` returns nothing.
- **AT-E1.2** `npx tsc --noEmit` passes in both `web-app` and `mobile-app` (already gated by CI).
- **AT-E1.3** Response-shape test: `get_tactical_summary` returns exactly
  `{success, match_status, win_probability, tactical_advice}` — no extra keys.
- **AT-E1.4** After a fresh train, `du -s ai-engine/src/models/trained_models/` is **< 15 MB**
  (currently 201 MB).
- **AT-E1.5 — the one that makes this safe.** **Rendered-output equivalence.** For a fixed match
  state, capture the AI Insights panel on mobile and web before and after E1. They must be
  identical. This is the test that converts "I think nothing renders it" into "nothing renders it."
- **AT-E1.6** With `data/real_matches.csv` removed, the service **fails to start** with an explicit
  error naming the missing file — it does not start and serve heuristic numbers.

---

## E2 — Stop serving first-innings win probability

Your framing is the right one: *don't silently display nonsense*. The chase model must not be asked
a first-innings question, and the UI must not fill the gap with a plausible-looking number.

**Scope**: at all three call sites (`matchController.js:491`, `:626`, `:823`), when
`currentInningsIndex(match) === 0`, do not call the AI engine at all. Return an explicit
`{available: false, reason: 'first-innings-model-does-not-exist'}`. Both clients render an honest
empty state.

**Acceptance tests**
- **AT-E2.1** Unit test with a mocked `axios`: for a match where `innings[1].balls` is empty,
  `getAIInsights` returns `available: false` **and the mock records zero HTTP calls**. Asserting the
  call count is what distinguishes "we hid the output" from "we stopped asking the question."
- **AT-E2.2** For a match with a chase in progress, the payload is produced and
  `target_score === innings[0].runs + 1` (note the `+ 1` — currently missing, audit §7e).
- **AT-E2.3** Client snapshot test: first-innings state renders the empty-state copy, **not** a
  percentage and **not** a progress bar at 0%.
- **AT-E2.4** Invariant test: no code path can emit a win-probability request whose `target_score`
  equals the currently-batting side's own score.

---

## E3 — One feature-construction function, shared by training and serving

The structural fix. E4's overs bug and E5's format bug are symptoms; this is the cause. The `3.4`
defect exists only because `current_run_rate` is computed in two places by two conventions — and the
extraction script *documented the correct convention and warned about the wrong one* while the
serving side used the wrong one anyway.

**Scope**: add `backend/src/services/matchStateFeatures.js` exporting `buildChaseState(match)`,
which derives `{oversRemaining, wicketsDown, currentRunRate, targetScore}` from **legal ball counts**
and `match.totalOvers`. Every consumer uses it: all three `matchController` sites, `keyMoments.js`,
**and `extractWinProbabilityData.js`**. The last one is what makes parity a guarantee rather than a
convention.

**Acceptance tests**
- **AT-E3.1 — the parity test, and the single most valuable test in this plan.** For N sampled match
  states, the feature vector produced by the *extraction* path and by the *serving* path must be
  **bit-identical**. This is the test that would have caught the `3.4` bug, and its absence is why
  the bug survived a documented warning.
- **AT-E3.2** Property test asserting the bug is gone, not merely absent: for any state with
  `legalBalls % 6 !== 0`, assert `currentRunRate === runs / (legalBalls / 6)` **and**
  `currentRunRate !== runs / storedOvers`.
- **AT-E3.3** `oversRemaining === match.totalOvers - legalBalls / 6`, verified for `totalOvers` of
  both 20 and 50, and asserted non-negative throughout.
- **AT-E3.4** `grep -rn "\.overs || 1" backend/src` returns nothing.

---

## E4 — A domain guard at the serving boundary

The model has a training domain and currently no way to refuse anything outside it. This also fixes
`keyMoments.js`'s range extrapolation (audit §7, "the correct consumer") **honestly** — by declaring
it rather than silently returning a flat-extrapolated value.

**Scope**: training writes `training_manifest.json` alongside the model — per-feature min/max,
n_matches, n_rows, base rate, the set of `totalOvers` values present, extraction commit SHA, and
sklearn version. `predict_win_probability` returns `in_domain: bool` plus the offending features.
Clients do not render a percentage when `in_domain` is false.

**Acceptance tests**
- **AT-E4.1** The API refuses to start if the manifest is absent or its sklearn version does not
  match the runtime.
- **AT-E4.2** A state with `overs_remaining = 45` (ODI) returns `in_domain: false` naming
  `overs_remaining`. Training contains **only** 20-over matches — audit §2.
- **AT-E4.3** A state with `overs_remaining = 20` (ball 0 of a chase, which `keyMoments.js` requests)
  returns `in_domain: false`. Training covers `[1, 19]` only.
- **AT-E4.4** Client test: `in_domain: false` renders the empty state, not a number.

---

## E5 — Wire the evaluation in, and commit the result

Currently `evaluate_win_probability.py` runs only if a human runs it, and **no number exists anywhere
in the repository**. There is also **no Python job in CI at all** — `.github/workflows/ci.yml` has
three jobs, all Node.

**Scope**: the script writes `ai-engine/results/<timestamp>/metrics.json`; a committed
`ai-engine/EVALUATION.md` carries the current headline numbers; add an `ai-engine` job to CI;
add `pytest` to `requirements.txt` (currently absent).

**Acceptance tests**
- **AT-E5.1** CI has an `ai-engine` job that runs the evaluation and **fails** if Brier exceeds the
  recorded threshold.
- **AT-E5.2** `EVALUATION.md` states Brier, log loss, the decile calibration table, base rate,
  n_matches — and the provenance sentence. A number without its provenance is not admissible here.
- **AT-E5.3** The evaluation either **loads the deployed artifact**, or states explicitly in its
  output that it evaluates the *procedure* via refit. This closes audit §5's gap, which is currently
  neither done nor disclosed.
- **AT-E5.4** Fixed seed ⇒ byte-identical metrics across runs.

---

## E6 — A split in the training path, and a temporal guard added *before* it is needed

`train_all_models` fits 100% of rows. Refitting on all data for deployment is standard and fine —
what is not fine is that **no split-based number is ever computed or recorded**.

The temporal guard matters more than it looks. Today the split is random over match IDs, which is
harmless because all 577 matches were created within ~20 seconds. **The moment real pilot matches
arrive it silently becomes a leak** — training on August, testing on July. Adding it now costs
nothing; adding it later requires noticing.

**Acceptance tests**
- **AT-E6.1** The manifest contains a holdout Brier and calibration. Training **fails** if the
  holdout is empty.
- **AT-E6.2** Construct matches spanning two distinct dates; assert the split is **chronological**,
  not random. This test fails today and would keep failing silently without it.
- **AT-E6.3** Assert no `match_id` appears in both train and holdout.

---

## E7 — Operational

- **`debug=True`**: `app.py:45` passes it explicitly, so `FLASK_ENV: production` in compose does not
  override it. The Dockerfile's `CMD ["python", "app.py"]` runs exactly this, port 5001 is published
  on the host, and `nginx.conf:132` proxies it at `/ai/`.
- **`POST /train` is unauthenticated** — its own comment says *"In a real app, this might be
  protected by an API key."*
- **The volume mount** (`docker-compose.yml:81`) shadows `trained_models/` and contradicts the
  source comment at `recommendations.py:7-9` asserting there is no mount. Effect: the self-healing
  retrain fires only on first boot; afterwards the service loads whatever was written then.

**Acceptance tests**
- **AT-E7.1** The image serves via a WSGI server (gunicorn/waitress); `debug` is never true when
  `FLASK_ENV=production`.
- **AT-E7.2** Unauthenticated `POST /train` returns 401.
- **AT-E7.3** Change a CSV, restart the stack, assert the model **retrains** (manifest SHA changes).
  Either drop the volume or reconcile the manifest against `data/` at startup.
- **AT-E7.4** The false comment at `recommendations.py:7-9` is corrected. It currently asserts
  something untrue about the deployment, which is how the staleness trap survived review.

---

## Suggested order

```
E0  measure          →  baseline recorded, nothing changed yet
E1  delete           →  zero-pixel diff, -200MB, smallest blast radius
E2  first innings    →  stops user-visible nonsense fastest
E3  shared features  →  the structural fix; E4 depends on it
E4  domain guard
E6  training split   →  produces the number
E5  wire CI          →  gates the number
E7  operational      →  independent, can run in parallel any time
        ↓
    re-run E0's evaluation → compare pre/post
```

The final re-measurement is the point of starting with E0. It is also the honest way to find out
whether the `3.4` skew was materially hurting predictions or merely wrong — I do not know which, and
neither does anyone else right now.

---

# Part 2 — Research questions

## The Gate 1 problem, stated plainly

Fact 2 above is not a caveat to append to a research plan. It determines which questions are
answerable.

`research/protocol.md` gate 1: *does the environment contain the structure the question is about?*
For all three candidate questions, against `real_matches.csv`, the answer is largely **no** — and the
reasons differ per question.

## RO1 — Win probability vs. a closed-form baseline

**Your formulation**: *Can the CricRoots model meaningfully outperform a strong, interpretable chase
baseline while remaining well calibrated?*

The formulation is right. The problem is the environment, and it is worse than "the data is
synthetic".

Because the simulator draws every ball i.i.d. with no team, batter, or state dependence, the true
win probability given `(runs, wickets, balls remaining, target)` is **exactly computable**. So on
this data:

- A correctly-specified closed-form baseline is not a strawman to beat — it is **approximately the
  Bayes-optimal predictor**.
- The expected result is "ML does not beat it." That is the *predicted* outcome, and confirming a
  prediction that follows from reading the generator teaches nothing.
- A result in the *other* direction — ML beats the closed form — would be evidence of **overfitting
  or leakage**, not skill.

A question whose negative result is uninformative and whose positive result is a bug is not a good
experiment. **RO1 as stated should not be run on current data.** Splitting it fixes this:

### RO1a — Estimator validity check (runnable now, Track A, cheap)

Derive the exact win probability under the simulator's own generative process — analytically or by
Monte Carlo over the known ball distribution — and use it as an **oracle**. Then measure how closely
the deployed model approaches it, via oracle MAE.

This reuses the programme's established instrument directly (`research/oracles.js`, oracle MAE as
the sound instrument when test distributions move — Exp 6). It answers a genuinely useful question:
**is the estimator doing its job, given a target we know exactly?** That is a validity check, not a
claim about cricket, and it should be reported as one. Gates 1–3 all clear for *this* question,
because the structure is known by construction.

### RO1b — The real question (blocked, Track B)

*Does a properly evaluated win-probability model outperform a strong interpretable baseline on real
cricket, while remaining calibrated?* Requires real matches. Same gate as Track B throughout the
programme. Not blocked on analysis — blocked on pilot adoption.

## RO2 — First-innings win probability

You are right that it is a genuinely different prediction problem, and the literature separating the
innings supports that. Two things to record before it becomes a plan:

- **It is engineering-blocked first.** E2 stops the current nonsense. Building the model is
  downstream of RO1 clearing — there is no case for extending a model that has not cleared a
  baseline.
- **It is *more* affected by Fact 2, not less.** The first-innings question depends on projecting a
  final score, which depends on batting resources and team strength. The simulator has **neither**.
  In this data, projected final score is just the mean run rate times overs remaining. The
  interesting part of the question is absent by construction.

## RO3 — Learned latent state representation

Your example is the right intuition: `82/2 after 10 overs` means different things with elite batters
to come versus a tail. And it connects well to the programme's latent-representation arc.

**But it fails gate 1 by construction, and in exactly the way D17 records.** `matchSimulator.js` has
no batter quality, no team strength, and no pitch. There is **no latent match state to recover**. A
latent-representation experiment run here would be Experiment 8 again: asking a transfer question in
a world with no shared latent factors, and getting a null result that names the wrong cause.

This does not kill RO3. It tells us what RO3 needs first, and the programme already has the pattern:

> **World E** — a match-level generator with explicit team strength, batting-resource depth, and
> phase structure, built to a stated specification, exactly as Worlds B/C/D were built for the
> matchup engine.

That makes the question answerable, with an oracle available to bound it. It is real work, and it is
the honest precondition. Note the pleasing symmetry with what the first arc established: the matchup
engine's limit was **sparse entity-level evidence**; the match-level question has abundant
observations but currently **no latent structure to find**. Different failure modes, which is what
makes a second branch worth having.

## Prior art — a step, not a footnote

Agreed that "we built a cricket win-probability model" is not a novelty claim. In-play cricket
forecasting is a mature field: dynamic logistic regression for in-play ODI win probability, WASP,
and commercial live win-probability systems are all well established.

Per `general-algorithm-landscape.md` §6, the prior-art review is a **gated step with its own
adversarial standard** — *search for papers that could kill it, not papers that support it* — and it
runs **before** any novelty claim, not after a result. Two process notes:

1. The specific citations relayed should be **verified against the primary sources** before entering
   the landscape document. The dynamic-logistic-regression, WASP and commercial-systems lines are
   well-attested; the 2026 arXiv item I have not confirmed and would not record as established prior
   art on a secondhand citation. That is the same standard the programme applies to its own results.
2. Prior art is cheap and unblocked. It can proceed in parallel with Part 1 — it needs no data and
   no fixes.

---

# Part 3 — Recommendation

**Do Part 1. Do not start RO1 yet** — and after Fact 2, I would go further than "not yet": RO1 as
originally framed should not be run on this data at all, because its informative outcome is
unreachable. RO1a is the version worth running, and it is a validity check rather than the headline
question.

**The strongest immediately-available research action is not an experiment.** It is the prior-art
review for match-level win probability, which is unblocked, cheap, and required before any claim.

**The highest-value thing in Part 1 is AT-E3.1**, the training/serving feature parity test. The `3.4`
bug survived despite being explicitly documented as a hazard in the very script that avoided it. A
warning in a comment did not prevent it; an assertion would have. I would add deployment-parity
testing to `research/protocol.md` as a standing gate — it is a seventh failure mode the existing six
do not cover, and it was found the same way all six were: by an absence producing a wrong result.

**One honest uncertainty**: I do not know whether the `3.4` skew materially changed predictions or
was merely wrong. E0-then-re-measure is designed to answer that rather than let me guess.

**Nothing here is implemented. Production remains frozen pending your go-ahead on Part 1.**
