# CricSync - The All-in-One Cricket Application

CricSync is a comprehensive, full-stack cricket application designed to provide an all-in-one experience for cricket enthusiasts, players, and tournament organizers. Built with modern technologies across web, mobile, and backend platforms, CricSync brings together team management, ball-by-ball live scoring, tournament administration, a player social network, community edtech, news, a gear marketplace, and data-driven AI tactical insights — with **real-time WebSocket support**.

The product direction: a world-class, one-stop app for cricket, starting with local and club tournaments rather than international cricket — every stat and recommendation is built to work from a club's own scoring data instead of assuming access to professional-league datasets.

## Project Overview

This repository contains the complete CricSync ecosystem, including:

- **Web Application** (`web-app/`): Next.js 14 (App Router) + TypeScript + Tailwind frontend — the primary, actively developed client. Covers auth, live scoring, tournament management, a player network, edtech, news, and a marketplace with cart/checkout, all under a shared "Stadium Dark" design system.
- **Mobile Application** (`mobile-app/`): React Native (Expo) with platform-specific optimizations for iOS and Android.
- **Backend API** (`backend/`): Node.js/Express server with MongoDB, JWT auth, and Socket.io for real-time match/chat events.
- **AI Engine** (`ai-engine/`): Python/Flask service providing win-probability and tactical-advisor predictions during a live match.
- **Statistical insights service** (`backend/src/services/tendencyAnalytics.js`): a complementary Node-side aggregation layer over real ball-by-ball data (line, length, shot zone, fielder) captured during scoring — powers shot advice, bowling plans, fielding placement, bowler scouting, wagon wheels, wicketkeeper stats, and career/tournament leaderboards, all computed live from match documents rather than a separately-maintained stats table.
- **Real-time Updates**: Socket.io WebSocket support for instant match updates, team chat, and tournament announcements.
- **Comprehensive Documentation**: Guides for architecture, deployment, development, and a running feature-progress log (`documentation/cricclubs-feature-roadmap.md`).

## Key Features

### 🏏 Live Scoring & Match Management
- **Ball-by-ball scoring UI**: runs, extras, wickets, with progressive-disclosure delivery tagging (line, length, shot zone, shot type, fielder) — auto-expands on boundaries and wickets, otherwise stays out of the way for fast scoring.
- **Real match lifecycle**: create teams/rosters, create a match (optionally linked to a tournament), start an innings, score it live, finish the match — result and margin are auto-derived from the innings totals.
- **AI tactical insights**: win-probability and aggressive/balanced/defensive tactical advice during a live match (Python AI engine), plus shot advice / bowling plans / fielding placement derived from the batsman's or bowler's own tagged-ball history where enough data exists, falling back to a wider player-pool average otherwise.

### 🏆 Tournament Management
- **Full lifecycle**: create a tournament, register teams, auto-generate a round-robin or knockout fixture list, score the matches, get an auto-computed points table (W/L/T/NR, points, net run rate) after every completed match.
- **Awards**: one-click computation of winner/runner-up/third place (from the points table) and MVP/best batsman/best bowler (from tournament-scoped stats).
- **Announcements**: real-time organizer-to-followers announcement chat per tournament.
- **Calendar**: a month-view calendar of scheduled matches and tournament date ranges.

### 📊 Player Stats & Wagon Wheels
- **Career stats**: batting/bowling/fielding averages, strike rate, economy, computed live from every completed match a player appears in — including wicketkeeper stats (catches/run-outs/stumpings) that most club-scoring tools don't track.
- **Wagon wheel**: an SVG polar-area chart of a batsman's scoring zones, built from the same delivery tagging captured during live scoring.
- **Leaderboards**: top batsmen/bowlers globally or scoped to a single tournament.

### 🌐 Community: Network, Edtech, News, Marketplace
- **Player network**: follow/unfollow, a searchable player directory, public player profiles.
- **Edtech**: a community-written lesson library (batting/bowling/fielding/fitness/rules/strategy).
- **News**: organizer/admin-authored posts and announcements.
- **Marketplace**: real listings, shopping cart, checkout, and buyer/seller order tracking for cricket gear.

### 📱 Cross-platform Support
- **Web app**: the primary client — responsive, real-time, actively developed.
- **Mobile app**: native iOS and Android experiences with platform-specific UI (currently behind the web app in feature parity).
- **Seamless sync**: same backend API and MongoDB data store across all clients.

### 🔐 Secure & Scalable
- **JWT Authentication**: Secure user authentication, session persisted client-side
- **MongoDB**: Reliable data persistence
- **Docker Deployment**: Easy containerization and scaling
- **Nginx Proxy**: Load balancing and SSL/TLS support

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
git clone https://github.com/Krishna-444-dev/CricSync.git
cd CricSync
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

## Documentation

