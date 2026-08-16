# Experiment 9 design - H13, observable evidence quality

**Status: DESIGN ONLY, SUBMITTED FOR REVIEW. No code. Nothing run.**

> Can we predict, using only information available about an entity so far, whether giving that
> entity a richer representation will improve its future predictions?

---

## 1. Why this is the right question now

The per-entity diagnostic established that recovery varies substantially between batters and that
**observation count explains essentially none of it** — within-quartile spread is 99% of overall
spread. What weakly predicts recovery is intrinsic and hidden (`|z_b|`, the variability of the
batter's own true surface).

So the naive rule — *fewer observations, simpler model* — is dead. H13 asks whether anything
**observable at prediction time** stands in for the hidden properties that actually matter.

---

## 2. THE LABEL PROBLEM — a gate that must pass before any proxy is built

**This is the most important section, and it is the reason the experiment is not simply "build six
proxies and correlate them".**

H13's target variable is *per-entity utility*: does the richer representation improve **this
batter's** held-out predictions? The per-entity diagnostic measured exactly that and found
`sd(utility) = 4.9e-3` from a **median of 15 test balls per batter** at 81 balls/batter.

A utility estimate from 15 Bernoulli-driven balls may be almost entirely noise. If it is, then
`corr(proxy, utility)` ≈ 0 is guaranteed *regardless of how good the proxy is* — we would be
correlating against an unmeasurable quantity and would misread it as "no observable proxy exists".

That is the same class of error as Experiment 1's sparsity failure and Worlds A/B's untestable
transfer question: concluding about a method from a property of the measurement setup.

**Gate M1 — is per-entity utility measurable at all?**
> Split each batter's held-out balls into two halves. Compute utility independently on each.
> Report the split-half correlation across batters, at each observation volume.
>
> - If split-half reliability is **near zero**, per-entity utility is not a usable label at that
>   volume. H13 is **untestable there**, and that is the finding — not "no proxy exists".
> - If reliability is **substantial**, proceed to §3.
>
> Reported per volume, because it will almost certainly pass at 649 balls/batter and may fail at 81.
> A Spearman-Brown correction to full-length reliability is reported alongside the raw split-half
> figure.

**Consequence to accept in advance**: if M1 fails at 81 balls/batter — the volume CricRoots actually
operates at — then the honest conclusion is that we cannot tell, *for an individual batter at that
scale*, whether a richer representation would help. That is a real and useful result about the
regime, and it would mean H13 can only be tested at volumes the product does not have.

---

## 3. Preregistered proxy list — frozen before any correlation is computed

Six proxies, all computable from an entity's own observed data with **no ground truth**, fixed here
so that the analysis cannot become a search for whichever proxy happens to correlate.

| # | Proxy | Definition |
|---|---|---|
| P1 | **Context coverage** | number of distinct (line, length) cells the batter has actually faced |
| P2 | **Coverage entropy** | Shannon entropy of the batter's ball distribution across the 42 cells — separates 81 balls spread evenly from 81 concentrated in three cells |
| P3 | **Temporal consistency** | split the batter's balls into first and second half chronologically; correlation between the per-cell dismissal rates of the two halves |
| P4 | **Predictive self-consistency** | fit on the batter's first half, predict the second; then reverse. Report mean of the two held-out log-likelihoods relative to a global-rate baseline |
| P5 | **Local response strength** | evidence *in the observed data alone* that outcome depends on context: likelihood-ratio statistic of a per-cell rate model against a constant-rate model for that batter |
| P6 | **Bootstrap prediction stability** | resample the batter's balls (with replacement) 20 times, refit, and measure agreement of the resulting predicted surfaces |

**P6 replaces the discredited confidence measure.** The per-entity diagnostic showed cross-seed
agreement reaching 1.000 while accuracy ranged −0.126 to 0.588 — optimiser restarts measure
optimiser determinism, not epistemic confidence. P6 resamples the **data**, so disagreement reflects
how much the conclusion depends on which observations happened to occur.

**Cost note**: P4 and P6 require per-entity refits (176 batters × 20 resamples for P6). If that
proves prohibitive, the resample count is reduced — but the proxy list is not.

---

## 4. Protocol

- World D+, unchanged and frozen. Same population, `z`, `φ`, seeds.
- Volumes: the same three as the adoption curve (81, 325, 649 balls/batter), so results attach
  directly to the known activation threshold.
- Per batter: compute P1–P6 from **training data only**, then measure utility on held-out balls.
- Analysis: correlation of each proxy with utility, then a combined fit — proxies as predictors of
  utility, evaluated by cross-validation across *batters* (hold out batters, not balls, so a proxy
  cannot exploit batter-specific leakage).
- `n` is included as a seventh predictor **as a control**, so the question is explicitly whether the
  proxies add anything *beyond* observation count — which the per-entity diagnostic says explains
  nothing.

---

## 5. Preregistered criteria

**M1 (gate)** — per-entity utility must be measurably reliable at the volume in question. See §2.

**M2 — does any observable proxy predict utility?**
> Supported if at least one proxy achieves |correlation with utility| > 0.2 at a volume passing M1,
> with the sign consistent across volumes that pass.

**M3 — do the proxies beat observation count?**
> The substantive test. Supported only if the combined proxy model predicts utility better than `n`
> alone, under batter-level cross-validation, by more than the noise floor. Given `corr(utility, n)`
> ≈ 0 already, `n` alone is a weak bar — so this is close to asking whether the proxies predict
> anything at all.

**M4 — negative control.**
> The same analysis in **World D−**, where the latent term drives run-scoring and is irrelevant to
> the target. Proxies that "predict utility" there are detecting something generic. Any proxy
> passing M2 in D+ **and** in D− is discounted.

**M2, M3 and M4 must all hold.** A proxy correlating with utility in both worlds is not evidence for
H13.

---

## 6. What each outcome licenses

| Outcome | Conclusion |
|---|---|
| **M1 fails at 81** | Per-entity utility is unmeasurable at CricRoots' actual scale. H13 is untestable there. Strong, uncomfortable, and worth knowing — it would mean no per-entity activation rule can be *validated* at this data volume, whatever its merits. |
| M1 passes, M2 fails | The information needed to decide when to trust a richer representation is itself latent. Closes the direction; also interesting. |
| M2 passes, M3 fails | Proxies predict utility but no better than observation count — contradicting the per-entity result, and a signal to re-examine that measurement rather than proceed. |
| M2/M3 pass, M4 fails | The proxies detect something generic, not latent-specific. Reject. |
| **All pass** | Observable evidence quality predicts representation usefulness. **This is the first point at which designing an algorithm would be justified rather than speculative.** |

---

## 7. Out of scope

- Any adaptive algorithm, entity-specific penalty, or gating mechanism. This experiment measures
  whether the *inputs* to such a rule exist.
- Changes to World D or to `generator.js`.
- Production code.
- Prior-art review — required before any novelty claim, but not before a measurement.

---

## 8. Open questions for review

1. **Is 0.2 the right bar for M2?** Arbitrary, as the 0.3 in Experiment 7's G3 was. It is stated so
   it can be argued with before results exist, and the correlation is reported continuously
   regardless.
2. **Should M1's gate be checked at all three volumes before running anything else?** It is cheap
   and would prevent building six proxies for a volume where the label is noise. My inclination is
   yes — run M1 alone first and report it before the rest is implemented.
3. **P4 and P6 are expensive.** If cost forces a choice, which matters more? P6 is the repaired
   confidence measure and is conceptually the most novel of the six; P4 is the most direct test of
   "is this entity's behaviour learnable from its own data".
