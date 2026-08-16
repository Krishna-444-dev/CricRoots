# Algorithm innovation roadmap

**Status: ROADMAP ONLY. No code. No new experiments. Experiment 6 is frozen and running.**

A menu of candidate research directions with the evidence standing behind each, written so that
when Experiment 6 finishes we can choose from a prepared set rather than inventing a justification
around whatever the results happen to show. Nothing here is authorized for implementation.

Companion documents: `decisions.md` (methodological choices), `hypotheses.md` (evidential status),
`research-log.md` (what was run and what came back), `protocol.md` (the governing principle).

---

## 0. The honest problem with "novelty", stated first

This section comes first deliberately, because it constrains everything below.

**Almost none of the ten directions is a novel technique.** Each has substantial prior art:

| Direction | Established field it belongs to |
|---|---|
| Adaptive evidence allocation | mixture-of-experts, gating networks, stacking, Bayesian model averaging |
| Behavioral similarity | collaborative filtering, k-NN pooling, embeddings, matrix factorization |
| Dynamic player state | state-space models, Kalman filtering, dynamic Elo/Glicko, HMMs |
| Adaptive forgetting | adaptive forgetting factors in recursive least squares; concept-drift detection |
| Evidence graph | relational learning, graph neural networks, label propagation |
| Matchup interaction discovery | factorization machines, tensor decomposition, latent factor models |
| Decision-theoretic utility | textbook decision theory |
| Counterfactual intelligence | causal inference, uplift modelling |
| Uncertainty-aware recommendation | Bayesian decision theory, bandits with confidence bounds |
| Active learning | active learning / optimal experimental design |

*Caveat on this table*: it reflects general familiarity with these fields, **not** a literature search
performed for this project. No novelty claim in this document may be made without a proper prior-art
review first - the same discipline applied to the original matchup-shrinkage idea.

So "we applied technique X to cricket" is **not** a contribution. Three things plausibly could be:

**(a) An empirical contribution.** A rigorous, reproducible finding about *which* estimator families
work in a specific, well-characterised regime - sparse, evolving, entity-pair prediction with
known ground truth. This is the one we have already partly produced.

**(b) A mechanism contribution.** A genuinely new component, justified by a failure mode that
existing techniques demonstrably do not address. This requires the failure mode to exist and to be
shown resistant to off-the-shelf methods. We have no such demonstration yet.

**(c) A benchmark contribution.** The synthetic worlds, leakage-controlled harness, oracle
instruments, and preregistered criteria are reusable infrastructure for a problem class that is not
cricket-specific. Arguably the most defensible thing built so far.

**The most likely honest outcome is (a) and (c), not (b).** That should be stated plainly rather
than discovered late. A negative result - "sequential hierarchical shrinkage does not beat a
regularized joint model in this regime, and here is the framework that shows it" - is a real
contribution and does not need an invented algorithm attached to it.

---

## 1. Classification scheme

| Label | Meaning |
|---|---|
| **EVIDENCE-MOTIVATED** | A measured result in this repository points at it |
| **READY FOR EXPERIMENT** | Evidence-motivated *and* a falsifiable design could be written now |
| **AWAITING EXPERIMENT 6** | Its justification depends on a result that does not yet exist |
| **NOT YET JUSTIFIED** | Interesting; no evidence in this repository demands it |

Nothing is labelled "ready to implement". That label does not exist here on purpose.

---

## 2. What the evidence currently establishes

Grounding, so each direction below can be checked against it rather than against intuition:

- **H1 UNSUPPORTED** - sequential hierarchical shrinkage lost to `global` and
  `singleLevelShrinkage` in both worlds.
- **H2 REFUTED as a complete explanation** - making archetype genuinely informative (8.84% of
  logit variance) did not rescue the hierarchy.
- **H3, third outcome** - a *perfect* archetype prior beat `global` (1.9e-4 / 1.2e-4) but still lost
  to joint estimation. Noisy intermediate estimation is *a* limitation, not *the* limitation.
- **H4 SUPPORTED (converged)** - joint regularized estimation beat every sequential method on
  Brier, log loss, Spearman, and oracle MAE in both worlds, at ~500x the noise floor.
- **H5 NOT SUPPORTED** - the joint model's advantage is **not** concentrated in the sparse regime.
  This one constrains several directions below and is easy to forget.
