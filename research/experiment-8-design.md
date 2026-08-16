# Experiment 8 design - H12, low-rank joint estimation under sparsity

**Status: APPROVED WITH MODIFICATIONS. Design below incorporates all review points.**

Tests the last mechanism left standing after World D's gates: can a regularized factor model
extract the latent signal that J2a proved exists and J2b proved neighbourhood pooling cannot reach?

---

## 1. The circularity problem, and why it makes the conclusions asymmetric

**This must be settled before anything else, because it determines what the experiment can claim.**

World D+ generates `z_b · φ_{line,len}`. A low-rank model fits `u_b · v_{line,len}`. **Same
functional form.** A win would demonstrate only that factorisation recovers factorisation-generated
data — a tautology dressed as a result.

Three responses, and the third is the important one:

**(a) The model is not handed the answer.** `K` is *not* given. It is selected by cross-validation
over a fixed grid using training data only, exactly as `lambda` is. If the model cannot identify
the right dimensionality from sparse data, that is part of the difficulty being measured.

**(b) Correct specification does not imply estimability.** A correctly-specified model that cannot
be *fitted* from 1–5 observations per entity is still a failure, and that is the regime CricRoots
operates in. This is the point of §5.

**(c) The conclusions are therefore asymmetric, and this is preregistered:**

| Outcome | What it licenses |
|---|---|
| **Low-rank FAILS** | **Strong.** It failed in its own best case — correctly specified, oversized effect (19.4%), oracle-verified structure present. If factorisation cannot exploit this, a genuine methodological gap exists. |
| **Low-rank SUCCEEDS** | **Weak.** Shows only that a correctly-specified model works on correctly-specified data. It does **not** show factorisation would work on real cricket, where no such match is guaranteed. Must be reported with that caveat attached, and closes the novelty direction rather than opening one. |

A success here is the *less* informative result. Recorded now so it cannot be presented otherwise
later.

---

## 2. Arms — three, not two (required review modification)

The free interaction term `I_bw` and the low-rank term `u_b · v_ll` can both absorb
batter-associated structured variation, but they represent **different structures**: `I_bw` says
"this batter has a special relationship with this bowler", while `u_b · v_ll` says "this batter has
a *reusable* response to line/length conditions". Under sparsity the unconstrained pairwise term
has enough flexibility to soak up variation the latent term should be learning — which would mask
L1 and be invisible in a two-arm design.

This is not an arbitrary ablation. World D+ generates **both** structures independently (`I_bw` and
`z_b · φ_ll`), so whether the model can separate them is a real question about the model, not a
detail of the harness.

| Arm | Terms |
|---|---|
| **A** joint (existing) | `mu + batter + bowler + archetype + lineLength + interaction` |
| **B** joint + low-rank | A `+ u_b · v_ll` |
| **C** low-rank, no free interaction | `mu + batter + bowler + archetype + lineLength + u_b · v_ll` |

**The decisive comparison is B vs C.** If dropping the free interaction lets the latent model
recover structure it could not recover alongside it, we have found a concrete modelling failure:
*unconstrained high-dimensional interactions absorb transferable structure that lower-rank factors
should represent.* If B ≈ C, interaction is not the issue.

## 3. Model specification

Extends the existing joint model with one term:

```
logit p = mu + batter[b] + bowler[w] + archetypePair[a] + lineLength[l] + interaction[b,w]
        + u_b · v_{line,len}                                    <- new, rank K
```

Everything else is unchanged from the model used in Experiments 4–7, so the comparison against
`jointRegularizedLogit` isolates exactly one addition.

- `u_b ∈ R^K` per batter, `v_{line,len} ∈ R^K` per (line, length) cell.
- Separate L2 penalty `lambda_lowrank` on both, since the term has `176K + 42K` parameters.
- Initialised from small random values (the bilinear term is non-convex; zero-init leaves the
  gradient at zero). Seeded, and **the same seeds used for every arm** so initialisation cannot
  differ between them.

**Non-convexity**: unlike every previous model in this programme, this objective has local optima.
**Three fixed seeded initialisations provide a limited optimisation-stability diagnostic** — they
are explicitly *not* a guarantee of finding the global optimum, and the design does not claim
otherwise. Best selected by *training* loss only; spread across restarts reported.

**Preregistered now, so it cannot be decided later**: the restart count will **not** be increased
after seeing instability. If the three disagree materially, that is reported as a finding about the
method's practicality, not treated as a nuisance to be averaged away by running more.

---

