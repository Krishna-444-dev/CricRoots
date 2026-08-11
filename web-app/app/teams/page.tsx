'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface Player {
  _id: string;
  user: { _id: string; name: string } | string;
  specialization: string;
}

interface Team {
  _id: string;
  name: string;
  city: string;
  description?: string;
  captain: Player;
  players: Player[];
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTeams(data.teams);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Teams" action={<Link href="/teams/new" className={buttonVariants('primary')}>+ New Team</Link>} />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : teams.length === 0 ? (
        <EmptyState icon="👥" title="No teams yet" description="Create the first team for your club or tournament." action={<Link href="/teams/new" className={buttonVariants('primary')}>+ New Team</Link>} />
      ) : (
        <div className="space-y-3">
          {teams.map(team => (
            <Link key={team._id} href={`/teams/${team._id}`}>
              <Card hover>
                <h2 className="font-semibold text-ink">{team.name}</h2>
                <p className="text-sm text-ink-secondary mt-0.5">{team.city} · {team.players?.length ?? 0} players</p>
                {team.description && <p className="text-sm text-ink-muted mt-1">{team.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
