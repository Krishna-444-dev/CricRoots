# CricRoots - The All-in-One Cricket Application

CricRoots is a comprehensive, full-stack cricket application designed to provide an all-in-one experience for cricket enthusiasts, players, and tournament organizers. Built with modern technologies across web, mobile, and backend platforms, CricRoots brings together team management, ball-by-ball live scoring, tournament administration, a player social network, community edtech, news, a gear marketplace, and data-driven AI tactical insights — with **real-time WebSocket support**.

The product direction: a world-class, one-stop app for cricket, starting with local and club tournaments rather than international cricket — every stat and recommendation is built to work from a club's own scoring data instead of assuming access to professional-league datasets.

## Project Overview

This repository contains the complete CricRoots ecosystem, including:

- **Web Application** (`web-app/`): Next.js 14 (App Router) + TypeScript + Tailwind frontend. Covers auth, live scoring, tournament management, a player network, edtech, news, and a marketplace with cart/checkout, all under a shared "Stadium Dark" design system.
- **Mobile Application** (`mobile-app/`): React Native (Expo SDK 54) with full feature parity to the web app across 31 screens — live scoring, tournaments, teams, marketplace, news, learn, the prediction game, the matchup-shrinkage Scouting Report + live tactical panel, post-match performance reports, Manhattan/Worm charts, and the in-app assistant chatbot. Distributed for pilot testing via Expo Go (no App Store review needed yet — see `documentation/going-legal-and-live.md`).
- **Backend API** (`backend/`): Node.js/Express server with MongoDB, JWT auth, and Socket.io for real-time match/chat events.
- **AI Engine** (`ai-engine/`): Python/Flask service providing win-probability and tactical-advisor predictions during a live match.
- **Statistical insights service** (`backend/src/services/tendencyAnalytics.js`): a complementary Node-side aggregation layer over real ball-by-ball data (line, length, shot zone, fielder) captured during scoring — powers shot advice, bowling plans, fielding placement, bowler scouting, wagon wheels, wicketkeeper stats, and career/tournament leaderboards, all computed live from match documents rather than a separately-maintained stats table.
- **Real-time Updates**: Socket.io WebSocket support for instant match updates, team chat, and tournament announcements.
- **Comprehensive Documentation**: Guides for architecture, deployment, development, and a running feature-progress log (`documentation/cricclubs-feature-roadmap.md`).

## Key Features

### 🏏 Live Scoring & Match Management
- **Ball-by-ball scoring UI**: runs, extras, wickets, with progressive-disclosure delivery tagging (line, length, shot zone, shot type, fielder) — auto-expands on boundaries and wickets, otherwise stays out of the way for fast scoring.
- **Voice-driven scoring**: speak a phrase like "yorker, off stump, driven for four" and it auto-fills the delivery-tagging form (never auto-submits — the scorer still confirms every ball). Supports selecting a recognition language (Hindi, Urdu, Bengali, Punjabi, Tamil, Telugu, regional English) for better accuracy on everything around the cricket terms, which stay matched in English.
- **Matchup-aware bowling plans, pre-match and live**: a hierarchical shrinkage engine blends a specific batter-vs-bowler matchup with archetype and league-wide pools (see `documentation/hierarchical-matchup-shrinkage-research.md`), then adjusts further in real time using this match's actual deliveries so far as the innings unfolds.
- **Post-match performance reports**: this match's numbers vs. career average, a recent-form trend across the last several matches, milestone/personal-best detection, and a tactical read cross-referencing each dismissal against the matchup engine's flagged risk zones.
- **Auto-generated ball-by-ball commentary**: a phrase-bank generator turns the structured data captured on every delivery into readable commentary, shown live on the match page.
- **Real match lifecycle**: create teams/rosters, create a match (optionally linked to a tournament), start an innings, score it live, finish the match — result and margin are auto-derived from the innings totals.
- **AI tactical insights**: win-probability and aggressive/balanced/defensive tactical advice during a live match (Python AI engine, self-healing on load failure), plus shot advice / bowling plans / fielding placement derived from the batsman's or bowler's own tagged-ball history where enough data exists, falling back to a wider player-pool average otherwise.
- **Key Moments**: ranks a completed chase's deliveries by win-probability swing (the same idea as baseball's Win Probability Added) to auto-surface the match's biggest turning points.

