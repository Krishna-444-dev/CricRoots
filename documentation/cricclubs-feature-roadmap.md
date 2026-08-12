# Competitor-Inspired Feature Roadmap

Tracks progress on features borrowed/adapted from researching leading cricket apps
([CricClubs.com](https://cricclubs.com/), then [CricHeroes](https://cricheroes.com/global)), plus
the UI redesign that preceded them. Started 2026-08-10.

## Why competitor research

CricRoots's vision is a world-class, one-stop cricket app, starting with local/club tournaments.
CricClubs and CricHeroes are the incumbents in that exact niche, so their feature sets are a useful
checklist of "table stakes" for a tournament organizer or club player — and their review complaints
are a useful list of gaps to deliberately do better on.

**CricClubs feature set** (league management, live scoring, match center, player profiles,
community/admin tools) — see commit `429b2fa` message for the full breakdown. **CricClubs user
complaints**: performance/crashes, confusing UI after updates, no wicketkeeper stat breakdown, no
calendar integration, OTP auth failures, weak support.

**CricHeroes feature set** (Manhattan/Worm/wagon-wheel analytics trio, algorithmic per-match MVP
points, badges/awards, smart fixture auto-generation, live streaming + AI highlights, a
rules/education/trivia community feed) — see commit `9bcc36f`'s message and the three commits after
it for the full breakdown. **CricHeroes user complaints**: almost everything except raw match
scoring is paywalled (players can't see their own stats or even the tournament points table for
free), requires a phone number to register, Android/iOS feature parity gaps, ads on the free tier.

**CricRoots's structural advantage**: the ball-by-ball scoring UI already tags `line`, `length`,
`shotZone`, `shotType`, `fielderId`, and `fielderPosition` per delivery (built for the AI tactical
insights feature). Both competitors' flagship analytics features (wagon wheels, keeper stats,
Manhattan/Worm charts, MVP calculation) are things CricRoots can build almost for free from data it
already collects — and unlike CricHeroes, none of it needs to sit behind a paywall. See
[[project_ai_strategy]] in memory for the broader AI/data strategy this feeds into.

## Status

### Done

- **UI redesign — "Stadium Dark" theme** (`f8e0892`, `bd2c670`): full design system (dark
  navy/pitch-green/gold palette), shared primitives (Card/Button/Badge/PageHeader/EmptyState),
  persistent Navbar, applied across all ~25 pages. Also fixed a `router.push`-during-render React
  warning on 5 pages.
- **Tournament points table / standings** (`429b2fa`): matches can be linked to a tournament at
  creation; completing a linked match auto-derives the result from innings totals and recomputes
  the full points table (W/L/T/NR, points, net run rate) from scratch. Fixed a pre-existing bug
  where `standings.team` was never populated (table always showed generic "Team"). Tournament
  Matches tab now lists real matches instead of just a count.

- **Wagon wheel + player career stats** (`ecd610c`): `GET /api/player-stats/:playerId`,
  `.../rankings/batsmen`, `.../rankings/bowlers` were already called by
  `PlayerStatsDashboard.tsx` but always returned empty/404 — they read from a `PlayerStats`
  collection nothing ever wrote to. Rewrote all three to compute live from `Match` documents
  (the same source-of-truth pattern as the standings feature): career batting/bowling averages,
  strike rate/economy, and **wicketkeeper stats (catches/run-outs/stumpings)** derived from
  `fielderId`/`wicketType` — directly answering the #1 CricClubs complaint. Added a wagon wheel
  SVG (`components/insights/WagonWheel.tsx`) rendering the existing `shotZone` tagging as a polar
  area chart, wired into the Batting tab. New aggregation functions live in
  `backend/src/services/tendencyAnalytics.js` (`getFieldingStats`, `getCareerStats`,
  `getBattingLeaderboard`, `getBowlingLeaderboard`).
  - Left the old `PlayerStats` model, `getAllPlayerStats`, `getPlayerTrends`,
    `updatePlayerStats`, and `comparePlayerStats` in place (unused by any frontend, harmless) —
    didn't touch them, out of scope for this pass.
  - `recentForm` and per-leaderboard-row `centuries` are hardcoded empty/0 for now — real
    "recent form" needs a chronological per-match trend, not just a total, and wasn't built here.

- **Auto-generated fixtures** (`d1d3bad`): `POST /api/tournaments/:id/generate-fixtures`
  (organizer-only) builds round-robin (every registered team plays every other team once) or
  knockout (round 1 only, paired by registration order — later rounds depend on unknown results
  so aren't generated) pairings, spreads `scheduledDate` evenly across the tournament's date
  range, and links each match. Guards against <2 teams and against regenerating once fixtures
  exist. "Generate Fixtures" button in TournamentManager's Matches tab.
- **Tournament MVP/awards** (`4071964`): `POST /api/tournaments/:id/compute-awards`
  (organizer-only, Completed tournaments only) fills in all six `Tournament.awards` fields —
  winner/runner-up/third-place from the points table, best batsman/bowler from new
  tournament-scoped leaderboard aggregations (`getTournamentBattingLeaderboard`/
  `getTournamentBowlingLeaderboard` in `tendencyAnalytics.js`), and man-of-the-tournament from a
  documented heuristic (most `manOfTheMatch` awards in the tournament, tie-broken by a combined
  runs+wickets score, falling back to that score if no `manOfTheMatch` data exists). New Awards
  tab in TournamentManager.
- **Event calendar** (`4fe7c68`): read-only `/calendar` page, month-grid view with Prev/Next/Today
  navigation, matches shown as status-colored badges on their scheduled day, tournaments shown as
  a badge spanning their `[startDate, endDate]` range. Added to the main nav. Pure frontend, no
  backend changes — built entirely on the existing `/api/matches` and `/api/tournaments`
  endpoints.

- **Manhattan + Worm charts** (`9bcc36f`): `GET /api/matches/:id/charts` buckets each innings' ball
  data into overs (`backend/src/services/matchCharts.js`), replicating `recordBall`'s exact
  legal-delivery convention so wides/no-balls contribute runs without advancing the over count.
  Rendered as hand-built inline SVG (`ManhattanChart.tsx`, `WormChart.tsx`, matching
  `WagonWheel.tsx`'s existing style — no chart library in this repo) on the match detail page.
- **Automatic Man of the Match (MVP)** (`5b6a820`): `backend/src/services/mvpCalculator.js`
  implements a documented approximation of CricHeroes' algorithmic MVP model — runs convert to
  points (10 runs ≈ 1 point) weighted by batting position (derived from order-of-first-appearance
  in the innings' ball sequence, since the schema has no explicit position field), wickets earn the
  bowler position-weighted credit based on the dismissed batsman's position with a +20% fielder
  bonus on assisted dismissals and full credit to the fielder on run-outs. Hooked into the same
  spot `updateMatch` already auto-derives the match result — computed automatically on completion
  unless explicitly overridden.
- **Player achievement badges** (`c3813c6`): `getAchievements(playerId)` in `tendencyAnalytics.js`
  computes 8 fixed badges (Century Maker, Half-Century Hero, Five-Wicket Haul, Hat-trick Hero,
  Golden Duck — all per-innings — plus Century of Wickets, All-Rounder, Wicketkeeper Great as
  career milestones), added to `GET /api/player-stats/:playerId` and displayed as a new
  Achievements card on `PlayerStatsDashboard`.

### Backlog (not started, roughly in priority order)

- **Match notifications** — push/email when a followed team's match goes live or a tournament
  posts an announcement (announcement chat already exists; notification delivery doesn't).
  Deliberately left out of both parallel batches so far — needs a new data model and touches
  trigger points across several controllers (match status changes, announcement posts), which made
  it the track most likely to conflict with whatever else was running in parallel.
- **Live streaming + AI highlights** (CricHeroes) — real video infrastructure, a much bigger lift
  than anything else on this list. Noted for completeness, not scoped or planned.
- **Community feed** (CricHeroes: rules/education/trivia/quizzes/polls/stories) — CricRoots's
  edtech/news modules already cover lessons and announcements; polls/trivia/quizzes would be new
  data models. Lower priority than the stats/analytics gaps above.

## Notes on parallel-agent batches (2 so far)

Fixture-generation, MVP/awards, and the event calendar (batch 1) and Manhattan/Worm charts, the MVP
calculator, and achievement badges (batch 2) were each built by three background agents running in
parallel, each in its own isolated git worktree (`isolation: "worktree"` on the `Agent` tool),
rather than sequentially by hand. Worth recording what actually happened, for next time:

- All six finished successfully and needed no correctness fixes after review — just one cosmetic
  nit in batch 1 (two tournament tabs both defaulting to a 🏆 emoji).
- The real friction wasn't code quality, it was **merge order**: whenever two tracks in the same
  batch touched the same file (batch 1: `tournamentController.js` + `TournamentManager.tsx` for
  fixtures vs. awards; batch 2: `matchController.js` for charts vs. the MVP calculator), the second
  one to finish had its raw diff no longer apply cleanly, since the first one's merge had already
  moved the file out from under it. Both times this was a small, easy hand-merge (a few insertion
  points), not a real conflict — tracks that share a file are still fine to parallelize, just expect
  to hand-merge the second one in rather than a plain `git apply`.
- Batch 2 also hit a **session usage-limit error** mid-launch — all three agents failed within
  their first few tool calls, before writing any real code. One had already produced a small,
  complete, correct file (`matchCharts.js`'s over-grouping logic) before failing; that file was
  salvaged and handed back verbatim to the relaunched agent (pasted into its prompt) so it didn't
  redo already-correct work. The other two had made no progress worth preserving, so they were just
  relaunched fresh with the same prompts. Once the limit reset, all three succeeded normally. Worth
  knowing: a failed/interrupted agent's worktree can still hold salvageable partial work — check
  `git status --short` in it before discarding.
- Each agent could only self-verify with static checks (`node --check`, `tsc --noEmit`) since the
  dev server/docker ports were already in use by the orchestrating session — live/E2E verification
  against the running stack still had to happen after merging, one track at a time, same as any
  sequentially-built feature. This has consistently caught nothing wrong so far (all six tracks'
  logic held up under live E2E testing with real recorded match data), but it's still the step that
  actually proves correctness, not the static checks.
- Net effect both times: three feature-sized chunks of work landed in the time one background agent
  run takes. Picking tracks that don't share files removes the one real friction point, but even
  when they do share a file, the hand-merge cost has been small both times — not a reason to avoid
  parallelizing related work.

## Working notes for whoever picks this up next

- `Tournament.updateStandings()` (`backend/src/models/Tournament.js`) does a **full recompute**
  from all `Completed`/`Cancelled` matches referencing the tournament — not incremental. Keep it
  that way; it's what makes it safe to call repeatedly.
- NRR uses actual overs faced/bowled, not the "full quota if all out" convention real cricket
  boards use — a deliberate simplification given club-cricket roster sizes aren't guaranteed to be
  11. Revisit if it becomes a real pain point.
- `Match.innings[0]` is always `team1`'s innings and `innings[1]` is always `team2`'s, regardless
  of actual batting order — the frontend picks `inningsIndex` by matching team identity, not
  chronological order. There is currently no captured record of *which team batted first*
  (no toss UI wired up), which is why match results are reported as a runs margin uniformly rather
  than the traditional "won by N wickets" phrasing for the chasing side.
