# CricRoots Architecture Documentation

## System Overview

CricRoots is a full-stack cricket application built with a microservices-inspired architecture. The system consists of multiple independent services that communicate through well-defined APIs, allowing for scalability, maintainability, and independent deployment.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Layer                             │
├──────────────────┬──────────────────┬──────────────────────┤
│   Web Browser    │  Mobile (iOS)    │  Mobile (Android)    │
│   (React)        │  (React Native)  │  (React Native)      │
└────────┬─────────┴────────┬─────────┴──────────┬───────────┘
         │                  │                    │
         └──────────────────┼────────────────────┘
                            │
                    ┌───────▼────────┐
                    │  Nginx Proxy   │
                    │  (Reverse)     │
                    └───────┬────────┘
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
    ┌────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
    │ Backend   │    │ AI Engine   │   │  MongoDB    │
    │ API       │    │ (Python)    │   │  Database   │
    │ (Node.js) │    │ (Flask)     │   │             │
    │           │    │             │   │             │
    │ Port 5000 │    │ Port 5001   │   │ Port 27017  │
    └───────────┘    └─────────────┘   └─────────────┘
```

## Service Components

### 1. Client Layer

#### Web Application (Next.js)
- **Technology**: Next.js 14, React 18, TypeScript, TailwindCSS
- **Purpose**: Browser-based interface for desktop users
- **Features**: Ball-by-ball scoring, teams/tournaments/lessons (edtech), marketplace with cart/checkout, news, group and direct messaging, match predictions, calendar
- **Location**: `/web-app`

#### Mobile Application (React Native)
- **Technology**: React Native 0.81, Expo SDK 54, TypeScript
- **Purpose**: Native mobile experience for iOS and Android
- **Features**: 37 screens under `/mobile-app/src/screens` covering scoring, teams, tournaments, marketplace, and messaging; charts (Manhattan/Worm) rendered with `react-native-svg`; live-scoring resume/lock flow in `mobile-app/src/shared/utils/` (matchAuth, matchStats, resolveRef); distributed via EAS Update (channel `preview`)
- **Location**: `/mobile-app`

### 2. Backend API (Node.js/Express)

#### Core Responsibilities
- User authentication and authorization
- Data persistence and management
- Business logic implementation
- API endpoint exposure

#### Key Modules

**Authentication Module**
- User registration and login
- JWT token generation and validation
- Role-based access control

**Player Management**
- Player profile creation and updates
- Statistics tracking
- Team associations

**Team Management**
- Team creation and management
- Player roster management
- Team statistics

**Match Management**
- Match scheduling and creation
- Ball-by-ball scoring
- Match result calculation
- Scorecard generation

16 route files total (`backend/src/routes/`). Beyond the four modules above: `tournamentRoutes` (standings, tournament chat), `lessonRoutes`/`newsRoutes` (edtech + news feeds), `productRoutes`/`orderRoutes` (marketplace), `groupRoutes`/`directMessageRoutes` (chat, backed by Socket.IO), `insightsRoutes`/`predictionRoutes` (tactical insights, match-outcome predictions), `assistantRoutes` (Claude-backed Q&A), `playerStatsRoutes` (rankings/trends/comparisons), `userRoutes` (follow graph).

#### Database Models

16 Mongoose models in `backend/src/models/`; the four core ones are shown below (also: Tournament, Lesson, NewsPost, Product, Order, Prediction, Group, GroupMessage, DirectMessage, Message, Follow, PlayerStats).

```
User
├── name
├── email
├── password (hashed)
├── role (player, captain, organizer, admin, sponsor, collaborator)
└── createdAt

Player
├── user (ref: User)
├── specialization
├── battingStyle
├── bowlingStyle
├── stats
├── teams (ref: Team[])
└── profilePicture

Team
├── name
├── captain (ref: Player)
├── players (ref: Player[])
├── description
├── city
├── stats
└── logo

