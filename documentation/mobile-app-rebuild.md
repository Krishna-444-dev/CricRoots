# Mobile App Rebuild + Ball Commentary/Voice Input + Analytics Research

Continuation of the autonomous work session started in `documentation/cricclubs-feature-roadmap.md`.
Covers: auto-generated ball commentary + voice-driven scoring input, a full mobile-app foundation
rebuild (it was crashing on launch), a research pass into advanced cricket analytics, a full
web-vs-mobile feature-parity audit and build-out, and the first real live pilot-testing/bug-fix
arc (EAS Update setup, a systemic null-ref crash class, live-scoring resume, chart rendering, and
scorecard format). Started 2026-08-11.

## Ball commentary + voice scoring input (`0b27370`)

User's idea: auto-generate readable commentary from the structured data already captured during
scoring, and let the scorer speak a phrase ("yorker, off stump, driven for four") instead of
tapping through the delivery-tagging button groups, since tapping was slow enough that most
routine balls never got full detail tagged.

- **Commentary**: `backend/src/services/commentaryGenerator.js`, a phrase-bank (2-4 varied
  templates per situation: wicket / boundary / 1-3 runs / dot ball / each extra type) with a
  generic fallback so untagged balls still get *some* commentary. Generated server-side in
  `matchController.recordBall`, stored on the ball, shown in a new "Live Commentary" panel on the
  match detail page. Player names for the sentence come from the client (already in state at the
  moment a ball is scored), not a server-side lookup — avoids widening the save-vs-lookup race
  window in an already-hot path.
- **Voice input**: browser-native Web Speech API (`web-app/components/scoring/VoiceBallInput.tsx`,
  feature-detected, renders nothing on unsupported browsers), a keyword parser
  (`web-app/lib/voiceBallParser.ts`) using word-boundary + longest-phrase-first matching — this
  specifically prevents "off stump" (a line) from being misread as the "stumped" wicket type, a
  real collision risk a Plan-agent design review caught before implementation. Voice only fills
  the same state the tap buttons fill; it never auto-submits — the existing Record Ball
  button/wicket-modal confirm step still gates the actual save.
- Hoisted the line/length/shot-type/shot-zone taxonomy (previously duplicated between
  `BallByBallScoring.tsx` and `WagonWheel.tsx`, silently able to drift) into a shared
  `web-app/lib/ballTaxonomy.ts`.
- Verified end-to-end: unit-tested the generator and parser directly, confirmed via curl + browser
  screenshot that tagged/untagged/wicket/extra balls all produce correct commentary, and confirmed
  the exact "off stump" collision case does NOT trigger a false wicket.

## Mobile app: rescued from a crashing, three-navigator-tree state (`7680b4a` .. `675fb0f`)

An audit (Explore agent) found mobile-app in far worse shape than "behind web-app": the live entry
point crashed on its default tab from a broken import chain, three separate and
mutually-inconsistent navigation trees existed (only one of which `App.tsx` actually mounted, and
*that* one had no auth gate at all), the API client was written against an imagined backend
(invented `/cart`, `/messages`, `/chat-groups` routes that don't exist server-side; wrong port;
wrong paths for scoring/player-stats), and `useAuth` was a bare hook factory with no React
Context — meaning `LoginScreen` and the navigator's auth check would each hold independent, unsynced
state even once reachable.

### Foundation rebuild (`7680b4a`) — done myself, sequentially, since everything else depends on it

- New Stadium Dark theme (`mobile-app/src/theme/index.ts`) matching `web-app/tailwind.config.js`
  exactly, replacing the old generic light-blue Material theme.
- Rewrote `apiClient.ts` against the real backend route surface — every path cross-checked against
  `backend/src/routes/*` — with a single base URL via `EXPO_PUBLIC_API_URL` (Expo's native env-var
  inlining, no new dependency) that's platform-aware for the Android-emulator-vs-host-localhost
  gotcha (`10.0.2.2` vs `localhost`).
- Rewrote `shared/types/index.ts` to match real Mongoose document shapes (`_id`, `team1`/`team2`,
  etc.) instead of an idealized simplification.
