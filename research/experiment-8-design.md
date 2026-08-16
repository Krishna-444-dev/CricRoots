# Experiment 8 design - H12, low-rank joint estimation under sparsity

**Status: DESIGN ONLY, SUBMITTED FOR REVIEW. No code. Nothing run.**

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
operates in. This is the point of §4.

**(c) The conclusions are therefore asymmetric, and this is preregistered:**

| Outcome | What it licenses |
|---|---|
| **Low-rank FAILS** | **Strong.** It failed in its own best case — correctly specified, oversized effect (19.4%), oracle-verified structure present. If factorisation cannot exploit this, a genuine methodological gap exists. |
| **Low-rank SUCCEEDS** | **Weak.** Shows only that a correctly-specified model works on correctly-specified data. It does **not** show factorisation would work on real cricket, where no such match is guaranteed. Must be reported with that caveat attached, and closes the novelty direction rather than opening one. |

A success here is the *less* informative result. Recorded now so it cannot be presented otherwise
later.

---

## 2. Model specification

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
  gradient at zero). Seeded, and **the same seed used for every variant** so initialisation cannot
  differ between arms.

**Non-convexity is a real caveat**: unlike every previous model in this programme, this objective
has local optima. Mitigation: 3 restarts from different seeds, best selected by *training* loss
only, and the spread across restarts reported. If restarts disagree materially, that instability is
itself a finding about the method's practicality.

---

## 3. Hyperparameter protocol — fixed in advance

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

## 4. Primary question: sample efficiency, not overall performance

**Overall MAE is explicitly demoted to a secondary metric.** A factor model could beat global
overall while being useless at n = 1–5, which is where the product actually operates — and that
would be a negative result reported as a positive one.

The primary question, stated as a comparison rather than a threshold:

> **Does the low-rank model beat `jointRegularizedLogit` at LOW exact-matchup sample size?**

`jointRegularizedLogit` estimates individual effects freely. The latent structure's whole claim to
value is that it should be learnable *sooner*, because `z` is shared and evidence pools across
batters. If low-rank only wins once individual effects are already estimable, the latent structure
adds nothing at the sparsity that matters.

Reported by exact-matchup bin (`n` = 0, 1, 2–4, 5–9, 10–14), the existing `metrics.js` stratification.

---

## 5. Preregistered metrics

Primary:
- **Oracle MAE by exact-matchup sample-size bin** — the sample-efficiency curve.
- **Latent recovery**: correlation between the fitted latent contribution `u_b · v_{ll}` and the
  true `z_b · φ_{ll}`, over all (batter, line, length). Rotation-invariant, so it sidesteps the
  factor-identifiability problem. Reported overall and by batter observation count.

Secondary: overall oracle MAE, Brier, log loss, Spearman, decile calibration, selected `K`,
restart spread, and the same suite in **D−** as the negative control.

Reference points, both already available: `global` (0.036253 in D+) and the **J2a oracle**
(0.034058) — the latter is the ceiling. Reporting what fraction of the available 0.002195 the model
captures is more informative than an unanchored delta.

---

## 6. Falsification criteria

Thresholds against the measured optimizer-noise floor (8.7e-7 Brier; oracle-MAE thresholds in their
own units, 1e-4 as in Experiment 7).

**L1 — does low-rank capture the latent signal at all?**
> Supported if low-rank beats `jointRegularizedLogit` on overall oracle MAE in D+ by > 1e-4, **and**
> does not beat it in D−. A gain in both worlds means it is fitting noise, per K3.

**L2 — does it help where it matters?** *(the primary question)*
> Supported only if low-rank beats `jointRegularizedLogit` in the **n = 0 and n = 1 bins** by more
> than 1e-4. Winning only at n ≥ 5 means the latent structure becomes useful only once individual
> effects are already estimable — which does not solve the problem the programme is about.

**L3 — is it recovering the actual latent structure, or just flexing?**
> The mechanism check, mirroring Experiment 7's G2. Correlation between fitted and true latent
> contribution must exceed 0.3 in D+ **and** be near zero in D−. A model that improves predictions
> without recovering the structure is improving for some other reason — report the improvement,
> reject the mechanism.

**L4 — negative-control integrity.**
> Any variant improving in **both** D+ and D− is transferring on noise; its D+ gain is discounted
> and reported as such.

**L1, L2 and L3 must all hold** for H12 to be supported. L1 alone is not sufficient — that would be
the "wins overall, useless when sparse" outcome §4 exists to prevent.

---

## 7. What each outcome licenses

| L1 | L2 | L3 | Conclusion |
|---|---|---|---|
| fail | — | — | **Low-rank fails in its best case.** A genuine methodological gap: useful latent structure that neither discrete transfer nor conventional factorisation can exploit under sparsity. **This is the outcome that would justify designing something new.** |
| pass | fail | — | Latent structure is exploitable, but only once data is no longer sparse. Closes the direction for CricRoots' regime; worth recording as a sparsity limit. |
| pass | pass | fail | It improves without recovering the structure. Mechanism rejected; investigate what it is actually doing before any claim. |
| pass | pass | pass | **Conventional factorisation solves it.** Close the novelty direction (§1: this is the weak conclusion). The contribution is the benchmark and the negative results, not an algorithm. |

---

## 8. Out of scope

- Any novel estimator. This experiment tests an established baseline.
- Changes to World D's generator — it passed its gates and is now frozen.
- Neighbourhood methods (H11, closed).
- Production code.
- Symmetric bowler latent structure (deferred; revisit only if L1 fails).

---

## 9. Open questions for review

1. **Is 3 restarts enough** for a non-convex objective, given every previous model here was convex
   and this is the first time local optima are possible?
2. **Should the low-rank term also be tested *without* the free interaction term?** They compete for
   the same signal — the interaction term can absorb pairwise structure the latent term should be
   explaining, which could mask L1. An extra arm would isolate it at the cost of one more variant.
3. **Is L3's 0.3 correlation threshold right?** Chosen as clearly-above-noise but not demanding;
   there is no principled value and it is a judgement call worth challenging before results exist.
