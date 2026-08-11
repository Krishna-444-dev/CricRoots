'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useDirectMessageSocket } from '@/hooks/useDirectMessageSocket';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';

interface Conversation {
  user: { _id: string; name: string };
  lastMessage: { text: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
}

export default function MessagesInboxPage() {
  const { user, token, isLoading } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadConversations = useCallback(async () => {
    const res = await apiFetch('/api/messages/conversations');
    const data = await res.json();
    if (data.success) setConversations(data.conversations);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!token) return;
    loadConversations();
  }, [token, loadConversations]);

  // Refresh the inbox whenever a new DM comes in so the list, ordering, and unread
  // counts stay live without polling.
  useDirectMessageSocket({
    token,
    enabled: Boolean(token),
    onMessage: () => loadConversations(),
  });

  if (isLoading || loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to view your messages.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Messages" description="Your direct message conversations." />

      {conversations.length === 0 ? (
        <EmptyState icon="✉️" title="No conversations yet" description="Message a player from their profile to start a conversation." />
      ) : (
        <div className="space-y-3">
          {conversations.map(c => (
            <Link key={c.user._id} href={`/messages/${c.user._id}`}>
              <Card hover className="flex justify-between items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{c.user.name}</p>
                  <p className="text-sm text-ink-secondary truncate">
                    {c.lastMessage.fromMe ? 'You: ' : ''}{c.lastMessage.text}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0 ml-3">
                  <span className="text-xs text-ink-muted">
                    {new Date(c.lastMessage.createdAt).toLocaleDateString()}
                  </span>
                  {c.unreadCount > 0 && <Badge variant="success">{c.unreadCount}</Badge>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
