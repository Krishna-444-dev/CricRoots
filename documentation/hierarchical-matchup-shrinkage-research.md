# Hierarchical Matchup Shrinkage: Research & Patent Strategy

Written 2026-08-12, in response to an explicit ask to find a genuinely differentiated algorithm -
one worth writing up and possibly patenting, not just marketing copy. This doc is the durable
record; a designed version exists as a published Artifact from the same session for easier reading.

**Approach**: research prior art first (patents, academic papers, competitor product docs) before
claiming anything is novel. Three ideas got killed by that search. One survived, got specified
precisely, and got built the same day.

## Ruled out (prior art already covers these)

1. **Win probability from match state** (score/wickets/overs/required-rate) - saturated three times
   over: ESPNcricinfo's Forecaster, CricViz's WinViz (used on ICC/Sky/Fox broadcasts), the
   peer-reviewed Asif & McHale (2016) *"In-play forecasting of win probability in ODI cricket"*
   (*International Journal of Forecasting*), WASP, and a long tail of student ML papers. None
   condition on ball-level tactical data, but the win-probability problem itself isn't open.

2. **Predicting shot type/zone from line, length, and player identity** - **actively patented**.
   Stats Perform holds US12100210B2 / US11715303: an LSTM + feedforward network predicting
   next-delivery shot type/zone from line/length plus personalized player embeddings built from a
   player's last ~500 deliveries (the patented version of the 2021 MIT Sloan paper *"You Cannot Do
   That Ben Stokes,"* arXiv 2102.01952). CricRoots's data model overlaps enough that the algorithm
   must never be framed as "predicting shot type/zone from line and length" - that's their claimed
   territory. Moot anyway: their method needs ~500 balls/player; club cricket never will.

3. **Auto-generated ball-by-ball commentary** - heavily published sports-NLG pattern (CricViz ×
   frog.ai's live commentary product, multiple 2023-2025 vision-transformer/CNN+RAG papers). Being
   built into CricRoots as a good feature regardless - just not a research or patent claim.

## The gap that survived

Closest real prior art: a 2026 paper submitted to *JQAS* (arXiv 2604.13861) doing James-Stein
shrinkage on phase-specific (powerplay/middle/death) player profiles across 1,161 IPL matches
(~264,800 deliveries), feeding a Monte Carlo/MDP optimizer for batting order and bowling plans.

It differs from CricRoots's actual problem on every axis that matters:
- **Granularity**: outcome-level (runs, dismissals), not the line/length/shotType/shotZone/
  fielderPosition tactical-attribute level CricRoots already tags per ball.
- **Scale**: IPL-rich per-player samples vs. club cricket, where a specific batter-vs-bowler
  matchup usually has 0-15 balls of history, full stop, forever.
- **Timing**: post-hoc season optimization vs. a live recommendation needed mid-over.

A broader search for "amateur/grassroots sports analytics under data scarcity" as its own research
question came back essentially empty. CricHeroes (the closest direct competitor) sells video-based
AI Highlights, not statistical tactical recommendations. Honest caveat: this whitespace may be thin
because it's commercially unglamorous, not because it's unsolved-and-valuable - worth validating
with real pilot usage, not just citations.

## The algorithm: Hierarchical Matchup Shrinkage (shipped)

A bowling line/length recommendation for a *specific* batter against a *specific* bowler, backed
off through four levels of pooling rather than either trusting a near-empty exact-matchup average
or ignoring who's bowling entirely (which is what CricRoots's pre-existing single-player insights
did until this pass).

**Backoff chain** (finest to coarsest):
1. Exact matchup - this batter vs this bowler, this line, this length (almost always n = 0-2)
2. This batter vs bowler-archetype - pooled across every bowler sharing the opposing bowler's style
3. Archetype vs archetype - every batter of this handedness vs every bowler of that style, league-wide
4. Global - every tagged delivery, no player identity at all (always populated, last resort)

Structurally the same idea as Katz/Kneser-Ney backoff smoothing in n-gram language models - prefer
the most specific estimate you have enough evidence for, fall back to a coarser-but-stable one
otherwise - applied to tactical cricket stats instead of word sequences. It generalizes the
James-Stein blend already in use for single-player stats (`blendWithPrior`, `k=15` pseudo-count)
into a recursive chain across levels, rather than inventing a new statistical primitive.

