import { useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

export interface DirectMessage {
  _id: string;
  sender: { _id: string; name: string };
  recipient: { _id: string; name: string };
  text: string;
  read: boolean;
  createdAt: string;
}

interface UseDirectMessageSocketProps {
  token: string | null;
  onMessage: (message: DirectMessage) => void;
  enabled?: boolean;
}

// Every authenticated socket connection auto-joins a personal `user-<userId>` room
// server-side on connect, so unlike useChatSocket (team/tournament chat) there's no
// join/leave event to emit here - we just listen for direct messages addressed to us.
export function useDirectMessageSocket({ token, onMessage, enabled = true }: UseDirectMessageSocketProps) {
  useEffect(() => {
    if (!enabled || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket: Socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socket.on('new-direct-message', (data: { message: DirectMessage; timestamp: string }) => {
      onMessage(data.message);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, enabled]);
}

export default useDirectMessageSocket;
