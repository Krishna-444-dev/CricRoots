'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  scheduledDate: string;
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  Live: 'live',
  Scheduled: 'info',
  Completed: 'neutral',
  Cancelled: 'danger',
};

export default function MatchesPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/matches')
      .then(res => res.json())
      .then(data => {
        if (data.success) setMatches(data.matches);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="Matches"
        description="Live and upcoming matches across all tournaments."
        action={<Link href="/matches/new" className={buttonVariants('primary')}>+ New Match</Link>}
      />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : matches.length === 0 ? (
        <EmptyState
          icon="🏏"
          title="No matches yet"
          description="Create the first match to get scoring."
          action={<Link href="/matches/new" className={buttonVariants('primary')}>+ New Match</Link>}
        />
      ) : (
        <div className="space-y-3">
          {matches.map(match => (
            <Card key={match._id} hover>
              <div className="flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-ink truncate">{match.title}</h2>
                  <p className="text-sm text-ink-secondary mt-0.5">
                    {match.team1?.name} <span className="text-ink-muted">vs</span> {match.team2?.name}
                  </p>
                  <p className="text-xs text-ink-muted mt-1">
                    {match.venue} · {new Date(match.scheduledDate).toLocaleDateString()}
                  </p>
                </div>
                <Badge variant={STATUS_VARIANT[match.status] ?? 'neutral'} pulse={match.status === 'Live'}>
                  {match.status}
                </Badge>
              </div>
              <div className="flex gap-4 mt-4 pt-3 border-t border-border">
                <Link href={`/match/${match._id}`} className="text-sm font-medium text-pitch-400 hover:text-pitch-300">
                  View Scorecard
                </Link>
                <Link href={`/match/${match._id}/score`} className="text-sm font-medium text-pitch-400 hover:text-pitch-300">
                  Score
                </Link>
                <Link href={`/match/${match._id}/scouting`} className="text-sm font-medium text-pitch-400 hover:text-pitch-300">
                  Scouting
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