## 4. Hyperparameter protocol — fixed in advance

Selected by 3-fold cross-validation over **training rows only**, identical discipline to D12.
No test checkpoint influences any choice.

| Hyperparameter | Grid |
|---|---|
| `K` | {1, 2, 3, 5, 8} — includes the true value (3) but is not centred on it, and includes over- and under-specification |
| `lambda_lowrank` | {1, 5, 20, 100} |
| `lambda`, `lambda_interaction` | inherited unchanged from the existing model (5 and 20) |

The selected `K` is reported. If CV picks `K ≠ 3` that is informative about identifiability at this
sparsity and is reported as such, not corrected.

---

## 5. Primary question: sample efficiency, not overall performance

**Overall MAE is explicitly demoted to a secondary metric.** A factor model could beat global
overall while being useless at n = 1–5, which is where the product actually operates — and that
would be a negative result reported as a positive one.

The primary question, stated as a comparison rather than a threshold:

> **Does the low-rank model beat `jointRegularizedLogit` at LOW exact-matchup sample size?**

Stated at the level that actually matters, and preserved as the framing for the whole hypothesis:

> **Can latent structure be exploited *before* sufficient entity-specific observations exist?**

H12 must not quietly become "can we build a better factorisation model". A factor model that
eventually beats the joint model at n = 50 is statistically interesting and **irrelevant to the
regime CricRoots operates in**.

`jointRegularizedLogit` estimates individual effects freely. The latent structure's whole claim to
value is that it should be learnable *sooner*, because `z` is shared and evidence pools across
batters. If low-rank only wins once individual effects are already estimable, the latent structure
adds nothing at the sparsity that matters.

Reported by exact-matchup bin (`n` = 0, 1, 2–4, 5–9, 10–14), the existing `metrics.js` stratification.

---

## 6. Preregistered metrics

Primary:
- **Oracle MAE by exact-matchup sample-size bin** — the sample-efficiency curve.
- **Latent recovery**: correlation between the fitted latent contribution `u_b · v_{ll}` and the
  true `z_b · φ_{ll}`, over all (batter, line, length). Rotation-invariant, so it sidesteps the
  factor-identifiability problem. Reported overall and by batter observation count.

Secondary: overall oracle MAE, Brier, log loss, Spearman, decile calibration, selected `K`,
restart spread, and the same suite in **D−** as the negative control.

**Reference points — corrected before results, see below.** `global` (0.036253 in D+) and the J2a
oracle instrument (0.034058).