- **H6 PROVISIONALLY SUPPORTED** - online updating helped, at 78x/52x a measured noise floor, but
  the original preregistered criterion failed in World B and the replacement was post-audit.
- **Ground-truth variance** (World A): batter 34.4%, bowler 33.0%, line×length 22.0%,
  batter×bowler interaction 8.6%, batter line/length response 2.6%.
- **Structural**: mean-zero drift leaves `global` near-invariant by construction; `k=15` gives
  individual data ≤16% of blend weight for 86% of checkpoints.

---

## 3. The directions

### D-I. Adaptive evidence allocation

**Classification: AWAITING EXPERIMENT 6**

- **Motivating evidence** — H4: joint estimation, which allocates evidence across effects implicitly
  via regularization, beat a hand-specified chain with fixed `k`. H3: even a perfect intermediate
  level did not close the gap, so *what* is pooled matters less than *how* pooling is decided.
- **Known limitation** — `k=15` is uniform across every rung and every context. The diagnostic
  measured its consequence directly: individual data almost never gets meaningful weight in this
  regime.
- **Research hypothesis** — Weights over evidence sources, learned as a function of sample size,
  variance, similarity, and detected shift, outperform a fixed regularization scheme.
- **Potential novelty** — Low as a technique (mixture-of-experts with a gating network). Possible as
  a mechanism *only if* Experiment 6 shows a failure mode that uniform regularization cannot
  express and context-dependent weighting can.
- **Required data** — None new; existing synthetic worlds suffice for a first test.
- **Potential baselines** — The joint model (offline and online) is the bar, **not** the sequential
  hierarchy. H8's preregistered criterion already fixes this: beating only the hierarchy would not
  count, since a simpler method already cleared it.
- **Failure condition** — Fails if it cannot beat the plain joint model by more than the measured
  noise floor, or if its gating weights must be fit on anything other than training data.
- **Product relevance** — High if real. A coach-facing system that knows when to distrust thin
  history is directly useful.
- **Honest risk** — The joint model may already capture most of this. Regularized joint estimation
  *is* a form of evidence allocation; adding an explicit allocator on top may be re-parameterising
  what already works.

---

### D-II. Behavioral similarity instead of static archetypes

**Classification: NOT YET JUSTIFIED**

- **Motivating evidence** — H2 and the diagnostic: declared archetypes (`battingStyle`,
  `bowlingStyle`) carried ~0% of ground-truth variance in World A, and archetype pooling actively
  hurt. Learned similarity is the obvious replacement.
- **Known limitation** — Registration-form categories are not behaviour.
- **Research hypothesis** — Continuous, behaviour-derived similarity transfers information between
  sparse matchups without the noise that static archetype pooling introduced.
- **Potential novelty** — Low. This is collaborative filtering / neighbourhood pooling.
- **Required data** — Existing worlds can test it, but with an important catch below.
- **Potential baselines** — Joint model; joint model plus an interaction term.
- **Failure condition** — Fails if it does not beat the joint model, or if its similarity structure
  requires held-out data to construct.
- **Product relevance** — Moderate. Explaining "similar to these players" is intuitive for coaches.
- **Why NOT YET JUSTIFIED, and this is the important part** — In the current synthetic worlds,
  behavioural similarity is *definitionally* a proxy for `vulnerability` and `effectiveness`, which
  the joint model already estimates directly as free parameters. A similarity method would at best
  recover what the joint model has by construction. **Testing this in the current worlds would
  produce a result that says nothing about real cricket.** It needs either a generator where
  similarity carries structure the joint model cannot express (e.g. shared latent factors across
  players), or real data. Building it now would be answering an easier question than the one that
  matters.

---

### D-III. Dynamic player state

**Classification: AWAITING EXPERIMENT 6**

- **Motivating evidence** — None yet. Experiment 6 exists precisely to determine whether temporal
  drift is a real failure mode.
- **Known limitation** — Every method evaluated so far assumes stationarity.
- **Research hypothesis** — Separating long-term skill from a current latent state predicts better
  under drift than a single time-invariant parameter per entity.
- **Potential novelty** — Low. State-space models over player ability are well established in sports
  analytics.
