# CricSync Architecture Documentation

## System Overview

CricSync is a full-stack cricket application built with a microservices-inspired architecture. The system consists of multiple independent services that communicate through well-defined APIs, allowing for scalability, maintainability, and independent deployment.

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

#### Web Application (React)
- **Technology**: React, TypeScript, TailwindCSS
- **Purpose**: Browser-based interface for desktop users
- **Features**: Shopping cart, team management, scoring display
- **Location**: `/web-app`

#### Mobile Application (React Native)
- **Technology**: React Native, Expo, TypeScript
- **Purpose**: Native mobile experience for iOS and Android
- **Features**: Platform-specific UI, offline support, push notifications
- **Location**: `/mobile-app`
- **Platform-Specific Code**:
  - iOS components: `/mobile-app/src/platform/ios-*`
  - Android components: `/mobile-app/src/platform/android-*`

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

#### Database Models

```
User
├── name
├── email
├── password (hashed)
├── role (player, captain, organizer, admin)
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

#### API Endpoints
- `POST /api/recommendations/batsman`
- `POST /api/recommendations/bowler`
- `POST /api/recommendations/fielding`
- `GET /api/recommendations/health`

### 4. Data Layer (MongoDB)

#### Purpose
Persistent data storage for all application entities

#### Collections
- `users`: User account information
- `players`: Player profiles and statistics
- `teams`: Team information and rosters
- `matches`: Match details and scoring data

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

### Asynchronous Communication (Future)

```
Client → Backend API → Message Queue (RabbitMQ/Redis)
                       ↓
                   AI Engine (processes)
                       ↓
                   Database Update
                       ↓
                   WebSocket to Client
```

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
Nginx handles CORS headers:
- Access-Control-Allow-Origin
- Access-Control-Allow-Methods
- Access-Control-Allow-Headers
- Access-Control-Max-Age
```

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

### Real-time Features

```
WebSocket Server
    ↓
    ├─ Live match updates
    ├─ Real-time notifications
    └─ Chat functionality
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
