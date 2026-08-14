# CricRoots Backend API Documentation

## Overview

The CricRoots backend is a Node.js/Express server that provides a RESTful API for the CricRoots mobile and web applications. It handles user authentication, player management, team operations, and integrates with the Python AI recommendation engine.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Security**: Helmet, CORS

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── jwt.js               # JWT token generation/verification
│   ├── controllers/              # 18 controllers, one per resource (+ messageController,
│   │   │                         # groupMessageController for team/tournament/group chat)
│   │   ├── authController.js
│   │   ├── playerController.js
│   │   ├── userController.js
│   │   ├── teamController.js
│   │   ├── matchController.js
│   │   ├── tournamentController.js
│   │   ├── playerStatsController.js
│   │   ├── lessonController.js
│   │   ├── newsController.js
│   │   ├── productController.js
│   │   ├── orderController.js
│   │   ├── insightsController.js
│   │   ├── predictionController.js
│   │   ├── directMessageController.js
│   │   ├── groupController.js
│   │   ├── groupMessageController.js
│   │   ├── messageController.js
│   │   └── assistantController.js
│   ├── middleware/
│   │   ├── auth.js              # protect / optionalAuth / authorize
│   │   └── upload.js            # multer disk storage for group attachments
│   ├── models/                  # 16 Mongoose models: User, Player, Team, Match, Tournament,
│   │   │                        # PlayerStats, Lesson, NewsPost, Product, Order, Prediction,
│   │   │                        # DirectMessage, Message, Group, GroupMessage, Follow
│   │   ├── User.js
│   │   ├── Player.js
│   │   ├── Team.js
│   │   ├── Match.js
│   │   └── Tournament.js
│   ├── routes/                  # 16 route files, mounted in index.js under /api/*
│   ├── services/                # Business logic kept out of controllers
│   │   ├── tendencyAnalytics.js # Career stats, wagon wheel, matchup shrinkage
│   │   ├── mvpCalculator.js
│   │   ├── matchCharts.js
│   │   ├── keyMoments.js
│   │   ├── commentaryGenerator.js
│   │   ├── matchArticleGenerator.js
│   │   ├── predictionSettler.js
│   │   ├── rainRuleCalculator.js
│   │   └── assistantService.js
│   ├── utils/
│   │   ├── aiService.js         # HTTP client for the Python AI engine
│   │   └── statUtils.js
│   └── index.js                 # Main entry point
├── package.json
└── .env.example
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/cricroots
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication Endpoints

#### 1. Register User

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "player"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player"
  }
}
```

#### 2. Login User

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player"
  }
}
```

#### 3. Get Current User

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player",
    "createdAt": "2023-08-09T10:00:00.000Z"
  }
}
```

### Player Endpoints

#### 1. Register Player Profile

**Endpoint**: `POST /api/players/register`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "specialization": "Batsman",
  "battingStyle": "Right-hand",
  "bowlingStyle": "None"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "bowlingStyle": "None",
    "stats": {
      "matches": 0,
      "runs": 0,
      "wickets": 0,
      "average": 0
    },
    "teams": [],
    "profilePicture": "no-photo.jpg"
  }
}
```

#### 2. Get All Players

**Endpoint**: `GET /api/players`

**Response** (200 OK):
```json
{
  "success": true,
  "count": 2,
  "players": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "user": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "specialization": "Batsman",
      "battingStyle": "Right-hand",
      "stats": {
        "matches": 5,
        "runs": 250,
        "wickets": 0,
        "average": 50
      }
    }
  ]
}
```

#### 3. Get Player by ID

**Endpoint**: `GET /api/players/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "stats": {
      "matches": 5,
      "runs": 250,
      "wickets": 0,
      "average": 50
    },
    "teams": []
  }
}
```

#### 4. Update Player Profile

**Endpoint**: `PUT /api/players/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "specialization": "All-rounder",
  "battingStyle": "Right-hand",
  "bowlingStyle": "Right-arm Fast"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "specialization": "All-rounder",
    "battingStyle": "Right-hand",
    "bowlingStyle": "Right-arm Fast"
  }
}
```

#### 5. Get Current User's Player Profile