- New `AuthContext.tsx` wrapping the `useAuth` hook factory so auth state is actually shared app-wide.
- Consolidated to one navigation tree (`AppNavigator`, auth-gated) and deleted the two dead ones,
  plus the orphaned iOS/Android platform-specific component library (`src/platform/*`,
  `IntegratedApp.tsx`) nothing correctly wired up to — converged on one consistent themed
  component style instead of maintaining two half-built native-look component trees.
- Expanded the tab bar from 5 mock screens to a real 5-tab × nested-stack IA
  (Home/Matches/Teams/Tournaments/Profile) covering every feature area web-app has, registering
  placeholder screens for anything not yet built (so the app stays runnable at every checkpoint).
- Generated placeholder app icon/splash assets in the Stadium Dark palette (`app.json` referenced
  files that didn't exist anywhere in the repo, which would block `expo prebuild`/`eas build`) — a
  real designed icon should replace these before an actual store submission.

### Screen-building batch — 4 parallel background agents, split along the stack files just created

Each track owned a distinct set of screen files with the shared navigator/apiClient/theme/types
already stable, so file overlap between tracks was near zero (unlike the two CricClubs/CricHeroes
batches, where tracks sharing `tournamentController.js`/`matchController.js` needed hand-merging).

- **Matches + Live Scoring** (`675fb0f`) — the flagship feature: match browsing, match detail
  (scorecard, recent deliveries, live commentary), and the full ball-by-ball live scoring flow
  (team/roster setup, run/extras/wicket recording against the real `record-ball` endpoint, the
  same line+length-mandatory-before-confirming-a-wicket validation as web-app, optional
  progressive delivery tagging feeding the same wagon-wheel/MVP/commentary pipeline).
- **Teams + Tournaments** (`b2d247e`) — team roster management (captain-only add/remove player),
  team creation, and the full tournament experience (standings, linked matches, register-team,
  organizer-gated generate-fixtures/compute-awards — gated in the render tree itself, not just the
  tap handler, so a non-organizer never even sees the buttons).
- **Player Stats + Network** (`8134cf6`) — career stats, wagon wheel (rendered as sorted horizontal
  bars, not a circular SVG chart — `react-native-svg` isn't installed and adding a new native
  dependency wasn't safely doable in this environment, so this is a deliberate equivalent-data,
  different-rendering simplification), all 8 achievement badges (earned highlighted gold, locked
  dimmed not hidden), and the player directory with follow/unfollow. Also fixed a real latent bug:
  `ProfileScreen` was passing a *User* id where the stats screen needs a *Player* id (different
  document/id space) — now resolves the user's own Player profile first via
  `GET /players/me/profile`.
- **Learn/News/Marketplace/Cart/Orders** (`67cb4c5`) — content browsing plus the full
  add-to-cart → checkout → order-history flow, reusing the already-correct, already-client-side-only
  `CartContext`. This agent caught and fixed a real bug in its own task brief: the suggested
  checkout payload shape didn't match what `orderController.js` actually reads (it only consumes
  `{productId, quantity}` per item and re-derives name/price/seller/total server-side) — sending
  the richer shape would have silently been ignored and 400'd every checkout.

### Result

Zero placeholder screens remain (21/21 real), `npx tsc --noEmit` is clean across the entire
mobile-app codebase. This is UI-complete parity with web-app's core feature set, built and
statically verified without ever running the app in a simulator (none was available in this
environment) — **the natural next step for whoever picks this up is an actual device/simulator
smoke test**, since static type-checking and hand-traced logic review, however careful, cannot
catch every runtime-only issue (layout overflow, gesture conflicts, native module quirks).

### One session-usage-limit recovery worth noting

The Matches/Live Scoring agent (the largest of the four) hit a session usage limit mid-task,
right as it started its biggest file. Rather than restart it, its output was inspected directly:
all three of its files were already complete and syntactically sound — the only compile error was
a one-line gap in *my own* foundation work (`BallEvent`'s shared type was missing
`batsmanName`/`bowlerName`/`fielderName`, which the agent correctly tried to send per its brief).
Fixed the type, salvaged the full output, zero work lost. Same lesson as the earlier CricHeroes
batch's recovery: check a failed agent's worktree for salvageable content before defaulting to a
full restart.

## Cricket analytics research pass

Researched (WebSearch-heavy Explore agent) advanced cricket analytics work — GitHub repos,
published methodologies — specifically evaluated against CricRoots's local/club-level focus and
small-data-volume constraint (a club season is thousands of balls, not the scale professional
analytics train on). Full findings in the agent transcript; summary of what's actionable:

