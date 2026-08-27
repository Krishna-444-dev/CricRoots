# Design: voice-assisted delivery tagging

**Date**: 2026-08-26 · **Status**: DESIGN ONLY. Nothing implemented.
**Origin**: "it's really hard for the scorer to enter all details related to shot and ball" —
a proposal for voice-enabled scoring.

**Position: the idea is well-aimed, at half the input. Build it for tagging, never for runs. And
measure the problem on one real match before building anything — including a cheaper fix that may
remove most of the burden without any voice at all.**

---

## 1. The burden, measured

Per delivery, the scorer faces:

| Field | Required? | Options |
|---|---|---|
| runs | yes | 0–6 |
| wicket type | if out | 7 |
| extra type | if extra | 5 |
| **line** | optional, defaults `unknown` | 6 |
| **length** | optional, defaults `unknown` | 7 |
| **shotType** | optional, defaults `null` | 10 |
| **shotZone** | optional, defaults `null` | 8 |

**3,360 combinations** across the optional four, every ball, ~240 balls a match, in the ~25 seconds
between deliveries. That is the part that is hard. Runs are one tap.

---

## 2. Split the input by ERROR COST — this is the whole design

| | Runs / wickets / extras | line / length / shot / zone |
|---|---|---|
| Role | the authoritative scorecard | optional analytical tagging |
| Current input | one or two taps | 3,360 combinations |
| Cost of a wrong value | **corrupts the match total; unrecoverable** | one mis-tagged ball in 240 |
| Cost of no value | scorecard is wrong | field is `unknown` — today's normal |

Voice is a **bad** fit for the left column and a **good** fit for the right, for the same reason.
A misheard "four" for "one" silently breaks the innings total, the result, the MVP calculation and
the tournament standings — and the scorer will not notice, because they said the right thing. A
misheard shot zone costs one ball out of 240 in a field the matchup engine already shrinks toward a
prior.

**Runs stay on taps. Tagging goes to voice.** Failure degrades to `unknown`, which is exactly
today's behaviour, so the worst case is no worse than now.

---

## 3. Before building anything: two cheaper interventions

### 3a. One of the four fields feeds nothing analytical

A consumer audit of every optional tag:

| Field | Options | What actually reads it |
|---|---|---|
| `line` | 6 | matchup engine — `getLineLengthBreakdown`, `hierarchicalBlend`, scouting, bowling plans |
| `length` | 7 | the same; these two are the core input to the entire tendency system |
| `shotZone` | 8 | the wagon wheel on the player profile (`tendencyAnalytics.getZoneBreakdown`) |
| **`shotType`** | **10** | **`commentaryGenerator` only — auto-generated prose. No analytical consumer.** |
| `fielderPosition` | 11 | dismissal text |

**Dropping `shotType` from the scorer's flow takes the combinations from 3,360 to 336 — a 90%
reduction — and costs one adjective in a generated sentence.** No stat, no chart, no model reads it.

That is the single cheapest change available and it needs no new technology. It should be evaluated
*before* voice, not after, because it changes how much burden is even left to solve.

### 3b. Nobody has measured the burden on a real scorer

All 9,364 balls in the database are `matchSimulator` output, and the simulator always tags. The
100% tagging rate is an artefact, not evidence. **Zero human-scored deliveries exist.**

So today we can measure neither the problem nor a solution. Tagging-completeness instrumentation is
already item 2 in `evidence-provenance-backlog.md`; one real match answers it.

---

## 4. Architecture, if it is built

```
  scorer speaks  ->  on-device STT  ->  transcript  ->  parse  ->  prefilled tags  ->  one tap to confirm
                     (Whisper)                          (LLM)         (never auto-committed)
```

**On-device Whisper, not cloud.** Whisper (OpenAI, MIT-licensed) is meaningfully more robust to
background noise than classical STT, and `whisper.cpp` runs it locally. That matters more here than
accuracy alone: `pilot-deployment-plan.md` step 7 is explicitly *"cellular data with Wi-Fi off"*,
and grounds have poor signal. A cloud round-trip per ball fails exactly where it is needed.

