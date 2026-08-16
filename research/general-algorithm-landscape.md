# General algorithm landscape: prior art for "adaptive evidence allocation"

**Status: LITERATURE MAP ONLY. No implementation. Experiment 6 is frozen and running.**

Commissioned to answer one question before any general-purpose algorithm is attempted:

> Where does the proposed "evidence allocation" problem already have a well-established solution,
> and where are the genuine gaps?

Searched adversarially, per instruction — looking for work that would **kill** the idea rather than
support it.

---

## 0. Headline finding

**The AEAL framing, as currently stated, is not novel. Every component has substantial prior art,
and at least three literatures contain something very close to the whole thing.**

The proposal was:

> Dynamically allocate trust across evidence sources according to specificity, reliability,
> similarity, recency, and observed predictive validity, with weights that are context-dependent
> and learned from prediction error.

Read that sentence against these three, all of which predate it:

1. **Dynamic Model Averaging** (Raftery, Kárný & Ettler 2010) — time-varying model weights updated
   from predictive likelihood via a forgetting factor. That is "trust learned from observed
   predictive validity, decaying with recency," exactly. And the obvious next step has been taken
   too: McCormick, Raftery, Madigan & Burd (2012) make the forgetting factor **itself
   time-varying** — i.e. adaptive forgetting, which is direction D-IV in the roadmap, already done.
2. **Evidential reasoning / Dempster–Shafer with contextual discounting** — combines sources using
   *two separate parameters*, weight **and reliability**, where reliability is explicitly
   context-dependent. The canonical teaching example is a camera that is reliable in daylight and
   unreliable at night: same source, context-dependent trust. That is AEAL's central claim, in a
   literature dating to the 1970s–80s and actively extended since.
3. **Prediction with expert advice**, specifically the *specialists / sleeping experts* variant
   (Freund, Schapire, Singer & Warmuth) combined with *tracking the best expert* (Herbster &
   Warmuth, fixed-share). Sleeping experts handles sources that only apply in some contexts —
   which is what "specificity" means operationally. Fixed-share handles non-stationarity. Together
   they cover specificity + recency **with regret guarantees**, which AEAL does not currently offer.

A recent hit found in search is closer still: **C²MF** (Context-specific Credibility-aware
Multimodal Fusion) "dynamically evaluates source credibility based on its position in latent
space." That is context-dependent, learned, per-prediction source trust.

**Conclusion: "learn context-dependent trust over evidence sources" cannot be claimed as a novel
contribution.** Anything we build must be positioned relative to the above, not presented as a new
idea.

---

## 1. Method and epistemic status — read before using this document

**What was done**: four targeted web searches chosen to be adversarial, plus my own knowledge of
these fields. Roughly two hours of effort, not two months.

**What this is NOT**: a systematic literature review. No paper below was read in full. Several
claims rest on abstracts, secondary summaries, or recall. Author/date attributions should be
verified before appearing in anything external.

**A specific limitation worth naming**: my training data ends January 2026 and it is now August
2026. Search surfaced 2026 work I have no knowledge of. **The most recent literature is exactly
where a competing method is most likely to be hiding**, and it is exactly where my coverage is
weakest.

**Practical consequence**: this document is sufficient to *stop* us claiming novelty. It is **not**
sufficient to *establish* novelty. Those need different levels of rigour and the gap between them
is where research embarrassment lives.

---

## 2. Area-by-area map

Against the fifteen areas requested.

