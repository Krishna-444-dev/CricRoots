# Hypothesis register

Each hypothesis, its current evidential status, and what would change that status. Status values
are deliberately limited to: **UNTESTED**, **SUPPORTED**, **UNSUPPORTED**, **REFUTED**,
**SUPERSEDED**.

"Unsupported" means the evidence does not support it. It does not mean "false" - that distinction
is load-bearing and is kept throughout.

---

## H1 - Hierarchical shrinkage beats simpler baselines when identity-level data is sparse

> The four-level backoff chain in `getMatchupPlan` (exact matchup -> batter vs bowler-archetype ->
> archetype vs archetype -> global) produces better dismissal-probability estimates than a global
> rate or a single-level shrinkage, in the 0-15-observation regime typical of grassroots cricket.

**Status: UNSUPPORTED** (Experiments 2, 3a, 3b)

`fullHierarchy` scored *worse* than both `global` and `singleLevelShrinkage` on Brier and Spearman
in every valid experiment so far, in both a world where archetype carries no signal and one where
it carries 8.84% of ground-truth variance.

**What would change this**: a sparsity regime, population size, or `k` value under which the
ordering reverses. None has been found, but the space has not been swept.

---

## H2 - The hierarchy fails *because* the archetype levels are statistically meaningless

**Status: REFUTED as a complete explanation** (Experiment 3b)

Experiment 3b built a world where archetype genuinely predicts the outcome (8.84% of logit
variance, verified). The hierarchy still lost to global and single-level shrinkage. Archetype
irrelevance therefore cannot be the whole story.

The *partial* version survives: Experiment 3a showed that removing the archetype rungs recovers
`singleLevelShrinkage` bit-for-bit, and the diagnostic showed those rungs pool on a variable with
~0% ground-truth variance in World A. So the rungs do inject noise there - it just is not
sufficient to explain the failure in World B.

---

## H3 - The bottleneck is noisy *empirical estimation* of intermediate levels, not the architecture

> If the archetype level's estimate were perfect, sequential blending would recover the signal.

**Status: partially addressed, awaiting the converged re-run** (Experiment 4A)

Experiment 4A supplied a perfect archetype prior via the oracle. `oracleInformedHierarchy` did beat
`global` and `fullHierarchy` in both worlds - but by a modest margin, and it was outperformed by
the joint model. Precise magnitudes are pending the corrected-optimizer re-run (see D13).

**What would settle it**: the Experiment 5 numbers, where the oracle methods are unaffected by the
optimizer defect (they do not use the optimizer) but their competitors are re-measured.

---

## H4 - Joint estimation of all effects outperforms sequential empirical-rate blending

> Fitting `mu + batter + bowler + archetypePair + lineLength + interaction` jointly by regularized
> maximum likelihood beats estimating per-bucket rates and blending them through a fixed chain.

**Status: SUPPORTED, but precise numbers SUPERSEDED pending re-measurement** (Experiment 4B)

The joint model won on Brier, log loss, Spearman, and oracle MAE in both worlds - while fit once on
training data only, seeing a mean of 34.5 fewer within-match balls per checkpoint than its
competitors. The Spearman gap was large (World A 0.31 -> 0.55; World B 0.31 -> 0.68).

**Caveat that must travel with this**: the optimizer was not converged (D13). The ranking gap is
far too large to be convergence noise, but the Brier margins are only ~4x the convergence error
and should not be cited until Experiment 5 reports converged values.

---

## H5 - The joint model's advantage is concentrated in the sparse (0-15) regime

> The original research question was specifically about sparse matchups. If the joint model's
> advantage is uniform across sample sizes, the sparse-data framing is not what explains its win.

**Status: UNTESTED** - Experiment 5 reports the per-method sample-efficiency breakdown that
answers it directly.

Note a structural constraint already known: the current league configuration produces **no**
checkpoints above 14 exact-matchup balls, so the 15-24 / 25-49 / 50+ bins are empty. Testing the
convergence half of this hypothesis ("methods converge as n grows") would require a denser
configuration - a separate experiment, not yet designed.

---

## H6 - Within-match evidence materially improves estimates

> A model that keeps learning as a match unfolds beats the same model fit once beforehand.

**Status: UNTESTED** - Experiment 5's `jointRegularizedLogitOnline` vs `jointRegularizedLogit`
comparison is exactly this contrast, on identical checkpoints within a single run.

**Pre-registered falsifiers**: if online ≈ offline, within-match evidence adds nothing at this
scale and Experiment 4's handicap was immaterial rather than generous. If online < offline, the
update rule is harming the model - and the fidelity check (D14) is what distinguishes that from a
formulation problem.

---

## H7 - Behavioral similarity is a better intermediate level than declared archetype

> Pooling by *learned statistical similarity* rather than by registration-form categories
> (handedness, bowling style) would give the hierarchy an intermediate level that actually carries
> information.

**Status: UNTESTED, not yet designed.** Deliberately not implemented. The evidence motivating it
is real (D6, H2), but building it now would mean inventing an algorithm before the simpler
question - whether joint estimation already captures what a similarity structure would add - has
been answered.

---

## H8 - Adaptive evidence allocation beats a fixed `k` and a fixed chain

> Weights over evidence sources learned as a function of sample size, variance, and similarity
> outperform `k = 15` applied uniformly at every rung.

**Status: UNTESTED, not yet designed.** Same reasoning as H7. Note that the joint model is already
a partial answer: regularized joint estimation implicitly allocates evidence across effects
without a hand-set chain, and H4's result is the first evidence that doing so helps.
