# State of the research programme

**Snapshot as of 2026-08-16, after nine experiments.** Not a hypothesis, not an experiment. A
handoff document. Every number cites the run it came from; comparisons are within-world only, since
Experiment 6 established that absolute Brier is confounded by test-period base rate across runs.

---

## What we know

| Finding | Evidence |
|---|---|
| **Per-player scalar effects are the single most valuable component measured.** Global → player-level model: 0.036253 → 0.027018 oracle MAE, a **25.5% reduction**. Removing per-player terms cost +4.91e-3, ~40x any other ablation. | Exp 8 (World D+), archetype diagnostic |
| **Joint regularized estimation beats the deployed sequential hierarchy**, on Brier, log loss, Spearman and oracle MAE, in both worlds, under a converged optimiser. | Exp 5 |
| **Ground-truth variance decomposition** (World A): batter 34.4%, bowler 33.0%, line×length 22.0%, batter×bowler interaction 8.6%, batter line/length response 2.6%. | ground-truth decomposition |
| **Declared archetype carries ~0% of ground-truth variance** in World A — by code inspection *and* ANOVA (eta² 0.04–0.93%). | Exp 2 diagnostic |
| **A latent contextual representation becomes worth activating between 325 and 649 balls/batter.** Below: CV kills it, benefit ≈ 0. Above: CV adopts it, r=0.562, benefit +1.03e-3 (5.2% relative). | adoption curve |
| **Recovery heterogeneity is not explained by observation count.** Within-quartile spread is 99% of overall spread; `corr(accuracy, n)` ≈ 0. What weakly predicts it is intrinsic and hidden (`|z_b|`, own-surface variability). | per-entity diagnostic |
| **The hierarchy's pools are strictly nested**, with 15.6% mean self-contamination at the finest rung (max 100%). Real, measurable, and *not* responsible for the performance gap. | nested-evidence finding, Exp 7 |
| **Brier degradation across runs is confounded** by realized test-period base rate. Oracle MAE is the sound instrument when the test distribution moves. | Exp 6 drift diagnostic |

---

## What we ruled out — and the scope of each

**No research area is closed. Each entry below is a mechanism, bounded by a regime.**

| Hypothesis | Verdict | What is *not* closed |
|---|---|---|
| H1 sequential hierarchical shrinkage beats simpler baselines | UNSUPPORTED | hierarchical modelling generally |
| H2 archetype irrelevance explains the failure | REFUTED as complete explanation | archetype as a useful level — the *oracle* archetype beats global |
| H5 the joint model's advantage is a sparse-data effect | NOT SUPPORTED | the advantage itself, which is real |
| H9 nested contamination explains the deficit | UNSUPPORTED | the contamination, which exists and is measurable |
| H10 online adaptation strengthens under drift | NOT SUPPORTED | online adaptation's small stationary benefit |
| H11 discrete neighbourhood **substitution** | REFUTED (oracle neighbourhoods lost) | similarity as *constraint* — retains own evidence, untested |
| H12 low-rank latent representation | UNSUPPORTED below ~325–649 balls/batter | the same term **above** that threshold; non-bilinear forms |
| H13 observable evidence quality | **UNTESTABLE at 81 balls/batter** | testable at 325+, simply not tested |

---

## Measurable vs not measurable, at CricRoots' operating point (~81 balls/batter)

**Measurable**
- Aggregate predictive performance of any method, across ~2,520 checkpoints
- Per-player scalar effects — and they are large
- Ground-truth recovery of any component (Track A only, via oracles)
- Whether a mechanism is active, converged, and correctly implemented (protocol gates)

**Not measurable**
- **Per-entity utility of a richer representation** — reliability **−0.11**; within-batter measurement variance *exceeds* between-batter variance. Any per-entity claim at this scale is unverifiable.
- Consequently: *why* an entity-adaptive rule helped, even if *that* it helped is testable in aggregate.
- Anything requiring real-world validation — Track B remains blocked (D2/D3).

---

## Strongest current positions

**Strongest baseline**: `jointRegularizedLogitOnline` — best on every metric in both worlds under a
converged optimiser (Exp 5). Any future proposal is measured against **this**, not against the
sequential hierarchy, which a simpler method cleared long ago.

**Strongest product capability**: per-player vulnerability estimation, which the evidence supports.
Plus provenance (`basedOn`, `historicalSampleSize`, `rawBallsAtFinestLevel`) already computed and
already sent to the client — currently discarded at render (see
`documentation/evidence-provenance-backlog.md`).

**Strongest methodological asset**: the protocol gates (`research/protocol.md`) — six failure modes
with detection methods, four directly detectable, two inferential and marked as such.

---

## The next question, chosen by filter rather than by appeal

Applying the five properties: (1) evidence it matters, (2) target measurable in the intended regime,
(3) meaningful baselines exist, (4) a clear failure mechanism to attack, (5) would generalize.

| | RQ1 evidence-aware complexity | RQ2 similarity as constraint |
|---|---|---|
| 1. Evidence it matters | **Yes** — heterogeneity unexplained by `n`; a global penalty decides one thing for entities in different states | **Partial** — motivated by H11's scope, not by a positive finding |
| 2. Target measurable | **Aggregate: yes. Per-entity: no.** The rule can be validated; its individual decisions cannot | **Yes**, in aggregate |
| 3. Baselines exist | **Yes** — global CV, and the joint/online model | **Yes** — but prior art is dense (graph/fused/network-lasso) and unreviewed |
| 4. Failure mechanism identified | **Yes** — global λ ignores per-entity evidential state | **No** — no measured failure it is designed to fix |
| 5. Generalizes | **Yes** — medicine, marketing, fraud, recommendation all share the shape | Yes, but as an application of known technique |

**RQ1 passes four and a half of five; RQ2 fails property 4.** RQ2 is interesting but currently
motivated by *what H11 didn't test* rather than by anything measured — which is the weaker reason to
run an experiment, and the reason the last four hypotheses formed.

**Neither is promoted to a hypothesis.** RQ1's honest current form is: *does an evidence-aware
complexity policy beat a global one in aggregate?* — testable now, with per-entity attribution
explicitly out of reach.

---

## Standing constraints

Production frozen (D8) · `k` never tuned (D7) · Track B blocked (D2/D3) · live-adjustment
double-counting still unevaluated (D4) · prior-art review required before any novelty claim
(`general-algorithm-landscape.md` §6) · conclusions admissible only after protocol gates 1–5 clear.

---

## What this programme has actually produced

An environment that reliably detects when a question cannot be answered with the evidence available,
and a discipline for closing mechanisms without closing questions. Nine experiments, five
hypotheses refuted or unsupported, **two of my own conclusions retracted mid-arc** — the retractions
are in the git history rather than tidied away.

If an algorithm eventually emerges, this is what will make it credible. If none does, this is still
the contribution, and it does not need one attached.
