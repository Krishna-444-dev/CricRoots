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
- **League → Tournament → group-stage → knockout-bracket** (`af99c20`, `e9d7628`): new `League`
  model; tournaments can belong to a league, get split into groups (`assignGroups`), get a
  round-robin fixture list generated within each group, and progress through an auto-seeded
  Quarterfinal → Semifinal → Final bracket (`generateKnockoutStage`/`advanceKnockoutRound`) derived
  from group standings. Also shipped `simulateTournament.js`/`matchSimulator.js`/
  `runTournamentSimulation.js`, a reusable ops toolkit that plays a full realistic tournament
  (ball-by-ball, through the real controller functions via a fake req/res harness) for demo/
  load-testing — since proven correct across 200+ simulated matches.
- **Live tournament statistics + house rules document upload** (`4e85b0c`): `tournament.statistics`
  was a stored sub-document nothing ever wrote to (always all-zero regardless of matches played) —
  replaced with `getTournamentMatchStatistics()`, computed live from the tournament's own Completed
  matches. Also added real PDF/Word upload for a tournament's house rules (separate from the
  existing free-text rules field), web + mobile.
- **Top Performers leaderboard** (`84bfa8a`, `5b99cb4`): `GET /api/tournaments/:id/leaderboard` —
  top run-scorers / wicket-takers for a tournament, same average-based ranking `computeAwards`'s
  bestBatsman/bestBowler already use, surfaced top 20 per department (bumped up from an initial 5)
  on a new section of the Awards tab, web + mobile.
- **Division as a first-class tournament concept** (`de76a48`, plus simulation-toolkit support in
  `d48ffdd` and this doc's own follow-up commit): prompted directly by screenshots of the real
  CricClubs Atlanta Cricket League app showing Division modeled as a filterable dimension *within*
  one Tournament/Series (League → Series → Division → tabs), not as separate tournaments — which is
  how an earlier pass in this same session had modeled it (2 sibling `Tournament` documents), before
  being explicitly rebuilt properly per the user's choice. Added `tournament.divisions[]` (each with
  its own `teams`/`groups`/`awards`) and `match.division`, with every division-aware endpoint
  (`assignDivisions` (new), `assignGroups`, `generateFixtures`, `getTournamentStandings`,
  `generateKnockoutStage`, `advanceKnockoutRound`, `computeAwards`, `getTournamentLeaderboard`)
  branching on `tournament.divisions?.length > 0` first and falling through to the pre-existing flat
  logic unchanged — fully additive, verified backward-compatible with the 3 tournaments that
  predate divisions. Web + mobile both got a division pill/chip selector scoping the
  Standings/Bracket/Awards/Matches tabs. Proven end-to-end with a real 40-team, 2-division run
  (`runDivisionedTournament.js`, new — factors the match-playing loop out into
  `matchOrchestration.js` so it and `runTournamentSimulation.js` share one proven implementation
  instead of two copies): 20 teams/division, 2 groups/division, independent group stage +
  knockout bracket + winner + leaderboard per division, zero player overlap between divisions
  confirmed at the roster level.
  - Caught proactively during schema design, not after a bad run: `Tournament.updateStandings()`
    only filtered matches by `round: 'Group'`, which — once divisions exist — would fold every
    division's group-stage matches into one polluted flat table (group names like "Group A" repeat
    across divisions). Fixed by also filtering `division: null`, so the flat `tournament.standings`
    field only ever reflects a non-divisioned tournament's own matches; a divisioned tournament's
    flat `standings`/`groups` now correctly stay at all-zero schema defaults, unused.
  - **Deferred at the time, since built** — the same CricClubs screenshots also showed a Fielding
    (Most Catches) leaderboard tab, a "Top Performer of Series" ranked list with a points column, a
    Division-scoped Teams tab with captain/vice-captain badges, and a multi-document library. The
    user was initially offered a menu bundling these in with the Division rebuild and chose the
    Division-only option — all four shipped later the same day once explicitly requested, see below.

