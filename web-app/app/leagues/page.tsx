'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/leagues')
      .then(res => res.json())
      .then(data => {
        if (data.success) setLeagues(data.leagues);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Leagues" action={<Link href="/leagues/new" className={buttonVariants('primary')}>+ New League</Link>} />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : leagues.length === 0 ? (
        <EmptyState icon="🏆" title="No leagues yet" description="Create a league to organize multiple tournaments/seasons under one umbrella." action={<Link href="/leagues/new" className={buttonVariants('primary')}>+ New League</Link>} />
      ) : (
        <div className="space-y-3">
          {leagues.map(league => (
            <Link key={league._id} href={`/leagues/${league._id}`}>
              <Card hover>
                <h2 className="font-semibold text-ink">{league.name}</h2>
                <p className="text-sm text-ink-secondary mt-0.5">Organized by {league.organizer?.name || 'Unknown'}</p>
                {league.description && <p className="text-sm text-ink-muted mt-1">{league.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
