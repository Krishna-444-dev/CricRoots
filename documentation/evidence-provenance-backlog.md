# Backlog: data instrumentation and evidence provenance

**Status: BACKLOG. Not to be implemented while the research programme is active** (decision D8 —
production stays frozen so Experiments 1-9 remain reproducible). Recorded now so the finding is not
lost.

**Risk: low. Value: high. Backend work required: none for the core change.**

---

## The finding

`getMatchupPlan` already computes which evidence level produced each recommendation, already sends
it to the client, and the client already declares it in its TypeScript types — and then never
renders it.

Returned per bucket (`backend/src/services/tendencyAnalytics.js:173-184`):

| Field | Meaning | Rendered today? |
|---|---|---|
| `blendedDismissalRate` | the number | yes |
| `confidence` | coarse label | yes, as a badge |
| **`basedOn`** | **which evidence level actually produced it** | **no** |
| `historicalSampleSize` | sample size at that level | no |
| `rawBallsAtFinestLevel` | balls in *this exact matchup* | no |

Consumers: `web-app/app/match/[id]/scouting/page.tsx` and
`web-app/app/match/[id]/report/[playerId]/page.tsx`.

---

## Why it matters

`confidence` is derived in `statUtils.js:19` from `individualN` — the sample size at *whichever
level actually contributed*. When the exact matchup has no balls in a bucket, `hierarchicalBlend`
skips that level and the finest contributor becomes the archetype pool, which is large.

**So a bucket can display "medium" or "high" confidence while the batter's own contribution to it
is zero.**

The research programme established that this is precisely the distinction that matters here: the
evidence supports a claim about *how vulnerable this batter is in general* (per-player effects were
the single most valuable component measured — a 25.5% oracle-MAE improvement over a global rate),
but does **not** currently support a claim about *how this batter responds to a particular line and
length* at the observation volumes CricRoots operates at. See `research/research-log.md`, the
Experiments 8-9 arc closure.

`basedOn` separates those two claims. The confidence badge does not.

---

## The change

**Phase 1 — display only, no backend work.**

Render `basedOn` and `historicalSampleSize` alongside each recommendation, and reframe the
confidence badge so it reads as *strength of the evidence at that level* rather than as *how well
we know this batter*. Roughly:

```
Recommended: full, outside off
8.4% dismissal probability
Based on:  Right-hand batters vs Right-arm Fast
Evidence:  214 deliveries at that level - 0 for this exact matchup
```

Two dimensions, kept separate, as reviewed:

- **Evidence source** — exact matchup → batter vs style → archetype vs archetype → population
- **Evidence strength** — sample size / uncertainty *at that source*

**Phase 2 — the full ladder, which DOES require backend work.**

A UI showing the estimate at every level simultaneously is *not* a display-only change.
`getMatchupPlan` currently returns **one blended value plus a label naming the dominant level** — it
does not return the per-level rates. The `levels` array is built at
`tendencyAnalytics.js:162-170` and discarded after blending. Exposing the ladder means returning
those four `{value, n, label}` entries per bucket, which is a small API change but is a change, and
would need its own review.

Phase 1 delivers most of the honesty benefit with zero backend risk. Phase 2 is optional.

---

## The principle worth carrying beyond this feature

> **An estimate should carry its epistemic provenance, not merely its numerical value.**

A generic confidence score answers "how sure are you?". Provenance answers "why are you entitled to
think that?" — a different and more useful question, and one most predictive products cannot answer
at all.

The four lines of the Phase 1 output each carry a distinct piece of that:

| Line | What it is |
|---|---|
| 8.4% dismissal | the estimate |
| Right-hand batters vs Right-arm Fast | where the estimate came from |
| 214 deliveries at that level | how much evidence supports it |
| 0 for this exact matchup | **what the system does not know** |

The fourth line is the one a confidence badge structurally cannot express.

---

## What this does not do

It does not change the algorithm, does not improve **model accuracy**, and does not resolve any
open research question.

What it improves is **claim accuracy** — the product stops implying an estimate is batter-specific
when its evidence is population-level. Those are different things, and only the second is being
claimed here. It uses information the system was already producing and discarding at the last step.


---

# Priority order when production unfreezes

Derived from the research programme, ordered by *what cannot be fixed later*.

## 1. Capture per-ball match state — unbackfillable

`Match.js` stores `line`, `length`, `shotType`, `shotZone`, `fielderId`, `fielderPosition` per ball.
It does **not** store score, wickets, or phase at the moment of the ball — only innings totals.
Those could in principle be reconstructed by replaying an innings, but only for complete
uninterrupted innings, and fragilely.

**This is first because it is the only item on the list that cannot be done retroactively.** Any
future question of the form "does this batter respond differently under pressure" needs it, and
every match played without it is permanently lost to that question.

