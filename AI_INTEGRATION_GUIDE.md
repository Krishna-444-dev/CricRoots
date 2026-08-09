# CricSync AI Integration Guide

This document provides a comprehensive guide on how the AI Engine is integrated with the backend and frontend components of the CricSync application.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Mobile/Web Frontend                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ AITacticalAdvisor Component                          │   │
│  │ - Displays win probability                           │   │
│  │ - Shows tactical advice                              │   │
│  │ - Recommends next batsman/bowler                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP GET /ai-insights
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Node.js Backend                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Match Controller                                     │   │
│  │ - recordBall(): Saves ball data                      │   │
│  │ - getScorecard(): Returns match state                │   │
│  │ - getAIInsights(): Fetches AI predictions            │   │
│  └──────────────────────────────────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │ AIService Utility                                    │   │
│  │ - getTacticalAdvice()                               │   │
│  │ - getWinProbability()                               │   │
│  │ - recommendBatsman()                                │   │
│  │ - recommendBowler()                                 │   │
│  │ - recommendFielding()                               │   │
│  └──────────────────────────┬──────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
                    HTTP POST /api/recommendations/*
                             │
┌────────────────────────────▼────────────────────────────────┐
│                  Python AI Engine                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Flask API Server                                     │   │
│  │ - /tactical-advisor                                  │   │
│  │ - /win-probability                                   │   │
│  │ - /batsman                                           │   │
│  │ - /bowler                                            │   │
│  │ - /fielding                                          │   │
│  └──────────────────────────┬──────────────────────────┘   │
│                             │                                │
│  ┌──────────────────────────▼──────────────────────────┐   │
│  │ RecommendationModel                                  │   │
│  │ - Trained ML Models (RandomForest)                  │   │
│  │ - Feature Engineering                               │   │
│  │ - Prediction Logic                                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Backend Integration

### AIService Utility (`backend/src/utils/aiService.js`)

The `AIService` class provides a wrapper around the AI Engine API calls:

```javascript
// Get tactical advice for the current match situation
const advice = await AIService.getTacticalAdvice({
  oversRemaining: 10.5,
  wicketsDown: 4,
  currentRunRate: 7.2,
  targetScore: 180,
  oppositionStrength: 8.0,
  pitchType: 1
});
```

**Key Methods:**
- `getWinProbability(matchData)` - Predicts match outcome probability
- `recommendBatsman(matchData)` - Suggests next batsman
- `recommendBowler(matchData)` - Suggests next bowler
- `recommendFielding(playerData, batsmanData)` - Suggests fielding positions
- `getTacticalAdvice(matchData)` - Comprehensive tactical summary
- `healthCheck()` - Verifies AI Engine availability

### Match Controller Integration

The match controller automatically fetches AI insights when:

1. **Recording a Ball** (`POST /api/matches/:id/record-ball`)
   - After saving the ball data
   - Calls `AIService.getTacticalAdvice()`
   - Returns insights along with match data

2. **Getting Scorecard** (`GET /api/matches/:id/scorecard`)
   - Includes AI insights in the response
   - Provides real-time tactical analysis

3. **Getting AI Insights** (`GET /api/matches/:id/ai-insights`)
   - Dedicated endpoint for AI data
   - Called by frontend components

### Example Flow

```javascript
// 1. Frontend records a ball
POST /api/matches/123/record-ball
{
  inningsIndex: 1,
  ballNumber: 45,
  batsmanId: "player1",
  bowlerId: "player2",
  runs: 4,
  isWicket: false
}

// 2. Backend saves the ball
// 3. Backend calculates match state
// 4. Backend calls AI Engine
POST http://ai-engine:5001/api/recommendations/tactical-advisor
{
  overs_remaining: 15.1,
  wickets_down: 3,
  current_run_rate: 7.5,
  target_score: 180,
  opposition_strength: 8.0,
  pitch_type: 1
}

// 5. AI Engine returns predictions
{
  success: true,
  match_status: "Balanced",
  win_probability: 0.62,
  tactical_advice: "Aggressive approach recommended...",
  key_recommendations: {
    batsman: 5,
    bowler: 3
  }
}

// 6. Backend returns to frontend
{
  success: true,
  match: {...},
  aiInsights: {...}
}
```

## Frontend Integration

### Mobile Component (`mobile-app/src/components/AITacticalAdvisor.tsx`)

Displays AI insights in a user-friendly format:

```typescript
<AITacticalAdvisor matchId={matchId} isLive={isLive} />
```

**Features:**
- Auto-refreshes every 30 seconds during live matches
- Shows win probability with visual progress bar
- Displays tactical advice
- Recommends next batsman and bowler
- Color-coded status (Dominant/Balanced/Challenging)

### Web Component (`web-app/components/AITacticalAdvisor.tsx`)

Similar functionality for web browsers with responsive design.

### Live Match Screens

**Mobile Screen** (`mobile-app/src/screens/LiveMatchScreen.tsx`)
- Tab-based navigation (Scorecard / AI Insights)
- Real-time score updates
- Recent balls display
- FAB button to record new balls

**Web Page** (`web-app/app/match/[id]/page.tsx`)
- Similar layout with responsive design
- Grid-based recent balls display
- Professional styling

## Data Flow During Live Match

```
1. User opens live match screen
   ↓
2. Component fetches match data: GET /api/matches/:id
   ↓
3. Component fetches AI insights: GET /api/matches/:id/ai-insights
   ↓
4. Backend calls AI Engine: POST /api/recommendations/tactical-advisor
   ↓
5. AI Engine returns predictions
   ↓
6. Frontend displays insights
   ↓
7. Auto-refresh every 30 seconds (steps 2-6 repeat)
   ↓
8. When ball is recorded: POST /api/matches/:id/record-ball
   ↓
9. Backend updates match state and fetches new AI insights
   ↓
10. Frontend receives updated data and refreshes display
```

## AI Engine Endpoints

### 1. Tactical Advisor (Recommended)
```
POST /api/recommendations/tactical-advisor

Request:
{
  overs_remaining: 10.5,
  wickets_down: 4,
  current_run_rate: 7.2,
  target_score: 180,
  opposition_strength: 8.0,
  pitch_type: 1
}

Response:
{
  success: true,
  match_status: "Balanced",
  win_probability: 0.62,
  tactical_advice: "Aggressive approach recommended...",
  key_recommendations: {
    batsman: 5,
    bowler: 3
  }
}
```

### 2. Win Probability
```
POST /api/recommendations/win-probability

Request:
{
  overs_remaining: 10.5,
  wickets_down: 4,
  current_run_rate: 7.2,
  target_score: 180
}

Response:
{
  success: true,
  win_probability: 0.62,
  status: "Balanced"
}
```

### 3. Batsman Recommendation
```
POST /api/recommendations/batsman

Request:
{
  current_run_rate: 6,
  wickets_down: 2,
  overs_remaining: 15,
  opposition_strength: 7
}

Response:
{
  success: true,
  recommended_batsman_id: 5,
  confidence: 0.87
}
```

## Configuration

### Environment Variables

**Backend** (`.env`):
```
AI_ENGINE_URL=http://ai-engine:5001
```

**AI Engine** (`.env`):
```
PORT=5001
FLASK_ENV=production
BACKEND_API_URL=http://backend:5000
```

### Docker Compose

Services communicate through the `cricsync-network`:
- Backend: `http://ai-engine:5001`
- AI Engine: `http://backend:5000`

## Performance Considerations

1. **Caching**: AI insights are cached for 30 seconds to reduce API calls
2. **Timeout**: AI Engine calls have a 5-second timeout
3. **Fallback**: If AI Engine is unavailable, match data is still returned
4. **Async**: AI calls don't block match data retrieval

## Error Handling

If the AI Engine is unavailable:
- Backend returns match data without AI insights
- Frontend displays match scorecard normally
- AI Insights section shows error message
- Auto-retry every 30 seconds

## Future Enhancements

1. **Real-time WebSocket Updates**: Push AI insights to clients
2. **Player-Specific Recommendations**: Personalized advice based on player history
3. **Deep Learning Models**: Upgrade from RandomForest to neural networks
4. **Live Data Integration**: Connect to real cricket data sources
5. **Model Versioning**: Support multiple model versions simultaneously
6. **A/B Testing**: Test different recommendation strategies

## Testing the Integration

### Local Testing

1. Start all services:
```bash
docker-compose up -d
```

2. Create a test match:
```bash
curl -X POST http://localhost:5000/api/matches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Match",
    "team1Id": "<team1_id>",
    "team2Id": "<team2_id>",
    "venue": "Test Stadium",
    "scheduledDate": "2024-01-01T18:00:00Z"
  }'
```

3. Record a ball:
```bash
curl -X POST http://localhost:5000/api/matches/<match_id>/record-ball \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "inningsIndex": 0,
    "ballNumber": 1,
    "batsmanId": "<player_id>",
    "bowlerId": "<player_id>",
    "runs": 4
  }'
```

4. Get AI insights:
```bash
curl http://localhost:5000/api/matches/<match_id>/ai-insights
```

---

For more information, see the main [README.md](README.md) and [ARCHITECTURE.md](ARCHITECTURE.md).
