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

### In progress

- **Wagon wheel + wicketkeeper stats** — visualize the `shotZone` tagging already captured per
  ball as an interactive wagon wheel on player profiles; add a keeper-specific stat line (catches,
  stumpings) derived from `fielderId`/`fielderPosition`, directly answering the #1 complaint found
  in CricClubs review research.

### Backlog (not started, roughly in priority order)

- **Player career stats page** — aggregate a player's batting/bowling/fielding across all their
  matches (currently stats are per-match only via the scorecard; no cross-match aggregation
  exists).
- **Auto-generated fixtures** — given a tournament + registered teams, generate a full
  round-robin/knockout schedule instead of creating matches one at a time.
- **MVP / awards tracking** — `Tournament.awards` schema fields already exist
  (`manOfTheTournament`, `bestBatsman`, `bestBowler`) but nothing computes or sets them.
- **Match notifications** — push/email when a followed team's match goes live or a tournament
  posts an announcement (announcement chat already exists; notification delivery doesn't).
- **Event calendar** — surfacing scheduled matches/tournament dates in a calendar view.

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
