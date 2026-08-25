# Research design: endgame state representation

> **STATUS AS OF 2026-08-19: ARCHIVED — CONTINGENT, NOT ACTIVE.**
>
> **AE-1 ran and returned H-form.** The endgame error was a missing functional form, not a missing
> learned representation. Per this document's own §8 conditional, **World E (§3) and AE-2 (§4) are
> not justified by that finding and are not being built.** See
> [`documentation/ai-engine-ae1-results.md`](../../documentation/ai-engine-ae1-results.md).
>
> The World E design is kept intact rather than deleted because its *method* — the E-N control that
> preserves the confound, the O1/O2 oracle decomposition, the anti-rigging spec — is reusable and was
> reviewed. If a future finding motivates a richer world, **that motivation must be argued fresh**;
> this document's §1 motivation no longer stands.
>
> §2 (AE-1) is complete. Everything below §2 is contingent and dormant.

**Status: DESIGN ONLY. No code, no world, no model.** Written 2026-08-19 in response to E6's
endgame finding.

**Naming**: the AI-engine *research* experiments proposed here are **AE-1** and **AE-2**, kept
distinct from the remediation plan's engineering items E0–E7 and from the matchup programme's
Experiments 1–9.

---

## 0. Summary of the proposal, and the one place it departs from the brief

The brief was: design World E, with positive and negative controls, an exact oracle, and the
baselines to test.

That design is in §3–§6. **But §2 proposes a cheaper experiment first**, because working through
*why* C3 fails in the last over produced a specific, analytic answer — and if that answer is right,
World E would be built to test a question that a two-term change to the feature basis already
answers.

The brief's own strongest constraint is the reason:

> **World E must not be created merely so an endgame-aware algorithm wins.**

The most likely way that happens is not rigged parameters. It is building World E while the
incumbent baseline is still missing a term that anyone competent would add — so the new
representation wins against a straw opponent. **AE-1 removes that risk for the price of one
afternoon.**

---

## 1. The diagnosis, sharpened

E6 measured the failure. It did not explain it. The explanation is available analytically, and it
matters because it determines what World E is for.

### The state

8 runs needed, 6 balls, 8 wickets in hand. Oracle **0.591**, C3 **0.887**.

### Why 0.591 is right

Under the simulator's kernel, expected runs per legal ball ≈ **1.37**, so ≈ 8.2 runs are expected
from six balls. The side needs 8. The *mean* says this is comfortable. The *variance* of six draws
from a distribution with mass at {0, 1, 2, 3, 4, 6} does not.

### Why C3 cannot express it

For a required total *R* over *n* balls with per-ball mean μ and standard deviation σ:

```
P(win)  ≈  Φ( (n·μ − R) / (σ·√n) )
```

The numerator grows **linearly** in n; the denominator grows as **√n**. So for a fixed required
*rate* (R/n constant), win probability rises with n like **√n** — and → 1.

C3's basis is built on required run rate `R/(n/6)`, plus `rrr × overs_left`, `overs_left²`,
`log1p(rrr)`. Every term is a polynomial or log in *rate* and *overs*. **None of them is the
standardized margin `(n·μ − R)/√n`**, and no linear combination of them reproduces a √n law across
the full range of n. The model therefore reads "required rate 8" as the same situation at 6 balls
as at 60, when it is not.

This is not a capacity problem. C5 (gradient boosting, unconstrained to be linear) scored **worse**
than C3. It is a **parameterisation** problem — precisely the lesson E6 already recorded from C1 vs
C2, where the same model class moved from Brier 0.1286 to 0.1149 purely on how the features were
written.

### What follows

There are two distinct hypotheses hiding inside "the endgame needs a different representation":

| | Claim | Implication |
|---|---|---|
| **H-form** | The gap is a **functional-form** gap. The right analytic terms close it. | No new world needed. No new algorithm needed. |
| **H-repr** | The gap is a **representation** gap. Even with the right analytic terms, something about terminal dynamics is not expressible in closed form. | A research question, and World E is the environment for it. |