**Where it lives:**
- `backend/src/utils/statUtils.js` - `hierarchicalBlend(levels)`, generalizing `blendWithPrior`
- `backend/src/services/tendencyAnalytics.js` - `getMatchupPlan()`, `getPlayerIdsByArchetype()`,
  `getLineLengthBreakdown()` (the last one refactored out of the pre-existing
  `getBatsmanLineLengthBreakdown`, which now delegates to it)
- `backend/src/controllers/insightsController.js` - `getMatchupPlan`
- Route: `GET /api/insights/matchup/:batsmanId/:bowlerId/bowling-plan`
- Commit `a0e2898` - verified against the live dev database: correct fallback through the chain for
  a real player pair with zero direct history, correct 404 on unrecognized players, zero regression
  on the two pre-existing single-player endpoints.

Archetypes are bootstrapped from the `battingStyle`/`bowlingStyle` fields already captured at
player registration, not a learned cluster - not enough data to cluster on reliably yet, consistent
with the project's existing "shrinkage stats in backend, not ML, at current data scale" strategy.

## Real-time in-match updates (shipped 2026-08-12)

Everything in Section "The algorithm" is a pre-match/between-overs query against all-time
historical data. This extension makes the recommendation shift *as the current match unfolds* - no
cricket product found in the research does this at grassroots scale either.

**Design**: rather than folding "today" into the existing 4-level historical chain as a 5th rung,
it's treated as a genuinely different axis and blended as one extra step *on top of* the historical
composite. The historical chain's specificity axis is about *identity* (which players); live form is
about *recency/context* (pitch behavior today, weather, current form) - conflating the two into one
chain would have been a modeling error, not just a simplification. Concretely:

1. Compute the historical blended estimate per line/length bucket exactly as before
   (`getMatchupPlan`), which already reports an effective `historicalSampleSize` per bucket.
2. Separately tally this batter's deliveries *in the current match only* (any bowler - a handful of
   balls faced today reflects today's conditions regardless of who's bowling them, and there's
   rarely enough live data against one specific bowler alone in a short match to be useful).
3. Blend the two with the same `blendWithPrior` primitive, but a smaller pseudo-count
   (`LIVE_K = 5` vs. the usual 15) - a ball faced five minutes ago under today's actual conditions
   should outweigh a historical archetype-level data point faster than a typical archetype/global
   blend would allow. This is the one genuinely new tuning decision in this extension; the blending
   mechanism itself is the same primitive used everywhere else, just applied again.

**Where it lives:**
- `backend/src/services/tendencyAnalytics.js` - `getLiveMatchupPlan(matchId, batsmanId, bowlerId)`
- `backend/src/controllers/insightsController.js` - `getLiveMatchupPlan`
- Route: `GET /api/insights/matchup/:batsmanId/:bowlerId/live-bowling-plan?matchId=...`
- `web-app/components/scoring/LiveMatchupPanel.tsx`, mounted in `BallByBallScoring.tsx` right below
  the current striker/bowler summary - refetches after every ball recorded (keyed on the current
  over.ball position), so the on-screen recommendation actually moves as the innings progresses.
- Verified end-to-end against the live dev backend: registered throwaway fixtures, recorded three
  tagged balls for a brand-new player pair, confirmed the live endpoint correctly reflects today's
  dismissal-rate-so-far per bucket, confirmed graceful fallback to the historical rate for buckets
  with zero live balls today, confirmed 400 on a missing `matchId` and 404 on an unknown one, then
  cleaned up the test fixtures.

## On patenting - the honest version

An abstract statistical method ("blend estimates across a hierarchy of pools") is very likely
**not patent-eligible on its own** in the US post-*Alice Corp v. CLS Bank* (2014) - courts
consistently reject patents on abstract mathematical ideas merely run "on a generic computer," and
this reads exactly like that category. Contrast with the Stats Perform patent above: it's not
"predict cricket outcomes," it's a specific neural architecture tied to a concrete pipeline. A
patent claim needs that same specificity. What's more plausibly defensible: the *specific real-time
system* from the extension above - the online per-ball posterior update tied concretely to the
voice-input pipeline and live-scoring UI, described as a technical data-processing system rather
than a bare formula.

