# Research-Readiness Audit

Written 2026-08-15, in response to an external review of the CricRoots repository and an explicit
instruction to verify every claim against the actual code before proposing any research or
engineering plan — not to accept or extend the review's conclusions on trust. Every finding below
was checked directly against the repository as it exists right now (reading the source, running
the actual scripts/queries against the real database where relevant), not inferred from
documentation or commit messages alone. Where a claim below could not be directly verified, that is
stated explicitly rather than assumed.

**No implementation changes were made while writing this document.** It is analysis only.

## 1. What is already strong

- **`blendWithPrior`/`hierarchicalBlend` (`backend/src/utils/statUtils.js`) is a correctly
  implemented empirical-Bayes-style shrinkage estimator.** The formula
  `(n·individualValue + k·prior) / (n + k)` is the standard James-Stein-style blend used for
  small-sample sports statistics. Read line-by-line; it does what its documentation claims.
- **The hierarchical backoff chain (`getMatchupPlan`, `tendencyAnalytics.js`) is real, working code
  against real data structures**, not a stub. It queries `Match.aggregate` over actual
  `innings.balls` documents, forms four levels (exact matchup → batter-vs-bowler-archetype →
  archetype-vs-archetype → global), and blends them via `hierarchicalBlend`. Archetypes come from
  `Player.battingStyle`/`bowlingStyle`, fields that are genuinely captured at registration, not
  placeholder data.
- **The live-adjustment extension (`getLiveMatchupPlan`) is a coherent, separately-reasoned design
  decision**, not a bolted-on afterthought — it correctly treats "today's form" as a different axis
  (recency/context) from "which players" (identity), blending on top of the historical estimate
  rather than folding it into the same backoff chain. The reasoning for this is documented in
  `documentation/hierarchical-matchup-shrinkage-research.md` and matches what the code actually
  does.
- **The win-probability model's real-data path is genuinely real-data-trained, not synthetic.**
  `extractWinProbabilityData.js` walks actual completed matches' ball-by-ball chase innings and
  backfills the true final outcome (did the chasing team actually win?) as the label for every
  over-checkpoint in that match. Verified directly: `real_matches.csv` has 577 unique match IDs,
  11,234 rows, and `win_probability` is a hard 0/1 that is **constant within every single match**
  (checked programmatically, not sampled) — i.e., it is the real final result, not a synthetic
  heuristic. `recommendation_model.py`'s `train_all_models` trains `win_prob_model.pkl` on this
  file when it exists, which it does. The deployed win-probability model is not the same code path
  as the batsman/bowler recommendation models discussed in §2.
- **`evaluate_win_probability.py`'s train/holdout split is done correctly at the match level**, not
  the row level (`match_level_split` splits on unique `match_id`, confirmed by reading the code).
  This is the right unit to split on — rows from the same match share one trajectory and one
  outcome, and a row-level split would leak the label. The script also computes Brier score and
  decile calibration, and compares a real-trained vs. synthetic-trained model on the *same* real
  holdout, which is a legitimate comparison design.
- **The research document itself (`hierarchical-matchup-shrinkage-research.md`) already does the
  intellectually correct thing**: it researches prior art before claiming novelty, kills three
  candidate ideas after finding they're already covered (win probability from match state, shot
  prediction from line/length — actively patented by Stats Perform, auto-commentary), and is
  explicit that a paper isn't publishable without a real evaluation, which doesn't exist yet. It
  independently arrives at almost exactly the next step this audit was asked to scope: "build a
  backtesting/ablation harness... compare raw exact-matchup average, single-level blend, archetype-
  only, and the full chain... calibration curves, not just accuracy." This audit is not
  discovering a new direction; it is checking whether the direction the project already committed
  to is actually executable on the data that exists today (§5 below is the important finding here).
