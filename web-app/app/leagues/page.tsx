'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface League {
  _id: string;
  name: string;
  description?: string;
  organizer: { _id: string; name: string };
}

function LeagueCard({ league }: { league: League }) {
  return (
    <Link href={`/leagues/${league._id}`}>
      <Card hover>
        <h2 className="font-semibold text-ink">{league.name}</h2>
        <p className="text-sm text-ink-secondary mt-0.5">Organized by {league.organizer?.name || 'Unknown'}</p>
        {league.description && <p className="text-sm text-ink-muted mt-1">{league.description}</p>}
      </Card>
    </Link>
  );
}

export default function LeaguesPage() {
  const { user, token } = useAuth();
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [myLeaguesLoading, setMyLeaguesLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<League[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!user || !token) {
      setMyLeaguesLoading(false);
      return;
    }
    apiFetch('/api/leagues/mine')
      .then(res => res.json())
      .then(data => { if (data.success) setMyLeagues(data.leagues); })
      .finally(() => setMyLeaguesLoading(false));
  }, [user, token]);

  // Every other league is search-only, never fetched or shown by default - a debounced request
  // fires only once the viewer actually types something, and clearing the box clears the results
  // rather than falling back to "show everything".
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      fetch(`/api/leagues?search=${encodeURIComponent(term)}`)
        .then(res => res.json())
        .then(data => { if (data.success) setSearchResults(data.leagues); })
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Leagues" action={<Link href="/leagues/new" className={buttonVariants('primary')}>+ New League</Link>} />

      {user && (
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">My Leagues</h2>
          {myLeaguesLoading ? (
            <p className="text-ink-secondary text-sm">Loading...</p>
          ) : myLeagues.length === 0 ? (
            <EmptyState
              icon="🏆"
              title="You're not part of any league yet"
              description="Leagues you organize or play in will show up here. Search below to find one to join, or create your own."
            />
          ) : (
            <div className="space-y-3">
              {myLeagues.map(league => <LeagueCard key={league._id} league={league} />)}
            </div>
          )}
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">Find a League</h2>
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search leagues by name..."
          className="w-full text-sm bg-surface-alt border border-border-strong rounded-lg px-3 py-2 text-ink mb-3"
        />
        {searching ? (
          <p className="text-ink-secondary text-sm">Searching...</p>
        ) : searchResults === null ? (
          <p className="text-ink-muted text-sm">Start typing to find a league by name.</p>
        ) : searchResults.length === 0 ? (
          <p className="text-ink-muted text-sm">No leagues match &quot;{searchTerm.trim()}&quot;.</p>
        ) : (
          <div className="space-y-3">
            {searchResults.map(league => <LeagueCard key={league._id} league={league} />)}
          </div>
        )}
      </div>
    </main>
  );
}
