# AI System Prototype — Mined Patterns

Distilled from `/ai-system/*.tsx` (6,313 lines across 5 components) and the two
`ai-tactical-recommendation-*.md` design docs (491 lines), reviewed in full on 2026-08-10.

**Purpose of this document**: the `ai-system/` prototype is disconnected mock-data UI,
scoped for professional/international cricket, and will not be adopted wholesale. This
is a reference for whoever builds the real shrinkage-weighted statistics layer for
CricSync's four local-tournament recommendation features:

1. Shot advice for a batsman
2. Opposition bowler scouting
3. Bowling plans (where to bowl to dismiss a specific batsman)
4. Fielding placement for a specific batsman

---

## 0. Recommended reading order / starting point

Don't read the 6,300 lines top to bottom. If you're picking up the real
recommendation-endpoint work, read in this order:

1. **`PlayerMatchDataCollection.tsx` lines 37–174** — the canonical `PlayerStats`,
   `MatchConditions`, `MatchData` type definitions that all four other files import
   from `../data/types`. Read this first purely to understand the vocabulary the
   other files assume.
2. **`PlayerMatchDataCollection.tsx` lines 120–154 and 336–390** — the
   `playerPerformances[].battingStats` / `.bowlingStats` shape, specifically
   `runsPerBowler`, `phaseScoring`, `phaseWickets`, `phaseEconomy`. This is the
   closest thing in the prototype to a per-match aggregation layer, and the closest
   analog to what a shrinkage layer needs to compute *from* ball-level data.
3. **`BowlerRecommendation.tsx` lines 683–796** (`calculateMatchupScore`,
   `calculatePhaseEffectivenessScore`, `calculatePitchConditionScore`) — closest
   structural analog to feature (2) "opposition bowler scouting." Read for the
   *scoring pattern* (weighted factors → 0-1 clamp → explanation string), not for
   the specific formulas, which assume hand-labeled matchup data that doesn't exist
   in reality (see §3).
4. **`FieldingPositionOptimization.tsx` lines 788–922** (`calculatePlayerPositionScore`,
   `generateReasons`) — the direct precursor to feature (4) "fielding placement for a
   specific batsman." This is the most reusable of the five files because it already
   works in "one batsman + one bowler + one field" terms rather than "who bats/bowls
   next," which fits your scope far better.
5. **`BatsmanRecommendation.tsx` lines 386–665** — read last, mainly for the
   explanation-generation pattern (§4) and the confidence-labeling anti-pattern (§3).
   Its actual purpose — "who should we send in next" — is NOT one of your four
   planned features, so treat this file as a pattern reference, not a target for
   feature (1) "shot advice."

**Important scope note**: `BatsmanRecommendation.tsx` and `BowlerRecommendation.tsx`
solve "which player should play next" (a captain's team-selection problem for
professional squads with benches). None of CricSync's four planned features are that
problem — local tournaments field a fixed XI. The genuinely reusable material in
those two files is the *scoring/explanation machinery*, not the "next player" framing.

---

## 1. Scoring/weighting algorithms as implemented

### 1.1 Batsman recommendation — doc vs. code disagree

`BatsmanRecommendation.tsx` lines 38–45:

```ts
const ALGORITHM_WEIGHTS = {
  recentForm: 0.25,
  matchupVsBowlers: 0.20,
  pitchConditionSuitability: 0.15,
  phasePerformance: 0.15,
  situationalRequirement: 0.15,
  partnershipHistory: 0.10
};
```

`ai-tactical-recommendation-system-architecture.md` lines 88–116 states:
Recent Form 20%, Matchups vs. Current Bowlers 25%, Pitch Condition Suitability 15%,
Phase Performance 20%, Situational Requirements 15%, Partnership History 5%.

**Disagreement**: `recentForm` and `matchupVsBowlers` are swapped between doc (20/25)
and code (25/20). `phasePerformance` is 20% in the doc but 15% in code.
`partnershipHistory` is 5% in the doc but 10% in code. Only `pitchConditionSuitability`
(15%) and `situationalRequirement` (15%) actually match. **Take the code as the
"real" version if you want a concrete starting point** — but neither is empirically
derived; both are arbitrary numbers someone typed once. Don't treat either as
authoritative, just as *a* prior to start from.

