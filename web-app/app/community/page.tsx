'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import TriviaCard from '@/components/community/TriviaCard';
import PollsSection from '@/components/community/PollsSection';

interface PlayerRef {
  _id: string;
  user?: { _id: string } | string;
}

interface MyTeam {
  _id: string;
  name: string;
  city: string;
  captain: PlayerRef | null;
  viceCaptain: PlayerRef | null;
  coaches: PlayerRef[];
}

interface MyTournament {
  _id: string;
  name: string;
  venue: string;
  organizer: { _id: string; name: string };
}

function playerUserId(p: PlayerRef | null | undefined): string | null {
  if (!p) return null;
  const u = p.user;
  if (!u) return null;
  return typeof u === 'string' ? u : u._id;
}

// Same "team admin" bar as teams/[id]/page.tsx (captain/vice-captain/coach) - who can create/
// close a poll for this team. Every `!!x &&` guard matters: a bare `user?.id === maybeUndefined`
// reads true for a logged-out viewer once both sides fail to resolve (see the real
// undefined === undefined auth-display bug fixed elsewhere this session).
function isTeamManager(team: MyTeam, userId: string | undefined): boolean {
  if (!userId) return false;
  const captainId = playerUserId(team.captain);
  if (!!captainId && captainId === userId) return true;
  const viceCaptainId = playerUserId(team.viceCaptain);
  if (!!viceCaptainId && viceCaptainId === userId) return true;
  return team.coaches.some((c) => {
    const coachId = playerUserId(c);
    return !!coachId && coachId === userId;
  });
}

export default function CommunityPage() {
  const { user } = useAuth();
  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [tournaments, setTournaments] = useState<MyTournament[] | null>(null);

  useEffect(() => {
    if (!user) {
      setTeams([]);
      setTournaments([]);
      return;
    }
    apiFetch('/api/teams/mine').then((r) => r.json()).then((data) => { if (data.success) setTeams(data.teams); });
    apiFetch('/api/tournaments/mine').then((r) => r.json()).then((data) => { if (data.success) setTournaments(data.tournaments); });
  }, [user]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="Community"
        description="Trivia, polls, and the rest of what's happening across your teams and tournaments."
      />

      <div className="mb-8">
        <TriviaCard />
      </div>

      {!user ? (
        <EmptyState
          icon="🗳️"
          title="Log in to see your polls"
          description="Polls are scoped to your own teams and tournaments - log in to create or vote in one."
        />
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">Your Teams</h2>
            {teams === null ? (
              <p className="text-sm text-ink-secondary">Loading...</p>
            ) : teams.length === 0 ? (
              <EmptyState
                icon="👥"
                title="You're not on a team yet"
                description="Join or create a team to start polling your teammates."
                action={<Link href="/teams" className="text-pitch-400 hover:text-pitch-300 text-sm font-medium">Browse Teams &rarr;</Link>}
              />
            ) : (
              <div className="space-y-5">
                {teams.map((team) => (
                  <Card key={team._id}>
                    <div className="flex items-center justify-between mb-3">
                      <Link href={`/teams/${team._id}`} className="font-semibold text-ink hover:text-pitch-400">
                        {team.name}
                      </Link>
                      <span className="text-xs text-ink-muted">{team.city}</span>
                    </div>
                    <PollsSection scope="team" scopeId={team._id} canManage={isTeamManager(team, user?.id)} />
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-3">Your Tournaments</h2>
            {tournaments === null ? (
              <p className="text-sm text-ink-secondary">Loading...</p>
            ) : tournaments.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="You're not part of a tournament yet"
                description="Tournaments you organize or play in will show up here."
                action={<Link href="/tournaments" className="text-pitch-400 hover:text-pitch-300 text-sm font-medium">Browse Tournaments &rarr;</Link>}
              />
            ) : (
              <div className="space-y-5">
                {tournaments.map((tournament) => {
                  const isOrganizer = Boolean(user?.id) && Boolean(tournament.organizer?._id) && tournament.organizer._id === user!.id;
                  return (
                    <Card key={tournament._id}>
                      <div className="flex items-center justify-between mb-3">
                        <Link href={`/tournaments?tournamentId=${tournament._id}`} className="font-semibold text-ink hover:text-pitch-400">
                          {tournament.name}
                        </Link>
                        <span className="text-xs text-ink-muted">{tournament.venue}</span>
                      </div>
                      <PollsSection scope="tournament" scopeId={tournament._id} canManage={isOrganizer} />
                    </Card>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