- **Required data** — World C provides it. Real data would be needed for any external claim.
- **Potential baselines** — Joint offline, joint online, and (importantly) a *trivial* recency
  baseline such as training only on the most recent N matches. If a sliding window matches a latent
  state model, the latent state adds nothing.
- **Failure condition** — Fails if F1 shows drift does not damage entity-dependent prediction, or if
  a sliding-window baseline performs equivalently.
- **Product relevance** — High and intuitive: "this batter has changed recently" is a real coaching
  observation.
- **Note** — The sliding-window baseline is the honest comparator and is easy to omit. Without it,
  any latent-state model will look good simply because it discounts old data at all.

---

### D-IV. Adaptive forgetting

**Classification: AWAITING EXPERIMENT 6**

- **Motivating evidence** — Same as D-III; contingent on F1/F3.
- **Known limitation** — The online model currently absorbs all evidence with equal weight; nothing
  distinguishes stale from current.
- **Research hypothesis** — A forgetting factor learned from observed disagreement between
  historical prior and recent evidence outperforms both no forgetting and a fixed decay constant.
- **Potential novelty** — Low as a technique (adaptive forgetting in RLS; concept-drift detectors
  such as ADWIN/DDM are a mature subfield). Moderate *if* the adaptation signal is derived from
  something specific to matchup structure rather than generic residual monitoring.
- **Required data** — World C.
- **Potential baselines** — **Fixed decay at several rates is mandatory.** The interesting claim is
  not "forgetting helps" but "*learned* forgetting beats the best *fixed* forgetting" - and the
  latter must be tuned on training data only.
- **Failure condition** — Fails if the best fixed decay rate matches learned forgetting within the
  noise floor. This is the single most likely way this direction dies, and the comparison must be
  preregistered before implementation.
- **Product relevance** — Moderate; largely invisible to the user.

---

### D-V. Dynamic evidence graph

**Classification: NOT YET JUSTIFIED**

- **Motivating evidence** — Indirect. H1/H2/H3 show a *fixed* hierarchy is the wrong structure; a
  graph generalises it.
- **Known limitation** — The backoff chain is hand-specified and identical for every prediction.
- **Research hypothesis** — Letting the model determine which neighbouring evidence is relevant
  per-prediction beats any fixed structure.
- **Potential novelty** — Low-moderate; relational learning applied to a new domain.
- **Required data** — Would need a generator with richer relational structure than currently exists.
- **Potential baselines** — Joint model; adaptive evidence allocation (D-I) if it exists by then.
- **Failure condition** — Fails if it does not beat D-I, which is a far simpler expression of the
  same idea.
- **Product relevance** — Low directly; potentially high for explanation.
- **Why NOT YET JUSTIFIED** — This is D-I with more machinery. It should not be attempted before
  D-I has been tried and found insufficient, and it carries a high overfitting risk at grassroots
  data scale. It is also the direction most likely to look impressive while adding nothing
  measurable - which is exactly the failure mode this programme exists to avoid.

---

### D-VI. Matchup interaction discovery (transferable mechanisms)

**Classification: EVIDENCE-MOTIVATED, and the strongest untested candidate**

- **Motivating evidence** — The ground-truth decomposition: batter×bowler interaction is a real
  **8.6%** of variance, and `batterLineLengthResponse` a further 2.6% that **no method in the
  comparison currently models at all** (D11). The joint model's interaction term is a free
  parameter per pair, so it can only learn pairs it has actually observed - and at this sparsity
  most pairs have 0-4 balls.
- **Known limitation** — Per-pair interaction parameters do not transfer. Observing that batter A
  struggles against left-arm spin tells the current model nothing about batter A versus a
  *different* left-arm spinner.
- **Research hypothesis** — A low-rank or factored interaction structure (batter latent factors ×
  bowler latent factors) recovers interaction signal from sparse data better than free per-pair
  parameters, because it shares statistical strength across pairs.
- **Potential novelty** — Low as a technique (factorization machines / low-rank interaction is
  standard). But the *empirical question* - whether factored interaction beats free per-pair
  parameters in a regime where nearly every pair has fewer than five observations - is a genuine
  and answerable one.
- **Required data** — **None new.** The current worlds already contain the necessary structure, and
  the oracle can measure recovery of the interaction term specifically.
