# CricRoots AI Integration Guide

This document provides a comprehensive guide on how the AI Engine is integrated with the backend and frontend components of the CricRoots application.

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

The match controller fetches AI insights when:

1. **Recording a Ball** (`POST /api/matches/:id/record-ball`)
   - After saving the ball data, the HTTP response itself only contains `{ success, message, match }` - no `aiInsights` field
   - `req.socketManager.emitBallRecorded()` fires instead, which broadcasts `ball-recorded` and then internally calls `AIService.getTacticalAdvice()` and broadcasts the result as a separate `ai-insights` WebSocket event (see WEBSOCKET_GUIDE.md)
   - So AI insights after a ball are delivered async over the socket, not synchronously in the record-ball response

2. **Getting Scorecard** (`GET /api/matches/:id/scorecard`)
   - Calls `AIService.getTacticalAdvice()` and includes `aiInsights` in the response (`null` if the AI Engine call failed)

3. **Getting AI Insights** (`GET /api/matches/:id/ai-insights`)
   - Dedicated endpoint for AI data, used as the REST fallback so a client opening the AI Insights panel mid-match gets an immediate snapshot instead of waiting for the next ball
   - Unlike scorecard, this one returns HTTP 500 if the AI Engine call fails rather than falling back gracefully

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

// 2. Backend saves the ball and returns { success, message, match } - no AI insights in this response
// 3. socketManager.emitBallRecorded() broadcasts 'ball-recorded', then calls
//    AIService.getTacticalAdvice() and broadcasts the result separately as 'ai-insights'
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

// 6. Backend broadcasts to all clients in the match room over WebSocket
socket.emit('ai-insights', { matchId, insights: {...}, timestamp })
```

## Frontend Integration

### Mobile Component (`mobile-app/src/components/AITacticalAdvisor.tsx`)

Displays AI insights in a user-friendly format:

```typescript
<AITacticalAdvisor matchId={matchId} isLive={isLive} />
```

**Features:**
- Fetches a one-time REST snapshot (`GET /api/matches/:id/ai-insights`) on mount so the panel doesn't sit spinning until the next ball is scored, then keeps itself fresh via the `useMatchWebSocket` hook's `ai-insights` event - no 30-second polling loop
- Shows win probability with visual progress bar
- Displays tactical advice
- Recommends the next bowler only, via a separate roster-grounded endpoint (`GET /api/matches/:id/next-bowler-recommendation`, backed by `tendencyAnalytics.getLiveMatchupPlan` - the matchup shrinkage engine, not the AI Engine). The AI Engine's own `key_recommendations.batsman/bowler` (raw class labels with no roster awareness) are deliberately not rendered
- Color-coded status (Dominant/Balanced/Challenging)

### Web Component (`web-app/components/AITacticalAdvisor.tsx`)

Same REST-snapshot-plus-WebSocket pattern as the mobile component, plus a `connectedUsers` count from the web hook.

### Live Match Screens

**Mobile Screen** (`mobile-app/src/screens/MatchDetailScreen.tsx`)
- Single scrollable screen (no tabs, no FAB) with sections for the live scorecard, recent balls, key moments, charts, and the embedded `AITacticalAdvisor`
- Ball scoring itself happens on a separate screen, `LiveScoringScreen.tsx`, which posts to `record-ball` over REST

**Web Page** (`web-app/app/match/[id]/page.tsx`)
- Tab-based navigation (Scorecard / AI Insights) - but only the AI Insights tab mounts `useMatchWebSocket`; see WEBSOCKET_GUIDE.md for how the Scorecard tab actually updates
- Grid-based recent balls display
- Professional styling

## Data Flow During Live Match

This is superseded in practice by the WebSocket push described in WEBSOCKET_GUIDE.md, but the still-accurate shape is:

```
1. User opens the AI Insights panel/tab
   ↓
2. AITacticalAdvisor mounts useMatchWebSocket and connects to the socket, joining match-<id>
   ↓
3. In parallel, it fetches a one-time snapshot: GET /api/matches/:id/ai-insights
   (Backend calls AI Engine: POST /api/recommendations/tactical-advisor)
   ↓
4. Frontend displays the REST snapshot immediately
   ↓
5. Whenever anyone records a ball: POST /api/matches/:id/record-ball
   ↓
6. Backend saves the ball, then emitBallRecorded() broadcasts 'ball-recorded' and
   'ai-insights' (freshly fetched from the AI Engine) to everyone in that match room
   ↓
7. All connected clients' panels update instantly - no polling loop
```

Note: the web scorecard tab (as opposed to the AI Insights tab) does not use this socket connection at all - it polls `GET /api/matches/:id` etc. on a 10-second `setInterval` (see `web-app/app/match/[id]/page.tsx`).

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

Services communicate through the `cricroots-network`:
- Backend: `http://ai-engine:5001`
- AI Engine: `http://backend:5000`

## Model Training & Reliability

- Both the win-probability regressor and the batsman/bowler/fielding classifiers are `RandomForest` models trained on **synthetic** data (`ai-engine/data/matches.csv`, `fielding.csv`), not real historical match data - accuracy claims should be read as illustrative of the pipeline, not of the sport, until real match data volume justifies retraining
- On startup, `RecommendationModel.load_models()` tries to unpickle the `.pkl` files baked into the ai-engine image. If that fails (e.g. a scikit-learn/numpy version bump since they were pickled), it logs the real exception (previously a bare `except: return False` swallowed it silently) and `recommendations.py` automatically calls `train_all_models()` against the synthetic dataset - the service self-heals instead of staying stuck at "model not trained" until someone notices and manually hits `POST /train`

## Performance Considerations

1. **Timeout**: AI Engine calls have a 5-second timeout
2. **Fallback**: If AI Engine is unavailable, match data is still returned (except `GET /api/matches/:id/ai-insights`, which returns HTTP 500)
3. **Async**: AI calls don't block match data retrieval

## Error Handling

If the AI Engine is unavailable:
- Backend returns match data without AI insights (scorecard endpoint) or a 500 (dedicated ai-insights endpoint)
- Frontend displays match scorecard normally
- AI Insights panel falls back to "Could not load AI insights" if the initial REST fetch fails, or keeps showing the last value received over the socket
- No fixed-interval auto-retry; the socket reconnects itself with backoff (see WEBSOCKET_GUIDE.md)

## Future Enhancements

1. ~~Real-time WebSocket Updates~~ - shipped; see WEBSOCKET_GUIDE.md
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