**Endpoint**: `GET /api/players/me/profile`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "stats": {
      "matches": 5,
      "runs": 250,
      "wickets": 0,
      "average": 50
    }
  }
}
```

### Team Endpoints

Creating a team requires the caller to already have a player profile (`POST /api/players/register`); that profile becomes the team's captain and its first roster entry.

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/teams` | Public | List all teams |
| GET | `/api/teams/:id` | Public | Populates captain, vice-captain, coaches, players (each with `user`) |
| POST | `/api/teams` | Private | Body: `{ name, description, city }`. Caller must have a player profile |
| PUT | `/api/teams/:id` | Private (team admin) | Captain, vice-captain, or a coach |
| DELETE | `/api/teams/:id` | Private (captain only) | |
| POST | `/api/teams/:id/add-player` | Private (team admin) | |
| DELETE | `/api/teams/:id/remove-player/:playerId` | Private (team admin) | |
| PUT | `/api/teams/:id/vice-captain` | Private (captain only) | Sets or clears (`null`) the vice-captain |
| POST | `/api/teams/:id/coaches` | Private (captain only) | |
| DELETE | `/api/teams/:id/coaches/:playerId` | Private (captain only) | |
| GET | `/api/teams/:id/messages` | Private | Team chat |
| POST | `/api/teams/:id/messages` | Private | Team chat |

"Team admin" = captain, vice-captain, or any coach. Only the captain can delete the team, reassign vice-captain, or manage coaches.

