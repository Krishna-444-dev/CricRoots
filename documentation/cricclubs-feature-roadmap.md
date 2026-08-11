# CricClubs-Inspired Feature Roadmap

Tracks progress on features borrowed/adapted from researching [CricClubs.com](https://cricclubs.com/),
a widely-used cricket league management platform, plus the UI redesign that preceded it.
Started 2026-08-10.

## Why CricClubs

CricSync's vision is a world-class, one-stop cricket app, starting with local/club tournaments.
CricClubs is the incumbent in that exact niche, so its feature set is a useful checklist of
"table stakes" for a tournament organizer — and its review complaints are a useful list of gaps
to deliberately do better on.

**CricClubs feature set** (league management, live scoring, match center, player profiles,
community/admin tools) — see commit `429b2fa` message for the full breakdown.

**CricClubs user complaints** (from app store / review research): performance/crashes, confusing
UI after updates, no wicketkeeper stat breakdown (catches/stumpings), no calendar integration,
OTP auth failures, weak support.

**CricSync's structural advantage**: the ball-by-ball scoring UI already tags `line`, `length`,
`shotZone`, `shotType`, `fielderId`, and `fielderPosition` per delivery (built for the AI tactical
insights feature). CricClubs' users are asking for wagon wheels and keeper stats that CricSync can
build almost for free from data it already collects — see [[project_ai_strategy]] in memory for
the broader AI/data strategy this feeds into.

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

### Backlog (not started, roughly in priority order)

- **Match notifications** — push/email when a followed team's match goes live or a tournament
  posts an announcement (announcement chat already exists; notification delivery doesn't).
  Deliberately left out of the parallel batch below — needs a new data model and touches trigger
  points across several controllers (match status changes, announcement posts), which made it the
  track most likely to conflict with the other three if run in parallel.

## Note on how the last three items got built

Fixture-generation, MVP/awards, and the event calendar were built by three background agents
running in parallel, each in its own isolated git worktree (`isolation: "worktree"` on the `Agent`
tool), rather than sequentially by hand. Worth recording what actually happened, for next time:

- All three finished successfully and needed no correctness fixes after review — just one cosmetic
  nit (two tournament tabs both defaulting to a 🏆 emoji).
- The real friction wasn't code quality, it was **merge order**: the awards agent's worktree
  branched before the fixtures agent's was merged, so by the time it finished,
  `tournamentController.js` and `TournamentManager.tsx` (both files) had moved out from under it.
  Its raw diff no longer applied cleanly and had to be reapplied by hand, hunk by hunk, against the
  current file state — not because the agent did anything wrong, just because two of the three
  tracks both landed in the tournament domain. Tracks that share a file are still fine to
  parallelize, but expect to hand-merge the second one in, not just `git apply`.
- Each agent could only self-verify with static checks (`node --check`, `tsc --noEmit`) since the
  dev server/docker ports were already in use by the orchestrating session — live/E2E verification
  against the running stack still had to happen after merging, one track at a time, same as any
  sequentially-built feature.
- Net effect: three feature-sized chunks of work landed in the time one background agent run takes
  (they ran concurrently), at the cost of the merge-order overhead above. Worth repeating for the
  next genuinely-independent batch; picking tracks that don't share files would remove the one real
  friction point.

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
