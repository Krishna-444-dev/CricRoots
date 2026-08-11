# Mobile App Rebuild + Ball Commentary/Voice Input + Analytics Research

Continuation of the autonomous work session started in `documentation/cricclubs-feature-roadmap.md`.
Covers three threads: auto-generated ball commentary + voice-driven scoring input, a full
mobile-app foundation rebuild (it was crashing on launch), and a research pass into advanced
cricket analytics to find genuinely applicable next features. Started 2026-08-11.

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
published methodologies — specifically evaluated against CricSync's local/club-level focus and
small-data-volume constraint (a club season is thousands of balls, not the scale professional
analytics train on). Full findings in the agent transcript; summary of what's actionable:

**Worth building:**
1. **D/L "Standard Edition" rain-revision** — the *Professional* Edition used in international
   cricket is ICC-owned/proprietary, but the original Standard Edition (the exponential-decay
   resource formula from Duckworth & Lewis's own published papers) is public, and is what England's
   ECB "Play-Cricket Scorer" app — the closest direct analog to CricSync — actually ships for
   recreational cricket. Closed-form formula + a resource table, no ML, no licensing issue, as long
   as it's clearly labeled "D/L Standard" (not claiming ICC-grade Professional Edition accuracy).
   **Not yet implemented** — the exact published resource-table values need sourcing/verification
   against the original papers before shipping a number that decides a real match outcome; this is
   the one place in this research pass where getting it wrong (a plausible-looking but incorrect
   number, stated with false authority) is worse than not building it, so it wasn't rushed.
2. **WPA-style "key moments" detection** — baseball's Win-Probability-Added concept (rank
   deliveries by the swing in win probability before/after) ported to cricket, using CricSync's
   *existing* win-probability endpoint. Notable because every cricket highlight-detection approach
   found in the literature is video-based (ball-tracking, broadcast footage) — WPA is the one
   technique that works from structured event data alone, which is all CricSync has. Investigated
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
   order. Fits CricSync's existing shrinkage-stats architecture (same "small sample, pool toward
   average" problem already solved for shot advice/bowling plans) but needs the DP machinery built
   from scratch — no reusable library found.

**Explicitly not a fit** (video/hardware-dependent, proprietary with no public methodology, or
CricSync already has a comparable purpose-built solution): CricViz Expected Wickets/Runs, WASP,
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

## What's next

- Source and verify the D/L Standard resource table before implementing rain-revision for real.
- An actual device/simulator smoke test of the mobile app (see "Result" above).