### 1.2 Bowler recommendation — doc and code agree

`BowlerRecommendation.tsx` lines 39–46, matches
`ai-tactical-recommendation-system-architecture.md` lines 118–150 exactly:

```ts
const ALGORITHM_WEIGHTS = {
  matchupVsBatsmen: 0.25,
  phaseEffectiveness: 0.20,
  pitchConditionSuitability: 0.15,
  recentForm: 0.15,
  bowlerFreshness: 0.15,
  tacticalVariation: 0.10
};
```

`bowlerFreshness` and `tacticalVariation` are about in-match over rotation — not
relevant to your four features (no "who bowls next" feature is planned) but
`bowlerFreshness`'s freshness formula (line 848) is worth noting for its shape:

```ts
// calculateBowlerFreshnessScore, lines 824-849
const oversRemainingScore = oversRemaining / maxOvers;
let restPeriodScore = Math.min(oversSinceLastBowled / 3, 1);
return (oversRemainingScore * 0.7) + (restPeriodScore * 0.3);
```

A 70/30 blend of two sub-signals into one factor — same additive-blend pattern
recurs everywhere in this codebase (see §1.4).

### 1.3 Fielding position optimization — no formal weights at all

Unlike the batsman/bowler engines, `FieldingPositionOptimization.tsx` has **no
`ALGORITHM_WEIGHTS` constant**. The design doc (lines 152–179) lists 5 factors with
no percentages either — this is the one engine where doc and code agree by both
being informal. The code (`calculatePlayerPositionScore`, lines 788–863) is a
sequence of ad hoc additive bonuses, all starting from a neutral 0.5 base and
clamped to [0,1] at the end:

```ts
let score = 0.5;
if (player has strength in this position) score += 0.3;
if (position is batsman's high-scoring zone) score += 0.2 * normalizedCatches;
// fielding stats, weighted by position importance tier (high/medium/low):
if (position.importance === 'high') score += 0.2*normalizedCatches + 0.1*normalizedRunOuts;
else if (position.importance === 'medium') score += 0.15*normalizedCatches + 0.05*normalizedRunOuts;
else score += 0.1*normalizedCatches + 0.05*normalizedRunOuts;
// bowler-type bonus: pace -> slip cordon +0.15; spin -> close-in ('special') +0.15
// phase bonus: powerplay -> slip/deep +0.1; death -> deep/long +0.1
return Math.max(0, Math.min(1, score));
```

These bonuses aren't guaranteed to sum to ≤1 (multiple could stack past 1.0 before
the final clamp) — this is a real algorithmic looseness, not a deliberate design;
worth doing properly (actual weighted sum to 1) in the real implementation.

**Field position taxonomy** (`FIELD_POSITIONS`, lines 43–66) is a useful reference:
21 named positions, each tagged with `zone` (slip cordon / off side / on side) and
`importance` (high / medium / low / special for short-leg/silly-point/short-midwicket).
Compare against your `shotZone` enum (8 zones: fine-leg, square-leg, mid-wicket,
mid-on, mid-off, cover, point, third-man) — the prototype's 21-position taxonomy is
finer-grained (splits slips 1-3, gully, deep variants, etc.) than what you'd need for
a fielding-placement recommendation keyed to your 8 shot zones plus
wicket-keeper/bowler/not-applicable. Not worth adopting wholesale; your 8-zone
schema is the right level of granularity for local-tournament UI.

### 1.4 Recurring formula patterns worth reusing (structure, not exact numbers)

- **Always start at a neutral 0.5, add/subtract bounded deltas, then
  `Math.max(0, Math.min(1, score))`.** Every one of the ~15 score functions in
  these files follows this shape. Good pattern to keep — it's defensive against
  missing data and keeps scores comparable.
- **Normalize a raw stat against an assumed "good" threshold, capped above 1.0**:
  e.g. `Math.min(strikeRate / 150, 1.25)` (BatsmanRecommendation.tsx:544),
  `Math.min(avgRecentRuns / 50, 1)` (line 484). The `1.25` cap lets an
  above-threshold performer score above 1.0 briefly before the outer clamp catches
  it — a mild "give elite performers a bonus" mechanism. Thresholds (150 SR, 50
  runs, 40 average, 140 powerplay SR, 180 death SR, 2 wickets/match) are all
  T20-professional-cricket numbers and **must be re-derived from your own local
  tournament pool average**, not hardcoded.