- **Potential baselines** — Joint model with free per-pair interaction (current); joint model with
  interaction removed entirely (an ablation not yet run, and a cheap, informative one).
- **Failure condition** — Fails if factored interaction does not beat free per-pair interaction by
  more than the noise floor, or if removing interaction entirely turns out to cost nothing - which
  would indicate the 8.6% is simply unrecoverable at this sparsity.
- **Product relevance** — High. "This batter is vulnerable to *this type of delivery from this type
  of bowler*" is precisely the tactical output the product wants.
- **Why this ranks highest** — It is the only direction whose motivating evidence is a *measured
  quantity of unexploited signal* (8.6% + 2.6%) rather than a plausible story, it needs no new
  data, and it has a cheap preliminary ablation that could kill it quickly. Note it is also
  compatible with H5: it does not claim a sparsity-specific advantage.

---

### D-VII. Decision-theoretic utility

**Classification: NOT YET JUSTIFIED (as research); worth doing as product work**

- **Motivating evidence** — D1: the composite runs+wickets target was deliberately deferred, not
  rejected. The product ultimately wants a bowling recommendation, not a probability.
- **Known limitation** — Dismissal probability is an intermediate quantity.
- **Research hypothesis** — Ranking options by expected tactical utility produces better
  recommendations than ranking by dismissal probability.
- **Potential novelty** — None. This is applying decision theory.
- **Required data** — Would require the generator to model runs realistically; it currently does not
  (run-scoring is deliberately simplistic, see `generator.js`).
- **Potential baselines** — Ranking by dismissal probability alone.
- **Failure condition** — Not really falsifiable as stated - "better recommendations" needs a
  ground-truth utility, which would have to be asserted rather than measured.
- **Product relevance** — High.
- **Note** — This is a **product decision about the objective**, not a research question, and it
  introduces a weighting parameter with no principled value (the exact reason D1 deferred it).
  Keep it out of the shrinkage research entirely.

---

### D-VIII. Counterfactual matchup intelligence

**Classification: NOT YET JUSTIFIED — and the highest-risk item here**

- **Motivating evidence** — None. Purely product-driven.
- **Known limitation** — The current system is descriptive.
- **Research hypothesis** — "What if we bowled differently?" can be estimated from observational
  ball-by-ball data.
- **Potential novelty** — Low as technique; **high risk of being wrong**.
- **Required data** — Real data with genuine variation in bowling strategy, plus defensible
  identification assumptions.
- **Potential baselines** — Conditional prediction without any causal claim.
- **Failure condition** — Fails if bowling choices are confounded with match state, which they
  certainly are in real cricket: bowlers choose deliveries *because of* the situation.
- **Product relevance** — Very high, which is precisely the danger.
- **Explicit warning** — A model that conditions on line and length is **not** estimating the causal
  effect of choosing that line and length. In real data, delivery choice is confounded by score,
  overs remaining, field settings, and the bowler's read of the batter. Presenting conditional
  predictions as counterfactual recommendations would be a genuine misrepresentation to users, not
  merely an overclaim. If pursued at all, this needs explicit identification assumptions stated up
  front. Note the current synthetic worlds cannot test this: delivery choice there is
  uniform-random, i.e. unconfounded by construction, so any method would appear to work.

---

### D-IX. Uncertainty-aware recommendations

**Classification: READY FOR EXPERIMENT**

- **Motivating evidence** — Strong and specific. `rawExactMatchup` produced a *better* Brier score
  (0.0364) than every other method in World A while making predictions on only 110 of 2,520
  checkpoints - the exact shape of a confident-looking estimate built on almost no data. The
  diagnostic also showed that at `k=15`, 86% of checkpoints have <=16% individual weight; the
  system currently has the information to know when it is guessing, and does not surface it.
- **Known limitation** — Every method emits a point estimate. The product would rank three bowling
  options by point estimate alone, even when the gaps are well inside the uncertainty.
- **Research hypothesis** — Ranking rules that account for estimate uncertainty produce better
  *decisions* than point-estimate ranking, even when point-estimate calibration is unchanged.
- **Potential novelty** — Low as technique. But it is directly testable **now**, needs no new
  method, and connects to a real measured pathology.
