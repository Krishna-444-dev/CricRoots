'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useDirectMessageSocket, DirectMessage } from '@/hooks/useDirectMessageSocket';
import Button from '@/components/ui/Button';

export default function DirectMessageThreadPage({ params }: { params: { userId: string } }) {
  const { user, token, isLoading } = useAuth();
  const [otherName, setOtherName] = useState('');
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/users/${params.userId}`).then(r => r.json()),
      apiFetch(`/api/messages/${params.userId}`).then(r => r.json()),
    ])
      .then(([userData, messagesData]) => {
        if (userData.success) setOtherName(userData.user.name);
        if (messagesData.success) {
          setMessages(messagesData.messages);
        } else {
          setError(messagesData.message || 'Could not load conversation');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Could not reach the CricRoots server');
        setLoading(false);
      });
  }, [params.userId, token]);

  useDirectMessageSocket({
    token,
    enabled: Boolean(token),
    onMessage: (message) => {
      if (message.sender._id === params.userId) {
        setMessages(prev => [...prev, message]);
      }
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (isLoading || loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to view messages.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  if (error) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8"><p className="text-ink-secondary">{error}</p></main>;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/messages/${params.userId}`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(prev => [...prev, data.message]);
        setText('');
      } else {
        setError(data.message || 'Could not send message');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="bg-surface border-b border-border p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/messages" className="text-ink-secondary hover:text-ink transition-colors" aria-label="Back to inbox">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <h1 className="text-lg font-bold text-ink">{otherName || 'Conversation'}</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto w-full scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-ink-muted text-center mt-8">No messages yet. Say hello.</p>
        ) : (
          messages.map(m => (
            <div key={m._id} className={`flex ${m.sender._id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-xl px-3 py-2 ${m.sender._id === user.id ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface border border-border text-ink'}`}>
                <p className="text-sm">{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.sender._id === user.id ? 'text-[#06170D]/60' : 'text-ink-muted'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-surface border-t border-border p-4 flex gap-2 max-w-2xl mx-auto w-full">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Message ${otherName || 'this player'}...`}
          className="flex-1 px-3 py-2 bg-surface-alt border border-border-strong rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50 focus:border-pitch-500"
        />
        <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
      </form>
    </main>
  );
}