- **Blend a categorical "form" label with a continuous recent-average, weighted
  60/40**: `(formBaseScore * 0.6) + (normalizedAvg * 0.4)`
  (BatsmanRecommendation.tsx:487, BowlerRecommendation.tsx:818). The categorical
  label (`'excellent'|'good'|'average'|'poor'`) is itself hand-entered data in this
  prototype (see §3) — the pattern of blending a slow-moving prior with a fast
  recent signal is exactly the shrinkage idea you're planning, but the prototype's
  version isn't actually a statistical shrinkage estimator, it's two arbitrary
  numbers averaged with fixed weights regardless of sample size.

---

## 2. Data shapes worth reusing

Comparing against `Match.js`'s `balls` subdocument and `PlayerStats.js`'s season
aggregates as described in your prompt.

| Prototype shape | Where | What it captures | Compared to your real schema |
|---|---|---|---|
| `matchupData.strongAgainstPlayers` / `weakAgainstPlayers` (string[] of player IDs) | `PlayerMatchDataCollection.tsx:86-91` (type), used throughout | Binary "good/bad matchup" tags per opponent | **Concept is genuinely new** — your `PlayerStats.js` has no per-opponent data at all. But the prototype's *representation* (a flat list of IDs) is a dead end — it can't be computed from anything, it's just declared. Don't copy the shape; copy only the concept "matchup data should exist," and derive it from ball-level `batsmanId`+`bowlerId` aggregation with shrinkage, not a hand-maintained list. |
| `playerPerformances[].battingStats.runsPerBowler` (`Record<bowlerId, runs>`) | `PlayerMatchDataCollection.tsx:130` | Per-match runs scored off each bowler faced | **Useful concept**, but match-granularity. Your ball-level schema (`balls[].batsmanId`, `.bowlerId`, `.runs`) is already a strict superset — you can compute this (and finer: per-ball-outcome-vs-bowler) directly from `Match.js`. No new field needed; this validates that your ball tagging already subsumes what the prototype modeled here. |
| `playerPerformances[].battingStats.phaseScoring` `{powerplay, middle, death}` | `PlayerMatchDataCollection.tsx:131-135` | Runs scored by match phase | **Concept validated, not new.** Your `balls[].ballNumber` combined with over count lets you derive powerplay/middle/death splits already. Nothing in `PlayerStats.js` currently stores this pre-aggregated — worth adding as a computed/cached field if query performance matters, but the raw data to compute it already exists post ball-tagging. |
| `playerPerformances[].bowlingStats.phaseWickets` / `.phaseEconomy` | `PlayerMatchDataCollection.tsx:143-153` | Same phase-split idea for bowling | Same as above — derivable from your ball data, not a new concept. |
| `shotDistribution` (`Record<zoneName, percentage>`, e.g. `{cover: 25, point: 15, ...}`) | `FieldingPositionOptimization.tsx:644-652` (mock data only — never computed anywhere in the codebase) | Batsman's shot placement tendency by zone | **Concept validated, not new** — this is exactly what your `balls[].shotZone` enum captures, and better (8 explicit zones vs. this ad hoc 7-key object that doesn't even cover all `FIELD_POSITIONS`). Your ball-level data is strictly richer since it's also joined to `shotType`, `line`, and `length` per delivery, none of which this prototype models at all (see next row). |
| **Delivery line/length as a dismissal-planning input** | **Not present anywhere in the prototype** | N/A | This is the single biggest gap: none of the 5 files, and neither doc, ever reference "line" or "length" as a bowling-plan dimension. The entire fielding/bowling logic operates at the level of "pitch type" (batting-friendly/bowling-friendly/spin-friendly/pace-friendly) and "bowling style" (fast/medium/spin), never at delivery-line/length granularity. **Your `balls[].line` and `balls[].length` enums are genuinely novel data the prototype never modeled — this is exactly the data your planned feature (3) "bowling plans" needs, and you'll be building that logic from scratch, not adapting anything here.** |
| `BowlerWorkload` (`oversBowled`, `lastOverNumber`, `wicketsTaken`, `runsConceded`) | `BowlerRecommendation.tsx:557-563` | Live in-match bowler workload for freshness/rotation | Out of scope for your 4 features (no "who bowls next" feature planned), but if you ever build a captaincy/rotation tool later, this is a clean small shape to start from. |
| `fielderPosition` reasoning tying position → bowler style → match phase | `FieldingPositionOptimization.tsx:832-860` | "pace bowler → prioritize slip cordon", "death overs → prioritize boundary riders" | Directly useful *logic*, not a data shape — your `balls[].fielderPosition` enum plus `bowlerId` gives you what you need to validate or replace these hardcoded style-based heuristics with actual observed frequency once you have enough local-tournament balls tagged. |