Match
├── title
├── team1 (ref: Team)
├── team2 (ref: Team)
├── matchType
├── status
├── venue
├── scheduledDate
├── innings[]
├── toss
├── result
├── manOfTheMatch (ref: Player)
└── createdBy (ref: User)
```

### 3. AI Recommendation Engine (Python/Flask)

#### Purpose
Provide intelligent tactical recommendations for cricket matches

#### Key Features

**Batsman Recommendation**
- Input: Match conditions, run rate, wickets, overs
- Output: Recommended batsman ID with confidence score
- Model: RandomForestClassifier

**Bowler Recommendation**
- Input: Opposition run rate, pitch conditions, wickets
- Output: Recommended bowler ID with confidence score
- Model: RandomForestClassifier

**Fielding Optimization**
- Input: Player abilities, batsman tendencies
- Output: Optimal fielding positions
- Model: RandomForestClassifier

**Win Probability & Tactical Advisor**
- Input: Overs remaining, wickets down, run rate, target score, opposition strength, pitch type
- Output: Win probability and tactical recommendation text
- Model: RandomForestRegressor (win probability)
- Called synchronously from the backend (`backend/src/utils/aiService.js`) and pushed to connected clients over Socket.IO (`emitAIInsights`)

#### API Endpoints
Registered in `ai-engine/app.py` under two blueprints:

`/api/recommendations` (`ai-engine/src/api/recommendations.py`):
- `POST /api/recommendations/batsman`
- `POST /api/recommendations/bowler`
- `POST /api/recommendations/fielding`
- `POST /api/recommendations/win-probability`
- `POST /api/recommendations/tactical-advisor`
- `POST /api/recommendations/train`
- `GET /api/recommendations/health`

`/api/analytics` (`ai-engine/src/api/analytics.py`):
- `POST /api/analytics/player-form`
- `POST /api/analytics/player-performance`
- `POST /api/analytics/tournament-trends`
- `POST /api/analytics/tournament-winner-prediction`

### 4. Data Layer (MongoDB)

#### Purpose
Persistent data storage for all application entities

#### Collections
16 collections total, one per model (see Database Models above). Core ones:
- `users`: User account information
- `players`: Player profiles and statistics
- `teams`: Team information and rosters
- `matches`: Match details and scoring data (innings, ball-by-ball log, live scorer state, rain-rule interruption)

#### Indexing Strategy
- `users.email`: Unique index for fast lookups
- `players.user`: Index for user-player association
- `teams.captain`: Index for team-captain queries
- `matches.scheduledDate`: Index for match scheduling

### 5. Infrastructure Layer (Docker & Nginx)

#### Docker Services
- **MongoDB**: Database container
- **Backend**: Node.js API container
- **AI Engine**: Python Flask container
- **Nginx**: Reverse proxy and load balancer

#### Nginx Configuration
- SSL/TLS termination
- Request routing to backend services
- CORS header management
- Security headers implementation
- Gzip compression

## Communication Patterns

### Synchronous Communication

```
Client → Nginx → Backend API
         ↓
       MongoDB (read/write)
         ↓
       Response to Client
```

### AI Engine Communication (Implemented, no queue)

The backend calls the AI Engine synchronously over HTTP (`backend/src/utils/aiService.js` → `AI_ENGINE_URL`, 5s timeout, degrades to `{ success: false }` on failure) and pushes the result to clients over the existing Socket.IO connection - no message queue involved:

```
Client → Backend API → AI Engine (HTTP, synchronous)
                       ↓
                   Database Update
                       ↓
                   Socket.IO push to room
```

A message queue between backend and AI Engine (decoupling, retry) is not yet built - see Future Enhancements > Message Queue Integration.

## API Communication Flow

### Authentication Flow

```
1. User Registration
   POST /api/auth/register
   ↓
   Backend validates input
   ↓
   Hash password with bcrypt
   ↓
   Create user in MongoDB
   ↓
   Generate JWT token
   ↓
   Return token to client

2. Subsequent Requests
   Client sends: Authorization: Bearer <token>
   ↓
   Backend verifies JWT signature
   ↓
   Extract user ID from token
   ↓
   Attach user to request
   ↓
   Process request
```

### Team Creation Flow

```
1. Client sends: POST /api/teams
   {
     name: "Team A",
     description: "...",
     city: "..."
   }
   ↓
2. Backend verifies authentication
   ↓
3. Fetch player profile for captain
   ↓
4. Create team in MongoDB
   ↓
5. Add captain to team players
   ↓
6. Return team with populated data
```

### Match Scoring Flow

```
1. Client sends: POST /api/matches/:id/record-ball
   {
     inningsIndex: 0,
     ballNumber: 1,
     batsmanId: "...",
     bowlerId: "...",
     runs: 4,
     isWicket: false
   }
   ↓