| # | Area | Status vs AEAL | Key point |
|---|---|---|---|
| 1 | Hierarchical Bayesian pooling | **Solved** | Partial pooling *is* specificity × reliability. Sample size automatically controls shrinkage. Standard in sports analytics. Time-varying-parameter hierarchical models exist. |
| 2 | Mixture-of-experts / gating | **Solved** | Gating network outputs input-dependent weights over experts. Hierarchical MoE nests them. This is context-dependent allocation, from 1991. |
| 3 | Adaptive ensemble weighting | **Solved** | Mature. Weights from validation performance, online or batch. |
| 4 | Dynamic model averaging | **Solved, and beyond us** | Raftery et al. 2010 + McCormick et al. 2012 already cover time-varying weights *and* adaptive forgetting. |
| 5 | Contextual bandits | **Adjacent** | Context-dependent action selection with exploration. Different objective (regret over actions, not calibration), but the machinery overlaps. |
| 6 | Online learning / adaptive forgetting | **Solved** | Adaptive forgetting factors in recursive least squares are classical control theory. |
| 7 | Meta-learning | **Adjacent** | "Learning how to adapt" is the literal definition. Usually few-shot across tasks rather than evidence-source weighting. |
| 8 | Retrieval-augmented prediction | **Solved for similarity** | Retrieve similar cases, weight by similarity. Directly covers roadmap D-II. |
| 9 | Conformal / uncertainty-aware prediction | **Solved, with guarantees we lack** | Distribution-free validity; Mondrian conformal gives per-group coverage. Relevant to roadmap D-IX. |
| 10 | Prediction with expert advice | **The strongest challenge** | See §3. Sleeping experts + fixed-share covers specificity + drift *with regret bounds*. |
| 11 | Multi-fidelity learning | **Solved** | Combining cheap-abundant with expensive-scarce sources is precisely a specificity/reliability trade-off. |
| 12 | Dynamic Bayesian models | **Solved** | Time-varying parameters with explicit evolution. |
| 13 | State-space models / Kalman | **Solved** | Latent state + observation, optimal recursive trust between prior and evidence by construction. This *is* roadmap D-III. |
| 14 | Concept / covariate / label drift | **Solved** | ADWIN, DDM, Page-Hinkley. Detecting "something changed" is a mature subfield. |
| 15 | Adaptive transfer learning | **Solved** | When and how much to transfer, including negative-transfer avoidance. |
| — | Evidence theory (not on the list) | **Very close hit** | Dempster–Shafer with weight + reliability, contextual discounting. Should have been on the list. |
| — | Attention | **Trivially close** | Attention *is* learned, context-dependent weights over information sources. |

---

## 3. The three strongest killers, stated properly

If we cannot answer these, there is no contribution.

**Killer 1 — Sleeping experts + fixed-share already covers the stated problem, with theory.**
Treat each evidence source (exact matchup, archetype, global, similar players) as an expert that is
"awake" only when it has data. Sleeping-experts algorithms handle varying availability; fixed-share
handles a changing best expert over time. The combination gives adaptive, context-sensitive weights
**with provable regret bounds** — something a learned allocator would need to earn empirically and
would likely still lack.
*To survive this we must show a regime where these bounds are vacuous or the algorithms
underperform in practice.*

**Killer 2 — Dynamic Model Averaging with adaptive forgetting is the same algorithm.**
DMA updates model weights from predictive likelihood with a forgetting factor; the 2012 extension
learns that factor over time. Roadmap directions D-I and D-IV, combined, describe this.
*To survive, we must show what our formulation does that DMA does not — and "applies to nested
evidence sources" is the only candidate I can see (see §4).*

**Killer 3 — Hierarchical Bayes already implements specificity × reliability optimally under its
assumptions.** Partial pooling shrinks in proportion to sample size and between-group variance.
That is not a heuristic to be improved on; it is the Bayes-optimal answer *if the model is correct*.
*To survive, we must show the assumptions fail in our regime in a way that a learned allocator
repairs.* Note our own H4 result is compatible with a simpler story: joint regularized estimation
beat sequential blending because the sequential chain was a **badly specified** hierarchical model,
not because hierarchical pooling is wrong.

---

## 4. Where a genuine gap might plausibly exist

Offered as *candidate* gaps requiring verification, not as claims.

**(a) Nested, data-sharing evidence sources.** Expert-aggregation theory generally treats experts
as arbitrary and given. Our sources are *nested subsets of one dataset*: the exact matchup is
inside the archetype pool, which is inside global. They are therefore strongly correlated and share
observations — a structure that violates the independence intuitions behind much aggregation
theory. Whether standard regret bounds degrade meaningfully under nesting is a real, checkable
question. **This is the most promising gap identified.**

**(b) Extreme sparsity plus drift, jointly.** Most online-learning analysis assumes a reasonable
observation stream per expert. Our regime has 0–14 observations for the most specific source *and*
a moving target. The intersection appears under-studied. Verify before believing.