**Net takeaway for §2**: almost everything the prototype's data shapes cover is
either (a) already subsumed by your richer ball-level schema, or (b) a
hand-maintained fictional field with no derivation logic. The one real gap your
ball-tagging fills that the prototype never even attempted is delivery line/length —
build that piece with no prototype guidance to lean on.

---

## 3. Confidence / sample-size handling — the key finding

**The prototype has no real concept of "not enough data, here's a fallback."**
This is worth reading carefully because it's the part most directly relevant to your
planned shrinkage-estimator work.

What it actually does:

- `confidenceLevel` (`'very high'|'high'|'medium'|'low'`) is **purely a re-labeling
  of the overall weighted score**, not a measure of data reliability:

  ```ts
  // BatsmanRecommendation.tsx:429-433, identical pattern in BowlerRecommendation.tsx:645-649
  if (overallScore >= 0.85) confidenceLevel = 'very high';
  else if (overallScore >= 0.7) confidenceLevel = 'high';
  else if (overallScore >= 0.5) confidenceLevel = 'medium';
  else confidenceLevel = 'low';
  ```

  A player with zero matchup history and every factor defaulting to neutral 0.5
  would land at `overallScore ≈ 0.5` and be labeled "medium confidence" — which
  reads to a user as "we're moderately sure this is a good pick," when the truth is
  "we have no information and guessed." This is a real anti-pattern to avoid: **do
  not conflate "confidence" (statistical reliability, driven by sample size) with
  "score" (how good the recommendation looks). They need to be two separate axes**
  in your shrinkage design — e.g. show a shrinkage weight / effective sample size
  alongside the blended stat, not a single "confidence: medium" chip derived from
  the stat's magnitude.

- Missing-data fallback everywhere is a **hardcoded neutral value (0.5), never a
  pool/population average**:

  ```ts
  // BatsmanRecommendation.tsx:521, calculateMatchupScore
  if (totalRelevantBowlers === 0) return 0.5; // Neutral if no data
  ```
  ```ts
  // FieldingPositionOptimization.tsx:795
  let score = 0.5; // Neutral starting point
  ```

  This is exactly the naive approach your shrinkage layer is meant to replace: 0.5
  isn't "the pool average," it's just the midpoint of the [0,1] scale, chosen
  because it's convenient, not because it means anything. Your planned
  own-rate/pool-average blend weighted by sample size is a genuine improvement over
  this, not a reinvention of something the prototype already solved.

- **The underlying "form" and "matchup" inputs are hand-labeled, not computed.**
  `recentForm.currentForm` (`'excellent'|'good'|'average'|'poor'`) and
  `matchupData.strongAgainstPlayers`/`weakAgainstPlayers` are typed directly into
  the mock data (`BatsmanRecommendation.tsx:104,107-108` etc.) — there is no
  function anywhere in any of the 5 files that *derives* these from
  `battingStats`/`bowlingStats`/match history. The scoring functions only know how
  to *consume* already-labeled matchup/form data, never how to *produce* it. **This
  means the entire "hard part" of your shrinkage layer — actually computing a
  reliable per-opponent or per-zone rate from raw ball data, correctly weighted by
  sample size — has zero prior art in this prototype.** The formulas here start
  from data that, in your real system, doesn't exist yet and must be built from
  scratch against `Match.js`'s `balls` subdocument.