## 1b. Record WHO chose Man of the Match — unbackfillable, and newly urgent

**Added 2026-08-25, after D21 identified this field as a research asset.**

`matchController.js:271-300` accepts a human-supplied `manOfTheMatch` and falls back to
`computeMatchMVP(match)` only when none is supplied. So an organiser overriding the algorithm is
already possible today.

**`Match.js:208-211` stores only a `Player` ref.** Nothing records whether that player was chosen by
a human or computed. Once saved, the two are indistinguishable.

This is D20 applied to a new case, and the consequence is specific: the moment real matches are
scored, **every human override is recorded as if the algorithm had produced it**, and every human
*agreement* — which is the denominator any disagreement rate needs — is lost the same way. The asset
D21 names as the most promising future research opening would be destroyed at the point of capture.

**It cannot be reconstructed.** There is no derivable signal distinguishing "the organiser picked
this player" from "`computeMatchMVP` picked this player", because in the agreement case they are the
same player and in the override case the algorithmic pick was never stored.

**The change is small and belongs with item 1**, before the first real match:

```
manOfTheMatch          Player ref   (unchanged)
manOfTheMatchSource    'human' | 'computed'
manOfTheMatchComputed  Player ref   — what the algorithm would have said, ALWAYS stored
```

Storing the algorithmic pick unconditionally is the part that matters. Without it, an override tells
you a human disagreed but not *with what*, and agreement is unrecoverable.

**Lower priority, same family**: `Prediction` has a unique index on `(user, match)` and re-predicting
before lock **updates the existing document** (`predictionSchema.index`, and
`predictionController.submitPrediction`). A user changing their mind overwrites the earlier forecast,
so prediction revision — a genuine signal about human confidence — is not observable. Worth fixing
if the human-forecast asset is ever used, not worth blocking the pilot for.

---

## 2. Instrument tagging completeness — including per-player distribution

`line` and `length` both `default: 'unknown'`, so a ball saves cleanly with no tag. Completeness is
therefore a property of scorer behaviour under live time pressure, and **nothing currently measures
it**.

Track, per match and per session:

```
both tagged | line missing | length missing | both missing | explicitly 'unknown'
```

**And per player, not only globally** — a platform can show 95% completeness overall while a
specific batter sits at 20%, and that batter is unusable for anything beyond a scalar estimate.

**The per-player metrics are already specified.** Experiment 9's proxies P1 (count of distinct
line/length cells faced) and P2 (Shannon entropy of the ball distribution across the 42 cells) were
designed to predict representation usefulness — a prediction task that M1 showed is untestable at
current scale. But as *descriptive statistics about data completeness* they need no research
validation at all, and they answer exactly the question this item asks: 81 balls concentrated in
three contexts is a different dataset from 81 spread across thirty.

See `research/experiment-9-design.md` §3 for the definitions.

### Eligible-ball definition — a DATA CONTRACT, to be frozen before collection starts

Not a research decision. If the denominator drifts, "92% complete this season" and "92% next
season" are not comparable, and the metric silently stops meaning anything.

Keep two denominators, and store the raw flags so either can be recomputed:

- **All recorded deliveries** — never filtered, the audit trail
- **Research-eligible deliveries** — the metric's denominator, defined per `extraType`

Proposed dispositions, with reasons, to be argued with before freezing:

| `extraType` | Bowled? | Faced by batter? | Line/length meaningful? |
|---|---|---|---|
| `none` | yes | yes | yes — clearly eligible |
| `no-ball` | yes | yes | yes — eligible |
| `bye` | yes | yes (missed it) | yes — eligible |
| `leg-bye` | yes | yes (hit the body) | yes — eligible |
| `wide` | yes | **arguably not** | **depends on the question** |
| `penalty` | **no delivery occurred** | no | no — clearly excluded |

**The complication worth surfacing now**: `wide` splits by question, not by data. A wide *has* a
line and length — that is generally why it was called — so for a **bowler-tendency** question it is
a legitimate observation. For a **batter-response** question it is not: the batter did not play it.

So a single global eligibility rule cannot serve both. **This argues for storing raw `isExtra` /
`extraType` and computing the denominator per question, rather than baking one definition into the
stored metric.** A defined *family* of completeness figures, each with its rule stated, rather than
one number whose meaning depends on a choice nobody records.

## 3. Surface evidence provenance — the change described above

Smallest change, no new data required, addresses the overclaim directly.

## 4. Only then, improve the intelligence

The research programme has not produced a method that beats the deployed one *at current evidence
volumes* — and has produced measurements suggesting the richer methods need substantially more data
per player than currently exists.

---

**The through-line**: capture → measure data quality → expose provenance → then improve the model.
Reversing that order builds intelligence on an instrument nobody has verified is working.
