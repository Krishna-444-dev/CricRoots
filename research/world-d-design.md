# World D design proposal - a latent-factor benchmark for behavioural transfer

**Status: PROPOSAL ONLY. No code. No experiments. Submitted for review.**

Builds a world in which behavioural transfer is **testable without being guaranteed**, per D17.
Worlds A and B cannot test it — they contain no shared latent factors, so "behaviourally similar
players" is not a thing they contain.

The governing risk this document is written against: **a world built so that similarity helps will
show that similarity helps, and will have proved nothing.** Every choice below is made to keep a
negative outcome genuinely reachable.

---

## 1. What has to be true for this benchmark to be worth building

Three requirements, all from D17:

1. **Shared latent factors** — players genuinely resemble each other in how they respond, not just
   in an overall level.
2. **Individual residual behaviour** — similarity must be partial. If similar players were
   *identical*, transfer would be trivially optimal.
3. **Archetype must be imperfect and distinct from the latent structure.** If `battingStyle` were
   the latent cluster, we would only be testing whether a method can rediscover a label we planted.

Plus a fourth, which is the one that makes the benchmark honest:

4. **A negative control** in which latent factors exist, are discoverable from observable
   behaviour, and are irrelevant to the prediction target.

---

## 2. World D+ generating process

Extends the existing formula. Everything already in Worlds A/B stays; one term is added.

```
logit p(b,w,line,len) =
      BASE
    + V_b                       batter level          (unchanged, independent scalar)
    + E_w                       bowler level          (unchanged)
    + I_bw                      pair interaction      (unchanged, sparse)
    + LL_{line,len}             context               (unchanged)
    + R_{b,line,len}            individual residual   (unchanged, sparse)  <- requirement 2
    + A_{sty(b),sty(w)}         archetype             (unchanged)          <- requirement 3
    + z_b · φ_{line,len}        SHARED LATENT         (new)                <- requirement 1
```

**The latent term.** Each batter gets `z_b ~ N(0, I_K)`, a `K`-dimensional factor vector. Each
(line, length) cell gets a loading `φ_{line,len} ~ N(0, σ_φ² I_K)`. The contribution is their dot
product.

Two batters with similar `z` therefore have **similar response profiles across the whole
line/length surface** — genuinely shareable structure, which is exactly what Worlds A/B lack.

**Fixed in advance:**

| Parameter | Value | Reasoning |
|---|---|---|
| `K` (factor dimension) | **3** | Small enough to be learnable from ~14k training balls; large enough that a single scalar cannot capture it. Not tuned. |
| `σ_φ` | **0.22** | Chosen so the latent term's variance lands near the existing interaction (8.6%) and archetype (8.84%) terms — a real effect, not a dominant one. |
| `z_b` distribution | `N(0, I_3)` | Standard; the scale lives entirely in `σ_φ`. |
| Draw order | **last**, after every existing table | Same discipline as `archetypeSignal` (D6) and drift (§2 of experiment-6-design) — Worlds A/B/C stay byte-identical for the same seed. |
| `battingStyle` assignment | **unchanged, independent of `z`** | Requirement 3. Archetype and latent structure must be different partitions. |

**Target realised variance share: 10–15%.** This is a target, not a guarantee. The actual share is
measured after generation and **reported as measured**, whatever it comes to — exactly as World B's
8.84% was.

---

## 3. World D− negative control

The trap this must set: a method that discovers real behavioural clusters and transfers on them
should be **penalised**, not rewarded.

A latent term that simply contributes zero to the target would be a weak control — nothing would be
discoverable, so no method could be misled. Instead:

**In D−, `z_b` drives run-scoring but not dismissal probability.**

```
logit p(dismissal)  =  ... existing terms ...          NO latent term
E[runs | b, line, len]  =  base_runs + z_b · φ_{line,len}    latent term HERE
```

Run-scoring is currently `rng.pick([0,0,1,1,1,2,4,6])`, unconditioned. D− makes it depend on `z_b`,
so:

- The latent clusters are **real and discoverable** from observed behaviour.
- A similarity method built on general behavioural profile will find them.
- They carry **no information about dismissal probability**, the actual target.

Same `K`, same `σ_φ`, same seeds as D+. The two worlds differ in **which channel** the latent term
feeds.

**This is the check that makes the benchmark hard to game.** Any method claiming to exploit
behavioural similarity must gain in D+ *and* not lose in D−.

---

## 4. Benchmark validity checks — run BEFORE any method is built

If these fail, the world is broken and no result from it means anything. Ordered.

**J1 — does D+ actually contain shared latent structure?** *(data-side, no model)*
> Residual response-surface correlation between batter pairs must be substantially higher for pairs
> with similar `z` than for random pairs. In Worlds A/B this quantity was mean **0.0101** with no
> difference between same-style and different-style pairs. D+ must clearly separate. Also report
> the realised latent variance share.