**Bottom line**: treat the prototype's scoring formulas as a UI/API *contract*
reference (what a "recommendation" object should look like, how to structure
factor scores + explanations), not as a data-pipeline reference. It skipped
the exact problem — reliable estimation from sparse data — that your shrinkage
work exists to solve.

---

## 4. UI/UX patterns worth carrying forward

These are interaction patterns, not MUI component code (your web-app is Tailwind).

1. **Factor breakdown + confidence badge + explanation, three-tier disclosure.**
   Every recommendation card shows: (a) an overall score as a progress bar, (b) a
   list of named factors each with a small 0-5 rating/score bar
   (`BatsmanRecommendation.tsx:1083-1158`), and (c) an expandable "Show
   Explanations" section with one human-readable sentence per factor
   (`BatsmanRecommendation.tsx:1162-1264`). The explanations are hidden by default
   behind a toggle button, not shown inline — keeps the primary view scannable
   while making "why" one click away. Worth carrying forward as-is.

2. **Threshold-banded explanation templates.** Every `generateXExplanation`
   function uses the same four-tier structure keyed to score ranges (≥0.8 / ≥0.6 /
   ≥0.4 / else), each tier returning a canned sentence referencing the player name
   and a specific stat (`BatsmanRecommendation.tsx:669-785`,
   `BowlerRecommendation.tsx:919-1014`). E.g.:
   > "Virat Kohli is in excellent form with an average of 59.0 in recent matches."
   Cheap, deterministic, and legible — good pattern for a stats-driven backend that
   isn't going to use an LLM for explanation generation. Reuse the "four
   score-bands → four sentence templates, always cite the concrete number" idea.

3. **Ranked table → click row → detail panel below.** Recommendations render as a
   sortable table (rank, name, score, confidence chip); clicking a row selects it
   and populates a detail panel with the factor breakdown and explanations
   (`BatsmanRecommendation.tsx:983-1041` + `1044-1285`). Simple, works well for
   "opposition bowler scouting" (rank bowlers by threat) and "shot advice" (rank
   shot options).

4. **Confidence chip color coding**: very high → success.main (dark green), high →
   success.light (light green), medium → warning.main (amber), low → error.light
   (light red) (`BatsmanRecommendation.tsx:837-845`). Standard traffic-light
   pattern, trivially portable to Tailwind. As noted in §3, re-derive what feeds
   this chip — don't just reuse the score-based thresholds.

5. **Free-text reasons list (not fixed factors) for fielding recommendations.**
   Unlike the batsman/bowler engines' fixed six-factor breakdown,
   `FieldingPositionOptimization.tsx`'s `generateReasons()` (lines 866-922) returns
   a variable-length array of only the reasons that actually applied ("specializes
   in fielding at Cover," "plays 25% of shots in this area," "good slip fielder for
   Bumrah's pace bowling"), each rendered with an info icon
   (`FieldingPositionOptimization.tsx:1536-1547`). This scales better than a fixed
   factor table when most factors don't apply to most player/position pairs — worth
   using this pattern (sparse, conditional reason list) for your fielding-placement
   feature instead of the fixed six-factor layout used elsewhere.

6. **Field visualization as a positioned-dot diagram, not an SVG library.**
   `FieldVisualization` (`FieldingPositionOptimization.tsx:991-1176`) renders fielders
   as absolutely-positioned circular divs inside a circular field div, using a
   hardcoded `positionCoordinates` lookup table (normalized -1..1 offsets per
   position name, lines 1006-1029) and coloring each dot by score
   (`getScoreColor`, lines 1043-1048: green ≥0.8, light green ≥0.6, amber ≥0.4,
   orange below). No charting library — just absolute positioning and a lookup
   table. Directly portable to Tailwind/React; the coordinate table itself would
   need to be redone for your 8-zone system but the rendering approach is sound
   and lightweight.

7. **Tab structure**: Dashboard / Batsman / Bowler / Fielding as top-level tabs,
   with a "Match Phase" selector (`TacticalRecommendationUI.tsx:96-102`) covering
   Pre-match planning → Powerplay → Middle → Death → Post-match analysis. If you
   ever build a single combined recommendations screen, this five-stage phase
   selector (rather than just three in-match phases) is a reasonable frame:
   pre-match and post-match are meaningfully different UI states from "live."

8. **Loading state text is task-specific, not generic.** "Analyzing match
   situation and player data...", "Analyzing batsman tendencies and optimizing
   field placement..." — small thing, but each loading spinner explains what's
   being computed rather than a bare "Loading...". Cheap to replicate.

---

## 5. Explicit do-NOT-adopt list

Scoped for professional/international cricket; do not let these influence the
local-tournament design.

- **Weather API integration.** `MatchConditions.weather/temperature/humidity/windSpeed`
  feed directly into bowler pitch-suitability scoring ("cloudy favors pace bowlers,"
  `BowlerRecommendation.tsx:778-784`). Local tournaments have no weather-API budget
  or need; drop this dimension entirely.
- **Ground-dimension database / `groundSize` enum.** Used to boost six-hitters on
  "small" grounds (`BatsmanRecommendation.tsx:552-558`) and favor pace bowlers with
  yorkers on small grounds (`BowlerRecommendation.tsx:787-789`). Requires a
  venue-dimensions database you don't have and won't build for local grounds.
- **"Ensemble model," "machine learning model trained on historical match data,"
  "reinforcement learning for strategy optimization," "continuous learning loop,"
  "automated retraining"** — all from
  `ai-tactical-recommendation-specification.md` lines 38-42, 73-77, 180-195 and
  `ai-tactical-recommendation-system-architecture.md` lines 209-212. You've
  explicitly decided against a trained model given local-tournament data volumes;
  the doc's entire "Machine Learning Infrastructure" section (spec doc lines
  180-196) is not applicable.