**E6 cannot distinguish these**, because no candidate in its closed set contained a margin term.
AE-1 does distinguish them, and it is a precondition for World E being meaningful.

---

## 2. AE-1 — the gate: functional form, or representation?

**Question**: does adding analytically-motivated endgame terms to the existing basis close the
endgame gap in the *current* world?

**Why it comes first**: if H-form holds, then "the endgame needs a learned representation" is false
in this world, and World E must be justified by something else — which is a much healthier place to
start designing from than a false premise.

### Design

Same data, same fixed split, same oracle, same protocol as E6. Test set read once. Closed candidate
set:

| | Candidate | Purpose |
|---|---|---|
| A0 | C3 exactly as E6 selected it | The incumbent. Not refit, not re-tuned. |
| A1 | C3's basis **+** standardized margin `(n·μ̂ − R)/(σ̂·√n)` | Direct test of the §1 derivation |
| A2 | C3's basis **+** the margin **+** `√n`, `R/√n`, `1/√n` | Tests whether the specific z-score matters or merely √n-scaled terms |
| A3 | A1's basis, gradient boosted | Separates "wrong terms" from "wrong function class" |
| A4 | Gaussian closed form: `Φ((n·μ̂ − R)/(σ̂·√n))`, moments from **training only**, no fitting | The analytic answer with zero learned parameters |
| **A5** | **Exact finite-horizon DP over the empirical outcome distribution, estimated from training only** | **Added by review.** See below — without it, A4's failure would be misread. |
| A5₀ | A5 with the wicket dimension removed (never all out) | Decomposition aid, declared here so it is preregistered rather than added later |
| — | Exact oracle | Floor |

μ̂ and σ̂ are estimated from the training split. They are **not** read from the generator — that
would make A4 an oracle rather than a baseline.

### Why A5 is necessary — the amendment

**A Gaussian approximation is itself unreliable in exactly the regime under investigation.** Six
draws from a lumpy discrete distribution with mass on {0, 1, 2, 3, 4, 6} is not a regime where the
CLT is trustworthy. So the inference "A4 did not close the gap, therefore H-form is insufficient"
would be **unsound**: A4 might fail purely as an approximation, while the underlying missing idea —
the finite-horizon discrete outcome distribution — is exactly right.

A5 removes that ambiguity by computing the finite-horizon probability **exactly**, using only an
empirical outcome distribution estimated from training data. No learned coefficients, no generator
access, no test information. This yields a ladder where it is possible to see *where* the error
disappears:

```
rate basis  →  analytic margin (A4)  →  exact empirical finite-horizon (A5)  →  true oracle
```

### Interpretation, fixed in advance

| Case | Pattern | Conclusion |
|---|---|---|
| 1 | A4 **and** A5 close the endgame gap | **H-form**, strongly supported |
| 2 | A4 fails, **A5 closes it** | **H-form still**, but the missing piece is *discrete finite-horizon structure*, not the standardized-margin approximation. A better finding than case 1. |
| 3 | A1/A2 improve substantially, A4/A5 do not | The representation may need to be **learned** rather than derived from the marginal distribution |
| 4 | None improve | **H-repr** becomes credible, and World E earns its place |

### How A5 is estimated, and the one honest limitation

`real_matches.csv` contains over-boundary checkpoints, not ball-by-ball outcomes. The empirical
outcome distribution is therefore estimated at **over granularity**, as the joint distribution of
(runs conceded, wickets lost) in a complete over, taken from differences between consecutive
training checkpoints.

Three points, each of which affects what A5 can claim:

1. **Over granularity is the data's native granularity, not a compromise.** Every training row sits
   at an integer `overs_remaining`; the model has never seen a fractional over. And at the headline
   failing state — 1 over remaining — the DP is a *single* transition, `P(runs in one over ≥ R)`,
   with no granularity loss whatsoever. A5 is therefore exact precisely where E6 found the 0.296
   error.
