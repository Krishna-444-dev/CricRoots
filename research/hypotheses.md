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

**Status: the pre-registered THIRD outcome - architecture usable, not competitive** (Experiment 5)

Experiment 4A supplied a perfect archetype prior via the oracle. `oracleInformedHierarchy` did beat
`global` and `fullHierarchy` in both worlds - but by a modest margin, and it was outperformed by
the joint model. Precise magnitudes are pending the corrected-optimizer re-run (see D13).

**Falsification criterion**: H3 is supported only if `oracleInformedHierarchy` - the current
architecture handed a *perfect* intermediate estimate - beats `global` on Brier by a margin larger
than the optimizer's convergence error (currently ~1e-5 in probability, so any Brier margin above
~1e-5 qualifies) in both worlds. If a perfect intermediate level cannot beat a flat global rate,
the limitation is architectural, not estimation noise. If it beats `global` but still loses to the
joint model, the architecture is usable but not competitive - a third, distinct outcome.

**Result (Experiment 5, converged)**: `oracleInformedHierarchy` beats `global` on Brier by
1.94e-4 (World A) and 1.21e-4 (World B) - both far above the measured 8.7e-7 optimizer-noise floor,
so the first clause of the criterion is met. But it loses to the joint model in both worlds. This
is exactly the third outcome the criterion anticipated: **handed a perfect intermediate estimate,
the sequential architecture can extract real value from it, but still does not compete with joint
estimation.** So noisy intermediate estimation is *a* limitation, not *the* limitation.

---

## H4 - Joint estimation of all effects outperforms sequential empirical-rate blending

> Fitting `mu + batter + bowler + archetypePair + lineLength + interaction` jointly by regularized
> maximum likelihood beats estimating per-bucket rates and blending them through a fixed chain.

**Status: SUPPORTED, on converged numbers** (Experiment 5)

The joint model won on Brier, log loss, Spearman, and oracle MAE in both worlds - while fit once on
training data only, seeing a mean of 34.5 fewer within-match balls per checkpoint than its
competitors. The Spearman gap was large (World A 0.31 -> 0.55; World B 0.31 -> 0.68).

**Falsification criterion**: H4 is unsupported if, under a *converged* optimizer and with the
information handicap removed, the joint model fails to beat `singleLevelShrinkage` (the strongest
sequential baseline) on Brier by more than the convergence error, or fails to beat it on Spearman.
A win on ranking alone with no calibration improvement would support a narrower claim - "better at
ordering options" - and the register would be split accordingly rather than counting it as full
support.

**Converged result (Experiment 5)**: the joint model beats `singleLevelShrinkage` on Brier by
6.4e-4 (World A) and 4.7e-4 (World B), and on Spearman by 0.553 vs 0.310 and 0.683 vs 0.315. The
measured optimizer-noise floor is 8.7e-7, so these margins are ~500x noise. The Experiment 4 caveat
is discharged: the ordering held under a converged optimizer.

**Caveat that must still travel with this**: the joint model's functional form is deliberately the
same as the synthetic generator's own ground truth (D11). This result shows a regularized joint
model recovers a structured sparse-generating process far better than sequential blending does. It
does **not** show it will outperform on real cricket, where no such structural match is guaranteed.

---

## H5 - The joint model's advantage is concentrated in the sparse (0-15) regime

> The original research question was specifically about sparse matchups. If the joint model's
> advantage is uniform across sample sizes, the sparse-data framing is not what explains its win.

**Status: NOT SUPPORTED as stated** (Experiment 5) - and this contradicts the intuitive reading of
the results tables, so the arithmetic is spelled out below.

**Falsification criterion**: H5 is unsupported if the joint model's Brier advantage over
`singleLevelShrinkage` in the 0 and 1 bins is not larger than its advantage in the 5-9 and 10-14
bins. A flat advantage across bins means the win is not a sparse-data phenomenon and the framing
must change even if the headline numbers do not.

**Applied literally, the criterion fails in BOTH worlds.** Joint-online advantage over
`singleLevelShrinkage`, by bin:

| bin | World A | World B |
|---|---:|---:|
| 0 (n=737/800) | +0.000825 | +0.000807 |
| 1 (n=555/567) | +0.001372 | **-0.000101** |
| 2-4 (n=882/865) | +0.000337 | +0.000125 |
| 5-9 (n=328/276) | **-0.000329** | +0.001430 |
| 10-14 (n=18/11) | +0.003587 | +0.008075 |

