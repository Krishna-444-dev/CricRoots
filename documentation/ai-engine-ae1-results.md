# AE-1 results — the endgame gap is a functional-form gap

**Date**: 2026-08-19 · **Design**: [`ai-engine/experiments/endgame-research-design.md`](../ai-engine/experiments/endgame-research-design.md),
preregistered with two amendments, all committed before implementation.
**Raw output**: `ai-engine/results/ae1/ae1-results.json` · byte-identical on rerun.

**Headline: Case 1/2 — H-form. World E is not justified by this finding.**

A closed-form finite-horizon calculation, estimated from training data alone with **zero learned
coefficients**, reduces the incumbent's error in the decision-relevant endgame region by **27×** and
essentially reaches the exact oracle. The 0.296 error E6 found is now **0.006**.

---

## 1. Results

**Primary endpoint** — the frozen 4,800-state sweep (balls 1–12 × wickets 0–9 × runs needed 1–40),
886 of which are competitive (0.2 < oracle_p < 0.8). Oracle MAE; no labels, no sampling noise.

| Candidate | Grid MAE (all 4,800) | **Grid MAE (competitive)** | Observed endgame MAE | Whole test MAE |
|---|---|---|---|---|
| A0 — C3 incumbent | 0.05142 | **0.18475** | 0.03001 | 0.01856 |
| A1 — + standardized margin | 0.05040 | 0.18167 | 0.02893 | 0.01807 |
| A2 — + margin + √n terms | 0.05026 | 0.17725 | 0.02629 | 0.01678 |
| A3 — A1 basis, boosted | 0.04091 | 0.11983 | 0.03168 | 0.02846 |
| A4 — Gaussian closed form | 0.01423 | 0.02767 | 0.00951 | 0.01424 |
| **A5 — empirical finite-horizon DP** | **0.00200** | **0.00681** | **0.00162** | **0.00895** |
| A5₀ — same DP, wickets ignored | 0.01242 | 0.04122 | 0.00847 | 0.04748 |
| *Oracle (floor)* | *0* | *0* | *0* | *0* |

**A5 is better than the incumbent everywhere** — competitive endgame, whole endgame, and whole test.
This is not a trade of endgame accuracy against general accuracy.

### The extrapolation probe — the direct successor to E6's headline

Absolute error against the oracle:

| State | A0 (incumbent) | A4 | **A5** |
|---|---|---|---|
| 1 over, 2 down, **8 needed** | **0.296** | 0.015 | **0.006** |
| 0.5 over, 2 down, 4 needed | 0.341 | 0.000 | 0.016 |
| 0.1 over, 2 down, 1 needed | 0.326 | 0.035 | 0.000 |

On the state that motivated this entire line of work, the incumbent says **0.887**, the oracle says
**0.591**, and A5 says **0.585**.

---

## 2. Classification against the preregistered interpretation tree

| Case | Condition | Result |
|---|---|---|
| 1 | A4 **and** A5 close the gap → H-form strongly supported | **This, primarily** |
| 2 | A4 fails, A5 closes it → H-form via discrete structure specifically | Partly — A5 clearly beats A4 |
| 3 | A1/A2 improve, A4/A5 do not → learned representation needed | **No** — and its converse is a finding, §3 |
| 4 | None improve → H-repr, World E justified | **No** |

**H-form holds.** The endgame failure was a missing functional form, not a missing representation.
**World E is not justified by this finding** and should not be built on it.

---

## 3. The result I did not predict: adding the term to a learned model does not work

This is the most useful thing in the experiment and it was not in the design's expectations.

| Approach | Competitive grid MAE |
|---|---|
| A0 — incumbent, no margin term | 0.18475 |
| **A1 — margin term added to the logistic basis** | **0.18167** |
| A2 — margin + three √n terms added | 0.17725 |
| A3 — same basis, gradient boosted | 0.11983 |
| **A4 — the same quantity used in closed form, nothing learned** | **0.02767** |

**Giving the learned model the correct feature bought 1.7%. Using the identical quantity in closed
form bought 85%.**

The mechanism is legible. The logistic must set one coefficient for the margin against eleven other
correlated terms, fitted on data where endgame states are a **tiny minority** — 161 of 2,085
validation rows sit at `overs_remaining ≤ 2`, and only 17% of those are competitive. The coefficient
is therefore chosen almost entirely by mid-innings states, where the margin is least discriminative.
The term is *present* and *inert* where it matters.

This is validity gate 4 in a form the programme has not previously recorded: not "the mechanism was
inactive", but **"the mechanism was active globally and inactive in the regime of interest"**. A
feature being in the basis is not the same as a feature being used.

---

## 4. Decomposition: which ingredient actually mattered

A5₀ was preregistered to separate discreteness from wicket dynamics. It gave a counterintuitive
answer worth stating plainly.