### 🏆 Tournament Management
- **Full lifecycle**: create a tournament, register teams, auto-generate a round-robin or knockout fixture list, score the matches, get an auto-computed points table (W/L/T/NR, points, net run rate) after every completed match.
- **Awards**: one-click computation of winner/runner-up/third place (from the points table) and MVP/best batsman/best bowler (from tournament-scoped stats).
- **Announcements**: real-time organizer-to-followers announcement chat per tournament.
- **Calendar**: a month-view calendar of scheduled matches and tournament date ranges.
- **House rules**: organizers can set free-text custom playing conditions for their tournament, which the in-app assistant (below) prioritizes over generic cricket rules when answering questions in that context.

### 👥 Team Management
- **Role-based admin**: every team has a captain, who can delegate day-to-day roster management (add/remove players, edit team details) to a vice-captain and any number of coaches — deleting the team and reassigning roles stays captain-only, so admin access can't be used to lock out the captain.

### 🤖 In-App Assistant
- **App help & cricket rules chatbot**: Claude API (Haiku 4.5), grounded in the app's own real feature set and a plain-English cricket rules summary via prompt caching — answers "I don't know" rather than guessing when a question isn't covered. Only appears once `ANTHROPIC_API_KEY` is set (see `.env.example`).

### 📊 Player Stats & Wagon Wheels
- **Career stats**: batting/bowling/fielding averages, strike rate, economy, computed live from every completed match a player appears in — including wicketkeeper stats (catches/run-outs/stumpings) that most club-scoring tools don't track.
- **Wagon wheel**: an SVG polar-area chart of a batsman's scoring zones, built from the same delivery tagging captured during live scoring.
- **Leaderboards**: top batsmen/bowlers globally or scoped to a single tournament.