Mean sparse{0,1} vs dense{5-9,10-14}: World A +0.001099 vs +0.001629; World B +0.000353 vs
+0.004753. The advantage is **larger in the dense bins in both worlds**.

**Excluding the 10-14 bins** (n=18 and n=11 - too small to weigh), the picture splits: World A's
sparse advantage (+0.001099) does exceed its 5-9 advantage (-0.000329), so World A supports H5;
World B's (+0.000353 vs +0.001430) does not. **Mixed at best, and dependent on whether two
tiny bins are included - which is not a basis for a claim either way.**

**What this means for the framing**: the joint model wins overall, but its advantage is *not*
reliably concentrated in the sparse regime. The sparse-data motivation is not what the current
evidence explains the win by. This does not weaken H4; it weakens the *story* attached to H4.

Note a structural constraint already known: the current league configuration produces **no**
checkpoints above 14 exact-matchup balls, so the 15-24 / 25-49 / 50+ bins are empty. This
experiment can therefore only test the *sparse* half of the claim. The convergence half ("methods
converge as n grows") requires a denser configuration - a separate experimental regime, not yet
designed, and this experiment must not be described as answering it.

---

## H6 - Within-match evidence materially improves estimates

> A model that keeps learning as a match unfolds beats the same model fit once beforehand.

**Status: PROVISIONALLY SUPPORTED under a corrected, post-audit noise floor - while the
preregistered criterion itself FAILED in World B** (Experiment 5).

This qualification is permanent and travels with H6 wherever it is cited. The replacement noise
floor is scientifically sound and built from measurements that already existed, but it was
conceived *after* seeing the result. It is therefore not preregistered evidence, and H6 must not
be restated as plain "supported" on the strength of it.

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
lower. **It passed in both worlds** (36 test-match starts, 0 reset violations, 0.00e+0 deviation;
99.0% of post-evidence checkpoints moved; divergence grew with evidence).

**Result**: online beats offline on Brier by 6.784e-5 (World A) and 4.521e-5 (World B), and on
Spearman (0.5603 vs 0.5530; 0.6906 vs 0.6833), in both worlds.

**The criterion as written was unit-inconsistent, and applied literally World B FAILS it.** It
compares a *Brier* difference against 5.7e-5, which was a *probability-scale* fidelity tolerance -
different units. World A's 6.78e-5 clears 5.7e-5; World B's 4.52e-5 does not.

**Corrected with a directly measured floor**: the gate-failed run (fit truncated at 8000) and the
clean run (converged at 12000) differ *only* in optimizer state, so the Brier movement between
them is an empirical measure of optimizer noise. Largest observed: **8.7e-7**. Every non-optimizer
method was bit-identical across the two runs, confirming the harness is fully deterministic and
that this isolates optimizer noise alone. Against that floor, the improvements are **78x** and
**52x** - supported in both worlds.

**Flagged for scrutiny**: "the criterion failed, so I recomputed it more favourably" is exactly the
pattern that should attract suspicion. Three things are offered in mitigation, and the judgement
is the reviewer's, not mine: the unit mismatch is a plain error in the criterion's wording rather
than a matter of interpretation; the replacement floor is *measured*, not chosen; and the
replacement was derived from runs that already existed rather than from anything generated after
seeing this outcome. The literal failure is recorded above and is not withdrawn.

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

---

## H9 - The hierarchy's failure is caused by nested-pool contamination, not (only) archetype noise

> `hierarchicalBlend`'s shrinkage target at each rung contains the observations being shrunk
> (`E_exact ⊂ E_bVsArch ⊂ E_archVsArch ⊂ E_global`, guaranteed by construction). Empirical-Bayes
> shrinkage assumes prior and estimate are independent. Because the prior is pulled toward the
> individual estimate by the individual's own data, the blend moves less than intended -
> systematic **under-shrinkage of precisely the noisiest estimates**.

**Status: UNSUPPORTED** (Experiment 7). The mechanism is real and measurable; correcting it does
not improve prediction. The two statements are separate and both are kept.

See `research/nested-evidence-finding.md` for the measurement. Contamination at the finest rung is
mean 15.6% / median 11.8% / p90 31.3% / max 100% on Experiment 6's training set, with typical pool
sizes of 3 balls (exact) against 18 (batter-vs-bowler-archetype).

**Why it is currently indistinguishable.** Two explanations survive every result to date:

- **H-A (archetype noise)** - the archetype rungs pool on a variable carrying ~0% ground-truth
  variance in World A, injecting noise as a confident prior.
- **H-B (nested contamination)** - the archetype rungs' estimates are contaminated by the exact
  matchup's own observations, producing under-shrinkage.

`fullHierarchyNoArchetype` removed **both at once** - it deleted the archetype rungs *and* dropped
contamination from 15.6% to 0.02% - and came out bit-identical to `singleLevelShrinkage`. So the
Experiment 3a ablation cannot attribute the effect to either. Both remain live.

**Falsification criterion** (fixed now, before any such experiment is designed): H9 is supported
only if a rung that pools by archetype **excluding the target's own observations** (leave-one-out)
measurably outperforms the current contaminated rung, by more than the measured optimizer-noise
floor, on the same checkpoints. If leave-one-out pooling performs the same as the contaminated
version, contamination is not the mechanism and H-A stands alone.

**Additional preregistered measurement, not a pass/fail test**: compare *achieved* shrinkage
`|p_exact - p_final|` against shrinkage toward an uncontaminated prior, stratified by overlap
fraction (0-5%, 5-10%, 10-20%, 20-50%, 50%+). The mechanism predicts achieved shrinkage should fall
progressively short as overlap rises. This is a direct test of the mechanism rather than an
inference from Brier moving.

**Novelty: none in the remedy.** Leave-one-out pooling targets are textbook empirical Bayes, and
correctly specified hierarchical Bayes handles nesting generatively. The defensible claim is a
*measured failure mode of a widely-used practical approximation* in a specific sparse regime - not
a new method. Note this reading is also consistent with H4: the joint model may have won because it
is a correctly specified hierarchical model, not because joint estimation is inherently superior.

---

## Branch procedure after Experiment 6 (fixed in advance)

Recorded so the result does not select the procedure:

- **Drift matters (F1 and F3 pass)** → Branch A: temporal adaptation. H3/H4-style directions from
  the roadmap; sliding-window and fixed-decay baselines mandatory.
- **Drift does not matter (F1 fails)** → Branch B: nested-evidence contamination (H9). Cheaper,
  already has a measured effect size, and needs no new generator.
- **Both matter** → Branch C: the combination - how to aggregate overlapping nested evidence when
  both source reliability and the data-generating process move. This is the only branch whose
  problem statement is specific enough to be plausibly unsolved, and it is also the one most likely
  to be already covered by hierarchical state-space models. Prior-art review first, per
  `general-algorithm-landscape.md` §6.
- **F2 fires** (joint model differentially fragile) → none of the above; that is a finding against
  the current direction and gets reported as one.

---

## H10 - Online adaptation becomes more valuable as distribution shift increases

> If stale historical estimates decay in value under drift while online updating tracks the current
> regime, the online advantage should grow with drift magnitude.

**Status: NOT SUPPORTED** (Experiment 6, F3)

A(m) = Brier(offline) - Brier(online) across m ∈ {0, 0.25, 0.50, 1.00}: **+1.974e-4, +1.494e-4,
+8.530e-5, +1.679e-4** - non-monotonic. A(1.00) - A(0) = **-2.95e-5**, negative where the
preregistered criterion required > +8.7e-5.

**Why this verdict survives the Brier contamination that compromised F1/F2/F4**: F3 compares two
methods *within* the same run - same checkpoints, same realized outcomes, same base rate, same true
probabilities - so the irreducible Brier component is shared and cancels. The cross-run base-rate
artifact does not touch it.

**Corroborating context, not part of the criterion**: the descriptive temporal-block analysis shows
the online advantage growing early→late in C0b and C4-mild but *not* in C4-mod or C4-stress - i.e.
not in the runs with the most drift.

**Consequence**: adaptive forgetting, dynamic player state, and temporal evidence allocation
(roadmap D-III, D-IV, temporal part of D-I) are **not evidence-motivated**. Do not build them.

---

## H9 closure detail (Experiment 7)

**The mechanism was confirmed descriptively.** Achieved shrinkage `ΔS = S_B - S_A` was positive in
both worlds (+3.76e-3 World A, +6.48e-3 World B): the contaminated hierarchy really does shrink
less than the leave-one-out version, exactly as predicted.

**The correction did not help.** Arm B was marginally *worse* than arm A on oracle MAE in both
worlds (0.0319 vs 0.0317; 0.0357 vs 0.0356). G1 NOT MET where archetype carries real signal - the
decisive test by design.

**The H-A / H-B confound is now broken, against H9.** Arm B sat at **-3.1%** (World A) and
**-2.0%** (World B) of the way from arm A to arm C - indistinguishable from A, nowhere near C.
Removing contamination while keeping the archetype rungs recovers none of the deficit; removing the
rungs entirely recovers all of it. **H-A (archetype noise) dominates.**

**Do not rescue H9 with the underpowered G2 trend.** Only one overlap stratum reached the minimum
count, so the trend was not evaluable - but G1's failure alone is sufficient, and does not depend
on G2's power.

**Standing distinction to preserve wherever H9 is cited**: *contamination causes measurable
under-shrinkage* (supported, descriptive) is not the same claim as *removing contamination improves
prediction* (unsupported). The first is a property of the estimator; the second is what would have
made it matter.

---

## The open question after Experiment 7

Not a hypothesis yet - deliberately. What the evidence now jointly implies, with no explanation
attached:

- Archetype carries **genuine signal** in World B (8.84% of logit variance, by construction).
- `oracleArchetypeOnly` beats `global` (0.0276 vs 0.0305 oracle MAE) - so that signal is worth
  having.
- `archetypeOnly` (empirical) is **worse** than `global` (0.0399 vs 0.0305) - so the practical
  estimator is not extracting it.
- Neither contamination (H9) nor archetype irrelevance (H2) explains the gap.
- The joint model beats everything (0.0240).

Something is being lost between "the signal exists" and "the sequential estimator uses it". The
next step is a **diagnostic, not a hypothesis** - see `diagnostics/archetype-estimation-diagnostic.js`.
Naming a mechanism before measuring one is how the last four hypotheses were formed, and three of
them were unsupported.

---

## H11 - Behavioural-neighbourhood transfer exploits latent similarity under sparsity

> If entities share latent behavioural structure, pooling evidence from the most similar entities
> should improve prediction for a sparsely-observed target.

**Status: CLOSED - REFUTED** (World D gates, `diagnostics/world-d-validity-gates.js`)

Refuted under conditions maximally favourable to it. World D+ contains real, strong shared latent
structure (J1: residual surface correlation +0.4631 for the closest decile by z-distance, -0.4702
for the farthest, against 0.0067 overall) and that structure is genuinely predictive (J2a: direct
access to the true latent term improves oracle MAE from 0.036253 to 0.034058). The realised latent
variance share was **19.40%**, above the 10-15% target - so the effect was, if anything, oversized.

Yet **oracle** neighbourhoods - neighbours chosen with perfect knowledge of `z`, a strict upper
bound on any learned similarity metric - lost to plain `global` at every pool size: 0.0971 (K=10),
0.0730 (K=20), 0.0546 (K=40) against 0.0363.

**The failure pattern is diagnostic, not incidental.** MAE improves monotonically with pool size
while converging toward global *from below* - the signature of pure variance cost. Larger pools do
less damage; none adds value. Pooling over a discrete neighbourhood is too variance-expensive at
this sparsity regardless of how well the neighbourhood is chosen.

**This is a finding about the mechanism, not the simulator** - the distinction that D17 required.
J1 and J2a establish the world is sound; the mechanism still failed inside it. No learned
similarity method can beat the oracle it approximates, so this closes the direction rather than
inviting a better similarity metric.

---

## H12 - Low-rank joint estimation exploits latent structure that neighbourhood transfer cannot

> A regularized factor model estimating latent coordinates *jointly* under shrinkage, rather than
> pooling over a discrete neighbourhood, can extract the latent signal J2a showed to exist.

**Status: OPEN.** The natural remaining candidate, and structurally different from H11: it never
forms a neighbourhood, so it is not subject to the pooling variance cost that killed H11.

The specific question, from review, is **not** whether it beats global overall:

> **Does a low-rank model recover useful latent structure BEFORE there is enough data to estimate
> individual effects directly?**

That is what would make the latent structure worth having. If it only helps once individual effects
are already estimable, it adds nothing at the sparsity CricRoots actually operates in.

Design: `research/experiment-8-design.md`. Not yet implemented.
