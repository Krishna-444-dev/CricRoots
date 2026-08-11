import { useEffect } from 'react';
import io, { Socket } from 'socket.io-client';

export interface GroupMessageSender {
  _id: string;
  name: string;
}

export interface GroupPollOption {
  _id: string;
  text: string;
  votes: GroupMessageSender[];
}

export interface GroupMessage {
  _id: string;
  group: string;
  sender: GroupMessageSender;
  type: 'text' | 'poll' | 'image' | 'video';
  text?: string;
  poll?: {
    question: string;
    allowMultiple: boolean;
    options: GroupPollOption[];
  };
  attachment?: {
    url: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  };
  createdAt: string;
}

interface UseGroupSocketProps {
  groupId: string;
  token: string | null;
  onNewMessage: (message: GroupMessage) => void;
  onPollUpdate: (message: GroupMessage) => void;
  enabled?: boolean;
}

// Groups use the join/leave room pattern like team/tournament chat (useChatSocket), but with
// two distinct events: `new-group-message` for brand-new text/poll/attachment messages, and
// `group-poll-update` specifically when an existing poll's vote counts change (a vote is not a
// new message - the caller should patch the existing message in place, not append it).
export function useGroupSocket({ groupId, token, onNewMessage, onPollUpdate, enabled = true }: UseGroupSocketProps) {
  useEffect(() => {
    if (!enabled || !groupId || !token) return;

    const socketUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';
    const socket: Socket = io(socketUrl, {
      auth: { token },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      socket.emit('join-group', groupId);
    });

    socket.on('new-group-message', (data: { groupId: string; message: GroupMessage }) => {
      if (data.groupId === groupId) {
        onNewMessage(data.message);
      }
    });

    socket.on('group-poll-update', (data: { groupId: string; message: GroupMessage }) => {
      if (data.groupId === groupId) {
        onPollUpdate(data.message);
      }
    });

    return () => {
      socket.emit('leave-group', groupId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, token, enabled]);
}

export default useGroupSocket;
