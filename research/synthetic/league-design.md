# League redesign - committed before regenerating data

Written before any code in this document was run against the evaluation harness, per the
instruction to define the target sparsity distribution before regenerating data, not after. This
is the design and the a priori prediction; the actual result gets reported in
`research/results/`, whatever it turns out to be, without editing this document afterward to fit
it.

## What was wrong with the pilot experiment's simulator

The pilot (`research: first controlled experiment`, commit `a85d6d2`) reused a single fixed pair
of teams (11 batters / 6 bowlers per side) across all 125 matches. Every (batter, bowler) pair
recurred in nearly every match, so by evaluation time 1657 of 1750 checkpoints (94.7%) had 50+
exact-matchup balls of history - the opposite of the sparsity regime the hypothesis is about.
Two compounding causes, both addressed below:

1. **Too few teams, no fixture rotation** - the same two teams played every match, instead of a
   real league where any two specific teams only meet a handful of times a season.
2. **Fixed, non-randomized batting order** - `strikerIdx` always started at 0 and only advanced
   on a wicket, so the same early-order batters faced a hugely disproportionate share of balls in
   every single match, further concentrating exposure onto a small subset of players.

## The redesign

- **16 teams**, each with its own 11 batters and 6 bowlers, drawn from a shared population (so
  archetypes/vulnerability/effectiveness/interaction parameters still work exactly as documented
  in `dataset-assumptions.md` - only the roster/fixture structure changes, not the underlying
  probability model).
- **Double round-robin fixtures** (every team plays every other team exactly twice - a completely
  standard real league structure, not picked to engineer a particular result): `C(16,2) x 2 = 240`
  matches total.
- **Batting order randomized per match** (a fresh random permutation of each side's 11 batters
  each match, not always starting from the same player) - closer to how a real team's batting
  order actually varies match to match, and prevents the fixed-order concentration problem above
  independent of the fixture-schedule fix.
- Bowler selection per ball remains uniform-random across the fielding side's 6 bowlers (unchanged
  from the pilot - this was never the problem).

## A priori prediction, reasoned before running

For two specific teams, A and B: they share exactly 2 matches all season (double round-robin).
Within one of those matches, a specific batter from A faces some subset of the ~35 balls bowled
that innings by B's 6 bowlers, only while they're at the crease and only on the balls where they
personally are on strike. With batting order randomized and an average dismissal rate around
4.5%, a given batter can expect to face on the rough order of 10-15 balls in a typical innings
before either getting out or the innings ending, split roughly evenly across B's 6 bowlers -
call it 2-3 balls against any one specific bowler, per match the two teams play. Across the two
matches A and B share all season, that's a rough expected exact-matchup sample size in the
**single digits** for a typical cross-team pair.

Stated prediction, before regenerating: the large majority of evaluation checkpoints should fall
in the 0-15 bucket, a meaningfully smaller fraction in 15-50, and few if any in 50+ (reaching 50+
would require a pair to be dramatically over-exposed relative to this average, which nothing in
this design should systematically cause). This is a rough analytical estimate, not a guarantee -
real variance in dismissal timing and bowler selection could push the actual distribution
somewhat differently, and the honest result is whatever the regenerated data actually shows once
run through the unchanged evaluation harness.

## What does not change

`generatePopulation` and `trueProbability` (research/synthetic/generator.js) are unchanged - the
probability-generating process itself was never the flawed part, only the match/roster/fixture
structure around it. `research/harness/evaluate.js` and `research/metrics.js` are unchanged, per
explicit instruction - only the data-generating process is being redesigned, not the evaluation
pipeline that measures it.