2. **Censoring must be handled or the distribution is biased.** Overs in which the target was
   reached are truncated and never appear as complete overs. The estimate is therefore taken only
   from overs that *cannot* terminate: those starting with `runs_needed > 36` (unreachable in one
   over) and `wickets_down ≤ 6`. This is valid **because this world's ball process is i.i.d., so the
   over distribution is homogeneous** — an assumption that is a property of the world under test and
   that would **not** hold in World E. Recorded as a limitation of the method, not a defect of the
   experiment.
3. **A4 and A5 differ in two respects at once** — discreteness *and* wicket dynamics (A4 ignores
   wickets entirely). A5₀ isolates them: A4 → A5₀ is the pure discreteness effect, A5₀ → A5 is the
   wicket effect.

### Primary endpoint — AMENDED after step 0 failed validity gate 2

**The originally proposed endpoint does not work, and the reason is worth recording.**

The design first specified *oracle MAE restricted to observed states with `overs_remaining ≤ 2`*.
Step 0 measured whether that endpoint can resolve anything, before any candidate was fitted:

| | Value |
|---|---|
| Observed endgame rows (validation) | **161**, across 88 matches |
| C3's oracle MAE in that regime | **0.0377** |
| Detection floor there (degrade-the-oracle calibration) | **0.0443** |

**The error to be improved is smaller than the smallest difference the regime can detect.** Running
AE-1 on that endpoint would have returned "no candidate is distinguishable from the oracle in the
endgame" *regardless of the truth* — the exact M1 failure this programme has hit three times before.

**Why the regime is so weak**: real endgame states are overwhelmingly already decided. Over those
161 rows the oracle's median win probability is **0.009**, and only **28 rows (17%)** are genuinely
competitive (`0.2 < p < 0.8`). E6's headline probe — 8 needed off 6 balls — lives in that thin
slice. Averaging over observed endgame states therefore drowns the failure in states where every
method is trivially right.

### The amendment, and why it is sound

**Oracle MAE requires no labels.** It compares a prediction against exact ground truth, so it carries
**no label sampling noise at all** and is not bound by a holdout's size. It can be evaluated on any
set of states we choose. Only the *Brier* comparison needs observed outcomes, and only it is limited
by the 161 rows.

| | Endpoint | Resolution |
|---|---|---|
| **Primary** | Oracle MAE over an **exhaustive endgame sweep**: balls ∈ 1–12 × wickets ∈ 0–9 × runs needed ∈ 1–40 = **4,800 states** | Deterministic. No label noise. |
| **Primary-competitive** | The same sweep restricted to `0.2 < oracle_p < 0.8` — where the E6 finding lives and where a captain's decision actually turns | Deterministic |
| **Secondary** | Observed-endgame Brier and oracle MAE, deployment-weighted | Coarse: floor 0.0443, stated whenever quoted |
| **Tertiary** | Whole-test metrics from E6 | So a fix that helps the endgame and hurts elsewhere is visible |
| — | Extrapolation probe table from E6 §9a, rerun per candidate | Direct successor to the 0.296 headline |

TOST with the step-0 margin applies to the **secondary** endpoint, which is label-dependent.
The primary needs no hypothesis test: on the sweep the oracle's MAE is 0 by construction, so a
candidate's distance from optimal is read directly.

### The one thing this amendment must not be allowed to hide

**The sweep is not the deployment distribution.** Uniform coverage of the endgame state space
deliberately over-weights competitive states relative to how often they occur.

Both numbers are therefore reported side by side, and **the gap between them is itself a finding**:
a model can look accurate on observed endgame data precisely because the states where it is badly
wrong are rare. That is a statement about what average metrics conceal, not a licence to quote
whichever number flatters a candidate.

### Preregistered outcomes