**Worth building:**
1. **D/L "Standard Edition" rain-revision** — the *Professional* Edition used in international
   cricket is ICC-owned/proprietary, but the original Standard Edition (the exponential-decay
   resource formula from Duckworth & Lewis's own published papers) is public, and is what England's
   ECB "Play-Cricket Scorer" app — the closest direct analog to CricRoots — actually ships for
   recreational cricket. Closed-form formula + a resource table, no ML, no licensing issue, as long
   as it's clearly labeled "D/L Standard" (not claiming ICC-grade Professional Edition accuracy).
   **Not yet implemented** — the exact published resource-table values need sourcing/verification
   against the original papers before shipping a number that decides a real match outcome; this is
   the one place in this research pass where getting it wrong (a plausible-looking but incorrect
   number, stated with false authority) is worse than not building it, so it wasn't rushed.
2. **WPA-style "key moments" detection** — baseball's Win-Probability-Added concept (rank
   deliveries by the swing in win probability before/after) ported to cricket, using CricRoots's
   *existing* win-probability endpoint. Notable because every cricket highlight-detection approach
   found in the literature is video-based (ball-tracking, broadcast footage) — WPA is the one
   technique that works from structured event data alone, which is all CricRoots has. Investigated
   during this session; **found the win-probability model isn't currently trained at all**
   (`ai-engine`'s `/win-probability` endpoint returns "model not trained" — a deeper gap than the
   previously-known "trained on synthetic data" issue) — see below.