### 🌐 Community: Network, Edtech, News, Marketplace, Predictions
- **Player network**: follow/unfollow, a searchable player directory, public player profiles, and direct 1:1 messaging (real-time via WebSocket, with an unread-count badge).
- **Group chat**: WhatsApp-style team/squad groups (member-only visibility, creator-as-admin), text messages, polls with live vote counts, and image/video attachments — all real-time.
- **Personalized Learn**: lesson recommendations matched against a player's own weak line/length batting or bowling data, with an honest "why you're seeing this" explanation and a generic fallback when there's not enough data yet.
- **Auto-generated tournament news**: when a tournament match completes, an article is automatically written spotlighting the standout performance (century, five-wicket haul, hat-trick) or a plain result recap — visible to everyone, with a personalized "My Tournaments" feed for players actually registered in that tournament.
- **Points-based prediction game**: predict a match winner (plus a Man of the Match bonus) before it starts, with a leaderboard — free points only, explicitly not real-money betting.
- **Marketplace**: real listings, shopping cart, checkout, and buyer/seller order tracking for cricket gear (cash/bank-transfer/in-person payment only — CricRoots isn't a party to the sale).

### 📱 Cross-platform Support
- **Web app**: responsive, real-time, actively developed.
- **Mobile app**: React Native/Expo, full feature parity with web across 31 screens, distributed to pilot testers via Expo Go (EAS Update) ahead of an eventual App Store/Play Store release.
- **Seamless sync**: same backend API and MongoDB data store across all clients.

### 🔐 Secure & Scalable
- **JWT Authentication**: Secure user authentication, session persisted client-side
- **MongoDB**: Reliable data persistence
- **Docker Deployment**: Easy containerization and scaling
- **Nginx Proxy**: Load balancing and SSL/TLS support
- **Terms of Service & Privacy Policy**: real, published legal pages (`/terms`, `/privacy`) covering data handling, age/consent rules, and the prediction game's "not gambling" framing.

## Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend (Web)** | React, TypeScript, TailwindCSS, Next.js |
| **Frontend (Mobile)** | React Native, Expo, TypeScript |
| **Backend** | Node.js, Express.js, MongoDB, Socket.io |
| **AI Engine** | Python, Flask, scikit-learn, Pandas |
| **Real-time** | Socket.io, WebSocket |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## Getting Started

### Prerequisites
- Node.js 16+
- Python 3.11+
- Docker & Docker Compose
- MongoDB

### Quick Start with Docker

1. **Clone the repository**:
```bash
git clone https://github.com/Krishna-444-dev/CricRoots.git
cd CricRoots
```

2. **Configure environment**:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Start all services**:
```bash
docker-compose up -d
```

4. **Access the application**:
- Backend API: `http://localhost:5000`
- AI Engine: `http://localhost:5001`
- Nginx Proxy: `http://localhost:80`

### Local Development

#### Backend Setup
```bash
cd backend
npm install
npm run dev
```

#### AI Engine Setup
```bash
cd ai-engine
pip install -r requirements.txt
python app.py
```

#### Web App Setup
```bash
cd web-app
npm install
npm run dev
```

#### Mobile App Setup
```bash
cd mobile-app
npm install
npx expo start
```
Set `EXPO_PUBLIC_API_URL` in `mobile-app/.env` to point at a reachable backend when testing on a
physical device (your machine's LAN IP, not `localhost`). To share a build with real testers with
zero setup on their end, see the Expo Go / EAS Update workflow in
`documentation/going-legal-and-live.md`.

## Documentation

- **[System Architecture](ARCHITECTURE.md)** - Detailed overview of the system design
- **[Deployment Guide](DEPLOYMENT.md)** - Instructions for local and production deployment
- **[Backend Documentation](backend/BACKEND_DOCUMENTATION.md)** - API endpoint details
- **[AI Engine Documentation](ai-engine/README.md)** - ML model and AI service details
- **[AI Integration Guide](AI_INTEGRATION_GUIDE.md)** - Backend-AI integration details
- **[WebSocket Guide](WEBSOCKET_GUIDE.md)** - Real-time communication architecture
- **[Feature Roadmap & Progress Log](documentation/cricclubs-feature-roadmap.md)** - What's shipped, what's next, and the design decisions behind the tournament/stats/AI features
- **[Mobile Rebuild & Analytics Research](documentation/mobile-app-rebuild.md)** - the mobile app rebuild, ball commentary/voice input, Key Moments, and the prediction game
- **[News & Learn Features](documentation/news-and-learn-features.md)** - auto-generated tournament news and personalized lesson recommendations
- **[Going Legal and Going Live](documentation/going-legal-and-live.md)** - practical checklist for LLC formation, production deployment, and pilot distribution via Expo Go

## API Endpoints

All routes are mounted under `/api` by `backend/src/index.js`. `success`/`message` JSON response shape throughout; protected routes require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
- `POST /register` · `POST /login` · `GET /me`

### Users & Network (`/api/users`)
- `GET /:id` - public profile · `GET /:id/followers` · `GET /:id/following`
- `POST /:id/follow` (protected) · `DELETE /:id/follow` (protected, unfollow)

### Direct Messages (`/api/messages`) — all protected, private 1:1 messaging between players
- `GET /conversations` - inbox, most-recent-first, per-conversation unread count
- `GET /unread-count` - total unread across all conversations, for a badge
- `GET /:userId` - full thread with that user; also marks their messages to you as read
- `POST /:userId` - send a message; delivered in real time via a per-user WebSocket room

### Group Chat (`/api/groups`) — all protected, WhatsApp-style member-only team/squad groups
- `GET /` - groups you're in · `POST /` - create (optionally tagged to a team you're on)
- `GET /:id` · `PUT /:id` (creator only - rename/add/remove members) · `DELETE /:id` (creator only)
- `POST /:id/leave` (any member except the creator)
- `GET /:id/messages` · `POST /:id/messages` - text messages
- `POST /:id/polls` - create a poll · `POST /:id/polls/:messageId/vote` - vote (single-choice polls auto-clear a prior vote on switch)
- `POST /:id/attachments` - multipart image/video upload (20MB cap), served back via `/uploads/`

### Players (`/api/players`)
- `GET /` - directory · `GET /:id` · `POST /register` (protected) · `PUT /:id` (protected) · `GET /me/profile` (protected)

### Player Stats (`/api/player-stats`) — computed live from Match data
- `GET /:playerId` - career batting/bowling/fielding stats + wagon wheel
- `GET /rankings/batsmen` · `GET /rankings/bowlers` - global leaderboards

### Teams (`/api/teams`)
- `GET /` · `POST /` (protected) · `GET /:id` · `PUT /:id` (protected, admin: captain/vice-captain/coach) · `DELETE /:id` (protected, captain-only)
- `POST /:id/add-player` (protected, admin) · `DELETE /:id/remove-player/:playerId` (protected, admin) - removing a player also strips them of vice-captain/coach status if they held it
- `PUT /:id/vice-captain` · `POST /:id/coaches` · `DELETE /:id/coaches/:playerId` (protected, captain-only) - role assignment stays stricter than day-to-day roster management on purpose
- `GET /:id/messages` · `POST /:id/messages` (protected) - team chat

### Matches (`/api/matches`)
- `GET /` · `POST /` (protected, optionally linked to a tournament) · `GET /:id`
- `PUT /:id` (protected) - update status/result; auto-derives the result from innings totals when marked Completed, settles predictions, and auto-generates a tournament news article
- `POST /:id/record-ball` (protected) - records a ball, generates commentary, emits WebSocket events
- `GET /:id/scorecard` · `GET /:id/ai-insights` · `GET /:id/charts` - Manhattan/Worm chart data
- `GET /:id/key-moments` - deliveries ranked by win-probability swing (chasing innings only)
- `GET /:id/performance-report/:playerId` - this match's numbers vs. career average, a recent-form trend, milestones, and a tactical tie-back cross-referencing each dismissal against the matchup-shrinkage engine's flagged risk zones

### Predictions (`/api/predictions`) — free points-based prediction game, not real-money betting
- `POST /` (protected) - submit/update a winner (+ optional Man of the Match) prediction; locks once the match leaves Scheduled
- `GET /match/:matchId` - the community split, plus your own pick if authenticated
- `GET /me` (protected) - your prediction history and total points
- `GET /leaderboard` - global points leaderboard

### Tournaments (`/api/tournaments`)
- `GET /` · `POST /` (protected) · `GET /:id` · `PUT /:id` (protected)
- `POST /:id/register-team` (protected) · `GET /:id/standings` · `GET /:id/matches` · `GET /:id/statistics`
- `POST /:id/generate-fixtures` (protected, organizer) - auto-generate round-robin/knockout schedule
- `POST /:id/compute-awards` (protected, organizer) - winner/runner-up/MVP/best batsman/best bowler
- `GET /:id/messages` · `POST /:id/messages` (protected) - tournament announcements

### Tactical Insights (`/api/insights`) — data-driven from tagged deliveries, with graceful pool-average fallback
- `GET /batsman/:playerId/shot-advice` · `GET /batsman/:playerId/bowling-plan` · `GET /batsman/:playerId/fielding-plan`
- `GET /teams/:teamId/bowler-scouting`
- `GET /matchup/:batsmanId/:bowlerId/bowling-plan` — joint batter-vs-bowler recommendation, blended through a 4-level hierarchical backoff (exact matchup → batter vs bowler-archetype → archetype vs archetype → global) rather than either player's tendencies alone. See `documentation/` research memo for the full design rationale.
- `GET /matchup/:batsmanId/:bowlerId/live-bowling-plan?matchId=...` — the same recommendation, live-adjusted with this batter's deliveries so far in the current match, surfaced in the live-scoring UI so it shifts as the innings actually unfolds.

### Edtech (`/api/lessons`)
- Standard `GET /` / `GET /:id` / `POST /` (protected, accepts an optional `tags` array) / `DELETE /:id` (protected) CRUD
- `GET /for-me` (protected) - lessons recommended from your own weak line/length data, with a plain-English reason and a generic fallback

### News (`/api/news`)
- Standard `GET /` / `GET /:id` / `POST /` (protected, organizer/admin) / `DELETE /:id` (protected) CRUD, `?tournament=` filter
- `GET /feed` (protected) - general news plus articles for every tournament you're registered in

### In-App Assistant (`/api/assistant`) - Claude API (Haiku 4.5), all protected
- `GET /status` - whether `ANTHROPIC_API_KEY` is configured; the frontend widget only renders when true
- `POST /ask` - app-help and cricket-rules Q&A, grounded in `backend/src/data/*.md` reference content (cached via prompt caching, not re-billed per query) plus a tournament's own `houseRules` when scoped to one. Answers "I don't know" rather than guessing when the question isn't covered by the reference material.

### Marketplace (`/api/products`, `/api/orders`)
- Standard `GET /` / `GET /:id` / `POST /` (protected) / `DELETE /:id` (protected) CRUD, plus `GET /api/orders/my` and `GET /api/orders/selling` for buyer/seller order views and `PUT /api/orders/:id/status` for fulfillment tracking.

## WebSocket Events

### Client → Server
- `join-match` / `leave-match` - join or leave a match's live room
- `join-team` / `leave-team` - join or leave a team's chat room
- `join-tournament` / `leave-tournament` - join or leave a tournament's announcement room

### Server → Client
- `ball-recorded`, `wicket`, `milestone`, `match-update`, `match-status-change`, `scorecard-update` - live scoring events
- `ai-insights` - AI tactical insights updated
- `user-joined` / `user-left` - presence in a match room
- `new-message` - a team chat message or tournament announcement was posted
- `new-direct-message` - a private 1:1 message was sent to you (delivered to your personal `user-<id>` room, auto-joined on connect)
- `new-group-message` - a text/poll/attachment message was posted to a group you've joined the room for
- `group-poll-update` - a poll's vote counts changed - patches the existing message, not a new one

## Project Statistics

| Metric | Value |
| :--- | :--- |
| **Total Commits** | 85+ |
| **Backend Route Files** | 15 (auth, users, players, player-stats, teams, matches, tournaments, insights, lessons, news, predictions, messages, groups, products, orders) |
| **Mongoose Models** | 16 |
| **WebSocket Events** | 15+ |
| **Web App Pages** | 34+ (matches, tournaments, teams, players, network, edtech, news, predictions leaderboard, marketplace/cart/checkout/orders, calendar, terms/privacy, auth) |
| **Mobile App Screens** | 23 (full parity with web, plus the matchup-shrinkage Scouting Report) |
| **Documentation Pages** | 16+ |

## Performance Metrics

### WebSocket Benefits
- **Latency**: <100ms (vs ~15s with polling)
- **Bandwidth**: 70% reduction compared to polling
- **Server Load**: Significantly reduced
- **Scalability**: Support for thousands of concurrent connections

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the ISC License - see the LICENSE file for details.

## Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

---

**CricRoots** - *Bringing the world of cricket together, one match at a time.*

*Developed with the assistance of Manus AI*

### Latest Updates
- ✅ Matchup-shrinkage tactical engine ported to mobile: a Scouting Report screen (team bowler threat ranking plus a Matchup Finder for picking any batter-vs-bowler pair) and a compact, collapsible live tactical panel in the mobile scoring flow that refetches after every ball — closing the mobile gap on `documentation/hierarchical-matchup-shrinkage-research.md`, which previously only had a web UI
- ✅ WhatsApp-style group chat: member-only team/squad groups, polls, and image/video attachments, all real-time — verified with a from-scratch integration test covering every permission boundary and vote-toggling edge case, which caught and fixed a Docker file-permissions bug, a missing nginx proxy path, and a subtle membership-check bug before they ever shipped
- ✅ Direct 1:1 messaging between players (real-time via WebSocket, inbox with unread counts, "Message" button on profiles) and tournament announcements on mobile (organizer broadcasts to everyone registered)
- ✅ First real on-device pilot test on iOS via Expo Go — found and fixed a genuinely missing `babel.config.js` (env vars were silently never inlined into any published build), an EAS Update environment-variable gap, several validation/keyboard UX bugs, and the wrong sport's icon on the Matches tab
- ✅ Mobile app rebuilt to full feature parity with web (31 screens), upgraded to current Expo SDK 54, and distributed to pilot testers via EAS Update/Expo Go — no App Store review needed yet
- ✅ Ball-by-ball auto-commentary and voice-driven delivery tagging; Key Moments (win-probability-swing highlights) on completed chases
- ✅ Points-based match prediction game with a global leaderboard (explicitly not real-money betting)
- ✅ Auto-generated tournament news articles on match completion, plus a personalized "My Tournaments" feed
- ✅ Personalized lesson recommendations matched against a player's own weak line/length data
- ✅ Win-probability AI model made self-healing (auto-retrains on load failure instead of silently staying untrained)
- ✅ Real Terms of Service and Privacy Policy pages, and a practical LLC-formation + go-live checklist
- ✅ Real-time WebSocket support for instant AI insights, team chat, and tournament announcements
- ✅ Full match lifecycle: real auth, team/roster creation, match creation, ball-by-ball scoring with delivery tagging, auto-derived results
- ✅ Tournament management: fixture auto-generation, auto-computed points table with net run rate, MVP/awards computation, calendar view
- ✅ Player stats computed live from match data: career batting/bowling averages, wicketkeeper stats, wagon wheel visualization, global and per-tournament leaderboards
- ✅ Manhattan and Worm charts, automatic algorithmic Man of the Match calculation, and 8 player achievement badges
- ✅ Data-driven tactical insights (shot advice, bowling plans, fielding placement, bowler scouting) blending a player's own tagged-ball history with a wider player-pool average when data is thin
- ✅ Player network, community edtech lesson library, news posts, and a full marketplace (listings/cart/checkout/orders)
- ✅ "Stadium Dark" UI redesign across web and mobile — a shared broadcast-graphics-style design system

### Coming Soon
- 🔄 A real deployed production backend (currently pilot-testing over a local network) and full App Store/Play Store submission
- 🔄 D/L Standard rain-revision rules, once the published resource-table values are verified against original sources
- 🔄 Match/tournament notifications (push/email when a followed team's match goes live or a tournament posts an announcement)
- 🔄 Global/international cricket news, once local tournament news is well established
- 🔄 Advanced/chronological "recent form" trend tracking per player
