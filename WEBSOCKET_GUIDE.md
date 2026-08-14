# CricRoots WebSocket Real-time Integration Guide

This document provides a comprehensive guide on the WebSocket implementation for real-time AI insights and match updates in the CricRoots application.

## Overview

The CricRoots application uses **Socket.io** for real-time, bidirectional communication between the backend server and connected clients (mobile and web), for match ball-by-ball events/AI insights as well as team/tournament/group chat and direct messages.

This is not a wholesale replacement of polling, though: on web, `useMatchWebSocket` is only mounted while the AI Insights tab is open (`web-app/app/match/[id]/page.tsx`) - the default Scorecard tab still refreshes itself via a 10-second `setInterval`, independent of the socket. The mobile `MatchDetailScreen` does keep its embedded `AITacticalAdvisor` connected whenever the match is live.

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

#### 3. Join/Leave Team, Tournament, Group Rooms
```javascript
socket.emit('join-team', teamId);
socket.emit('leave-team', teamId);
socket.emit('join-tournament', tournamentId);
socket.emit('leave-tournament', tournamentId);
socket.emit('join-group', groupId);
socket.emit('leave-group', groupId);
```
Same pattern as match rooms - subscribes/unsubscribes the client to a team chat, tournament announcements, or group chat room. `join-group` itself does not check membership; authorization is enforced separately by the REST API before any group message is ever emitted into that room.

Every authenticated socket is also auto-joined to a personal `user-<userId>` room on connect (no explicit join event needed) - this is how direct messages are delivered.

#### 4. Record Ball / Update Match (defined client-side, not wired up server-side)
```javascript
socket.emit('record-ball', { ballNumber: 45, batsmanId: 'player1', bowlerId: 'player2', runs: 4, isWicket: false });
socket.emit('update-match', { status: 'Live', toss: { winningTeam: 'team1', decision: 'bat' } });
```
Both mobile and web `useMatchWebSocket` hooks expose `recordBall()`/`updateMatch()` helpers that emit these, but `backend/src/utils/socketManager.js` has no `socket.on('record-ball', ...)` or `socket.on('update-match', ...)` handler - the server never listens for either, so these emits are currently no-ops. Ball recording actually happens over REST (`POST /api/matches/:id/record-ball`), which is what triggers the real `ball-recorded`/`ai-insights` broadcasts below.

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
`emitScorecardUpdate()` exists on `SocketManager` and the web hook listens for it, but no controller calls it yet (see #7) - the web scorecard tab gets its data from plain REST polling instead, not this event.

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

#### 7. Milestone, Match Update (defined, not currently triggered)
```javascript
socket.on('milestone', (data) => { /* data.milestone: 50s, 100s, etc. */ });
socket.on('match-update', (data) => { /* data.data: arbitrary match-level payload */ });
```
`SocketManager` defines `emitMilestone()` and `emitMatchUpdate()` (alongside `emitScorecardUpdate()` above), and the web hook listens for all three - but no controller currently calls any of them. They're wired end-to-end and ready to use, just not yet triggered by any code path.

#### 8. Chat Events
```javascript
socket.on('new-message', (data) => {
  // data = { scope: 'team' | 'tournament', id, message, timestamp }
});
socket.on('new-direct-message', (data) => {
  // data = { message, timestamp } - delivered to the recipient's personal user-<id> room
});
socket.on('new-group-message', (data) => {
  // data = { groupId, message, timestamp } - text, poll, or attachment
});
socket.on('group-poll-update', (data) => {
  // data = { groupId, message, timestamp } - updated vote counts for an existing poll message
});
```
Emitted by `messageController.js` (team/tournament chat), `directMessageController.js`, and `groupMessageController.js` respectively - these aren't AI/match related but are real, actively-used events this file previously didn't mention.

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
- Automatic reconnection with backoff (`reconnectionDelay: 1000`, capped at `reconnectionDelayMax: 5000`)
- Max 5 reconnection attempts (`reconnectionAttempts: 5`)
- No active HTTP-polling fallback while disconnected on the AI Insights panel specifically - it just keeps showing the last value it had (REST snapshot or last socket push) and a "Reconnecting..." badge until the socket comes back. The web scorecard tab's separate 10-second poll (see Overview) is unrelated and keeps running regardless of socket state.

### Timeout Handling
- 5-second timeout for AI Engine calls
- Graceful degradation if AI Engine is unavailable
- Match data still delivered without AI insights

### Authentication
- JWT token verified once, in the `io.use()` middleware at handshake time (`backend/src/utils/socketManager.js`)
- Invalid or missing tokens rejected with `next(new Error('Authentication error'))`, refusing the connection
- No re-check during the life of the connection - a socket that connected with a since-expired token is not proactively disconnected (tokens are 30 days by default, so this is a narrow edge case, not a re-auth loop)

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
5. ~~Chat Integration~~ - shipped, but as team/tournament/group rooms and DMs (`new-message`, `new-direct-message`, `new-group-message`, `group-poll-update` above), not scoped to match rooms specifically
6. **Replay System**: Store and replay match events

---

For more information, see the main [README.md](README.md) and [AI_INTEGRATION_GUIDE.md](AI_INTEGRATION_GUIDE.md).
