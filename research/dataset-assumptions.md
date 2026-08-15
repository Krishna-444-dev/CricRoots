# Dataset Assumptions

Two tracks, kept separate everywhere - code, data, documents, results. Neither is allowed to
stand in for the other.

## Track A - synthetic-but-structured (Phase 1's actual dataset)

The product database's existing simulated matches cannot be used - `documentation/
research-readiness-audit.md` section 5 establishes why (dismissal probability there is generated
independent of batter, bowler, line, and length, so there's no real structure for any method to
recover). Track A is a purpose-built replacement: a generator with a **known, explicit
probability-generating process**, so the question "does the estimator recover the true
probability?" has a real, checkable answer.

### The generating process

For a given batter `b`, bowler `w`, line `l`, length `n`:

```
logit(P_true(b, w, l, n)) =
    base_rate
  + batter_vulnerability[b]
  + bowler_effectiveness[w]
  + batter_bowler_interaction[b, w]   (small, sparse - most pairs have ~0 interaction)
  + line_length_effect[l, n]
  + batter_line_length_response[b, l, n]   (how this specific batter responds to this line/length)
```

modeled in logit space and squashed back to a probability, so the sum of effects can't produce an
invalid probability outside [0, 1] regardless of parameter values - a real risk with an additive
probability-space formula once several effects stack.

Each component is assigned once per synthetic "population" (players, archetypes, line/length
effects) and held fixed for that population - see `synthetic/generator.js` for the actual
distributions each parameter is drawn from. **Archetypes remain domain-defined categorical
groups** (batting handedness, bowling style - the same fields the real `Player` model already
has), not learned representations, matching how `getMatchupPlan` actually forms archetypes today.
Investigating learned vs. domain-defined archetypes is a real, separate future question, not part
of this document or this phase.

Given `P_true(b, w, l, n)`, individual ball outcomes are drawn as `Bernoulli(P_true(b, w, l, n))`
- real sampling noise, not a deterministic function of the parameters. This is what makes the
sparsity problem genuine even in synthetic data: two batters with identical `P_true` against the
same bowler will still show different *observed* dismissal rates at n=3, purely from sampling
variance, which is exactly the situation the shrinkage method exists to handle well.

### What this lets us test that the real data currently can't

Because `P_true` is known exactly for every (batter, bowler, line, length) combination, we can
compute `|P_estimated - P_true|` directly - the oracle comparison - which answers "does the
estimator recover the true underlying probability?" rather than only "does the estimator fit
the noisy observations?" These are different questions and synthetic data with a known ground
truth is the only way to ask the first one.

### What Track A results are not

A result on Track A is evidence about whether the **estimation mechanism** (shrinkage, backoff,
the live blend) behaves correctly under a probability structure of roughly this shape and this
degree of sparsity. It is **not** evidence that real cricket matchups have this shape, or that the
method will perform this well on real data. `synthetic/generator.js`'s assumptions are themselves
falsifiable once real data exists: if real pilot data shows a qualitatively different structure
(e.g., interaction effects that dominate rather than being sparse, or line/length mattering far
less than batter/bowler identity alone), that's a finding about Track A's assumptions, not a
reason to distrust Track B once it runs. Track A validates the mechanism against a controllable
ground truth; Track B (below) is what eventually validates the mechanism against reality.

## Track B - real-world validation (not started - blocked)

Requires real matches, scored by real people, from an actual pilot season - see
`documentation/going-legal-and-live.md` for the current state of getting there (not yet live).
No minimum sample size is committed to here in advance of seeing what a real pilot actually
produces; a rough, revisable floor worth stating now: enough matches that the *global* and
*archetype* levels of the hierarchy have real four-figure-plus ball counts (the levels every
prediction can always fall back to), even if exact-matchup and batter-vs-archetype counts stay in
the single digits per pair, which is expected and is the whole point of the method.

**Track B cannot begin until real data exists.** This document exists so that when it does, the
dataset it's evaluated against has the same explicit, written-down assumptions Track A has,
rather than an implicit "well, it's real, so it must be fine."

## Falsifiability

What would convince us Track A's synthetic assumptions are a poor proxy for methodology
development, specifically? If, once Track B becomes possible, the ranking of methods (which
baseline beats which) reverses between Track A and Track B - not just the absolute numbers
differing, which is expected, but the actual conclusion about whether hierarchical shrinkage
helps flipping - that's a direct finding that Track A's generating process assumed away something
that matters in reality (most likely: real matchup interaction effects are less sparse than
assumed, or line/length matters less than assumed relative to batter/bowler identity). That
comparison itself becomes a legitimate, interesting result to report, not a failure of this
document.
