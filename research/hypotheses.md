# Hypothesis register

Each hypothesis, its current evidential status, and what would change that status. Status values
are deliberately limited to: **UNTESTED**, **SUPPORTED**, **UNSUPPORTED**, **REFUTED**,
**SUPERSEDED**.

"Unsupported" means the evidence does not support it. It does not mean "false" - that distinction
is load-bearing and is kept throughout.

Every hypothesis carries an explicit **falsification criterion**, stated in operational terms
before any implementation begins. The purpose is to make each hypothesis decidable in advance, so
that a result cannot be reinterpreted after the fact into whatever the numbers happened to
support. Where a criterion was written after the experiment that bears on it, that is stated
plainly rather than backdated.

---

## H1 - Hierarchical shrinkage beats simpler baselines when identity-level data is sparse

> The four-level backoff chain in `getMatchupPlan` (exact matchup -> batter vs bowler-archetype ->
> archetype vs archetype -> global) produces better dismissal-probability estimates than a global
> rate or a single-level shrinkage, in the 0-15-observation regime typical of grassroots cricket.

**Status: UNSUPPORTED** (Experiments 2, 3a, 3b)

`fullHierarchy` scored *worse* than both `global` and `singleLevelShrinkage` on Brier and Spearman
in every valid experiment so far, in both a world where archetype carries no signal and one where
it carries 8.84% of ground-truth variance.

**Falsification criterion** (written after Experiments 2/3, stated retrospectively - not
backdated): H1 is supported only if `fullHierarchy` achieves a *lower* Brier score AND a *higher*
Spearman correlation than BOTH `global` and `singleLevelShrinkage`, on the same checkpoints, in the
0-14 exact-matchup-balls regime. Beating only one baseline, or winning on one metric while losing
the other, does not count.

**What would change the status**: a sparsity regime, population size, or `k` value under which
that criterion is met. None has been found, but the space has not been swept.

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

**Falsification criterion applied**: H2 predicted that in a world where archetype carries genuine
signal, `fullHierarchy` would beat `global`. It was pre-registered in `world-b-design.md` before
World B was generated. World B delivered 8.84% archetype variance and `fullHierarchy` still lost
(0.061925 vs 0.061510). The criterion fired against the hypothesis.

---

## H3 - The bottleneck is noisy *empirical estimation* of intermediate levels, not the architecture

> If the archetype level's estimate were perfect, sequential blending would recover the signal.

**Status: partially addressed, awaiting the converged re-run** (Experiment 4A)

Experiment 4A supplied a perfect archetype prior via the oracle. `oracleInformedHierarchy` did beat
`global` and `fullHierarchy` in both worlds - but by a modest margin, and it was outperformed by
the joint model. Precise magnitudes are pending the corrected-optimizer re-run (see D13).

**Falsification criterion**: H3 is supported only if `oracleInformedHierarchy` - the current
architecture handed a *perfect* intermediate estimate - beats `global` on Brier by a margin larger
than the optimizer's convergence error (currently ~1e-5 in probability, so any Brier margin above
~1e-5 qualifies) in both worlds. If a perfect intermediate level cannot beat a flat global rate,
the limitation is architectural, not estimation noise. If it beats `global` but still loses to the
joint model, the architecture is usable but not competitive - a third, distinct outcome.

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

**Falsification criterion**: H4 is unsupported if, under a *converged* optimizer and with the
information handicap removed, the joint model fails to beat `singleLevelShrinkage` (the strongest
sequential baseline) on Brier by more than the convergence error, or fails to beat it on Spearman.
A win on ranking alone with no calibration improvement would support a narrower claim - "better at
ordering options" - and the register would be split accordingly rather than counting it as full
support.

**Caveat that must travel with this**: the optimizer was not converged (D13). The ranking gap is
far too large to be convergence noise, but the Brier margins are only ~4x the convergence error
and should not be cited until Experiment 5 reports converged values.

---

## H5 - The joint model's advantage is concentrated in the sparse (0-15) regime