- **The multi-scorer lock/resume design (`activeScorer`, `LOCK_TIMEOUT_MS`, `innings.liveState`)
  is real engineering thinking, not generated boilerplate** — it solves an actual operational
  problem (a scorer's phone dying mid-match) with a mechanism that's simple and correct: a
  timestamped lock with a timeout, plus enough persisted client state that a second device can
  resume without re-deriving ambiguous striker/non-striker state from the ball log alone.

## 2. What is technically weak

- **`batsman_model.pkl` and `bowler_model.pkl` are trained entirely on synthetic data, and the
  synthetic data has no real label.** Confirmed by reading `recommendation_model.py`'s
  `train_all_models`: `X_bat`/`y_bat` come from `matches.csv`, whose `recommended_batsman` column is
  produced by `data_generator.py`'s `generate_synthetic_cricket_data` — random player IDs assigned
  via `random.choice`/`random.uniform`, not any real decision or outcome. The model's reported
  `confidence` (`np.max(probs)`) is the model's confidence in reproducing this synthetic label,
  which has no relationship to real recommendation quality. This is the weakest part of the AI
  engine and should not be presented as evidence of anything beyond "a Random Forest can fit
  synthetic data it was trained on."
- **The fielding model (`fielding_model.pkl`) has the identical problem** — trained on
  `fielding.csv`, also from `generate_synthetic_cricket_data`.
- **No automated test suite exists anywhere in the monorepo.** Confirmed directly:
  `backend/package.json`'s `test` script is the unmodified `npm init` placeholder
  (`echo "Error: no test specified" && exit 1`); `web-app/package.json` and `mobile-app/package.json`
  have no `test` script at all; there is no `pytest`/`jest`/`mocha` config anywhere in the repo; a
  filesystem search for `*.test.*`/`*.spec.*` outside `node_modules` returns nothing in any of the
  four packages. This session's actual practice has been live verification against a real backend
  and real database, then commit — which is a genuinely good verification discipline in the moment,
  but none of it persists as a regression guard.
- **No CI pipeline exists.** `DEPLOYMENT.md` contains a documented *example* GitHub Actions workflow,
  but there is no `.github/workflows/` directory in the repository — nothing actually runs on push.
- **Large trained-model binaries are committed directly to git history**, not stored externally.
  Verified by reading the actual blob sizes at `HEAD` (not just the working-tree files, which could
  in principle differ from what's committed): `batsman_model.pkl` is 100,121,385 bytes,
  `bowler_model.pkl` is 101,154,849 bytes, `win_prob_model.pkl` is 9,026,913 bytes, all tracked as
  real git blobs as of the current `HEAD` commit. Both of the two largest files are just under
  GitHub's 100 MiB hard block (104,857,600 bytes), which is presumably why the push succeeded at
  all — this is fragile, not intentional headroom.
- **Dependency vulnerabilities exist in all three JS packages** (`npm audit`, run directly):
  backend has 3 high-severity (transitively via `nodemon`, a dev-only dependency, so lower real
  risk); web-app has 2 high-severity (transitively via Next.js's bundled `postcss` — XSS/path-
  traversal advisories); mobile-app has 22 (11 moderate, 11 high), several via `expo-notifications`/
  `expo-constants`/`expo-updates` — dependencies added in this same working session for the push-
  notification feature, so this is a very recent, self-inflicted addition, not old debt.
- **Docker Compose ships with insecure fallback defaults that silently activate rather than fail
  closed**: `MONGO_INITDB_ROOT_PASSWORD: ${MONGO_ROOT_PASSWORD:-password}` and
  `JWT_SECRET: ${JWT_SECRET:-your_jwt_secret_key_change_in_production}` (verified by reading
  `docker-compose.yml` directly). `.env.example` correctly tells the reader to change these, so
  nothing is leaked, but an operator who forgets to set the env vars gets a working system with
  known-weak credentials instead of a startup failure.
- **CORS is unrestricted**: `app.use(cors())` with no options object (verified in
  `backend/src/index.js`), which defaults to allowing every origin. MongoDB, the backend, and the
  AI engine are all directly port-exposed in `docker-compose.yml` alongside nginx, not fronted
  exclusively by it.
- **Several backend/frontend modules have grown very large by accumulation** (verified by file
  size, not estimated): `web-app/components/TournamentManager.tsx` is 80 KB,
  `web-app/app/match/[id]/page.tsx` is 76 KB, `backend/src/controllers/tournamentController.js` is
  60 KB, `backend/src/services/tendencyAnalytics.js` is 56 KB, `backend/src/controllers/
  matchController.js` is 52 KB. None of these are wrong per-function, but each has become a single
  file doing many unrelated things (routing logic, business logic, and in the frontend cases, a
  large amount of UI in one component).

## 3. What is research-worthy

- **The hierarchical matchup shrinkage method itself** (§1) — a genuine candidate for the reasons
  the existing research doc already lays out: the specific gap (tactical-attribute-level, not
  outcome-level, recommendations at 0–15-ball sample sizes) doesn't have close published prior art,
  and the method is fully implemented against real data structures, not sketched.
- **The live/historical two-stage blend** (`getLiveMatchupPlan`) as a second, related but distinct
  question: does a small amount of current-match, current-conditions evidence, blended with a
  smaller pseudo-count, measurably improve calibration over historical-only estimates? This is
  answerable independently of whether the historical method itself proves out.
- **The `k` (and `LIVE_K`) hyperparameters as an explicit research question**, not an assumed
  constant — see §5 and §6 for why this can't be answered yet, but the question itself
  (does a fixed pseudo-count generalize across hierarchy levels and data regimes, or does it need
  to vary) is a legitimate, scoped research question once real data exists.
- **The general framing already in the research doc** — statistically honest decision-making under
  extreme data sparsity, cricket as the proving ground rather than the whole claim — is a real
  research framing, not marketing. It is *not*, on its own, evidence that the specific
  implementation works; that's exactly what's unproven (§5).

## 4. What is merely product functionality

These are real, working features that should not be described as research contributions,
because there is nothing experimental being claimed about them — they are direct applications of
already-established techniques:

- Auto-generated ball-by-ball commentary, match summaries, and the multi-paragraph match story
  (phrase-bank generation over already-computed stats — a standard, well-published pattern, and the
  project's own research doc already correctly excludes this from any novelty claim).
- Manhattan/Worm/wagon-wheel charts, MVP point scoring, achievement badges, rain-rule
  approximation — real, useful, correctly-implemented analytics, but direct application of known
  formulas/visualizations, not open research questions.
- The batsman/bowler/fielding Random Forest recommendations (§2) — real product code, but should be
  described to any outside reviewer (including in a future paper) as prototype/placeholder
  functionality, not evidence of ML capability, given they're trained on synthetic labels with no
  real-world grounding.
- Everything social/marketplace/community/notification-related — legitimate product surface area,
  entirely orthogonal to the research question.

## 5. What claims we currently cannot scientifically support — the central finding

**This is the most important result of this audit, and it was not something the external review
could have found without reading the match-generation code directly.**

Verified directly against `backend/src/scripts/matchSimulator.js`, the script that generated the
large majority of matches currently in the database (580 total matches, 577 completed, 579 with at
least one line/length-tagged ball — i.e., essentially the entire dataset the matchup engine would
draw from):

**Dismissal probability in the simulator is generated independently of line, length, batter, or
bowler.** The relevant line, verified directly:

```js
const isWicket = Math.random() < 0.045;
```

This is checked *after* `line`/`length` have already been chosen (via a weighted random pick, so
their marginal distribution looks realistic) and *independently* of which specific batter/bowler
pair is involved, or what archetype either belongs to. Runs-per-ball follow a similarly flat,
un-conditioned weighted distribution (`pickWeighted({0: 38, 1: 32, 2: 9, 3: 2, 4: 13, 6: 6})`),
also independent of line/length/batter/bowler.

**The practical consequence: in the data currently in the database, there is no real relationship
between (batter, bowler, line, length) and dismissal outcome for the hierarchical matchup engine to
detect.** The simulator produces line/length *tags* that look plausible in isolation, but the
generative process behind the outcome (wicket or not, runs scored) never reads those tags or player
identities when deciding what happens. Running any evaluation — baselines, the proposed hierarchy,
an ablation study, a `k`-sweep, a calibration curve — against this dataset today would not test
whether hierarchical shrinkage recovers real cricket structure, because the "ground truth" being
fit has no such structure to recover. A trivial global-average baseline would be statistically
expected to perform indistinguishably from the full hierarchical method on this data, not because
the method is wrong, but because there's nothing for a more sophisticated method to be *right
about* that a naive one would miss. A misleadingly good- or bad-looking result either way would be
noise, not evidence.

This is distinct from, and more serious than, the synthetic-training-data problem already flagged
for the batsman/bowler Random Forest models (§2) — those are at least honestly labeled as
placeholder in this audit. The matchup engine's evaluability problem is easy to miss precisely
*because* the engine is real, working code operating on data that has the right shape (real line/
length tags, real player IDs) — the corruption is in the causal structure behind the labels, not
in the code or the schema.

**The win-probability model is meaningfully less exposed to this problem**, though not entirely
clean, and this distinction matters for §6/§7:
- Match-*state*-to-outcome relationships (fewer wickets in hand + fewer overs left + higher required
  rate ⇒ lower win probability) are close to mechanically true regardless of how individual balls
  were generated, because they're consequences of the scoring/dismissal *mechanics* of cricket
  (you need enough balls left to reach the target, you need wickets in hand to keep batting), not of
  any particular player's skill. So win-probability-from-match-state, evaluated on these matches, is
  evaluating something closer to real structure than the matchup engine is.
- However: because the simulator's per-ball dismissal/run rates are flat and unconditioned on match
  situation too (no "settles in" behavior, no pressure response, no rain/pitch effects beyond what's
  explicitly modeled), the *specific shape* of any win-probability curve learned from this data may
  not transfer to real matches, even if the general "more resources remaining ⇒ higher win
  probability" relationship the model recovers is directionally sound. This should be described as
  "the evaluation methodology is sound; whether the *learned relationship* generalizes to real play
  is a separate, currently open question" rather than either "proven" or "meaningless."

**Additional smaller finding, same root cause:** `getMatchupPlan`'s underlying query
(`getLineLengthBreakdown` in `tendencyAnalytics.js`) has no match-exclusion or time-boundary filter
— it aggregates across every ball ever recorded matching the batsman/bowler criteria, with no
concept of "before this point in time." This means `getLiveMatchupPlan`, which is meant to treat
"today's balls" as a distinct live signal layered on top of a separate historical estimate, is
actually double-counting: by the time a ball recorded earlier in the current match is being used as
"live" evidence, it has already been persisted to the database and is therefore also already
included inside the "historical" aggregate computed by the very same request. This doesn't
invalidate the live-adjustment *idea*, but it means the current implementation cannot cleanly
distinguish "does live adjustment help" from "we weighted recent data twice," and needs to be fixed
(exclude the current match from the historical query, or exclude already-counted balls from the
live query) before any live-vs-historical-only comparison would mean anything.

## 6. What experiments are required

Contingent entirely on §5 being resolved first (see §7) — there is no ordering in which these
experiments can be usefully run before real or realistically-structured data exists:

1. **A frozen, versioned dataset** of ball-by-ball deliveries from matches where dismissal/run
   outcomes are genuinely dependent on batter, bowler, and line/length — either real matches from an
   actual pilot season, or a simulator rewritten to encode a real (even simplified) skill/matchup
   model, clearly labeled as synthetic-but-structured if used before real data exists.
2. **A precisely defined prediction target** (this needs to be settled before any of the below is
   built — see the explicit note at the end of this section).
3. **Baselines**, evaluated on the same frozen test split as the proposed method:
   - Global rate (no player identity at all)
   - Raw exact-matchup rate (no shrinkage — the naive estimate the whole method exists to improve on)
   - Single-level shrinkage (`blendWithPrior` against the global rate only — this is what existed
     before the hierarchical chain was built, so it's a real, meaningful "what did we actually add"
     baseline, not a strawman)
   - Archetype-only estimate (skip the exact-matchup level entirely)
4. **The proposed method**: full 4-level hierarchical shrinkage (historical only).
5. **The proposed method + live adjustment**: full hierarchy plus the `getLiveMatchupPlan` blend,
   *after* the double-counting bug in §5 is fixed.
6. **Match-level (or, if using real data spanning time, temporal) train/validation/test splitting**,
   the same discipline already correctly used in `evaluate_win_probability.py` — extended to the
   matchup-recommendation evaluation, which does not currently have any evaluation harness at all
   (there is no `evaluate_matchup_plan.py` equivalent; `getMatchupPlan`/`getLiveMatchupPlan` compute
   directly against live production data on every call, with no notion of a held-out set).
7. **For the win-probability model specifically**: re-run `evaluate_win_probability.py`'s existing
   methodology (it doesn't need to be rebuilt, just extended) directly against the currently-saved
   `win_prob_model.pkl` rather than a freshly retrained instance inside the eval script, to close
   the reproducibility gap noted in §7, and capture the results as a committed artifact rather than
   console output that isn't retained anywhere.

**On the prediction-target question, precisely, because it was asked for explicitly and it matters:**
`getMatchupPlan` as currently implemented predicts exactly one thing — `dismissalRate`, the
probability that this ball results in a dismissal, per line/length bucket, blended through the
hierarchy. That is unambiguous in the code (`bucket.dismissalRate`, `blendedDismissalRate`) and it
is the only target the shrinkage chain is currently applied to.

But `getLineLengthBreakdown` also already computes `strikeRate` (a runs-based rate) per bucket, and
this value is **not** currently passed through `hierarchicalBlend` at all — it's computed and then
discarded before `getMatchupPlan` builds its recommendation. This matters because a real bowling
plan is not single-objective: a line/length bucket with a low dismissal rate but a very high strike
rate (the batter never gets out there, but scores freely) is not obviously a "good" bucket to bowl,
and the current recommendation has no way to express that tradeoff — it optimizes for dismissal
probability alone. This needs an explicit decision before any experiment is designed, not an
implicit one made by only measuring the target that happens to already be wired up:

- **Option A — keep dismissal probability as the sole target.** Simplest, matches the current
  implementation exactly, easiest to defend a Brier-score/calibration evaluation for. Understates
  real tactical value (ignores runs conceded).
  - This is what "dismissal probability" already means: how would this actually be evaluated
    against ground truth from a real ball? — a Brier score comparing the predicted probability
    against the realized 0/1 outcome (dismissal or not) is the direct, correct comparison, exactly
    as `evaluate_win_probability.py` already does for match outcomes. No ambiguity here, which is
    the appeal of Option A.
- **Option B — extend to a joint or composite target** (e.g., expected runs conceded, or a combined
  "expected runs given no dismissal, weighted by dismissal probability" utility). Closer to what a
  real bowling plan cares about; meaningfully more research and engineering work (a composite target
  needs its own defensible construction and its own evaluation metric, not just "add strikeRate to
  the blend").
- **Recommendation, not yet a decision**: start the experimental program on Option A specifically
  because it's what the shipped code already computes and it has an unambiguous, well-understood
  evaluation protocol (Brier score / calibration against a realized binary outcome) — proving or
  disproving the *hierarchical shrinkage mechanism itself* is the first question, and it should be
  asked on the simplest target where the answer is interpretable. Option B is a legitimate and
  probably more product-relevant second question, but bundling it into the first experiment risks
  conflating "does hierarchical shrinkage help" with "did we pick the right composite objective,"
  which are two different failure modes that would be hard to tell apart in a single result.

## 7. What engineering work is required before experiments

In rough dependency order — most of these block §6 entirely, not just improve it:

1. **Resolve §5.** Either wait for real pilot data, or deliberately rebuild (a clone of, not a
   replacement for) the simulator with a real, documented skill/matchup model so that a
   *synthetic-but-structured* dataset can be used for methodology development while real data is
   still being collected — clearly labeled as such everywhere it's used, never conflated with real
   validation.
2. **Fix the historical/live double-counting bug in `getLiveMatchupPlan`/`getMatchupPlan`** (§5) —
   exclude the in-progress match from the historical aggregate, or exclude balls already reflected
   in "live" from the historical count. Required before the live-adjustment question in §6 can be
   asked at all.
3. **Build an evaluation harness for the matchup engine** — currently doesn't exist in any form.
   `evaluate_win_probability.py` is a real, usable template for structure (match-level split, Brier
   score, decile calibration) but the matchup engine needs its own, since the prediction unit
   (per-ball, per-bucket) and the thing being split on (matches, but the *unit under test* is a
   batter/bowler pair that may recur across matches) are both different from win-probability's
   single-outcome-per-match structure — this needs its own design, not a copy-paste.
4. **Deterministic unit tests for `blendWithPrior`/`hierarchicalBlend` first**, before any broader
   test suite work — these are pure functions with precisely computable expected outputs (given
   fixed inputs and `k`, the blended value is exact arithmetic, not something requiring mocking or
   integration setup), so they're the cheapest, highest-confidence tests available and they directly
   protect the primitive every other experiment depends on.
5. **A record-keeping structure for experiments** (dataset version, split, seed, hyperparameters,
   model/code version, metrics, timestamp) — doesn't need to be built speculatively; propose the
   structure only once §1–4 make an actual experiment runnable, per the instruction not to build
   `research/` scaffolding before it's needed.
6. **General test coverage** (scoring invariants, extras, wickets, innings transitions, auth) and
   **CI** — real, valuable, and largely independent of the research track; can proceed in parallel
   with §1–5 rather than blocking on them.
7. **Model artifact hygiene** — investigate before acting, per the explicit instruction not to
   delete anything blindly:
   - `batsman_model.pkl`/`bowler_model.pkl`/`fielding_model.pkl`: confirmed still loaded at runtime
     by `RecommendationModel.load_models()` and served by `app.py`'s Flask endpoints — removing them
     without a replacement would break the currently-deployed (if scientifically weak, per §2)
     product feature, not just clean up history. They are also fully reproducible on demand:
     `train_models.py` → `RecommendationModel.train_all_models()` regenerates all four `.pkl` files
     from `data/*.csv` deterministically (fixed `random_state=42`), so nothing irreplaceable is
     currently sitting only in git history.
   - `win_prob_model.pkl`: same load-bearing/reproducible situation, additionally regenerable from
     real match data via `extractWinProbabilityData.js` if the underlying matches still exist (they
     do, in the live database).
   - Given they're reproducible from committed scripts and small source CSVs, the lowest-risk path
     is: stop committing regenerated `.pkl` files going forward (`.gitignore` them, document the
     regeneration command), decide separately whether to rewrite git history to remove the existing
     ~200 MB of blobs (a genuinely disruptive operation for any other clone/fork — needs sign-off,
     not something to do unilaterally) or simply stop growing the problem from here forward. Neither
     choice is made in this document.

## Summary

The hierarchical shrinkage method is real, correctly implemented, and asks a legitimate research
question that the project's own prior documentation already scoped accurately. It has not yet been
evaluated — not "evaluated and found lacking," genuinely never evaluated — and the reason it hasn't
is more fundamental than "no evaluation harness exists" (true, but fixable in isolation): the
dataset that harness would run against today has no real matchup-dependent structure in it to
measure, because it comes almost entirely from a simulator whose outcome generation ignores exactly
the variables (batter, bowler, line, length) the method is trying to model. That is the one finding
in this document load-bearing enough to gate everything else in §6 and §7.
