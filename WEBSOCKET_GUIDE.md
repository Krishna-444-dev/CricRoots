# CricRoots WebSocket Real-time Integration Guide

This document provides a comprehensive guide on the WebSocket implementation for real-time AI insights and match updates in the CricRoots application.

## Overview

The CricRoots application now uses **Socket.io** for real-time, bidirectional communication between the backend server and connected clients (mobile and web). This replaces the previous polling mechanism, providing instant updates with significantly reduced latency and server load.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client Layer                             │
├──────────────────┬──────────────────┬──────────────────────┤
│   Web Browser    │  Mobile (iOS)    │  Mobile (Android)    │
│   (Socket.io)    │  (Socket.io)     │  (Socket.io)         │
└────────────────┬─┴────────────────┬─┴──────────────────┬───┘
                 │                  │                    │
                 └──────────────────┼────────────────────┘
                                    │
                         WebSocket Connection
                                    │
                    ┌───────────────▼────────────────┐
                    │  Nginx Reverse Proxy           │
                    │  (WebSocket Support)           │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │  Node.js Backend               │
                    │  (Socket.io Server)            │
                    ├────────────────────────────────┤
                    │  SocketManager                 │
                    │  - Room Management             │
                    │  - Event Broadcasting          │
                    │  - AI Integration              │
                    └───────────────┬────────────────┘
                                    │
                    ┌───────────────▼────────────────┐
                    │  Python AI Engine              │
                    │  (Real-time Predictions)       │
                    └────────────────────────────────┘
```

## WebSocket Events

### Client → Server Events

#### 1. Join Match Room
```javascript
socket.emit('join-match', matchId);
```
Subscribes the client to a specific match room to receive real-time updates.

#### 2. Leave Match Room
```javascript
socket.emit('leave-match', matchId);
```
Unsubscribes the client from the match room.

#### 3. Record Ball
```javascript
socket.emit('record-ball', {
  ballNumber: 45,
  batsmanId: 'player1',
  bowlerId: 'player2',
  runs: 4,
  isWicket: false
});
```
Notifies the server that a ball has been recorded.

#### 4. Update Match
```javascript
socket.emit('update-match', {
  status: 'Live',
  toss: { winningTeam: 'team1', decision: 'bat' }
});
```
Updates match-level information.

### Server → Client Events

#### 1. Ball Recorded
```javascript
socket.on('ball-recorded', (data) => {
  // data = {
  //   matchId: 'match123',
  //   ball: { ballNumber, batsmanId, bowlerId, runs, isWicket },
  //   matchState: { oversRemaining, wicketsDown, currentRunRate, ... },
  //   timestamp: Date
  // }
});
```
Broadcast when a new ball is recorded in the match.

#### 2. AI Insights
```javascript
socket.on('ai-insights', (data) => {
  // data = {
  //   matchId: 'match123',
  //   insights: {
  //     success: true,
  //     match_status: 'Balanced',
  //     win_probability: 0.62,
  //     tactical_advice: '...',
  //     key_recommendations: { batsman: 5, bowler: 3 }
  //   },
  //   timestamp: Date
  // }
});
```
Broadcast updated AI tactical insights.

#### 3. Wicket
```javascript
socket.on('wicket', (data) => {
  // data = {
  //   matchId: 'match123',
  //   wicket: {
  //     ballNumber: 45,
  //     batsmanId: 'player1',
  //     bowlerId: 'player2',
  //     wicketType: 'bowled',
  //     currentWickets: 4
  //   },
  //   timestamp: Date
  // }
});
```
Broadcast when a wicket falls.

#### 4. Match Status Change
```javascript
socket.on('match-status-change', (data) => {
  // data = {
  //   matchId: 'match123',
  //   status: 'Live',
  //   timestamp: Date
  // }
});
```
Broadcast when match status changes (Scheduled → Live → Completed).

#### 5. Scorecard Update
```javascript
socket.on('scorecard-update', (data) => {
  // data = {
  //   matchId: 'match123',
  //   scorecard: { team1, team2, runs, wickets, overs, ... },
  //   timestamp: Date
  // }
});
```
Broadcast updated scorecard information.

#### 6. User Joined/Left
```javascript
socket.on('user-joined', (data) => {
  // data = { userId: 'user123', timestamp: Date }
});