### Match Endpoints

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/matches` | Public | |
| GET | `/api/matches/:id` | Public | |
| GET | `/api/matches/:id/scorecard` | Public | |
| GET | `/api/matches/:id/charts` | Public | See `services/matchCharts.js` |
| GET | `/api/matches/:id/ai-insights` | Public | Proxies to the Python AI engine |
| GET | `/api/matches/:id/next-bowler-recommendation` | Public | |
| GET | `/api/matches/:id/key-moments` | Public | See `services/keyMoments.js` |
| GET | `/api/matches/:matchId/performance-report/:playerId` | Public | |
| POST | `/api/matches` | Private | Body: `{ title, team1Id, team2Id, matchType, venue, scheduledDate, pitchType, tournamentId, totalOvers }` |
| PUT | `/api/matches/:id` | Private | |
| POST | `/api/matches/:id/record-ball` | Private, scoring access + lock | See below |
| POST | `/api/matches/:id/apply-interruption` | Private, scoring access | Body: `{ revisedOvers }`. Rain/stoppage adjustment via `services/rainRuleCalculator.js` |
| POST | `/api/matches/:id/umpires` | Private (match creator only) | Body: `{ userId }` |
| DELETE | `/api/matches/:id/umpires/:userId` | Private (match creator only) | |
| POST | `/api/matches/:id/scoring-lock` | Private, scoring access | Claim/renew the scoring lock |
| DELETE | `/api/matches/:id/scoring-lock` | Private, lock holder or match creator | Release the scoring lock |
| DELETE | `/api/matches/:id` | Private | |

**Who can score a match** (`canManageMatch`): the match creator, any user appointed as an umpire, or any user with a player profile rostered on either playing team. Being on this list does not include the power to appoint umpires — only the match creator can add/remove umpires.

**Scoring lock**: because scoring access is now shared across a roster instead of creator-only, `POST /:id/scoring-lock` must be acquired (and periodically renewed as a heartbeat) before `record-ball` calls will succeed. A lock is considered fresh for 2 minutes (`LOCK_TIMEOUT_MS`) since its last renewal; after that it's treated as abandoned and up for grabs. Recording a ball while holding the lock renews it automatically. `POST /:id/scoring-lock` returns `409` if another user's lock is still fresh; `POST /:id/record-ball` returns `423` in the same situation. The lock can be released by whoever holds it or by the match creator (escape hatch for a stuck lock).

**Ball subdocument** (`innings[n].balls[]`, written by `record-ball`):
```javascript
{
  ballNumber: Number,
  batsmanId: ObjectId,
  bowlerId: ObjectId,
  runs: Number,
  isWicket: Boolean,
  wicketType: String,          // bowled, caught, lbw, run out, etc.
  commentary: String,          // auto-generated, see services/commentaryGenerator.js
  isExtra: Boolean,
  extraType: String,           // none | wide | no-ball | bye | leg-bye | penalty
  line: String,                 // delivery tagging, e.g. 'off-stump', default 'unknown'
  length: String,                // e.g. 'good-length', default 'unknown'
  shotType: String,             // batsman-relative shot tagging, default null
  shotZone: String,             // e.g. 'cover', default null
  fielderId: ObjectId,          // ref Player, for catches/run-outs/stumpings, default null
  fielderPosition: String       // default null
}
```
`batsmanName`, `bowlerName`, and `fielderName` are accepted in the `record-ball` request body but are **not** persisted on the ball — they're used only transiently to render the `commentary` string (client already has these names in state, avoiding a server-side lookup). `innings[n].liveState` (Mixed/opaque) is also written when the request includes `liveState` — a full snapshot of the scorer's client-side state (striker/non-striker/bowler, partnerships, fall of wickets) so a different device can resume scoring mid-innings.

### Tournament Endpoints

| Method | Endpoint | Access | Notes |
|---|---|---|---|
| GET | `/api/tournaments` | Public | |
| GET | `/api/tournaments/:id` | Public | |
| GET | `/api/tournaments/:id/standings` | Public | Points table, see Tournament model |
| GET | `/api/tournaments/:id/matches` | Public | |
| GET | `/api/tournaments/:id/statistics` | Public | |
| GET | `/api/tournaments/:id/messages` | Public | Tournament chat |
| POST | `/api/tournaments` | Private | |
| PUT | `/api/tournaments/:id` | Private | |
| POST | `/api/tournaments/:id/register-team` | Private | |
| POST | `/api/tournaments/:id/generate-fixtures` | Private | |
| POST | `/api/tournaments/:id/compute-awards` | Private | Winner/runner-up/third place/MoT/best batsman/best bowler |
| DELETE | `/api/tournaments/:id` | Private | |
| POST | `/api/tournaments/:id/messages` | Private | Tournament chat |

Standings are fully recomputed (not incrementally updated) from every `Completed`/`Cancelled` match linked to the tournament, so `updateStandings()` is idempotent.

### Other Endpoint Groups

Full request/response shapes aren't reproduced here — see the controller for each; routes and access level below.

| Group | Base path | Key endpoints |
|---|---|---|
| Users | `/api/users` | `GET /:id`, `GET /:id/followers`, `GET /:id/following` (public); `POST/DELETE /:id/follow` (private) |
| Player Stats | `/api/player-stats` | `GET /`, `GET /rankings/batsmen`, `GET /rankings/bowlers`, `GET /compare`, `GET /:playerId`, `GET /:playerId/trends` (public); `POST /:playerId/update` (private) |
| Lessons | `/api/lessons` | `GET /`, `GET /:id` (public); `GET /for-me` (personalized, private); `POST /`, `DELETE /:id` (private) |
| News | `/api/news` | `GET /`, `GET /:id` (public); `GET /feed` (personalized, private); `POST /`, `DELETE /:id` (private) |
| Products | `/api/products` | `GET /`, `GET /:id` (public); `POST /`, `DELETE /:id` (private) |
| Orders | `/api/orders` | `POST /`, `GET /my`, `GET /selling`, `PUT /:id/status` (all private) |
| Insights | `/api/insights` | `GET /batsman/:playerId/shot-advice`, `.../bowling-plan`, `.../fielding-plan`, `GET /teams/:teamId/bowler-scouting`, `GET /matchup/:batsmanId/:bowlerId/bowling-plan`, `.../live-bowling-plan` (all public, backed by `services/tendencyAnalytics.js`) |
| Predictions | `/api/predictions` | `GET /leaderboard` (public); `GET /match/:matchId` (optional auth); `GET /me` (private); `POST /` (private) — settled by `services/predictionSettler.js` |
| Direct Messages | `/api/messages` | `GET /conversations`, `GET /unread-count`, `GET /:userId`, `POST /:userId` — all private, no public inbox access |
| Groups | `/api/groups` | `GET /`, `POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`, `POST /:id/leave`, `GET/POST /:id/messages`, `POST /:id/polls`, `POST /:id/polls/:messageId/vote`, `POST /:id/attachments` (multipart upload) — all private, member-only |
| Assistant | `/api/assistant` | `GET /status`, `POST /ask` — both private |

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After registering or logging in, clients receive a token that must be included in the `Authorization` header for protected routes:

```
Authorization: Bearer <token>
```

Tokens expire after 30 days (configurable via `JWT_EXPIRE` in `.env`).

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: OK
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict (e.g. acquiring a match's scoring lock while another user's lock is still fresh)
- `423`: Locked (e.g. recording a ball while another user holds the scoring lock)
- `500`: Internal Server Error

## Database Models

### User Model

```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed, select: false),
  role: String (enum: ['player', 'captain', 'organizer', 'admin', 'sponsor', 'collaborator'], default: 'player'),
  createdAt: Date
}
```

### Player Model

```javascript
{
  user: ObjectId (ref: User, required),
  specialization: String (enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']),
  battingStyle: String (enum: ['Right-hand', 'Left-hand']),
  bowlingStyle: String (enum: ['Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin', 'None']),
  stats: {
    matches: Number,
    runs: Number,
    wickets: Number,
    average: Number
  },
  teams: [ObjectId] (ref: Team),
  profilePicture: String,
  timestamps: true
}
```

### Team Model

```javascript
{
  name: String (required),
  captain: ObjectId (ref: Player, required),
  viceCaptain: ObjectId (ref: Player, default: null),
  coaches: [ObjectId] (ref: Player),
  players: [ObjectId] (ref: Player),
  description: String (max 500 chars),
  city: String (required),
  stats: {
    matchesPlayed: Number,
    wins: Number,
    losses: Number
  },
  logo: String (default: 'no-photo.jpg'),
  timestamps: true
}
```

### Match Model

```javascript
{
  title: String (required),
  team1: ObjectId (ref: Team, required),
  team2: ObjectId (ref: Team, required),
  matchType: String (enum: ['T20', 'ODI', 'Test', 'Friendly'], default: 'T20'),
  status: String (enum: ['Scheduled', 'Live', 'Completed', 'Cancelled'], default: 'Scheduled'),
  venue: String (required),
  pitchType: String (enum: ['dry', 'green', 'flat', 'dusty', 'unknown'], default: 'unknown'),
  scheduledDate: Date (required),
  tournament: ObjectId (ref: Tournament, default: null),
  totalOvers: Number (default: 20),
  interruption: {                 // null until a rain/stoppage adjustment is applied
    revisedOvers: Number,
    oversBowledAtInterruption: Number,
    wicketsLostAtInterruption: Number,
    resourcePercentRemaining: Number,
    parScore: Number,
    target: Number,
    appliedAt: Date
  } | null,
  innings: [{
    team: ObjectId (ref: Team),
    runs: Number,
    wickets: Number,
    overs: Number,
    liveState: Mixed (default: null),   // opaque client-owned snapshot, see Match Endpoints
    balls: [ /* see "Ball subdocument" under Match Endpoints */ ]
  }],
  toss: { winningTeam: ObjectId, decision: String },      // 'bat' or 'bowl'
  result: { winningTeam: ObjectId, margin: String, marginValue: Number },
  manOfTheMatch: ObjectId (ref: Player),
  createdBy: ObjectId (ref: User, required),
  umpires: [ObjectId] (ref: User),
  activeScorer: {                 // the scoring lock, null when unclaimed
    user: ObjectId (ref: User),
    name: String,
    lastActiveAt: Date
  } | null,
  timestamps: true
}
```

### Tournament Model

```javascript
{
  name: String (required),
  description: String,
  houseRules: String (max 5000 chars),     // free-text custom playing conditions
  organizer: ObjectId (ref: User, required),
  format: String (enum: ['League', 'Knockout', 'Group', 'Round-Robin'], default: 'League'),
  matchType: String (enum: ['T20', 'T10', 'ODI', 'Test'], default: 'T20'),
  status: String (enum: ['Draft', 'Registration', 'Ongoing', 'Completed', 'Cancelled'], default: 'Draft'),
  venue: String (required),
  startDate: Date (required),
  endDate: Date (required),
  registrationDeadline: Date (required),
  teams: [ObjectId] (ref: Team),
  maxTeams: Number (default: 8),
  matches: [ObjectId] (ref: Match),
  prizePool: { total: Number, firstPlace: Number, secondPlace: Number, thirdPlace: Number },
  standings: [{                      // points table, rebuilt by updateStandings()
    team: ObjectId (ref: Team),
    played: Number, won: Number, lost: Number, tied: Number, noResult: Number,
    points: Number, netRunRate: Number, runsFor: Number, runsAgainst: Number
  }],
  rules: {
    overs: Number (default: 20),
    powerplayOvers: Number (default: 6),
    pointsForWin: Number (default: 2),
    pointsForTie: Number (default: 1),
    pointsForNoResult: Number (default: 1),
    bonusPointThreshold: Number (default: 0)
  },
  statistics: {
    totalMatches: Number, completedMatches: Number, totalRuns: Number, totalWickets: Number,
    highestScore: Number, lowestScore: Number, highestIndividualScore: Number,
    bestBowlingFigures: String (default: '0/0')
  },
  awards: {                          // set by POST /:id/compute-awards
    winner: ObjectId (ref: Team),
    runnerUp: ObjectId (ref: Team),
    thirdPlace: ObjectId (ref: Team),
    manOfTheTournament: ObjectId (ref: Player),
    bestBatsman: ObjectId (ref: Player),
    bestBowler: ObjectId (ref: Player)
  },
  logo: String,
  banner: String,
  isPublic: Boolean (default: true),
  allowRegistration: Boolean (default: true),
  requiresApproval: Boolean (default: false),
  timestamps: true
}
```

## Integration with Frontend

### Example: React Native Integration

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Register
async function register(name, email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      name,
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
  }
}

// Login
async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    // Store token in secure storage
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
  }
}

// Get current user
async function getCurrentUser(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}
```

---

*For more information, see the main CricRoots README.md*