| Outcome | Condition | What it means |
|---|---|---|
| **F — form** | A1/A2/A4 reduce endgame oracle MAE to within the equivalence margin of the oracle | **H-form holds.** The endgame gap was a missing term. World E is not justified by this finding, and any World E proposal must be re-argued from a different motivation. |
| **P — partial** | Endgame MAE improves materially but remains outside the margin | Both mechanisms are present. World E is justified, **and** the AE-2 baseline must include the AE-1 winner. |
| **R — representation** | Analytic terms do not materially improve the endgame | **H-repr holds.** The strongest possible motivation for World E. |

**Equivalence is tested by TOST with a predefined margin, not by "the CI includes zero."** E6 showed
why: C4 met a CI-includes-zero criterion with an oracle MAE four times the winner's, purely through
imprecision. Margin to be fixed in AE-1's own preregistration, by the same
degrade-the-oracle-with-known-noise calibration E6 used.

### Honest prior — and its exact epistemic status

I expect **F or P**, not R.

Stated precisely, per review: **the analytic derivation motivates an expectation of F/P; it does not
constitute evidence that any candidate will close the empirical gap.** The derivation says what kind
of term is missing from the basis. Whether adding it closes a measured 0.296 error on held-out data
is a separate question, and it is the one the experiment answers.

Recorded here so the expectation is on the record before the run, as with E6's A′ prediction — and
so that if the result is R, it is visible that it contradicted the prior rather than confirmed it.

**If F, this is a good outcome, not a wasted experiment.** It converts a 30-point production error
into a two-term fix and correctly stops us building a world.

---

## 3. World E — design, contingent on AE-1 returning P or R

### 3.1 The requirement that shapes everything: the oracle must stay exact

The programme's strongest instrument is the exact oracle. A Monte Carlo oracle would blur precisely
the per-state differences this research question is about — E6's whole finding lives at a resolution
of ~0.01, and MC standard error at that resolution needs impractical sample counts per state.

**Therefore World E is constrained so that the dynamic program remains exact.** This is achievable
and is a design requirement, not an aspiration:

- The transition kernel becomes **state-dependent** — that is the entire point.
- But the **sufficient state stays `(balls remaining, wickets down, runs needed)`**, conditional on
  match-level latents drawn once per match.
- This holds if batting ability is a function of **batting position** (and position is determined by
  wickets down), and bowler identity is a **deterministic function of over number**.

Under those constraints the DP is unchanged in structure — only the per-state kernel varies — and it
stays exactly solvable at the same cost.

**What this excludes, and why that is correct**: any mechanism whose state includes history —
strategy adaptation based on inferred opponent state, batter "settling in" as a function of balls
faced, momentum. Those are interesting and are **explicitly deferred**. Adding them turns the oracle
into a control problem and the environment stops being able to answer the question cleanly. §7
records what it would take.

### 3.2 What World E adds, and why each element earns its place

Every element must be justified by *what question it makes answerable*, not by realism for its own
sake. Realism that no experiment interrogates is decoration.

| Element | Concretely | Why it is needed |
|---|---|---|
| **Batting resources** | Per-position ability multiplier on scoring and on dismissal probability; a real tail (positions 8–11 markedly worse) | **The core mechanism.** Makes a wicket's cost depend on *who comes next*, which depends on wickets down — a state-dependent terminal effect no rate feature can carry. |
| **Bowling resources** | Per-bowler ability; over quotas; the best bowlers deterministically allocated to death overs | Makes the endgame kernel *differ* from the mid-innings kernel — a second, independent terminal effect. |
| **Team strength** | One latent per team, drawn per match, shifting both processes | Creates variation the model must infer from the innings so far; the D+ pattern where the oracle knows the latent and the model does not. |
| **State-dependent scoring** | Aggression as a deterministic function of `(balls remaining, runs needed)`: higher risk when behind late | Creates the genuine terminal dynamic — the same required rate implies different behaviour, hence different variance, at 6 balls vs 60. |
| **State-dependent wicket probability** | Rises with aggression | Couples the two above; makes the risk/reward tradeoff real rather than cosmetic. |

