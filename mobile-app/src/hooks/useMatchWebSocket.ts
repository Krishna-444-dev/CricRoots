import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';
import { API_BASE_URL } from '../shared/api/apiClient';

// Socket.IO shares the same HTTP server/port as the REST API (see backend/src/index.js -
// socketManager attaches to the same server Express listens on), so the socket origin is just
// API_BASE_URL with its trailing /api path stripped - not a separately-resolved URL. Previously
// this read `process.env.REACT_APP_API_URL`, a Create React App convention that Metro never
// inlines (Expo only inlines `EXPO_PUBLIC_*`), so it silently always fell back to
// 'http://localhost:5000' - meaning "the phone itself" on a physical device, not this Mac,
// which is why the socket connection always failed there while REST calls (going through
// apiClient's correctly-resolved API_BASE_URL) worked fine.
const SOCKET_URL = API_BASE_URL.replace(/\/api\/?$/, '');

interface AIInsight {
  match_status: string;
  win_probability: number;
  tactical_advice: string;
}

interface BallData {
  ballNumber: number;
  batsmanId: string;
  bowlerId: string;
  runs: number;
  isWicket: boolean;
  wicketType?: string;
}

interface UseMatchWebSocketProps {
  matchId: string;
  userId: string;
  token: string;
  enabled?: boolean;
}

export const useMatchWebSocket = ({
  matchId,
  userId,
  token,
  enabled = true
}: UseMatchWebSocketProps) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [aiInsights, setAiInsights] = useState<AIInsight | null>(null);
  const [ballRecorded, setBallRecorded] = useState<BallData | null>(null);
  const [wicket, setWicket] = useState<any>(null);
  const [matchUpdate, setMatchUpdate] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !matchId || !token) {
      return;
    }

    const newSocket = io(SOCKET_URL, {
      auth: {
        token,
        userId
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setError(null);
      // Join the match room
      newSocket.emit('join-match', matchId);
    });

    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setError('Connection error');
    });

    // Match events
    newSocket.on('ai-insights', (data) => {
      if (data.insights.success) {
        setAiInsights(data.insights);
      }
    });

    newSocket.on('ball-recorded', (data) => {
      setBallRecorded(data.ball);
      // Also update match state if needed
      setMatchUpdate(data.matchState);
    });

    newSocket.on('wicket', (data) => {
      setWicket(data.wicket);
    });

    newSocket.on('match-update', (data) => {
      setMatchUpdate(data.data);
    });

    newSocket.on('match-status-change', (data) => {
      setMatchUpdate({ status: data.status });
    });

    newSocket.on('user-joined', (data) => {
      console.log('User joined:', data.userId);
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data.userId);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      newSocket.emit('leave-match', matchId);
      newSocket.disconnect();
    };
  }, [matchId, userId, token, enabled]);

  // Emit functions
  const recordBall = useCallback((ballData: BallData) => {
    if (socket && isConnected) {
      socket.emit('record-ball', ballData);
    }
  }, [socket, isConnected]);

  const updateMatch = useCallback((matchData: any) => {
    if (socket && isConnected) {
      socket.emit('update-match', matchData);
    }
  }, [socket, isConnected]);

  return {
    isConnected,
    error,
    aiInsights,
    ballRecorded,
    wicket,
    matchUpdate,
    recordBall,
    updateMatch
  };
};

export default useMatchWebSocket;
