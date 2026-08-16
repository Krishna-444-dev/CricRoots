# Experiment 5 design - online joint estimation under a live information boundary

Written before implementing, same discipline as `league-design.md`, `world-b-design.md`, and
`experiment-4-design.md`. The online update strategy and evaluation protocol are fixed here, in
advance, and are not adjusted after seeing any result.

## Why this experiment exists

Experiment 4's `jointRegularizedLogit` beat every other method in both worlds, but it was fit
**once** on training matches only and never saw the current test match's already-revealed balls -
a mean of 34.5 balls per checkpoint that every database-querying method did see. That handicap
makes the result directionally safe (it won with less information) but leaves the deployment-
relevant question unanswered:

> Can a jointly-estimated model keep learning from sparse evidence *as a match unfolds*, under the
> exact same information boundary as the sequential methods it is being compared against?

Experiment 5 removes the handicap and puts every method on precisely equal information.

## The online procedure, defined in advance

A new method, `jointRegularizedLogitOnline`, evaluated on the identical checkpoints as everything
else. Its full specification:

1. **Base fit (once per experiment).** Fit on training matches only, with lambda selected by the
   same 3-fold cross-validation over training rows only. Identical to Experiment 4's model. Test
   data never influences lambda, and lambda is **not** re-selected online - it stays fixed for the
   whole experiment. Re-tuning it mid-run would make it a moving target and would be a form of
   adapting to the evaluation.
2. **Per-test-match reset.** At the start of each held-out test match, the online model is rebuilt
   from a deep copy of the base parameters, the base design (index maps), and fresh optimizer
   state. Nothing learned during test match *k* survives into test match *k+1*. This is the same
   cross-match leakage boundary the database side enforces by deleting each test match document
   after evaluating it - without the reset, a `(batter, bowler)` interaction coefficient learned
   in one test match would silently leak into the next.
3. **Predict-then-reveal, per ball.** At checkpoint *i*, the model predicts using parameters that
   have seen training data plus balls `0..i-1` of this match only. Ball *i* is then revealed and
   appended to the model's live dataset, exactly when it is pushed into the match document for the
   database-querying methods. Same boundary, same instant.
4. **The update itself.** On each revealed ball: **100 warm-start Adam iterations over the full
   current dataset** (all training rows plus this match's revealed balls), starting from the
   current parameters, with Adam moment state persisted across updates within a match and reset at
   the match boundary along with everything else.

**Why a bounded warm-start budget rather than a full cold refit**: a full refit at all 2,520
checkpoints is computationally prohibitive. Because consecutive checkpoints differ by exactly one
observation out of ~14,300, a warm start begins essentially at the optimum already.

**That assumption was verified, not asserted - and verifying it found a real defect.**
`research/models/online-fidelity-check.js` compares warm-start predictions against a fully
converged cold refit on identical data. Running it exposed two problems, both fixed before any
Experiment 5 result was produced:

- **Experiment 4's optimizer was not converged.** It used a fixed 300-iteration budget. Measured
  after the fact: predictions move ~1.3e-3 between 300 and 600 iterations, which propagates to
  roughly 1.3e-4 in Brier score - about 23% of the 5.6e-4 margin by which
  `jointRegularizedLogit` was reported to beat `singleLevelShrinkage`. **Experiment 4's headline
  ordering may well survive, but its precise numbers should not be trusted, and Experiment 5
  re-runs the fit-once joint model under the corrected optimizer so a directly comparable,
  converged version of that comparison exists.** This was my own implementation defect, not a
  property of any method under test.
- **Constant-step Adam plateaued instead of settling.** Successive doublings of the iteration
  budget kept moving predictions by ~1e-4 (mean) / ~5e-4 (max) indefinitely. Adding learning-rate
  decay (`lr_t = lr / sqrt(1 + t/500)`) reduced that to ~1e-5 / ~9e-5, and stopping now keys off
  relative improvement in the penalized objective rather than a fixed count.

With those fixes, the measured worst-case disagreement between warm-start updates and a fully
converged cold refit is **1.4e-5 mean / 5.7e-5 max** at 100 iterations per ball - roughly an order
of magnitude below the ~5e-4 differences being measured between methods. 200 iterations per ball
was measured to be no better (1.4e-5 / 5.7e-5), and 50 was clearly worse (2.0e-4 / 2.2e-4), so
**100 was selected on fidelity to a true refit alone.** No experimental result influenced that
choice; the check only ever compares the online optimizer against the batch optimizer on identical
data, and never looks at any method's score.

**Newly-seen `(batter, bowler)` pairs**: the design's index maps are extended on the fly when a
revealed ball introduces a pair absent from training, with the new coefficient initialized to zero
(i.e. "no interaction known yet"). Extensions are discarded at the per-match reset.

## What is compared

All existing methods, unchanged, on the same checkpoints: `global`, `rawExactMatchup`,
`singleLevelShrinkage`, `archetypeOnly`, `fullHierarchyNoArchetype`, `oracleArchetypeOnly`,
`oracleInformedHierarchy`, `jointRegularizedLogit` (the fit-once version, retained deliberately so
the online-vs-offline difference is measurable within a single run), `fullHierarchy`, and the new
`jointRegularizedLogitOnline`. Run in both World A and World B.

The sample-efficiency breakdown (`n` = 0, 1, 2-4, 5-9, 10-14, 15-24, 25-49, 50+) is already
produced per method by `research/metrics.js` and requires no changes - it will be reported for
every method, since the original research question was specifically about the 0-15 regime.

## Falsifiability

- If `jointRegularizedLogitOnline` performs **no better than** the fit-once
  `jointRegularizedLogit`, then within-match evidence adds nothing at this scale, and Experiment
  4's handicap was immaterial rather than generous.
- If it performs **worse** than the fit-once version, the online procedure is harming the model -
  which would point at the update rule (25 iterations, persisted moments) rather than at the
  formulation, and the fidelity check above is what would let us tell those apart.
- If the joint model's advantage is **not** concentrated in the low-`n` bins, then the original
  sparse-data motivation is not what is driving its win, and the story about *why* it works would
  have to change even though the headline numbers did not.
- If `fullHierarchy` closes the gap once every method sees identical information, then
  Experiment 4's result was substantially an artifact of the information asymmetry.

## What stays fixed

Metrics, leakage prevention, checkpoints, seeds, and every existing method are unchanged.
`backend/src/utils/statUtils.js` and `backend/src/services/tendencyAnalytics.js` - the production
algorithm - are **not modified**. `k` is not tuned. No adaptive evidence weighting or behavioral
similarity model is implemented; those remain candidates for a later phase and only if the
evidence supports pursuing them. Raw results are reported first, without interpretation.