**Deliberately excluded from v1**: per-player identity beyond position, ball-by-ball momentum,
weather/pitch evolution, and any history-dependent adaptation. Each breaks §3.1's oracle guarantee.

### 3.3 The two worlds

Following the D+/D− pattern exactly.

**World E-A (positive)** — all of §3.2. Endgame structure genuinely carries information: resource
depletion and death-over bowling change the terminal kernel in a way that is not a function of
required rate alone.

**World E-N (negative control)** — the hard part, and the place a lazy design fails.

The naive negative control is "no team strength, no resources". That is wrong, because it does not
control for the confound that actually threatens the conclusion.

**The confound**: the √n variance effect from §1 exists in *every* world, including the current one.
An endgame-aware representation will beat a rate-based one in **any** environment for that reason
alone. If E-N lacks that effect, E-N proves nothing.

**So E-N must retain everything except the mechanism under test:**

| | E-A | E-N |
|---|---|---|
| Finite-sample variance effect (√n) | present | **present** |
| Team-strength latent | present | **present** |
| Marginal run/wicket distributions | matched | **matched to E-A** |
| **Resource depletion (tail) and death-over bowling** | **present** | **absent** — ability constant across positions and overs |

E-N therefore has identical aggregate statistics and identical variance structure, differing **only**
in whether the terminal kernel depends on resource state. A method that wins in E-N is winning on the
variance effect, which AE-1's baseline already captures — and its E-N margin is the amount that must
be subtracted from its E-A result before any claim is made.

**Preregistered falsifier**: if the proposed representation improves on the AE-1 baseline in **E-N**
by an amount statistically indistinguishable from its improvement in **E-A**, the mechanism claim is
refuted regardless of how good the E-A number looks in isolation.

### 3.4 Calibrating the effect size honestly

The failure mode here is choosing an effect size that the proposed method can detect. Guard:

