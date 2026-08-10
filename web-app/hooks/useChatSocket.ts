import { useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

export interface ChatMessage {
  _id: string;
  sender: { _id: string; name: string };
  text: string;
  createdAt: string;
}

interface UseChatSocketProps {
  scope: 'team' | 'tournament';
  id: string;
  token: string | null;
  onMessage: (message: ChatMessage) => void;
  enabled?: boolean;
}

export function useChatSocket({ scope, id, token, onMessage, enabled = true }: UseChatSocketProps) {
  useEffect(() => {
    if (!enabled || !id || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket: Socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit(`join-${scope}`, id);
    });

    socket.on('new-message', (data: { scope: string; id: string; message: ChatMessage }) => {
      if (data.scope === scope && data.id === id) {
        onMessage(data.message);
      }
    });

    return () => {
      socket.emit(`leave-${scope}`, id);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, id, token, enabled]);
}

export default useChatSocket;
