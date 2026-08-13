'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

// Global floating help widget - app-navigation questions and general cricket rules for
// now. Tournament-specific house-rules grounding (Tournament.houseRules, already wired
// up backend-side) is a deliberate fast-follow: tournament detail is client-state
// inside TournamentManager.tsx rather than its own URL route, so scoping this widget to
// "the tournament currently being viewed" needs a shared context that doesn't exist yet
// - not guessed at here to avoid wiring into unfamiliar component internals.
export default function AssistantWidget() {
  const { user, token } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/assistant/status')
      .then((r) => r.json())
      .then((d) => { if (d.success) setConfigured(d.configured); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!user || !token || !configured) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const history = messages.slice(-10);
    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch('/api/assistant/ask', {
        method: 'POST',
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Something went wrong');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the assistant');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="w-[22rem] max-w-[calc(100vw-2.5rem)] h-[28rem] max-h-[calc(100vh-8rem)] bg-surface border border-border rounded-xl shadow-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-alt">
            <div>
              <p className="text-sm font-semibold text-ink">CricRoots Assistant</p>
              <p className="text-xs text-ink-muted">App help &amp; cricket rules</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close assistant"
              className="text-ink-muted hover:text-ink transition-colors text-lg leading-none"
            >
              &times;
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && (
              <p className="text-xs text-ink-muted text-center mt-6 px-4">
                Ask how to use a feature, or a cricket rules question - I&apos;ll answer from what&apos;s
                actually in the app, not guess.
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-pitch-500 text-white'
                      : 'bg-surface-alt text-ink border border-border'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-surface-alt border border-border rounded-lg px-3 py-2 text-sm text-ink-muted">
                  Thinking...
                </div>
              </div>
            )}
            {error && (
              <p className="text-xs text-wicket-400 text-center px-2">{error}</p>
            )}
          </div>

          <div className="flex items-end gap-2 p-3 border-t border-border">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              rows={1}
              maxLength={2000}
              className="flex-1 resize-none bg-surface-alt border border-border-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="bg-pitch-500 hover:bg-pitch-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg px-3 py-2 transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        className="w-12 h-12 rounded-full bg-pitch-500 hover:bg-pitch-600 text-white shadow-card flex items-center justify-center text-xl transition-colors"
      >
        {open ? '✕' : '\u{1F3CF}'}
      </button>
    </div>
  );
}