1. Effect size is fixed from **cricket-plausible** values (a real tail is roughly 40–60% of a top
   order's scoring rate), **not** from what any model can resolve.
2. The **ground-truth variance decomposition of World E is measured and committed before any model
   is fitted** — the same instrument used on World A. It must report what fraction of outcome
   variance the resource mechanism actually contributes. If that fraction is below the holdout's
   detection floor, the experiment is **not runnable** and must be redesigned or abandoned; it must
   not proceed and report a null.
3. World E parameters are **frozen and committed** before any model is fitted, and may not be
   adjusted afterwards. A second world with different parameters is a new world with a new name, not
   a revision.

---

## 4. AE-2 — the World E experiment

**Question**: does a representation that models terminal resource state beat one that does not, in a
world where terminal resource state genuinely matters — by more than it does in a world where it
does not?

### Baselines, per the brief

| | Baseline | Why it must be in the set |
|---|---|---|
| B0 | Constant base rate | Floor reference |
| B1 | C2 chase terms | E6's interpretable baseline; continuity with the record |
| B2 | **C3 as E6 selected it** | The current incumbent |
| B3 | **The AE-1 winner** | **Non-negotiable.** Without it the comparison is against a baseline we already know is missing a term, and any win is uninterpretable. |
| B4 | B3 + wickets-in-hand interactions, no learned representation | Distinguishes "resource state matters" from "a *learned* representation of it is needed" |
| B5 | The proposed endgame-aware representation | The candidate |
| O1 | **Exact oracle, full information** | The floor |
| O2 | **Exact oracle restricted to observable state** — knows the kernel but not the team-strength latent | See below |

**O2 is the instrument that makes AE-2 interpretable.** The gap `O1 − O2` is information that is in
principle unrecoverable from what a model can observe. Without it, a shortfall against O1 cannot be
separated into "the representation is inadequate" and "the information is not there" — which is
exactly the confusion D19 exists to prevent, and exactly what Experiment 4A resolved for the matchup
programme via oracle comparison.

### Endpoints

Primary: **endgame-regime oracle MAE against O2**, in E-A and in E-N, with the difference-in-differences
as the mechanism estimate. Secondary: the full two-axis panel from E6 §5 — whole-test predictive
metrics plus perturbation sensitivity, calibration by regime, extrapolation probe.

### Validity gates, in order

1. **World E contains the structure** — variance decomposition committed before fitting (§3.4.2).
2. **Target measurable at this volume** — detection floor calibrated by the degrade-the-oracle
   procedure, before any candidate is fitted.
3. **Oracle verified** — DP against Monte Carlo on the E-A and E-N kernels, as `oracle.test.js`
   already does for the current world.
4. **Mechanism active** — report the magnitude of the fitted endgame component, not only its
   accuracy. Experiment 8 of the matchup programme recorded what happens otherwise.
5. **Equivalence via TOST**, never CI-includes-zero.

---

## 5. What would make this research illegitimate

Written down in advance so it can be checked against later.

1. **Tuning World E after seeing which representation wins.** Parameters frozen and committed first.
2. **Omitting E-N**, or building an E-N that lacks the √n variance effect.
3. **Comparing against a baseline that predates AE-1.** The single largest risk, and the reason AE-1
   is a gate rather than an option.
4. **Reporting the E-A gain without subtracting the E-N gain.**
5. **Proceeding when the variance decomposition says the mechanism is below the detection floor.**
6. **Claiming any of this is about cricket.** Every result is conditional on a generator we wrote.
   Real-data validation stays Track B, blocked on pilot adoption.

---

## 6. Protocol additions this work implies

Two candidate rules, recorded for your call rather than applied unilaterally:

**A seventh validity gate — deployment parity.** Proposed after Part 1: a feature transformed during
training must share the serving implementation or be asserted equal to it automatically. The `3.4`
defect survived a correct written warning; an assertion found a second, unrelated defect on its first
run.

**An addition to D19 — non-significance is not equivalence.** A claim that two methods perform
equivalently requires an equivalence test with a predefined margin. "The confidence interval includes
zero" is a failure to detect a difference, and is satisfied by any sufficiently imprecise estimate.
C4 in E6 is the worked example.

---

## 7. Deferred, with what each would cost

**Strategy adaptation** — the batting side changing behaviour based on inferred opponent strength or
on its own trajectory. This makes the process history-dependent, so the sufficient state grows and the
exact DP is lost. It would need either an augmented state small enough to remain tractable, or a
Monte Carlo oracle with an error budget explicitly compared against the effect sizes of interest.
Genuinely interesting; not v1.

**Per-player identity** — abilities attached to individuals rather than positions. Reintroduces the
matchup programme's evidence-sparsity problem at match level, and that programme already measured
where that becomes unanswerable (~325+ balls/batter). Worth doing only after the position-level
question is settled.

**First-innings win probability** — a separate target with its own extraction, still unmodelled and
still the reason `available: false` ships today. Unchanged by anything here.

---

## 8. Recommendation

**Run AE-1 first.** It is small, it is decisive, and it protects the brief's own strongest
constraint. It has three preregistered outcomes and two of them are useful:

- **F** — the endgame gap was a missing analytic term. A two-term fix to a 30-point production error,
  and we correctly do not build a world.
- **P** or **R** — World E is justified by a measured residual that survives the obvious fix, and
  AE-2 starts from a baseline nobody can call a straw man.

**Do not build World E until AE-1 reports.** On the honest prior in §2, F or P is more likely than R,
and in the F case World E as motivated by this finding should not be built at all.

**Nothing in this document is implemented. Production remains frozen. E4, E7 and the tactical-advisor
thresholds remain untouched.**
