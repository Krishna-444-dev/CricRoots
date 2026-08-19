const AIService = require('./aiService');
const { verifyToken } = require('../config/jwt');

class SocketManager {
  constructor(io) {
    this.io = io;
    this.matchRooms = new Map(); // Store active match rooms
    this.setupMiddleware();
    this.setupEventHandlers();
  }

  setupMiddleware() {
    // Middleware to verify JWT tokens - socket.userId is derived from the
    // verified token payload, never trusted from client-supplied handshake data.
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }
      const decoded = verifyToken(token);
      if (!decoded) {
        return next(new Error('Authentication error'));
      }
      socket.userId = decoded.id;
      next();
    });
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected: ${socket.id}`);

      // Every authenticated connection auto-joins its own personal room, so a direct message
      // can be delivered by user id alone - no explicit join-dm event needed the way match/team/
      // tournament rooms require, since a DM's audience (one specific person) is already known
      // the instant the socket authenticates.
      socket.join(`user-${socket.userId}`);

      // Join a match room
      socket.on('join-match', (matchId) => {
        socket.join(`match-${matchId}`);
        this.matchRooms.set(`match-${matchId}`, {
          matchId,
          connectedUsers: this.io.sockets.adapter.rooms.get(`match-${matchId}`).size
        });
        
        // Notify others that a user joined
        this.io.to(`match-${matchId}`).emit('user-joined', {
          userId: socket.userId,
          timestamp: new Date()
        });
      });

      // Leave a match room
      socket.on('leave-match', (matchId) => {
        socket.leave(`match-${matchId}`);
        this.io.to(`match-${matchId}`).emit('user-left', {
          userId: socket.userId,
          timestamp: new Date()
        });
      });

      // Join/leave a team chat room
      socket.on('join-team', (teamId) => {
        socket.join(`team-${teamId}`);
      });
      socket.on('leave-team', (teamId) => {
        socket.leave(`team-${teamId}`);
      });

      // Join/leave a tournament announcements room
      socket.on('join-tournament', (tournamentId) => {
        socket.join(`tournament-${tournamentId}`);
      });
      socket.on('leave-tournament', (tournamentId) => {
        socket.leave(`tournament-${tournamentId}`);
      });

      // Join/leave a group chat room. Membership itself is enforced by the REST API (a
      // non-member's join-group just puts them in a room nothing will ever emit group messages
      // they're authorized to see into, since the emit only happens after a REST call that
      // already checked membership) - this event is purely about live delivery, not authorization.
      socket.on('join-group', (groupId) => {
        socket.join(`group-${groupId}`);
      });
      socket.on('leave-group', (groupId) => {
        socket.leave(`group-${groupId}`);
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.userId} disconnected: ${socket.id}`);
      });
    });
  }

  /**
   * Emit match update to all connected clients
   */
  emitMatchUpdate(matchId, matchData) {
    this.io.to(`match-${matchId}`).emit('match-update', {
      matchId,
      data: matchData,
      timestamp: new Date()
    });
  }

  /**
   * Emit AI insights to all connected clients
   */
  async emitAIInsights(matchId, chaseState) {
    // chaseState is null during the first innings (services/matchStateFeatures.js). Emitting
    // nothing is deliberate: the `|| 20`, `|| 150` defaults this used to apply meant a first-
    // innings ball produced a fully-formed win probability built from placeholder inputs, which
    // is exactly the "silently display nonsense" failure E2 exists to remove.
    if (!chaseState) return;

    try {
      const aiInsights = await AIService.getTacticalAdvice(chaseState);

      this.io.to(`match-${matchId}`).emit('ai-insights', {
        matchId,
        insights: aiInsights,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error emitting AI insights:', error);
    }
  }

  /**
   * Emit ball recorded event
   */
  async emitBallRecorded(matchId, ballData, matchState) {
    // Emit ball event
    this.io.to(`match-${matchId}`).emit('ball-recorded', {
      matchId,
      ball: ballData,
      matchState,
      timestamp: new Date()
    });

    // Emit updated AI insights
    await this.emitAIInsights(matchId, matchState);
  }

  /**
   * Emit wicket event
   */
  emitWicket(matchId, wicketData) {
    this.io.to(`match-${matchId}`).emit('wicket', {
      matchId,
      wicket: wicketData,
      timestamp: new Date()
    });
  }

  /**
   * Emit milestone event (50, 100, etc.)
   */
  emitMilestone(matchId, milestoneData) {
    this.io.to(`match-${matchId}`).emit('milestone', {
      matchId,
      milestone: milestoneData,
      timestamp: new Date()
    });
  }

  /**
   * Emit match status change
   */
  emitMatchStatusChange(matchId, status) {
    this.io.to(`match-${matchId}`).emit('match-status-change', {
      matchId,
      status,
      timestamp: new Date()
    });
  }

  /**
   * Emit scorecard update
   */
  emitScorecardUpdate(matchId, scorecard) {
    this.io.to(`match-${matchId}`).emit('scorecard-update', {
      matchId,
      scorecard,
      timestamp: new Date()
    });
  }

  /**
   * Emit a new chat/announcement message to a team or tournament room
   */
  emitNewMessage(scope, id, message) {
    this.io.to(`${scope}-${id}`).emit('new-message', {
      scope,
      id,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Deliver a direct message to the recipient's personal room, if they're currently connected.
   */
  emitDirectMessage(recipientId, message) {
    this.io.to(`user-${recipientId}`).emit('new-direct-message', {
      message,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast a new group message (text, poll, or attachment) to everyone currently in that
   * group's room.
   */
  emitNewGroupMessage(groupId, message) {
    this.io.to(`group-${groupId}`).emit('new-group-message', {
      groupId,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Broadcast an updated vote count for a poll message - separate event from
   * emitNewGroupMessage so clients can patch just that one message's poll state in place
   * instead of re-fetching or re-appending it as if it were a brand-new message.
   */
  emitGroupPollUpdate(groupId, message) {
    this.io.to(`group-${groupId}`).emit('group-poll-update', {
      groupId,
      message,
      timestamp: new Date()
    });
  }

  /**
   * Get connected users count for a match
   */
  getConnectedUsersCount(matchId) {
    const room = this.io.sockets.adapter.rooms.get(`match-${matchId}`);
    return room ? room.size : 0;
  }
}

module.exports = SocketManager;