**Recommendation**: a provisional patent application is cheap to file (~$65-260 in USPTO
micro/small-entity fees) and buys a 12-month priority date while deciding - but drafting claims that
actually hold up costs real attorney time, and this document is not a substitute for one. If
patenting is worth pursuing, the next step is a real patent attorney, not more internal writing.

## On publishing - more realistic, more valuable near-term

A paper without a real evaluation isn't publishable, and there isn't enough pilot data yet to
evaluate anything credibly.

1. ✅ Design + ship the algorithm against real (if small) data - done, see above.
2. Let the pilot season run - real matches, real tagged balls, real matchups repeating across a season.
3. Build a backtesting/ablation harness: compare raw exact-matchup average, single-level blend (the
   old code), archetype-only, and the full 4-level chain on held-out matches. Calibration curves,
   not just accuracy - does "70% confidence" actually mean 70%?
4. Write it up, post to arXiv first - no gatekeeping, immediately citable/dateable, standard
   practice for applied industry methods work.
5. Consider *JQAS* or the MIT Sloan Sports Analytics Conference - JQAS is literally where the
   closest prior art (above) was submitted, i.e. direct engagement with the specific gap being
   claimed, not a random venue.

## Why this fits the bigger picture

The underlying problem - statistically honest tactical recommendation under extreme data sparsity -
isn't cricket-specific. It's a property of amateur sport generally: any local league in any sport
has the same 0-15-encounters-per-matchup reality professional analytics never has to solve for. The
research program outlives the cricket-only phase of the product on purpose - the same hierarchical
backoff idea, the same archetype-bootstrapping, the same honesty-about-confidence design, applies
unchanged to a future FootieRoots or any other sport in the umbrella (see [[project-vision]]).
Worth framing the eventual paper as a method for amateur sports analytics generally, with cricket as
the first, data-richest proving ground.

## Sources

- ESPNcricinfo, ["Launching Superstats"](https://www.espncricinfo.com/story/launching-superstats-the-new-language-for-cricket-analysis-1178276)
- CricViz, [WinViz](https://cricviz.com/winviz/) / [enhanced WinViz launch](https://cricviz.com/cricviz-launches-enhanced-winviz-model/)
- Asif & McHale (2016), "In-play forecasting of win probability in ODI cricket," *International Journal of Forecasting*
- Wikipedia, [WASP (cricket calculation tool)](https://en.wikipedia.org/wiki/WASP_(cricket_calculation_tool)) / [Duckworth-Lewis-Stern method](https://en.wikipedia.org/wiki/Duckworth%E2%80%93Lewis%E2%80%93Stern_method)
- US Patents [US12100210B2](https://patents.google.com/patent/US12100210B2), [US11715303](https://patents.google.com/patent/US11715303B2) (Stats Perform); source paper [arXiv 2102.01952](https://arxiv.org/pdf/2102.01952)
- CricViz, [AI commentary service launch with frog.ai](https://cricviz.com/cricviz-confirms-the-launch-of-ai-commentary-service/)
- [arXiv 2604.13861](https://arxiv.org/html/2604.13861) - "Simulation-Based Optimisation of Batting Order and Bowling Plans in T20 Cricket" (JQAS submission)
- [Efron & Morris (1975) revisited](https://baseballwithr.wordpress.com/2016/02/15/revisiting-efron-and-morriss-baseball-study/) - James-Stein shrinkage for baseball batting averages
- CricHeroes, [why AI Highlights are a paid feature](https://blog.cricheroes.com/why-ai-highlights-are-a-paid-feature-on-cricheroes/)
- [Hawk-Eye patent history - GB2357207A withdrawn](https://www.lexology.com/library/detail.aspx?g=8a8958d5-493e-4869-8481-e73a2d4b5e2d)

This document is analysis and a working implementation, not legal advice - the patent-eligibility
discussion is a starting orientation, not a substitute for a patent attorney's review.