- **Required data** — None. `getMatchupPlan` already returns `confidence` and `historicalSampleSize`;
  the joint model can produce parameter uncertainty; the oracle gives ground truth for scoring
  decision quality.
- **Potential baselines** — Point-estimate ranking (current behaviour).
- **Failure condition** — Fails if uncertainty-aware ranking does not improve a preregistered
  decision-quality metric (e.g. regret against the oracle's true best option) over point-estimate
  ranking.
- **Product relevance** — High and immediate; it changes what a coach is shown.
- **Why READY** — A falsifiable design could be written today against existing data and existing
  methods. It also tests a *different* dependent variable (decision regret rather than calibration),
  which makes it complementary to everything else rather than another leaderboard entry.

---

### D-X. Online active learning

**Classification: NOT YET JUSTIFIED**

- **Motivating evidence** — None.
- **Known limitation** — The system passively consumes whatever is bowled.
- **Research hypothesis** — Choosing deliveries partly for information gain improves future
  predictions.
- **Potential novelty** — Low as technique; the *application* is unusual.
- **Required data** — Would need a simulator where the recommendation influences what is bowled -
  a closed loop the current harness does not have.
- **Potential baselines** — Greedy exploitation.
- **Failure condition** — Fails if information gained does not offset tactical cost.
- **Product relevance** — Low, and arguably negative: recommending a delivery *because it is
  informative* rather than because it is tactically best is asking a coach to sacrifice the current
  match for future model quality. That is a hard sell and an ethical wrinkle worth naming.

---

## 4. Ranking, as the evidence currently stands

1. **D-VI (matchup interaction discovery)** - only direction motivated by a measured quantity of
   unexploited signal; needs no new data; has a cheap killing ablation.
2. **D-IX (uncertainty-aware recommendations)** - testable now, tests a different dependent
   variable, addresses a measured pathology.
3. **D-I / D-III / D-IV** - all contingent on Experiment 6. Ranking among them depends on F5.
4. **D-II, D-V** - interesting, but currently untestable in a way that would mean anything.
5. **D-VII, D-VIII, D-X** - product or out-of-scope; D-VIII carries a real misrepresentation risk.

---

## 5. Decision procedure when Experiment 6 completes

Fixed now, so the result does not select the procedure:

- **If F1 fails** (drift does not damage entity-dependent prediction): D-III, D-IV, and the temporal
  part of D-I lose their justification. Do not pursue them. The next step is D-VI or real data.
- **If F1 passes and F3 fails** (drift damages, fixed online adaptation does not recover it):
  adaptation is not the lever. Investigate *why* before proposing an adaptive algorithm.
- **If F1 and F3 pass, and a ceiling remains**: D-III and D-IV become evidence-motivated, and F5
  selects which - interaction drift → matchup-level forgetting; player drift → entity-level
  recency; context drift → context-conditional regularization.
- **If F2 fires** (the joint model is *differentially fragile* under drift): that is a finding
  against the current direction and must be reported as such, not routed around by adding an
  adaptive layer.
- **Regardless of the above**: D-VI and D-IX remain available, since neither depends on drift.

---

## 6. What we say if there is no novel algorithm

A stated-in-advance acceptable outcome:

> The existing sequential hierarchical shrinkage engine was tested against a regularized joint
> model in controlled synthetic environments with known ground truth. The joint model outperformed
> it consistently. No further algorithmic novelty was required; the contribution is the evaluation
> framework and the negative result.

That is a legitimate research outcome and a legitimate engineering outcome. It would mean replacing
the matchup engine with a better-understood standard method - which is a real improvement to the
product, arrived at by evidence rather than by preference.

The failure mode to avoid is the opposite: inventing a mechanism so that the programme has
something novel to point at. Every direction above is written with a failure condition specifically
so that outcome stays visible and rejectable.

---

## 7. Standing constraints

- Nothing here is authorized for implementation.
- Experiment 6 is frozen; this document does not touch its protocol, and was written while it ran.
- No production code changes.
- Any future implementation requires its own preregistered design document with falsification
  criteria, following the pattern of `experiment-4/5/6-design.md`.
- Any novelty claim requires a prior-art review first (§0).
- Baselines must be the strongest available method at the time, never the sequential hierarchy
  alone - that bar has already been cleared by a simpler method.
