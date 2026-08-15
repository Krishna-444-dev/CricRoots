'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface League {
  _id: string;
  name: string;
  description?: string;
  organizer: { _id: string; name: string };
}

interface Tournament {
  _id: string;
  name: string;
  format: string;
  status: string;
  venue: string;
  startDate: string;
  endDate: string;
}

export default function LeagueDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [league, setLeague] = useState<League | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leagues/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setLeague(data.league);
          setTournaments(data.tournaments);
        }
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!league) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">League not found.</p></main>;
  }

  // Both sides must be real, present values - a bare `user?.id === league.organizer?._id` reads
  // as true for a logged-out viewer on a league with no organizer populated, since undefined
  // === undefined (see the identical bug found and fixed on the match detail page).
  const isOrganizer = Boolean(user?.id) && Boolean(league.organizer?._id) && user!.id === league.organizer!._id;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink">{league.name}</h1>
          <p className="text-ink-secondary">Organized by {league.organizer?.name || 'Unknown'}</p>
        </div>
        {isOrganizer && (
          <Link href={`/tournaments?leagueId=${league._id}`} className={buttonVariants('primary', 'sm')}>
            + Create Tournament
          </Link>
        )}
      </div>
      {league.description && <p className="text-ink-secondary mb-6">{league.description}</p>}

      <h2 className="text-lg font-semibold text-ink mb-3">Tournaments ({tournaments.length})</h2>
      {tournaments.length === 0 ? (
        <EmptyState
          icon="🏏"
          title="No tournaments yet"
          description={isOrganizer ? 'Create the first tournament under this league.' : 'This league has no tournaments yet.'}
          action={isOrganizer ? <Link href={`/tournaments?leagueId=${league._id}`} className={buttonVariants('primary')}>+ Create Tournament</Link> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {tournaments.map(t => (
            <Link key={t._id} href={`/tournaments?tournamentId=${t._id}`}>
              <Card hover>
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-semibold text-ink">{t.name}</h3>
                  <span className="text-xs text-ink-secondary whitespace-nowrap">{t.status}</span>
                </div>
                <p className="text-sm text-ink-secondary mt-0.5">{t.format} · {t.venue}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
