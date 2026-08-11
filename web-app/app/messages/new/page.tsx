'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string;
  specialization: string;
}

// Both populated ({_id,name}) and unpopulated (bare id string) shapes show up for Player.user
// depending on the endpoint - see web-app/app/groups/new/page.tsx's identical handling.
function playerUserId(p: PlayerDoc): string {
  return typeof p.user === 'string' ? p.user : p.user._id;
}

function playerDisplayName(p: PlayerDoc): string {
  return typeof p.user === 'string' ? p._id : p.user.name;
}

export default function NewMessagePage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [allPlayers, setAllPlayers] = useState<PlayerDoc[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/players')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAllPlayers(data.players);
        setLoading(false);
      });
  }, []);

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers
      .filter((p) => !user || playerUserId(p) !== user.id)
      .filter((p) => !q || playerDisplayName(p).toLowerCase().includes(q));
  }, [allPlayers, search, user]);

  if (isLoading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to message someone.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/messages" className="text-ink-secondary hover:text-ink transition-colors" aria-label="Back to messages">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <h1 className="text-2xl font-bold text-ink">New Message</h1>
      </div>

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search players..."
        autoFocus
        className="w-full px-3 py-2.5 mb-4 bg-surface-alt border border-border-strong rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50 focus:border-pitch-500"
      />

      {loading ? (
        <p className="text-ink-secondary">Loading players...</p>
      ) : filteredPlayers.length === 0 ? (
        <p className="text-ink-muted text-center mt-8">No players found.</p>
      ) : (
        <div className="space-y-2">
          {filteredPlayers.map((p) => (
            <Card
              key={p._id}
              hover
              className="cursor-pointer"
              onClick={() => router.push(`/messages/${playerUserId(p)}`)}
            >
              <p className="font-semibold text-ink">{playerDisplayName(p)}</p>
              <p className="text-sm text-ink-secondary">{p.specialization}</p>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