**A note on naming, because it changes the plan.** *Wispr Flow* (wisprflow.ai) is a commercial,
closed-source dictation product with no embeddable mobile SDK. *Whisper* is the open-source model.
They are different things and only the second is buildable on.

**Parsing is the easy half.** Cricket shorthand is formulaic — *"good length outside off, driven to
cover"* — and the vocabulary is a closed set of 6 + 7 + 8 enum values. `assistantService.js` already
wires `@anthropic-ai/sdk` with Haiku, so transcript → structured tags is a prompt containing the
enum lists, not new infrastructure. A plain grammar/keyword matcher is a viable fallback and worth
trying first, since the vocabulary is fixed.

**Never auto-commit.** The transcript prefills the tag chips; the scorer confirms with the tap they
already make. This keeps the human in the loop on every ball and means a bad transcription costs a
correction, not a wrong record.

---

## 5. What it costs

**It ends Expo Go for the pilot.** On-device speech is a native module. `pilot-deployment-plan.md`
assumes Expo Go throughout, and step 7's acceptance test runs there. Voice means a development
build, app-store-style distribution for testers, and a heavier release loop. **This is the single
largest consequence and it lands on the launch plan, not the code.**

Also: model weights add to app size, and inference costs battery on a phone already running a
scoring session for three hours.

---

## 6. Preregistered decision criteria

Fixed now, so the decision is not made by whoever is most enthusiastic after the first demo.
Evaluated on **the first three real matches**, with tagging-completeness instrumentation in place.

| Measurement | Conclusion |
|---|---|
| Tagging completeness **≥ 70%** on line/length | **Do not build.** Taps are working; voice solves a problem that is not there. |
| **30–70%** | **Try 3a first** — drop `shotType`, re-measure. Build voice only if completeness stays below 70% with the reduced field set. |
| **< 30%** | The burden is real. Build the spike, targeting whichever fields the data shows being dropped. |
| Completeness varies wildly **per scorer** | The problem is training or UI, not input modality. Voice will not fix it. |

**Additional gate**: if `line`/`length` are tagged but `shotZone` is not, delete `shotZone` from
the flow rather than building voice for it — one wagon wheel is not worth a native-module
dependency and the loss of Expo Go.

---

## 7. What this cannot do, stated plainly

**Voice tagging cannot make the context-dependent research question answerable.** The programme
established that a line/length-conditioned representation is worth activating only above ~325
balls/batter, and CricRoots operates at ~81. Perfect tagging raises effective volume to 81, not
above 325. Only more matches do that.

So the justification for this work is **product** — the scorer's job becomes feasible — and not
research. It ensures that when volume does arrive the data is usable. It does not accelerate the
arrival.

Anyone proposing this as an AI/research win should be shown this paragraph.

---

## 8. What could kill it

- Ground noise and wind degrade STT below usable accuracy. **Untested, and the dominant risk.**
- Latency exceeds the gap between deliveries. Needs measuring on a real phone, not assumed.
- Scorers dislike speaking aloud while scoring — a social constraint, not a technical one, and
  entirely plausible in a small club setting.
- The dev-build requirement makes pilot distribution too heavy to be worth it.

---

## 9. Recommendation

1. **Now**: instrument tagging completeness (backlog item 2), per scorer and per field.
2. **After one real match**: read the numbers against §6.
3. **If 30–70%**: drop `shotType`, re-measure. This is 90% of the combinatorial burden for the cost
   of one adjective.
4. **Only if still below 70%**: build the spike, on-device Whisper, tagging only, prefill-and-confirm.

**Undo is a prerequisite either way** and now exists (`feature/undo-ball`). Voice raises the error
rate by design; a scoring surface with no undo cannot absorb that.
