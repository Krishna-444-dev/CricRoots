'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useChatSocket, ChatMessage } from '@/hooks/useChatSocket';
import Button from '@/components/ui/Button';

export default function TeamChatPage({ params }: { params: { id: string } }) {
  const { user, token, isLoading } = useAuth();
  const [teamName, setTeamName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      fetch(`/api/teams/${params.id}`).then(r => r.json()),
      apiFetch(`/api/teams/${params.id}/messages`).then(r => r.json()),
    ]).then(([teamData, messagesData]) => {
      if (teamData.success) setTeamName(teamData.team.name);
      if (messagesData.success) {
        setMessages(messagesData.messages);
      } else {
        setError(messagesData.message || 'Could not load chat');
      }
      setLoading(false);
    });
  }, [params.id, token]);

  useChatSocket({
    scope: 'team',
    id: params.id,
    token,
    onMessage: (message) => setMessages(prev => [...prev, message]),
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
          <p className="text-ink-secondary mb-4">You need to be logged in to view team chat.</p>
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
      const res = await apiFetch(`/api/teams/${params.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
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
        <h1 className="text-lg font-bold text-ink max-w-2xl mx-auto">{teamName} <span className="text-ink-muted font-normal">· Team Chat</span></h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto w-full scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-ink-muted text-center mt-8">No messages yet. Say hello to your team.</p>
        ) : (
          messages.map(m => (
            <div key={m._id} className={`flex ${m.sender._id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-xl px-3 py-2 ${m.sender._id === user.id ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface border border-border text-ink'}`}>
                {m.sender._id !== user.id && (
                  <p className="text-xs font-semibold text-ink-secondary mb-0.5">{m.sender.name}</p>
                )}
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
          placeholder="Message your team..."
          className="flex-1 min-w-0 px-3 py-2 bg-surface-alt border border-border-strong rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50 focus:border-pitch-500"
        />
        <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
      </form>
    </main>
  );
}