- **Fielding leaderboard + Top Performer of Series** (merged `d73b686`, built by a parallel worktree
  agent): `getTournamentFieldingLeaderboard` in `tendencyAnalytics.js` mirrors the existing
  batting/bowling leaderboard pattern (same division-scoping, `division: null` for a flat
  tournament), counting catches/run-outs/stumpings per fielder from `ball.wicketType`/`ball.fielderId`
  across a tournament's Completed matches. "Top Performer of Series" reuses the *exact* per-match MVP
  weighting instead of inventing a separate metric: `mvpCalculator.js`'s `computeMatchMVP` was
  refactored to expose the underlying `computeMatchMVPPoints(match)` points map (previously it only
  returned the single winning player's ID), summed across a tournament's/division's matches for a
  real points-based ranking — verified to still produce byte-identical `manOfTheMatch` picks against
  25 real completed matches. Both wired into the existing `GET /:id/leaderboard` endpoint, web +
  mobile Awards tab.
- **Division-scoped Teams roster + multi-document library** (merged `b9090f2`, built by a parallel
  worktree agent): new `GET /:id/teams?division=X` returns that division's (or the whole flat
  tournament's) teams with captain/vice-captain/full roster populated, including `Player.profilePicture`
  (falls back to an initials avatar for the placeholder default — no new photo-upload pipeline needed,
  the field already existed). The single-slot `houseRulesDocument` was fully migrated into a real
  `documents: [{url, fileName, category, uploadedAt}]` array (`POST`/`DELETE /:id/documents`) — zero
  tournaments had one set at migration time, so no data migration was needed. Left a harmless ghost
  `houseRulesDocument: {url: null, ...}` field on 4 pre-existing tournaments (Mongoose doesn't strip
  fields removed from the schema on read); cleaned up afterward via a raw-driver `$unset` across the
  collection, since Mongoose's own `updateMany` silently no-ops an `$unset` for a field no longer in
  the schema — worth remembering next time a field gets removed from any model.
- **Mobile ErrorBoundary** (`83aad93`, unrelated to CricClubs but shipped in the same parallel batch):
  see `documentation/todo.md`'s Mobile/pilot-testing section for the full writeup of the EAS Update
  blank-screen investigation this closes most of.
- **Win-probability model retrained on real match outcomes** (`8eaacc2`, `ai-engine/`, unrelated to
  CricClubs but shipped in the same parallel batch): see `documentation/todo.md`'s AI/data section for
  the full writeup.
- **Web navbar + Tournament Manager decluttered, plus 3 real bugs caught by actually browsing the
  app** (`93aae22`): the top navbar's 12 flat links were overflowing the viewport at normal desktop
  widths (Register button clipped off entirely) - grouped into Compete/Community dropdowns plus 3
  standalone destinations, 5 top-level items instead of 12. The Tournament Manager's 10 flat tabs
  (grown steadily all session - Teams and Documents were both added just hours earlier) became a
  two-tier bar (Tournaments / Compete / Stats / Info, each with its own sub-tab row), with zero
  changes to the underlying per-tab render logic. Screenshotting the actual result (Playwright,
  headless Chromium against the live dev server) rather than trusting the code read alone surfaced
  three real, unrelated bugs in the process: the web Standings tab's render condition only checked
  the flat `tournament.groups` field, never `divisions`, so every divisioned tournament fell through
  to a useless all-zero placeholder table despite the fetch effect already loading the real
  division-scoped data; `getAllTournaments`/`getTournament` never populated `divisions.awards.*`, so
  Winner/Runner-up/MVP cards showed "-" for every divisioned tournament; and the web Statistics tab
  read the stale `tournament.statistics` embedded field instead of the live endpoint built earlier
  this session specifically to fix "why are the stats 0" - it just never got wired into this
  particular tab (mobile had it right the whole time). None of these three were caught by `tsc`/
  `node --check` - they only surfaced by loading the actual page and looking.

- **Match-page bug fixes from a second round of CricClubs screenshots** (`7b549a9`, this time
  match-center screenshots: player profile with per-format stats, match scorecard tabs, ball-by-ball
  commentary, over-by-over score, a 9-chart Charts tab): the user separately flagged 3 real problems
  while looking at the real app. The Matches list showed a "Score" link on every match including
  Completed/Cancelled ones (list page never gated it, unlike the detail page, which already did).
  No back navigation existed on the match detail page except the browser button - added `router.back()`
  rather than a hardcoded destination, since matches are reached from several different places.
  "Live Commentary" only ever showed the last 10 balls of whichever innings was "current," with no
  way to see the other innings once the second one started - a completed match's first-innings
  commentary was permanently unreachable. Rebuilt as a full ball-by-ball view for either innings via
  a toggle, auto-following the live innings until the viewer picks one manually. **Also found while
  testing**: `GET /api/matches` returned full ball-by-ball data for all matches with no projection -
  57MB and 12+ seconds for the 579 real matches this session's simulations had accumulated,
  effectively hanging the Matches page. Fixed with `.select('-innings.balls')` (down to 1.6MB/<1s),
  and used the still-included innings totals to add inline live scores per team on each card,
  matching what CricClubs' match list shows.
- **Toss, partnerships, extras/type-of-runs charts, player-profile-by-format** (merged in one batch:
  `22396cb`, `8547ded`, `83eb0dc`, `a907f3e`) - four more gaps from the same screenshot round, built
  as 4 parallel worktree agents and merged in sequence, 2 of which needed real conflict resolution
  (both extended `matchCharts.js`'s `getMatchCharts` return and the match page's Charts section -
  resolved as simple concatenation both times, consistent with every prior batch's experience that
  same-file edits in different regions merge cheaply). Toss: schema/backend support already existed
  but had zero UI and a broken populate ref (`toss.winningTeam` had no `ref: 'Team'`, fixed as part of
  this track) - now captured at the same call that transitions a match to Live, displayed in the
  header. Partnerships: computed live from ball data (this session's established pattern - never a
  separately-maintained running field), correctly handles the case where a batsman is dismissed
  before their partner ever faces a ball (the ball log only records who's on strike, never the
  non-striker, so that partner's identity isn't always recoverable - reported as a single-batsman
  partnership rather than guessed). Extras/Type-of-Runs: two small hand-built-SVG charts from data
  already tagged per ball, verified to partition each innings' total runs exactly with no double
  counting. Player-profile-by-format: `getCareerStats` gained a `byFormat` breakdown (by
  `Match.matchType`) alongside its existing all-formats aggregate, plus runs-per-innings and
  dismissal-type charts - real seed data is 100% T20 so cross-format separation could only be verified
  by code review, not live data, but the single-format case matches the all-formats aggregate exactly
  on real data as a sanity check.
- **Match detail page restructured into CricClubs-style tabs** (`c6c3b0f` web; mobile in a separate
  commit) - explicit user ask: "follow cricclubs way of handling individual match data in various
  tabs instead of single tab with lot of scrolling." The page had grown into one long scroll under
  just 2 tabs (Scorecard/AI Insights) as feature after feature landed on it this session. Split into
  6: Info, Ball By Ball, Full Scorecard, Over by Over, Charts, and AI Insights (ours, not
  CricClubs'). Team score summary moved out of any single tab into a persistent header shown above
  the tab bar regardless of which tab is open, matching CricClubs' layout. **Full Scorecard and Over
  by Over are both new** - CricRoots never had either as a real feature. Full Scorecard was
  previously only derivable from the client-only `liveState` snapshot, absent on any match not
  scored through the live-scoring UI (every match this session's simulation scripts created, for
  instance) - completed/simulated matches showed no batting/bowling card at all. Fixed by porting
  mobile's already-correct compute-fresh-from-balls approach
  (`mobile-app/src/shared/utils/matchStats.ts`) to web (`web-app/lib/matchStats.ts`) - the same
  "mobile had it right, web didn't" pattern that already showed up once this session (Statistics
  tab). Over by Over groups balls into per-bowler over rows with a short outcome chip per ball,
  matching CricClubs' view. **Also found while testing edge cases**: `match.team1`/`team2` are
  `null` on one old orphaned test match, and were accessed unconditionally in several places -
  crashed the *entire* page (this bug predates the restructure; the old flat layout had the exact
  same unconditional access, it just never got exercised because there was less on the page to hit
  it). Added consistent null-safe fallbacks throughout rather than leaving it latent.
  Mobile got the identical restructure (`787bd3e`) as a background worktree agent, briefed with the
  finished web diff as its reference pattern rather than redesigning from scratch - `tsc --noEmit`
  clean, and a manual diff spot-check confirmed no section was dropped or duplicated. Two real,
  pre-existing gaps surfaced in the process (not introduced by this restructure, just newly visible
  once things were organized into tabs): mobile has no Man of the Match display and no Umpires
  management UI at all, unlike web - noted in the backlog below.
- **Per-match documents** (`d15dcd3`): CricClubs' match Info tab shows a "Match Documents" row -
  CricRoots had a tournament-level document library (built earlier this session) but nothing scoped
  to an individual match. Same `documents[]` shape/pattern, reusing the existing PDF/Word upload
  middleware rather than adding a second one. Verified end-to-end against the real backend (upload,
  list, download link, delete including the underlying file) before cleanup.
- **Checked whether the 57MB Matches-list bug had siblings elsewhere**: Teams (683KB), Players
  (756KB), Tournaments (289KB) list endpoints are all fast and reasonably sized even at this
  session's full simulated-data scale (~1,560 teams/players, 579 matches) - the Matches bug was
  unique to Match being the one model with a genuinely huge nested array (ball-by-ball data),
  nothing else in this codebase has an equivalent unbounded nested payload today.
- **Fixed a real `undefined === undefined` authorization-display bug, found live** (`ede0536`):
  the match page's Umpires/Documents-upload sections used `user?.id === match.createdBy?._id` to
  decide who sees organizer-only controls. One real match in the DB has no `createdBy` set at all -
  with both sides unresolved, that comparison reads true, showing organizer controls to any
  anonymous visitor (the actions still 401 server-side if actually used, but showing privileged UI
  to a logged-out viewer is still wrong). Swept the whole web app for the same `user?.id === x?.id`
  pattern against a nullable `x` and fixed every real instance: leagues (isOrganizer), teams
  (isCaptain/isViceCaptain/isCoach - viceCaptain was already correctly guarded, the other two
  weren't), edtech lessons, marketplace listings, news posts. Left several other `user.id === ...`
  checks alone after confirming they're either already guarded elsewhere or sit behind a
  login-required page, where a null `user` would crash loudly instead of silently misfiring - a
  different, lower-priority class of bug not addressed here. While checking whether mobile had the
  same authorization bug (it doesn't - `computeCanScore` and every other mobile ownership check
  already guards both sides, another instance of "mobile had it right, web didn't" this session),
  confirmed the fix is backend-safe by construction too: every backend `.toString() !== req.user.id`
  check would throw (500) rather than silently bypass if the owner field were ever null, since
  `req.user` is always a real authenticated value behind `protect` middleware - no equivalent
  vulnerability exists server-side.
- **Mobile: Man of the Match display + Umpires management** (`6de5dd8`) - closes the two gaps
  flagged during the tab-restructure port. Umpire appointment reuses the player directory this
  screen already fetches (no new network call) via a bottom-sheet picker matching
  `TournamentDetailScreen`'s existing register-team-picker pattern; gated on `computeCanScore`'s
  `isOwner` (already null-safe, see above) rather than a new ad-hoc check.
- **Top Performers lists collapsed to #1 + "Show all" toggle** (`ece2107`): the Awards tab's
  Leading Run Scorers/Wicket Takers/Fielders and Top Performer of Series lists showed up to 20
  rows each, all visible at once - explicit user feedback that it read as cluttered. CricClubs
  shows just the top entry per category by default. Each list gets its own independent expand
  flag (opening one doesn't affect the others). Web and mobile both updated.
- **My Leagues + search-only browsing** (`6dd33de`): the Leagues page showed every league in the
  system to everyone by default - explicit user ask for a "My Leagues" section (leagues organized
  or played in) with everything else reachable only via search, not shown by default. New
  `GET /api/leagues/mine` does the `League -> Tournament -> Team -> Player -> User` join
  server-side; `GET /api/leagues?search=<term>` is unchanged/backward-compatible when no search
  param is given (any other existing caller still gets the full list), but the frontend never
  calls it until the viewer actually types something. Verified with a throwaway second league
  (different organizer, no roster relationship) confirmed excluded from "mine" but found via
  search, then deleted. Web and mobile both updated.
- **AI-generated match summary** (`f5b0370`): a short natural-language recap, auto-generated once
  a match completes and shown at the top of the match page's Info tab - the CricClubs "Summary"
  behavior from the newest batch of match-page screenshots. Not an LLM call, same template/
  phrase-bank convention as `commentaryGenerator.js`/the tactical advisor: reuses
  `matchArticleGenerator.js`'s existing `computeMatchPerformances`/`pickHeroMoment` plus two newly
  exported sentence-builders (`resultSentence`/`heroSentence`) so this and the tournament news
  article read in the same voice instead of duplicating similar prose logic. Generated once
  (`matchController.updateMatch` only fills it while `match.summary` is still empty) and stored
  directly on `Match.summary`, unlike the tournament article which requires a `Tournament` and
  writes a separate `NewsPost`. Live-verified via the real `PUT /api/matches/:id` completion flow.
- **MVP tab** (`1a6c5a5`): new `GET /api/matches/:id/mvp` exposes the full per-match points
  ranking (`computeMatchMVPPoints`, already existed for Man-of-the-Match selection, just wasn't
  reachable as its own endpoint before). Web/mobile show it as a new tab, collapsed to the top 5
  with the same "Show all" toggle pattern as Tournament Awards. Live-verified across 3 real
  completed matches that the #1-ranked entry always matches `match.manOfTheMatch`.
- **Squads section** (`3f32a47`): Info tab now shows both teams' rosters side by side (avatar,
  name, role, captain/VC badges), fetched from the already-fully-populated `GET /api/teams/:id`
  - no new backend work needed. Collapses to 5 players per team with a "Full Squad" toggle, same
  pattern as MVP/Awards. Guarded against the confirmed-orphaned test match (null `team1`/`team2`).
- **In-app match/tournament notifications** (`58fbe84`): scoped down to in-app only per
  this doc's own backlog note - a bell icon + polled feed, no email/SMS/push infra (out of
  scope, this app has none). New `Notification` model (`backend/src/models/Notification.js`,
  compound-indexed on `{recipient, read, createdAt}`) fanned out to one document per recipient at
  creation time via `notificationService.js`, using the same `Team -> Player -> User` join
  `leagueController.getMyLeagues` established this session, just run forward (a team's roster ->
  its users) instead of backward. Two trigger points, both wrapped in the same log-only
  try/catch pattern as `matchController.updateMatch`'s other post-save side effects (match
  summary, standings refresh, ...) so a notification bug can never fail the real action: (1)
  `updateMatch` fires `match_live`/`match_completed` to every rostered player on either playing
  team on an actual status *transition* (captured via a `previousStatus` snapshot, so re-saving
  an already-Live match doesn't re-notify); (2) `messageController.postTournamentMessage` (the
  existing announcement-chat endpoint) fires `tournament_announcement` to every rostered player
  on any team in `tournament.teams` (already the full registered-team list regardless of
  divisions - `assignDivisions` partitions it, doesn't replace it, so no division-aware branch
  needed). `GET/PATCH /api/notifications*` (list capped at 50, unread-count, mark-one-read,
  mark-all-read) - mark-one-read verifies `notification.recipient === req.user.id` server-side
  (403 otherwise), same discipline as this session's other ownership-check fixes. Web: bell icon
  in `Navbar.tsx` (visible at every breakpoint, not just desktop) with a dropdown panel, polling
  `/unread-count` every 10s to match the match page's existing poll interval. Mobile: new
  Notifications tab in `MainTabNavigator` (bell icon + badge, same pattern as the Profile tab's
  existing unread-DM badge) opening `NotificationsScreen.tsx`, tapping a notification maps its
  `link` (a real relative path, e.g. `/match/<id>` or `/tournaments?tournamentId=<id>` - matched
  against the actual web routes, not assumed ones) to the right tab/screen/params. Live-verified
  against the real backend + real MongoDB with a throwaway user/player/team/match/tournament
  (created via the real API, deleted by exact ID afterward): flipping a real match Scheduled ->
  Live -> Completed produced exactly the expected notifications with no duplicate on a re-save
  no-op, posting a tournament announcement notified every rostered team's players, and the
  403-on-wrong-user / mark-all-read / unread-count paths all checked out.

### Backlog (not started, roughly in priority order)

- **Push/email notification delivery** — the in-app notification feed above covers the "seen
  when you check the app" case; actual push (Expo push tokens) or email delivery for a followed
  team's match going live, or a tournament announcement, would need real delivery infra this app
  doesn't have yet. Deliberately out of scope for the in-app pass.
- **Live streaming + AI highlights** (CricHeroes) — real video infrastructure, a much bigger lift
  than anything else on this list. Noted for completeness, not scoped or planned.
- **Community feed** (CricHeroes: rules/education/trivia/quizzes/polls/stories) — CricRoots's
  edtech/news modules already cover lessons and announcements; polls/trivia/quizzes would be new
  data models. Lower priority than the stats/analytics gaps above.

## Notes on parallel-agent batches (3 so far)

**Batch 3** (2026-08-14, 5 agents: ball-by-ball commentary/voice, the EAS error-boundary fix, the
fielding/top-performer leaderboard, the Teams/documents feature, and the AI win-probability
retraining) — larger and more heterogeneous than the first two batches (backend+web+mobile+Python
all at once, not just backend+web). What was different this time:

- **One agent's task turned out to already be done.** The ball-by-ball-commentary/voice-scoring plan
  it was handed was stale — that feature had actually shipped in an earlier, since-summarized part of
  this same session (`0b27370`/`d6207e4`/`7ae502a`), but the plan file itself never got cleaned up
  after completion, so it looked unstarted. The agent verified this properly (traced the git history,
  re-ran the full verification suite against the already-merged code) rather than either blindly
  redoing the work or blindly trusting that "the plan exists" meant "not done" — and correctly did
  *not* create an empty commit. Lesson: a stale plan file is a real failure mode now that plans
  persist across compactions; worth deleting `.claude/plans/*.md` once its work is confirmed shipped.
- **Worktree isolation means the shared docker containers are blind to an agent's edits.** Both
  `cricroots-backend` and `cricroots-ai-engine` bind-mount the *main* repo directory, not any
  worktree — so `docker exec` from inside a worktree agent runs old code. Each backend-touching agent
  instead ran its own local `node src/index.js` on a free port directly against the real MongoDB
  (exposed on `localhost:27017` on the host) for live E2E verification. The Python agent similarly
  couldn't `docker exec` its retrained model into place — it trained in its own local venv, and the
  orchestrating session did the actual `docker cp` + container restart into the `cricsync_ai_models`
  volume after merging. Worth remembering for any future batch that needs real E2E, not just static
  checks.
- **Two agents editing the same 5 files (`tournamentController.js`, `TournamentManager.tsx`,
  `TournamentDetailScreen.tsx`, `apiClient.ts`, `types/index.ts`) still merged with zero manual
  conflict resolution** — git's `ort` strategy handled it automatically both times, same as the
  earlier batches' experience: different tabs/sections in the same file are non-overlapping insertion
  points, not a real conflict, as long as each agent is told to make surgical edits and not reformat
  unrelated code.
- **A real Mongoose gotcha surfaced during merge-and-verify** (not by any agent, by the orchestrating
  session afterward): `Tournament.updateMany({}, {$unset: {houseRulesDocument: ''}})` silently did
  nothing — Mongoose's strict mode drops an update operation that references a field no longer in the
  current schema, even though `$unset` on a truly-absent path would normally be a harmless no-op
  anyway (the field *was* present in the raw documents, just not in the schema). Only the raw
  `mongoose.connection.collection(...).updateMany(...)` (bypassing Mongoose's schema layer entirely)
  actually removed it. Worth remembering any time a field is dropped from a schema after real data
  already has it set.
- Net effect: five feature-sized chunks (one of which turned out to need zero new work) landed in
  under 25 minutes of wall-clock time for the four that did.

**Batches 1 and 2** (earlier, 3 agents each):

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
