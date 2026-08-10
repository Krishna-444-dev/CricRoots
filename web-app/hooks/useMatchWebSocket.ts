import { useEffect, useState, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

interface AIInsight {
  match_status: string;
  win_probability: number;
  tactical_advice: string;
  key_recommendations: {
    batsman: number;
    bowler: number;
  };
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
  const [connectedUsers, setConnectedUsers] = useState(0);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!enabled || !matchId || !token) {
      return;
    }

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    
    const newSocket = io(socketUrl, {
      auth: {
        token,
        userId
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling']
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
      setError('Connection error - retrying...');
    });

    // Match events
    newSocket.on('ai-insights', (data) => {
      if (data.insights.success) {
        setAiInsights(data.insights);
      }
    });

    newSocket.on('ball-recorded', (data) => {
      setBallRecorded(data.ball);
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

    newSocket.on('scorecard-update', (data) => {
      setMatchUpdate(data.scorecard);
    });

    newSocket.on('user-joined', (data) => {
      console.log('User joined:', data.userId);
      setConnectedUsers(prev => prev + 1);
    });

    newSocket.on('user-left', (data) => {
      console.log('User left:', data.userId);
      setConnectedUsers(prev => Math.max(0, prev - 1));
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
    connectedUsers,
    recordBall,
    updateMatch
  };
};

export default useMatchWebSocket;