3. **Cricsheet** (the standard free ball-by-ball dataset, ~22,500 pro/international matches) — not
   useful for club-level player stats (international scoring patterns don't transfer), but a good
   substitute for the AI engine's synthetic win-probability training data, since win-probability's
   *shape* (function of required rate / wickets / overs left) generalizes better across levels than
   player-skill stats do. A prerequisite for #2 to be trustworthy, not just a nice-to-have.
4. **Markov-chain batting-order optimization** (Ovens & Bukiet and follow-up academic work) — a
   closed-form DP over each player's own run/dismissal distribution to suggest an optimal batting
   order. Fits CricRoots's existing shrinkage-stats architecture (same "small sample, pool toward
   average" problem already solved for shot advice/bowling plans) but needs the DP machinery built
   from scratch — no reusable library found.

**Explicitly not a fit** (video/hardware-dependent, proprietary with no public methodology, or
CricRoots already has a comparable purpose-built solution): CricViz Expected Wickets/Runs, WASP,
ESPNcricinfo Forecaster, Impact Index, ICC Rankings' exact formula, video-based commentary
generation research, ELO team ratings (trivial to add but low priority).

### Fixed: the win-probability model wasn't loading, and WPA key moments is now live

`docker exec` into a live win-probability request during this investigation returned
`{"success": false, "message": "Win probability model not trained"}` — the model artifact
(`ai-engine/src/models/trained_models/win_prob_model.pkl`) existed on disk but wasn't loadable for
that endpoint, and the failure was silent (a bare `except: return False`). Root cause: `ai-engine`
has no dev volume mount (unlike `backend`), so it only ever sees whatever `.pkl` was baked into the
image, with no way to self-correct. Fixed in `02fd7b9` — `load_models()` now logs the real
unpickling error, and `recommendations.py` auto-retrains on load failure so the service is
self-healing regardless of pickle compatibility. Verified via a genuine `docker compose build` +
cold restart, not just an in-memory patch.

With the model fixed, WPA-style **key moments** (finding #2 above) is now built: a new
`backend/src/services/keyMoments.js` replays the chasing innings (`innings[1]`) ball-by-ball,
calls the AI engine's win-probability endpoint at each checkpoint, ranks deliveries by
`|Δwin-probability|`, and returns the top 5 with their existing `commentary` text. New endpoint
`GET /api/matches/:id/key-moments` (Test matches explicitly excluded — no single limited-overs
chase concept applies). Displayed as a "🔑 Key Moments" panel on both the web-app match page and the
mobile `MatchDetailScreen`, reusing the same ball-commentary field already stored per delivery.
Verified end-to-end through the real backend→ai-engine pipeline (both a direct in-container call and
a full HTTP round-trip via nginx, with real match/team/ball data created through the actual API) and
via `tsc --noEmit` on both web-app (isolated) and mobile-app (whole-project).

Retraining the model itself against Cricsheet-derived match-state sequences (rather than the
current synthetic data) — which would improve accuracy on both the live tactical advisor and key
moments — is still a good follow-up, just not a blocker anymore.

## Points-based prediction game (not real-money betting)

The user asked to explore a "betting angle" to drive engagement among local/amateur players.
Real-money wagering was deliberately ruled out: gambling regulation varies enormously by
jurisdiction (licensing, KYC/AML, potential criminal liability for unlicensed operation), which is
legal exposure beyond ordinary product engineering judgment and needs the user's explicit sign-off,
not a unilateral build decision. Built instead: a free, points-based match-prediction game that
captures the same "who's going to win?" engagement hook with zero stake and zero payout.

- **Backend** (`e49cff1`): new `Prediction` model (`user`, `match`, `predictedWinner`, optional
  `predictedMotm` bonus guess, unique per user+match), `predictionSettler.js` service, and
  `/api/predictions` routes (submit/upsert, per-match "mine + community split", personal history,
  global leaderboard via aggregation - no denormalized point totals to keep in sync). Predictions
  lock the moment a match leaves `Scheduled`, so a "prediction" can never be made with in-progress
  match knowledge. Settlement runs automatically inside `updateMatch` when a match transitions to
  `Completed` - the frontend never triggers it. Scoring is purely additive (+10 correct winner, +15
  bonus for also nailing Man of the Match, 0 for wrong - never negative), which is itself part of
  what keeps this clearly on the legal/fun side of the line rather than something resembling a
  wager with a downside. Verified end-to-end via curl against a real match/team/prediction flow:
  upsert-before-lock, lock-on-Live rejection, auto-settlement, and leaderboard aggregation all
  confirmed working.
- **Web + mobile UI** — 2 parallel background agents, foundation (backend) already stable so no
  file overlap risk. Both added: a predict-the-winner widget on the match detail page/screen
  (locked automatically once `Scheduled` ends, shows the community split to everyone, shows
  settled results once a match completes), and a leaderboard page/screen with a "My Predictions"
  tab. Both tracks independently hardcoded "0 points" whenever the winner guess was wrong, missing
  that `wonOnWinner` and `wonOnMotm` are scored independently server-side - a wrong-winner-but-
  right-MOTM prediction can still earn 15 points. Caught in review before merging (same bug, found
  independently in both codebases since the two agents worked from the same task brief) and fixed
  in both before merge. All UI copy avoids gambling language entirely ("predict"/"points"/
  "leaderboard", never "bet"/"wager"/"odds"/"stake").

## Full web-vs-mobile feature parity audit + build-out (`efc92a1` .. `f04bbc1`)

User's ask: "whatever functionality we see on the web app, we should be able to see and do on
mobile app" — not just live scoring parity. An Explore-agent audit found five genuine gaps, one of
them (tournament creation) confirmed broken on **both** platforms, not just missing on mobile:

- **Match creation** (`efc92a1`) — confirmed totally missing from mobile; no way to start a match
  at all without going to web first.
- **Calendar** (`d7330ca`) — mobile port of the read-only web `/calendar` month-grid view.
- **Player profile completion + rankings** (`9a3d172`) — flagged as the highest-impact gap: a new
  player joining via mobile had no way to fill in their own profile.
- **Lesson and news authoring** (`2221496`) — mobile could read lessons/news but not create them.
- **Tournament creation** (`f04bbc1`) — the real find here: this was dead code on **web too**, not
  just a mobile gap. Fixed on both platforms in the same pass, plus mobile parity.

Built via parallel background agents (one per gap), each reviewed by reading the actual diff rather
than trusting the agent's own summary — this caught two real cross-agent conflicts before merge:
`HomeStack.tsx` got independent `Stack.Screen` additions from two agents working off the same base
commit (reconciled by hand, both kept); and the scoring-screen agent and the match-detail agent
independently designed **incompatible shapes** for `Innings.liveState` — one a lightweight
`ScoringSnapshot` (`battingTeamId`/`strikerId`/`nonStrikerId`/`bowlerId`/`outPlayerIds`), the other
expecting the full web-style `InningsData` shape (`currentBatsmen`/`currentBowler`/
`battingScorecard`/`bowlingScorecard`). Fixed by having the scoring screen write **both**, merged
into one object (`buildFullLiveState()`), so either screen can read what either wrote — this
mismatch resurfaced later (see the live-scoring resume section below) when a `liveState` written by
something else entirely (a manual backfill) turned out to satisfy neither shape fully.

## First real live pilot test + first real EAS Update setup

User tested the rebuilt app live over several rounds, each surfacing genuine bugs invisible to
`tsc --noEmit` or static review:

- **Rediscovered the dev server wasn't actually running** this session (a stale `expo start`
  process), and that no EAS Update had ever actually been published despite a linked EAS project
  (`c42d8897-9374-4b2c-8ceb-7282f6180e2b`, owner `krishnadev444`) — a prior claim that OTA
  distribution was already live was checked against `eas-cli build:list`/`channel:list` and found
  false before repeating it. Set up EAS Update for real: `eas update --channel preview` auto-created
  and linked a same-named branch+channel, now the actual pilot-distribution path.
- **The EAS Update path showed a silent blank screen after login** with no error surfaced — traced
  the *cause of the confusion* (not fully explained even now) but found and fixed the underlying
  false claim: an EAS Update bundle bakes in whatever `EXPO_PUBLIC_API_URL` was set in
  `mobile-app/.env` on the machine that ran the publish command, at publish time — so "OTA update,
  works from anywhere" was wrong; it still requires the same LAN/backend as the local dev-server
  path. Redirected testing to the dev-server path specifically because it surfaces real Metro
  red-box error overlays instead of a silent blank screen.
- **`HomeScreen.tsx` crash**: `Cannot read property 'name' of null` in `teamName()`, confirmed via
  the actual Metro error overlay (Render Error, Sources, Component/Call Stack) the user
  screenshotted. Root cause is a recurring bug class from earlier in this session's web-app
  work: a populated Mongoose ref resolves to one of three shapes — an unpopulated id string, a
  populated object, or `null` (a deleted referenced document — Mongoose nulls the field rather than
  omitting it or erroring). Code shaped like `typeof x === 'string' ? fallback : x.name` mishandles
  this because `typeof null === 'object'`, so `null` falls into the "populated object" branch and
  `.name` throws. Fixed with a new `mobile-app/src/shared/utils/resolveRef.ts`
  (`resolveRefId`/`resolveRefName`, mirroring the existing `web-app/lib/resolveRef.ts`), then swept
  the whole app for the pattern — 24 occurrences across 13 files, 12 genuinely vulnerable and fixed,
  12 already safely guarded (`a7b92cb`).

## Second bug round: WebSocket URL, AI Insights hidden by its own error, scoring-button parity gap

- **`useMatchWebSocket.ts` never actually connected**: it read `process.env.REACT_APP_API_URL`, a
  Create React App convention Metro never inlines, always silently falling back to
  `http://localhost:5000` — which on a physical device means the phone itself, not the backend. Now
  derives the socket origin from the same `API_BASE_URL` the REST client already resolves
  correctly, stripped of its `/api` suffix.
- **`AITacticalAdvisor.tsx` hid valid data behind an unrelated error**: it showed its error card
  unconditionally whenever the socket errored, even when the REST-fallback fetch had already loaded
  real insights — a connection hiccup blanked out working content. Now only blocks on the error if
  there's truly nothing to fall back on (`error && !aiInsights`).
- **`MatchDetailScreen.tsx`'s "Score this match" button used a stale, creator-only `canScore`
  check** that was never updated when scoring authorization was broadened inside
  `LiveScoringScreen.tsx` earlier this session — invisible to any non-creator rostered
  player/umpire who would have actually been let in once there. Fixed by extracting a shared
  `mobile-app/src/shared/utils/matchAuth.ts` (`computeCanScore`/`resolveUserId`/`rosterIds`), used
  by both screens so this can't drift out of sync a third time.
- **No public read-only Full Scorecard**: it only ever existed on the scorer's own
  `LiveScoringScreen.tsx`. Built one on `MatchDetailScreen.tsx`, extracting the ball-derived stats
  functions (`isLegalDelivery`/`battingStatsFor`/`bowlingStatsFor`/`maidenOversFor`) into a new
  shared `mobile-app/src/shared/utils/matchStats.ts` used by both screens (`8f24943`).

## Third bug round: live-scoring resume, chart rendering, scorecard format

Three more rounds of screenshots after the fixes above landed, each pointing at a real, distinct bug:

- **Live-scoring resume silently produced a blank/zeroed scoring view**: a match at 72/3 in 6 overs
  showed blank striker/non-striker/bowler names and "0 (0)"/"0/0 (0.0)" everywhere. Root cause: the
  resume logic (`LiveScoringScreen.tsx`'s `load()`) treated *any* truthy `innings[idx].liveState` as
  a valid resumable snapshot and immediately set `inningsStarted = true` — but this match's
  `liveState` had been written by something that didn't populate the `ScoringSnapshot` fields
  (`battingTeamId`/`strikerId`/`nonStrikerId`/`bowlerId`), so those all resolved to `undefined` while
  the screen still skipped straight past the "Start Innings" setup form. Fixed by validating the
  snapshot actually has every field needed before trusting it; if not, falls through to a "Resume
  Scoring" picker pre-filled with the batting side and already-dismissed batsmen derived directly
  from the ball log (unambiguous, unlike who's currently at the crease) rather than guessing at a
  specific player (`dbe77aa`).
- **Manhattan and Worm charts read as broken/non-standard**: both were horizontal bar-list rows
  (one per over, growing sideways) — the Worm Chart in particular just showed ever-longer bars of a
  running total, which doesn't convey what a worm chart is *for* (each team's scoring rate,
  compared side by side, with a visible crossing point). Rebuilt both as real SVG charts
  (`react-native-svg`, confirmed to ship inside Expo Go itself — no custom dev client needed, so
  this doesn't affect pilot distribution) matching `web-app/components/insights/ManhattanChart.tsx`
  and `WormChart.tsx`'s design exactly: clustered vertical bars per over for Manhattan, two
  polylines with an area fill for Worm, both with gridlines, axis labels, and wicket dots
  (`dbe77aa`, `c7d43b1`).
- **Both scorecards were missing standard dismissal text**: "13 (3) 4s:0 6s:2 SR:433.3" with no
  indication of *how* — or whether — a batsman got out, next to a "Full Scorecard" label. Added a
  shared `dismissalFor()` in `matchStats.ts` producing standard shorthand ("c Fielder b Bowler",
  "lbw b Bowler", "run out (Fielder)", "not out", ...) from each wicket ball's
  `wicketType`/`bowlerId`/`fielderId`, resolving names via a roster lookup (a docs-verification
  pass afterward found `batsmanName`/`bowlerName`/`fielderName` - accepted on `record-ball` and
  declared on the client's `BallEvent` type - are actually never persisted on the ball
  subdocument server-side, used only transiently to build `commentary`; `dismissalFor` still
  checks them first in case that changes, but in practice always falls through to the roster
  lookup) (`501fda5`). Also
  restructured `LiveScoringScreen`'s own scorecard from a single concatenated stat line into the
  same R/B/4s/6s/SR column-table layout `MatchDetailScreen`'s already used, since the two had
  drifted into visibly different formats (`08197dc`).

Every fix in these three rounds was verified against the actual served Metro bundle (fetching
`http://localhost:8081/node_modules/expo/AppEntry.bundle?platform=ios&dev=true` and grepping for
the new code) before telling the user it had shipped — `tsc --noEmit` alone doesn't catch runtime
crashes, stale-bundle caching, or Rules-of-Hooks violations. Also learned the hard way that a
shake-triggered in-app Reload on the EAS Update path only re-runs the update already downloaded to
the phone — it does not check the channel for a newer publish; that requires a full force-quit and
relaunch of Expo Go.

## What's next

- Source and verify the D/L Standard resource table before implementing rain-revision for real.
- Still an open question, not just a deprioritized one: *why* the EAS Update path shows a silent
  blank screen with zero error surfaced (as opposed to a real crash with a visible stack trace, the
  behavior confirmed on the dev-server path) — worked around by testing on the dev server instead,
  never root-caused.
- The win-probability/tactical-advisor model (`ai-engine/`) is trained on synthetic data at small
  scale — real club-match data (as scoring activity accumulates through this app itself) would be
  the next step toward it actually being sensitive to match state rather than saturating near its
  extremes for long stretches.