socket.on('user-left', (data) => {
  // data = { userId: 'user123', timestamp: Date }
});
```
Broadcast when users join or leave a match room.

## Implementation Details

### Backend Setup

#### 1. Socket Manager (`backend/src/utils/socketManager.js`)
Handles all WebSocket logic:
- Middleware for JWT authentication
- Room management
- Event emission and broadcasting
- AI integration

#### 2. Server Integration (`backend/src/index.js`)
- Creates HTTP server with Socket.io
- Initializes SocketManager
- Makes socketManager available to routes

#### 3. Match Controller Updates
- Emits events when balls are recorded
- Broadcasts AI insights
- Notifies all connected clients of match updates

### Frontend Integration

#### Mobile Hook (`mobile-app/src/hooks/useMatchWebSocket.ts`)
```typescript
const { isConnected, error, aiInsights, ballRecorded, wicket } = useMatchWebSocket({
  matchId,
  userId,
  token,
  enabled: true
});
```

#### Web Hook (`web-app/hooks/useMatchWebSocket.ts`)
Similar to mobile hook with additional `connectedUsers` tracking.

#### Component Usage
Both mobile and web components use the hooks to:
- Connect to WebSocket on component mount
- Listen for real-time events
- Update UI instantly
- Show connection status

### Nginx Configuration

Updated to support WebSocket proxying:
```nginx
location /socket.io {
    proxy_pass http://backend/socket.io;
    proxy_http_version 1.1;
    proxy_buffering off;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

## Benefits Over Polling

| Aspect | Polling (30s) | WebSocket |
| :--- | :--- | :--- |
| **Latency** | ~15s average | <100ms |
| **Server Load** | High (constant requests) | Low (persistent connection) |
| **Bandwidth** | High (repeated headers) | Low (binary frames) |
| **Real-time Feel** | Delayed | Instant |
| **Scalability** | Limited | Excellent |

## Connection Flow

```
1. User opens live match screen
   ↓
2. Component initializes useMatchWebSocket hook
   ↓
3. Socket.io client connects to backend
   ↓
4. Backend verifies JWT token
   ↓
5. Client joins match room: socket.emit('join-match', matchId)
   ↓
6. Backend broadcasts to all users in room
   ↓
7. Real-time events received instantly:
   - ball-recorded
   - ai-insights
   - wicket
   - match-status-change
   ↓
8. UI updates automatically
   ↓
9. When user leaves: socket.emit('leave-match', matchId)
   ↓
10. Socket disconnects on component unmount
```

## Error Handling

### Connection Failures
- Automatic reconnection with exponential backoff
- Max 5 reconnection attempts
- Fallback to HTTP polling if WebSocket fails

### Timeout Handling
- 5-second timeout for AI Engine calls
- Graceful degradation if AI Engine is unavailable
- Match data still delivered without AI insights

### Authentication
- JWT token verified on connection
- Invalid tokens rejected
- Automatic disconnection on token expiry

## Performance Optimization

### Room-based Broadcasting
- Events only sent to connected users in specific match room
- Reduces unnecessary network traffic
- Scales efficiently with multiple concurrent matches

### Event Batching
- Multiple updates can be combined
- Reduces frame rate overhead
- Maintains responsiveness

### Connection Pooling
- Nginx maintains persistent connections
- Efficient resource utilization
- Supports thousands of concurrent connections

## Monitoring & Debugging

### Check Connected Users
```javascript
const connectedUsers = socketManager.getConnectedUsersCount(matchId);
```

### View Server Logs
```bash
docker-compose logs -f backend
```

### Monitor WebSocket Connections
```bash
# Check active connections
netstat -an | grep ESTABLISHED | wc -l
```

## Testing WebSocket

### Using Socket.io Client Library

```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: {
    token: 'your_jwt_token',
    userId: 'user_id'
  }
});

socket.on('connect', () => {
  console.log('Connected');
  socket.emit('join-match', 'match123');
});

socket.on('ai-insights', (data) => {
  console.log('AI Insights:', data);
});

socket.on('ball-recorded', (data) => {
  console.log('Ball Recorded:', data);
});
```

### Using Browser DevTools

1. Open Chrome DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Observe real-time messages

## Deployment Considerations

### Production Setup
1. Enable SSL/TLS (already configured in Nginx)
2. Set appropriate timeouts
3. Configure firewall rules for WebSocket port (443)
4. Monitor connection pool limits
5. Set up load balancing if needed

### Scaling
- Use Redis adapter for multiple backend instances
- Implement sticky sessions for load balancing
- Monitor memory usage (each connection uses ~5KB)

## Future Enhancements

1. **Message Compression**: Enable Socket.io compression
2. **Presence Tracking**: Show which users are watching
3. **Notifications**: Send push notifications for key events
4. **Analytics**: Track real-time engagement metrics
5. **Chat Integration**: Add live chat to match rooms
6. **Replay System**: Store and replay match events

---

For more information, see the main [README.md](README.md) and [AI_INTEGRATION_GUIDE.md](AI_INTEGRATION_GUIDE.md).
