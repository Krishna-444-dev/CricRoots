'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useChatSocket, ChatMessage } from '@/hooks/useChatSocket';

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
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-600 mb-4">You need to be logged in to view team chat.</p>
          <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  if (error) {
    return <main className="min-h-screen flex items-center justify-center p-8"><p className="text-gray-600">{error}</p></main>;
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
      setError('Could not reach the CricSync server');
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-lg font-bold text-gray-900">{teamName} · Team Chat</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.length === 0 ? (
          <p className="text-gray-400 text-center mt-8">No messages yet. Say hello to your team.</p>
        ) : (
          messages.map(m => (
            <div key={m._id} className={`flex ${m.sender._id === user.id ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-lg px-3 py-2 ${m.sender._id === user.id ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
                {m.sender._id !== user.id && (
                  <p className="text-xs font-medium text-gray-500 mb-0.5">{m.sender.name}</p>
                )}
                <p className="text-sm">{m.text}</p>
                <p className={`text-[10px] mt-1 ${m.sender._id === user.id ? 'text-blue-100' : 'text-gray-400'}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="bg-white border-t border-gray-200 p-4 flex gap-2 max-w-2xl mx-auto w-full">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message your team..."
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          Send
        </button>
      </form>
    </main>
  );
}