**J2 — is the structure exploitable at all?** *(oracle upper bound)*
> An **oracle latent neighbourhood** — neighbours chosen by true `z` similarity — must beat `global`
> on oracle MAE in D+. If perfect knowledge of the latent structure cannot beat a flat global rate
> at this sparsity, the world still cannot test the question, exactly as Worlds A/B could not. **This
> is the check that Worlds A/B failed** (oracle-similar 0.0642 vs global 0.0305), and it is the most
> likely way World D also fails.

**J3 — does the negative control fire?**
> The same oracle latent neighbourhood must **not** beat `global` in D−. If it does, the control is
> broken and D− is not protecting anything.

**J1, J2 and J3 must all pass before any similarity method is implemented.** A world that fails J2
gets redesigned or abandoned; it does not get a method built on top of it.

---

## 5. Strongest existing baselines — to be implemented BEFORE anything novel

Per D17. The bar is **not** the sequential hierarchy; that was cleared long ago by a simpler method.

| # | Baseline | Why it is the relevant bar |
|---|---|---|
| **1** | **Joint regularized logit + low-rank interaction term** (factorisation-machine style: `logit p += u_b · v_{line,len}`, learned) | **The one that matters most.** This is a standard technique that targets exactly the structure D+ contains. If it captures the latent signal, no similarity-pooling method is needed and the research direction closes. |
| 2 | k-NN / collaborative-filtering pooling over estimated response profiles | The direct classical form of "behavioural transfer" |
| 3 | Latent-class / mixture-model hierarchical Bayes | Learns clusters rather than using declared ones |
| 4 | Empirical Bayes shrinkage toward a *learned* cluster mean | The minimal upgrade to the current archetype rung |
| 5 | Existing suite: `global`, `singleLevelShrinkage`, `fullHierarchy`, joint offline/online | Continuity with Experiments 2–7 |
| 6 | Oracle latent neighbourhood | Upper bound instrument, diagnostic only, never a candidate method |

**Baseline 1 is the decisive comparison.** Adding a low-rank term to a model we already have is
cheap, standard, and directly aimed at this structure. Any novel proposal must beat *it*.

---

## 6. Preregistered criteria for the research question

Only evaluated once J1–J3 pass.

**K1 — does latent structure help at all, beyond declared archetypes?**
> Supported if baseline 1 (low-rank joint) beats the plain joint model on oracle MAE in D+ by more
> than the measured optimizer-noise floor, **and** does not beat it in D−.

**K2 — does explicit similarity pooling add anything beyond a low-rank model?**
> Supported only if a similarity-pooling method beats **baseline 1** in D+ by more than the noise
> floor, and does not lose in D−. **Beating the sequential hierarchy or plain joint model does not
> count.**

**K3 — negative control integrity, applied to every method.**
> Any method that improves in D+ but also improves in D− is **transferring on noise**. Its D+ gain
> must be discounted accordingly and reported as such, not presented as a win.

**Stated in advance**: the most likely outcome is that **K1 passes and K2 fails** — that a standard
low-rank model captures the structure and bespoke similarity pooling adds nothing. That would close
the direction, and it is a perfectly good result. The benchmark is built to make that outcome
visible rather than avoidable.

---

## 7. What this proposal does not do

- No code, no generator change, no experiment.
- No claim that behavioural transfer works, or that any of it would be novel. §0 of
  `general-algorithm-landscape.md` already places k-NN pooling, factorisation, metric learning, and
  latent-class models in established literature; a prior-art review is required before any novelty
  claim regardless of outcome.
- No commitment to build World D at all. If review concludes that J2 is unlikely to pass at
  grassroots sparsity, **not building it is the correct decision** — that would mean the question is
  unanswerable at this data scale, which is itself worth knowing and costs nothing to establish.

---

## 8. Open questions for review

1. **Is `K = 3` right?** Larger `K` makes the structure richer but harder to learn from ~14k balls,
   and risks J2 failing for capacity reasons rather than structural ones.
2. **Should the latent term also load on bowlers?** As specified only batters have `z`. Symmetric
   latent structure on both sides is more realistic but doubles what must be learned.
3. **Is the D− channel choice right?** Driving run-scoring is realistic and discoverable, but our
   run model is currently crude. An alternative is a latent term on a genuinely separate observable
   we would have to invent — probably worse.
4. **Should J2 use the same K-neighbourhood size as the failed Worlds A/B test (K=20)?** That test
   found even oracle neighbourhoods lost to global because a 20-batter pool carries too much
   variance at this sparsity. If that is a *sparsity* limit rather than a *structure* limit, World D
   will fail J2 for the same reason — which argues for checking J2 with several pool sizes, or
   accepting that the answer is "not at this data scale."