**(c) The empirical question, which needs no novelty at all.** Which of these families actually
performs best in the sparse-evolving-entity-pair regime, measured against known ground truth with
leakage control and preregistered criteria? Nobody appears to have benchmarked them head to head
here. **This requires inventing nothing and is the contribution we are already closest to
delivering.**

---

## 5. What is actually defensible right now

Ranked by how likely it is to survive scrutiny:

1. **The benchmark and framework** — synthetic worlds with known ground truth, leakage-controlled
   harness, oracle instruments, preregistered falsification criteria, documented negative results.
   Domain-agnostic in structure. Strongest asset.
2. **The empirical finding** — a rigorous negative result on sequential hierarchical shrinkage plus
   a positive result for joint regularized estimation, in a well-characterised regime.
3. **A mechanism contribution** — requires a demonstrated failure mode that the methods in §2
   provably do not address. **We do not have one.** Experiment 6 might produce one; it might not.

The generality ambition is best served by (1). A benchmark for "sparse, evolving, nested-evidence
prediction" transfers to marketing, clinical, and scientific domains **without needing a new
algorithm at all** — because the hard part in those domains is also evaluation, not estimator
selection.

---

## 6. Required before any novelty claim

1. Read the primary sources for §3's three killers, in full.
2. Implement at least one strong baseline from each killer family. **Sleeping experts + fixed-share
   is mandatory** — it is the cheapest and most likely to win.
3. Run a proper literature review with attention to 2025–2026 work, where my coverage is weakest.
4. Only then, if a failure mode survives all of the above, formulate a mechanism.

The order matters. Implementing our idea first and reviewing the literature afterwards is how six
months disappear.

---

## 7. Recommended reframing

Not:

> "We invented a general framework for adaptive evidence allocation."

But:

> "We built a controlled benchmark for prediction under sparse, nested, non-stationary evidence,
> and used it to measure which established families of estimator actually work there — including
> several that are widely assumed to."

That is defensible today, transfers across domains, and does not require a new algorithm. If a
mechanism gap emerges from Experiment 6 or from the baseline comparisons above, it can be added on
top of a foundation that already stands.

---

## Sources

Search results consulted (abstracts and summaries only; none read in full):

- [Adversarial Online Learning with Changing Action Sets](https://arxiv.org/abs/2003.03490)
- [Near-optimal Per-Action Regret Bounds for Sleeping Bandits](https://arxiv.org/pdf/2403.01315)
- [Learning From Sleeping Experts: Rewarding Informative, Available, and Accurate Experts](https://www.researchgate.net/publication/328773799_Learning_From_Sleeping_Experts_Rewarding_Informative_Available_and_Accurate_Experts)
- [Online Learning: A Modern Introduction Using Convex Optimization](https://arxiv.org/pdf/1912.13213)
- [Dynamic Model Averaging for Practitioners in Economics](https://arxiv.org/pdf/1606.05656)
- [Adaptive Dynamic Model Averaging with an Application to House Price Forecasting](https://arxiv.org/pdf/1912.04661)
- [A loss discounting framework for model averaging and selection in time series models](https://arxiv.org/pdf/2201.12045)
- [Bayesian Ensembling: Insights from Online Optimization and Empirical Bayes](https://arxiv.org/pdf/2505.15638)
- [Bayesball: A Bayesian hierarchical model for evaluating fielding in major league baseball](https://arxiv.org/pdf/0802.4317)
- [Flexible Mixture Priors for Large Time-varying Parameter Models](https://arxiv.org/pdf/2006.10088)
- [Context-specific Credibility-aware Multimodal Fusion with Conditional Probabilistic Circuits](https://arxiv.org/pdf/2603.26629)
- [New evidential reasoning rule with both weight and reliability for evidence combination](https://www.sciencedirect.com/science/article/abs/pii/S0360835218303607)
- [Deep evidential fusion with uncertainty quantification and contextual discounting](https://arxiv.org/pdf/2309.05919)
- [Evaluating the reliability of sources of evidence with a two-perspective approach](https://www.sciencedirect.com/science/article/abs/pii/S002002551930773X)