2. Backend validates match ownership
   ↓
3. Add ball to innings
   ↓
4. Update runs and wickets
   ↓
5. Trigger AI recommendation (optional)
   ↓
6. Return updated match scorecard
```

## Scalability Considerations

### Horizontal Scaling

```
Load Balancer
    ↓
    ├─ Backend Instance 1
    ├─ Backend Instance 2
    └─ Backend Instance 3
    
    ↓
    MongoDB Replica Set
    ├─ Primary
    ├─ Secondary 1
    └─ Secondary 2
```

### Caching Strategy

```
Client Request
    ↓
Nginx Cache (Static content)
    ↓
Redis Cache (API responses)
    ↓
Backend API
    ↓
MongoDB
```

### Database Optimization

- **Indexing**: Strategic indexes on frequently queried fields
- **Sharding**: Partition data by team or match for large datasets
- **Read Replicas**: Distribute read operations across replicas
- **Connection Pooling**: Reuse database connections

## Security Architecture

### Authentication & Authorization

```
JWT Token Structure:
{
  header: {
    alg: "HS256",
    typ: "JWT"
  },
  payload: {
    id: "user_id",
    iat: 1234567890,
    exp: 1234654290
  },
  signature: HMAC-SHA256(header + payload, secret)
}
```

### Password Security

```
User Input Password
    ↓
Salt Generation (bcryptjs)
    ↓
Hash with 10 rounds
    ↓
Store in MongoDB
    ↓
On Login: Compare hash with input
```

### HTTPS/TLS

```
Client ←→ Nginx (SSL/TLS)
         ↓
       Backend (internal network)
         ↓
       MongoDB (internal network)
```

### CORS Configuration

```
Nginx handles CORS headers on /api/:
- Access-Control-Allow-Origin
- Access-Control-Allow-Methods
- Access-Control-Allow-Headers
- Access-Control-Max-Age
```

The backend also applies Express `cors()` (`backend/src/index.js`) as a second layer, so it still responds correctly when hit directly (bypassing Nginx, e.g. in local dev).

## Deployment Architecture

### Development Environment

```
docker-compose up -d
    ↓
    ├─ MongoDB (development)
    ├─ Backend (development mode)
    ├─ AI Engine (development mode)
    └─ Nginx (development config)
```

### Production Environment

```
Load Balancer (AWS ELB/ALB)
    ↓
Kubernetes Cluster (or Docker Swarm)
    ├─ Backend Pods (replicas: 3)
    ├─ AI Engine Pods (replicas: 2)
    └─ MongoDB Replica Set
    
    ↓
    
Persistent Volumes
    ├─ MongoDB Data
    ├─ Model Cache
    └─ Logs
```

## Monitoring & Observability

### Health Checks

```
Nginx → Backend /
       → AI Engine /api/recommendations/health
       → MongoDB ping
```

### Logging Strategy

```
Application Logs
    ↓
Log Aggregation (ELK Stack)
    ↓
Visualization (Kibana)
    ↓
Alerting (PagerDuty)
```

### Metrics Collection

```
Prometheus Scraper
    ↓
    ├─ Backend metrics
    ├─ AI Engine metrics
    └─ MongoDB metrics
    ↓
Grafana Dashboards
```

## Future Enhancements

### Real-time Features (Implemented)

Socket.IO is already live in the backend (`backend/src/utils/socketManager.js`), JWT-authenticated per connection, with per-user, per-match, per-team, per-tournament, and per-group rooms:

```
Socket.IO Server
    ↓
    ├─ Live match updates (ball recorded, wicket, status change)
    ├─ AI insights push (tactical advisor results, post-ball)
    └─ Group/direct chat delivery
```

### Message Queue Integration

```
Backend → RabbitMQ/Redis
    ↓
    ├─ Email notifications
    ├─ SMS alerts
    ├─ AI processing
    └─ Data analytics
```

### Microservices Decomposition

```
Current Monolith
    ↓
    ├─ Auth Service
    ├─ Player Service
    ├─ Team Service
    ├─ Match Service
    ├─ AI Service
    └─ Notification Service
```

---

For deployment instructions, see [DEPLOYMENT.md](DEPLOYMENT.md)
For API documentation, see [backend/BACKEND_DOCUMENTATION.md](backend/BACKEND_DOCUMENTATION.md)