- **[System Architecture](ARCHITECTURE.md)** - Detailed overview of the system design
- **[Deployment Guide](DEPLOYMENT.md)** - Instructions for local and production deployment
- **[Backend Documentation](backend/BACKEND_DOCUMENTATION.md)** - API endpoint details
- **[AI Engine Documentation](ai-engine/README.md)** - ML model and AI service details
- **[AI Integration Guide](AI_INTEGRATION_GUIDE.md)** - Backend-AI integration details
- **[WebSocket Guide](WEBSOCKET_GUIDE.md)** - Real-time communication architecture
- **[Feature Roadmap & Progress Log](documentation/cricclubs-feature-roadmap.md)** - What's shipped, what's next, and the design decisions behind the tournament/stats/AI features

## API Endpoints

All routes are mounted under `/api` by `backend/src/index.js`. `success`/`message` JSON response shape throughout; protected routes require `Authorization: Bearer <token>`.

### Authentication (`/api/auth`)
- `POST /register` · `POST /login` · `GET /me`

### Users & Network (`/api/users`)
- `GET /:id` - public profile · `GET /:id/followers` · `GET /:id/following`
- `POST /:id/follow` (protected) · `DELETE /:id/follow` (protected, unfollow)

### Players (`/api/players`)
- `GET /` - directory · `GET /:id` · `POST /register` (protected) · `PUT /:id` (protected) · `GET /me/profile` (protected)

### Player Stats (`/api/player-stats`) — computed live from Match data
- `GET /:playerId` - career batting/bowling/fielding stats + wagon wheel
- `GET /rankings/batsmen` · `GET /rankings/bowlers` - global leaderboards

### Teams (`/api/teams`)
- `GET /` · `POST /` (protected) · `GET /:id` · `PUT /:id` (protected) · `DELETE /:id` (protected)
- `POST /:id/add-player` (protected, captain-only) · `DELETE /:id/remove-player/:playerId`
- `GET /:id/messages` · `POST /:id/messages` (protected) - team chat

### Matches (`/api/matches`)
- `GET /` · `POST /` (protected, optionally linked to a tournament) · `GET /:id`
- `PUT /:id` (protected) - update status/result; auto-derives the result from innings totals when marked Completed
- `POST /:id/record-ball` (protected) - records a ball, emits WebSocket events
- `GET /:id/scorecard` · `GET /:id/ai-insights`

### Tournaments (`/api/tournaments`)
- `GET /` · `POST /` (protected) · `GET /:id` · `PUT /:id` (protected)
- `POST /:id/register-team` (protected) · `GET /:id/standings` · `GET /:id/matches` · `GET /:id/statistics`
- `POST /:id/generate-fixtures` (protected, organizer) - auto-generate round-robin/knockout schedule
- `POST /:id/compute-awards` (protected, organizer) - winner/runner-up/MVP/best batsman/best bowler
- `GET /:id/messages` · `POST /:id/messages` (protected) - tournament announcements

### Tactical Insights (`/api/insights`) — data-driven from tagged deliveries, with graceful pool-average fallback
- `GET /batsman/:playerId/shot-advice` · `GET /batsman/:playerId/bowling-plan` · `GET /batsman/:playerId/fielding-plan`
- `GET /teams/:teamId/bowler-scouting`

### Edtech (`/api/lessons`), News (`/api/news`), Marketplace (`/api/products`, `/api/orders`)
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

## Project Statistics

| Metric | Value |
| :--- | :--- |
| **Total Commits** | 38+ |
| **Backend Route Files** | 12 (auth, users, players, player-stats, teams, matches, tournaments, insights, lessons, news, products, orders) |
| **Mongoose Models** | 12 |
| **WebSocket Events** | 15+ |
| **Web App Pages** | 30+ (matches, tournaments, teams, players, network, edtech, news, marketplace/cart/checkout/orders, calendar, auth) |
| **Documentation Pages** | 18+ |

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

**CricSync** - *Bringing the world of cricket together, one match at a time.*

*Developed with the assistance of Manus AI*

### Latest Updates
- ✅ Real-time WebSocket support for instant AI insights, team chat, and tournament announcements
- ✅ Full match lifecycle: real auth, team/roster creation, match creation, ball-by-ball scoring with delivery tagging, auto-derived results
- ✅ Tournament management: fixture auto-generation, auto-computed points table with net run rate, MVP/awards computation, calendar view
- ✅ Player stats computed live from match data: career batting/bowling averages, wicketkeeper stats (catches/run-outs/stumpings), wagon wheel visualization, global and per-tournament leaderboards
- ✅ Data-driven tactical insights (shot advice, bowling plans, fielding placement, bowler scouting) blending a player's own tagged-ball history with a wider player-pool average when data is thin
- ✅ Player network (follow/directory/profiles), community edtech lesson library, news posts, and a full marketplace (listings/cart/checkout/orders)
- ✅ "Stadium Dark" UI redesign across the entire web app — a broadcast-graphics-style dark theme with a shared component/design-token system
- ✅ Docker deployment configuration and comprehensive documentation, including a running feature-progress log

### Coming Soon
- 🔄 Match/tournament notifications (push/email when a followed team's match goes live or a tournament posts an announcement)
- 🔄 Event calendar deep-linking and richer tournament schedule views (day-by-day round scheduling, knockout bracket rounds beyond round 1)
- 🔄 Mobile app feature parity with the web app, and app store deployment
- 🔄 Advanced/chronological "recent form" trend tracking per player