| Step | Competitive grid MAE | Change |
|---|---|---|
| A4 — Gaussian, **no wickets** | 0.02767 | — |
| A5₀ — exact discrete, **no wickets** | 0.04122 | **worse by 0.014** |
| A5 — exact discrete, **with wickets** | 0.00681 | better by 0.034 |

**Making the calculation exact while still ignoring wickets makes it worse.** So A4's apparent
accuracy is partly **two errors cancelling**: the Gaussian understates extreme probabilities, and
omitting wickets overstates them, and the two partially offset. Removing one error without the other
exposes the remainder.

The dominant ingredient is therefore **wicket dynamics**, not discreteness — the opposite of what the
§1 CLT derivation emphasised. The derivation correctly identified that *a finite-horizon calculation*
was missing; it pointed at the wrong component as the main one.

Confirmed independently on whole-test MAE, where A5₀ (0.04748) is far worse than A4 (0.01424):
across a full innings, ignoring wickets is a much larger error than approximating the distribution.

---

## 5. Why the amended endpoint was necessary — now demonstrable

Step 0 changed the primary endpoint after the original failed validity gate 2. The results show what
would have happened otherwise.

Applying the preregistered TOST margin for the observed endgame regime (**0.04425**) to the observed
endgame column:

| Candidate | Observed endgame MAE | Within margin? |
|---|---|---|
| A0 incumbent | 0.03001 | **yes** |
| A4 | 0.00951 | yes |
| A5 | 0.00162 | yes |

**Every candidate passes, including the incumbent that is wrong by 0.296 on the state that started
this.** The observed endgame regime cannot distinguish a 27× difference in competitive-state
accuracy. Had the endpoint not been amended, AE-1 would have reported "no candidate is
distinguishable from the oracle in the endgame" and we would have concluded the incumbent was fine.

---

## 6. The gap between grid and observed performance — a finding, not an artefact

| Candidate | Competitive grid MAE | Observed endgame MAE | Ratio |
|---|---|---|---|
| A0 incumbent | 0.18475 | 0.03001 | **6.2×** |
| A5 | 0.00681 | 0.00162 | 4.2× |

The incumbent looks six times better on observed data than on the state space, because the states
where it is badly wrong are rare: across observed endgame rows the oracle's **median** win
probability is 0.009, and only 17% are competitive.

> **A model can look accurate on average precisely because the states where it fails are rare — and
> those states can be the ones decisions turn on.**

Both numbers are reported together, per the design. Neither alone is "the" performance figure: the
grid answers *can the representation model endgame dynamics*, the observed column answers *how does
it behave on states that actually occur*.

---

## 7. Validity

| Check | Result |
|---|---|
| Grid frozen before results | Yes — declared in the design, unchanged |
| Candidate set closed before results | Yes — A0–A5, A5₀ declared in the design |
| No generator access in any candidate | Yes — A4/A5 moments estimated from training checkpoints only |
| Test labels unread during selection | Yes — no selection was performed; A0's penalty is E6's validation choice |
| Byte-identical rerun | Yes |
| Optimiser converged | Yes (Nelder–Mead, `success=True`) |

### The empirical model recovered the generator's moments without seeing it

A useful independent check that the estimation is sound. Estimated from 5,175 uncensored training
overs, versus values derived analytically from `matchSimulator.js`:

| | Estimated | True (derived) |
|---|---|---|
| P(wicket per legal ball) | 0.0418 | 0.0426 |
| Mean runs per legal ball | 1.4714 | ≈1.469 |

The estimator recovered the ball-level process from over-level aggregates to within ~2%. A5's
performance is therefore attributable to the *method*, not to a lucky fit.

### Limitation carried forward

A5's estimation pools overs across the innings, which is valid **only because this world's ball
process is homogeneous**. That assumption is a property of the world under test and would **not**
hold in a world with resource depletion or death-over bowling — i.e. in World E, this exact
estimator would be mis-specified. Recorded in the design and repeated here because it bounds where
A5 can be used.

---

## 8. Position, and what this means for World E

**The endgame problem, as identified by E6, is solved in this world by a calculation with no learned
parameters.** That is the outcome the design named as most likely, and it is the outcome that
correctly stops us building a world.

Per the design's own conditional: **World E is not justified by this finding.** If it is built later,
it must be argued from a different motivation, and this document is the reason the old motivation no
longer stands.

What survives as genuinely open, and is *not* a research question yet:

1. **§3's finding** — a correct feature can be inert in the regime that matters while active
   globally. That is a statement about fitting objectives and regime imbalance, it generalises well
   beyond cricket, and nothing here tests it properly.
2. **§4's finding** — the CLT derivation identified the right *category* of missing structure and the
   wrong *component* within it. Worth remembering the next time an analytic argument motivates an
   experiment.

**Everything above is a statement about `matchSimulator.js`.** A5's advantage depends on the ball
process being homogeneous, which real cricket's is not. Whether a finite-horizon calculation helps on
real matches is Track B, unblocked only by pilot data.

**Nothing deployed. E4, E7 and the tactical-advisor thresholds remain untouched. World E unbuilt.**
