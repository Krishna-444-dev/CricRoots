# Prediction Target

## Decision

Phase 1 evaluates exactly one target: **`P(dismissal | batter, bowler, line, length)`** - the
probability that a given delivery, bowled by this bowler to this batter at this line/length,
results in a dismissal. This is precisely what `getMatchupPlan`'s `blendedDismissalRate` already
computes and reports for each bucket; no new quantity is being invented for this evaluation.

This was worked out in detail in `documentation/research-readiness-audit.md` section 6 and is
restated here as its own decision because everything downstream (baselines, harness, metrics)
depends on it being unambiguous before any of that code is written.

## What this deliberately does not evaluate yet

`getLineLengthBreakdown` (the function every level of `getMatchupPlan`'s hierarchy is built from)
already computes a runs-based `strikeRate` per bucket alongside `dismissalRate` - and
`getMatchupPlan` discards it before returning. A bucket with a low dismissal rate but a high
strike rate (the batter never gets out there, but scores freely) is not obviously good for the
bowling side, and dismissal probability alone can't express that. That's real, and it's exactly
why this document exists instead of assuming the target implicitly.

**Phase 1 does not evaluate that tradeoff.** A composite runs+wickets target is a legitimate,
probably more product-relevant second question, deliberately deferred rather than folded into
this experiment. See "Why not start with the composite target" below for the falsifiability
argument for deferring it, not skipping it.

## Falsifiability

**What would convince us dismissal probability was the wrong target to evaluate first?**

If Experiment 1 (Phase 1's actual deliverable) shows the hierarchical shrinkage mechanism
recovers a known ground-truth dismissal probability well under sparsity - the estimation
mechanism itself works - that is evidence about the *statistical method*, not yet evidence that
`getMatchupPlan`'s recommendation is good tactical advice. If a later analysis showed that
ranking line/length buckets by dismissal probability alone produces materially different, and
worse by some independent tactical-quality measure, advice than a composite runs+wickets ranking
would, that *would* be evidence that dismissal-probability-alone is an incomplete **product**
target - without at all invalidating whatever Experiment 1 found about whether the **estimation
mechanism** works. These are different claims and this document keeps them separate on purpose:
Phase 1 tests the mechanism; whether the mechanism's output is sufficient advice on its own is a
separate, later question.

**What would convince us the mechanism itself doesn't work, on this target?** Full falsifiability
detail lives in `harness/evaluate.js` and `metrics.js` (calibration/Brier score/ranking quality
against a known ground-truth probability, per bucket, per sample-size regime) - stated briefly
here: if the full hierarchical method's estimates are no closer to the true generating
probability than a single-level shrinkage or archetype-only baseline's are, especially in the
n=0-15 regime the whole method exists to help with, that is a direct disproof of the central
hypothesis, and Experiment 1 is built to be capable of showing exactly that.

## Why not start with the composite target

Bundling "does hierarchical shrinkage help" with "did we pick the right composite objective"
into one experiment risks conflating two different failure modes that would be hard to
distinguish in a single result: a bad outcome could mean the shrinkage mechanism doesn't work, or
it could mean the mechanism works fine but the composite objective was constructed badly (wrong
weighting between runs and wickets, wrong normalization, etc.) - and a single experiment can't
tell you which. Dismissal probability alone has one unambiguous evaluation protocol (Brier
score/calibration against a realized or, for synthetic data, known-true binary/probability
outcome) with no such construction choice to get wrong. Prove or disprove the mechanism on the
simplest interpretable target first; the composite-target question is real and worth a dedicated
Experiment 2 once the mechanism itself has a real answer.

## What does not change because of this decision

`getLiveMatchupPlan`'s live adjustment is evaluated on the same target (does blending in current-
match evidence improve the *calibration of the dismissal-probability estimate*, not some
separately-defined live utility). The double-counting issue documented in the audit
(`getLiveMatchupPlan` double-counts in-progress-match balls that are already inside the
"historical" aggregate) still has to be fixed before the live-adjustment comparison specifically
is run - that fix is orthogonal to this document and tracked separately, not blocking the
historical-only evaluation this document scopes.