**Correction (made mid-run, from arm A's intermediate value; no criterion changed).** An earlier
version of this section called the J2a oracle "the ceiling" and proposed reporting what fraction of
the available 0.002195 a model captures. That is wrong. Arm A — the existing joint model, with **no
latent term at all** — scores **0.027018** on the identical test rows (same population, league, and
split seeds; verified). It already beats the supposed ceiling by ~4x the entire gap J2a measured.

The J2a instrument is `global` + the true latent term, so it is a ceiling **only for global-based
predictors**. The joint model's free per-player effects capture substantially more than
global-plus-perfect-latent-knowledge does. Treating 0.034058 as a ceiling, or 0.002195 as the
available headroom, would badly misread arms B and C.

**No criterion is affected**: L1, L2 and L3 all compare arms against **arm A** and across worlds,
never against the J2a instrument. Only this section's framing was wrong, and it is fixed here rather
than after seeing the arms it would have distorted.

---

## 7. Falsification criteria

Thresholds against the measured optimizer-noise floor (8.7e-7 Brier; oracle-MAE thresholds in their
own units, 1e-4 as in Experiment 7).

**L1 — does the model recover the latent structure?** *(restructured per review — L1 is now a
mechanism test, not an overall-performance test)*
> `r_latent` (correlation between fitted `u_b · v_ll` and true `z_b · φ_ll`) must be materially
> higher in D+ than in D−. Overall MAE is deliberately **not** part of L1: §5 states overall
> performance is not the question, so making L1 depend on it would contradict the design's own
> logic and permit "overall MAE improved, therefore latent recovery" — an inference this programme
> has already been burned by (H5).

The criteria now form an explicit causal chain rather than three parallel tests:

```
L1  structure is recovered        ->  L2  recovered structure helps where data is sparse
                                  ->  L3  and it is the LATENT structure doing it, not flex
```

**L2 — does it help where it matters?** *(the primary question)*
> Supported only if low-rank beats `jointRegularizedLogit` in the **n = 0 and n = 1 bins** by more
> than 1e-4. Winning only at n ≥ 5 means the latent structure becomes useful only once individual
> effects are already estimable — which does not solve the problem the programme is about.

**L3 — is the improvement attributable to the latent structure?**
> Mirrors Experiment 7's G2. **`r_latent` is reported as a continuous quantity for every arm and
> every world — that is the primary output.** The 0.3 threshold is a secondary preregistered
> classification only, and is acknowledged as a judgement call with no principled basis. Reporting
> the number continuously means `r = 0.29` is visible as "recovered most of the structure, just
> under an arbitrary line", not as "no latent recovery".

**L4 — negative-control integrity.**
> Any variant improving in **both** D+ and D− is transferring on noise; its D+ gain is discounted
> and reported as such.

**L1, L2 and L3 must all hold** for H12 to be supported. L1 alone is not sufficient — that would be
"recovers the structure but cannot use it", which is Case 2 below and a distinct result.

**Scope discipline, preregistered**: Experiment 8 is designed to answer whether the low-rank
mechanism is viable *and* whether the free interaction term masks it. **A follow-up experiment will
not be added merely because one arm returns an ambiguous result.** If it fails, the conclusion is
that existing techniques have been exhausted on this question — which is the point at which
designing something new becomes justified rather than speculative.

---

## 7b. Redundancy is structurally ruled out — established before results were visible

Review raised two distinct readings of "high `r_latent`, no benefit at n=0/1":

- **(A) Redundant** — arm A's per-player parameters already encode the same information.
- **(B) Inaccessible** — the structure is recoverable but not with enough precision to improve
  sparse predictions.

**(A) is ruled out structurally.** Arm A's terms are `batter[b]` (a scalar per batter),
`lineLength[l]` (shared across all batters), and `interaction[b,w]` (per batter-bowler pair). None
is a batter x (line,length) term, so arm A cannot represent `z_b · φ_ll` except through those two
marginals.

Decomposing the true latent surface over all 176 batters x 42 cells (a property of the world,
computed independently of any model or result):

| Component of the latent surface | Share of its variance |
|---|---:|
| batter-marginal — absorbable by `batter[b]` | **0.63%** |
| lineLength-marginal — absorbable by `ll[l]` | **1.19%** |
| **irreducible batter x (line,length) interaction** | **98.18%** |

Arm A can absorb at most ~1.8% of the latent surface. **If arm B recovers `z` well and still does
not beat arm A at n=0/1, it cannot be because arm A already had the information — it structurally
cannot have it.** That outcome would therefore be reading (B), not (A).

Recorded now, before the arms are visible, so the distinction cannot be resolved after the fact in
whichever direction the numbers happen to suggest.

**Also worth carrying**: the generator's `R_{b,line,len}` term has the same shape and is likewise
unrepresentable by arm A (the D11 known limitation). Arms B and C are the first models in this
programme with any capacity to represent batter-specific context response at all.

---

## 8. What each outcome licenses

| L1 | L2 | L3 | Conclusion |
|---|---|---|---|
| fail | — | — | **Low-rank fails in its best case.** A genuine methodological gap: useful latent structure that neither discrete transfer nor conventional factorisation can exploit under sparsity. **This is the outcome that would justify designing something new.** |
| pass | fail | — | Latent structure is exploitable, but only once data is no longer sparse. Closes the direction for CricRoots' regime; worth recording as a sparsity limit. |
| pass | pass | fail | It improves without recovering the structure. Mechanism rejected; investigate what it is actually doing before any claim. |
| pass | pass | pass | **Conventional factorisation solves it.** Close the novelty direction (§1: this is the weak conclusion). The contribution is the benchmark and the negative results, not an algorithm. |

---

## 9. Out of scope

- Any novel estimator. This experiment tests an established baseline.
- Changes to World D's generator — it passed its gates and is now frozen.
- Neighbourhood methods (H11, closed).
- Production code.
- Symmetric bowler latent structure (deferred; revisit only if L1 fails).

---

## 10. Open questions (all resolved in review)

1. ~~Is 3 restarts enough?~~ **Resolved in review: three is a limited stability diagnostic, not a
   guarantee, and the count is frozen — it will not be raised after seeing instability.**
2. ~~Should the low-rank term be tested without the free interaction term?~~ **Resolved in review:
   yes — arm C added (§2).**
3. ~~Is L3's 0.3 threshold right?~~ **Resolved in review: `r_latent` is reported continuously as the
   primary quantity; the threshold is a secondary classification only.**
