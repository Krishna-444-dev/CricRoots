# World B - a synthetic world where archetype carries genuine signal

Written before implementing, same discipline as `league-design.md`: the design and the a priori
target go here first; the actual realized number gets measured afterward and reported honestly,
not edited into this document after the fact to fit.

## Why

The diagnostic (`research/diagnostics/experiment-2-diagnostic.md`, Finding 2) established that in
the world Experiments 1-3a evaluated ("World A"), `battingStyle`/`bowlingStyle` carry ~0% of
ground-truth variance - `trueProbability` never reads them. That's a plausible mechanical
explanation for why archetype-level pooling hurts rather than helps (Finding 3), but it leaves an
open question: is archetype pooling a bad idea in general, or only bad because *this particular*
archetype variable happens to be uninformative? "World B" exists to test that directly: hold
everything else about the generator fixed, add a genuine, nonzero archetype-conditioned effect,
and see whether `fullHierarchy` and `archetypeOnly` behave differently.

## Design

A new optional parameter, `archetypeSignal` (default `false`), on `generatePopulation`. When
`false` (the existing behavior, used by every experiment so far), nothing changes - "World A" stays
exactly reproducible. When `true`, one additional term is drawn: `archetypeEffect`, a fixed
`Normal(0, 0.35)` value per `(battingStyle, bowlingStyle)` combination (2 x 4 = 8 combinations),
added to `trueProbability`'s existing logit sum. `0.35` was chosen to be in the same order of
magnitude as the existing `lineLengthEffect` term's `Normal(0, 0.3)` (which realizes a 22.0%
variance share over 42 cells) - a deliberately "not negligible" effect size, not tuned to hit an
exact target percentage. The realized variance share is measured after generation (see
`ground-truth-decomposition.js`, extended to report the `archetypeEffect` term when present) and
reported as-is, whatever it turns out to be.

**Measured after generation** (populationSeed=1, 176 batters, 96 bowlers - the same population
used in Experiments 2/3a): the archetype term realizes an **8.84% share of total logit-space
variance** (0.05259 of 0.59506 total; computed the same way as
`ground-truth-decomposition.js`'s other component shares, full enumeration, no sampling error).
That lands close to World A's batter x bowler interaction term (8.6%) - a real, comparable-sized
effect, not a token amount, and not tuned to hit an exact target after the fact.

**Critically, this term is drawn LAST in `generatePopulation`, after batters, bowlers,
interactions, `lineLengthEffect`, and `batterLineLengthResponse` are already fully determined.**
This means for the same `seed`, calling `generatePopulation({ seed, archetypeSignal: false })` and
`generatePopulation({ seed, archetypeSignal: true })` produce **byte-identical** batters, bowlers,
interaction table, line/length table, and response table - the RNG stream up to that point is
untouched by whether the archetype draw happens afterward. World A and World B, for the same seed,
differ in exactly one respect: the presence of this one additional term. Everything else that
could confound the comparison (different vulnerability draws, different interaction sparsity,
etc.) is controlled for by construction, not by chance.

## What gets compared

Experiment 3a's population/match/split seeds are reused unchanged. World B is one additional
harness run with `archetypeSignal: true` and everything else in `CONFIG` identical, producing
predictions from the same 6 methods (`global`, `rawExactMatchup`, `singleLevelShrinkage`,
`archetypeOnly`, `fullHierarchyNoArchetype`, `fullHierarchy`) on the same checkpoint structure.
World A's numbers are Experiment 3a's already-collected results - not re-run, since the config is
identical and the pipeline is deterministic.

## What does not change

The generator's five existing terms (`vulnerability`, `effectiveness`, `interaction`,
`lineLengthEffect`, `batterLineLengthResponse`) and their distributions are unchanged in both
worlds. `generateMatches`, `generateLeagueMatches`, `generateFixtures`,
`research/harness/evaluate.js`'s leakage-prevention logic, and `research/metrics.js` are
unchanged. `archetypeSignal` defaults to `false`, so every existing caller (Experiments 1-3a,
`generator.test.js`) is unaffected.