- **External APIs**: "Weather data services," "Pitch condition reports,"
  "Tournament data feeds" (spec doc lines 209-212). No external data integration is
  in scope.
- **"Match importance" as a scoring input** (spec doc line 30) — implies a
  tournament-stakes model (league vs. final, etc.) that doesn't exist in the
  prototype's code (never actually implemented, only mentioned in the doc) and
  isn't relevant to your four features.
- **Bowler workload/freshness/rotation and tactical-variation-vs-recent-bowlers
  logic** (`BowlerRecommendation.tsx` freshness/tactical-variation factors,
  ~30% of its total weight). This solves "who should bowl the next over," which
  is not one of your four planned features (fixed local-tournament XI, no bench
  rotation decision to support). Skip unless you later add a captaincy tool.
  Same applies to `BatsmanRecommendation.tsx`'s entire purpose (next batsman to
  send in) and its `partnershipHistory` factor (complementary-batting-style
  heuristic, `calculatePartnershipScore`, lines 647-665) — not a planned feature.
- **3D field visualizations, animated player movement predictions, ball trajectory
  visualization** (spec doc lines 224-227) — pure scope creep for a local-tournament
  app; the 2D dot-diagram pattern in §4.6 is already the right level of fidelity.
- **Win probability meter, scenario simulator, post-match "recommendation accuracy"
  analytics** (spec doc lines 125, 144-147, 151-154) — not requested features;
  would require outcome-tracking infrastructure you haven't built.
- **Venue historical scoring-pattern database** (`previousMatchScores` in
  `MatchConditions`, referenced but never actually used in any scoring function in
  any of the 5 files despite being in every mock match object) — dead weight in the
  prototype itself; doesn't need porting.
- **Hand-labeled `matchupData`/`recentForm.currentForm` categorical fields as a
  design pattern** (see §3) — do not build a data model where "form" or "matchup
  strength" are manually-entered enums. Everything must be computed from ball-level
  data with shrinkage, per your stated plan.

---

## Appendix: files and line counts reviewed

| File | Lines |
|---|---|
| `ai-system/BatsmanRecommendation.tsx` | 1,292 |
| `ai-system/BowlerRecommendation.tsx` | 1,581 |
| `ai-system/FieldingPositionOptimization.tsx` | 1,592 |
| `ai-system/PlayerMatchDataCollection.tsx` | 1,258 |
| `ai-system/TacticalRecommendationUI.tsx` | 590 |
| `documentation/ai-tactical-recommendation-specification.md` | 255 |
| `documentation/ai-tactical-recommendation-system-architecture.md` | 236 |
| **Total** | **6,804** |

All files read in full, not excerpted.