> The original research question was specifically about sparse matchups. If the joint model's
> advantage is uniform across sample sizes, the sparse-data framing is not what explains its win.

**Status: UNTESTED** - Experiment 5 reports the per-method sample-efficiency breakdown that
answers it directly.

**Falsification criterion**: H5 is unsupported if the joint model's Brier advantage over
`singleLevelShrinkage` in the 0 and 1 bins is not larger than its advantage in the 5-9 and 10-14
bins. A flat advantage across bins means the win is not a sparse-data phenomenon and the framing
must change even if the headline numbers do not.

Note a structural constraint already known: the current league configuration produces **no**
checkpoints above 14 exact-matchup balls, so the 15-24 / 25-49 / 50+ bins are empty. This
experiment can therefore only test the *sparse* half of the claim. The convergence half ("methods
converge as n grows") requires a denser configuration - a separate experimental regime, not yet
designed, and this experiment must not be described as answering it.

---

## H6 - Within-match evidence materially improves estimates

> A model that keeps learning as a match unfolds beats the same model fit once beforehand.

**Status: UNTESTED** - Experiment 5's `jointRegularizedLogitOnline` vs `jointRegularizedLogit`
comparison is exactly this contrast, on identical checkpoints within a single run.

**Falsification criterion** (pre-registered in `experiment-5-design.md` before the run): H6 is
unsupported if `jointRegularizedLogitOnline`'s Brier is not lower than `jointRegularizedLogit`'s by
more than the online procedure's measured fidelity error (5.7e-5 in probability, D14). Three
distinguishable outcomes: online > offline supports H6; online ~= offline means within-match
evidence adds nothing at this scale and Experiment 4's handicap was immaterial rather than
generous; online < offline means the update rule is harming the model, and the fidelity check is
what separates that from a formulation problem.

**Prerequisite before any of the above is read**: the mechanical verification in
`research/diagnostics/verify-information-flow.js` must pass. If the online model did not actually
update, or the per-match reset failed, the comparison is meaningless regardless of which score is
lower.

---

## H7 - Behavioral similarity is a better intermediate level than declared archetype

> Pooling by *learned statistical similarity* rather than by registration-form categories
> (handedness, bowling style) would give the hierarchy an intermediate level that actually carries
> information.

**Status: UNTESTED, not yet designed.** Deliberately not implemented. The evidence motivating it
is real (D6, H2), but building it now would mean inventing an algorithm before the simpler
question - whether joint estimation already captures what a similarity structure would add - has
been answered.

**Falsification criterion, fixed now so it cannot be softened later**: a behavioral-similarity
intermediate level is supported only if it beats the strongest joint-model variant available at
the time, on pre-declared calibration (Brier) AND ranking (Spearman) metrics, in the sparse regime,
by a margin exceeding optimizer convergence error - and only if the similarity structure is learned
from training data alone, with no access to held-out matches or ground-truth parameters. Beating
only the *sequential hierarchy* would not count: that bar has already been cleared by a simpler
method.

---

## H8 - Adaptive evidence allocation beats a fixed `k` and a fixed chain

> Weights over evidence sources learned as a function of sample size, variance, and similarity
> outperform `k = 15` applied uniformly at every rung.

**Status: UNTESTED, not yet designed.** Same reasoning as H7. Note that the joint model is already
a partial answer: regularized joint estimation implicitly allocates evidence across effects
without a hand-set chain, and H4's result is the first evidence that doing so helps.

**Falsification criterion, fixed now so it cannot be softened later**: adaptive evidence allocation
is supported only if it improves pre-registered calibration (Brier) and/or ranking (Spearman)
metrics over the *strongest baseline available at that time* - which currently means the joint
regularized model, not `k=15` sequential shrinkage - across the pre-declared sparse-data regime, by
a margin exceeding optimizer convergence error. Any weighting function it learns must be fit on
training data only. If it wins only against the sequential hierarchy, or only after its weighting
function has seen evaluation data, the hypothesis is unsupported.
