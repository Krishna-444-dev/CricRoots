# Backlog: surface evidence provenance in the matchup recommendation

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
