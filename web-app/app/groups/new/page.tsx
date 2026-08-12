'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string;
  specialization: string;
}

interface TeamDoc {
  _id: string;
  name: string;
  city: string;
  captain: PlayerDoc;
  players: PlayerDoc[];
}

// Both populated ({_id,name}) and unpopulated (bare id string) shapes show up for Player.user
// depending on the endpoint - see web-app/app/teams/page.tsx's identical handling. Either way,
// this returns the underlying User id, which is all group membership needs.
function playerUserId(p: PlayerDoc): string {
  return typeof p.user === 'string' ? p.user : p.user._id;
}

function playerDisplayName(p: PlayerDoc): string {
  return typeof p.user === 'string' ? p._id : p.user.name;
}

export default function NewGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [allPlayers, setAllPlayers] = useState<PlayerDoc[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    Promise.all([
      fetch('/api/teams').then((r) => r.json()),
      fetch('/api/players').then((r) => r.json()),
    ]).then(([teamsData, playersData]) => {
      if (teamsData.success) setTeams(teamsData.teams);
      if (playersData.success) setAllPlayers(playersData.players);
      setLoading(false);
    });
  }, []);

  // Preselect a team passed via ?teamId= (entry point from a team's detail page).
  useEffect(() => {
    const teamId = searchParams.get('teamId');
    if (teamId) setSelectedTeamId(teamId);
  }, [searchParams]);

  const myTeams = useMemo(() => {
    if (!user) return [];
    return teams.filter((t) => playerUserId(t.captain) === user.id || t.players.some((p) => playerUserId(p) === user.id));
  }, [teams, user]);

  const selectedTeam = teams.find((t) => t._id === selectedTeamId) || null;

  const filteredPlayers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allPlayers
      .filter((p) => !user || playerUserId(p) !== user.id)
      .filter((p) => !q || playerDisplayName(p).toLowerCase().includes(q));
  }, [allPlayers, search, user]);

  const prefillFromTeamRoster = () => {
    if (!selectedTeam) return;
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      selectedTeam.players.forEach((p) => {
        const uid = playerUserId(p);
        if (!user || uid !== user.id) next.add(uid);
      });
      return next;
    });
  };

  const toggleMember = (uid: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  if (isLoading || (!isLoading && !user)) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/groups', {
        method: 'POST',
        body: JSON.stringify({
          name,
          teamId: selectedTeamId || undefined,
          memberIds: [...selectedMemberIds],
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/groups/${data.group._id}`);
      } else {
        setError(data.message || 'Could not create group');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card padding="lg">
        <h1 className="text-2xl font-bold text-ink mb-2">New Group</h1>
        <p className="text-sm text-ink-secondary mb-6">You&apos;ll be the group creator and can manage it afterward.</p>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}

        {loading ? (
          <p className="text-ink-secondary">Loading...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="name" className={labelClass}>Group Name</label>
              <input type="text" id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Weekend Warriors" />
            </div>

            <div>
              <label htmlFor="team" className={labelClass}>Tag to a team (optional)</label>
              <select id="team" value={selectedTeamId} onChange={(e) => setSelectedTeamId(e.target.value)} className={inputClass}>
                <option value="">No team</option>
                {myTeams.map((t) => (
                  <option key={t._id} value={t._id}>{t.name}</option>
                ))}
              </select>
              {selectedTeam && (
                <button
                  type="button"
                  onClick={prefillFromTeamRoster}
                  className="mt-2 text-sm text-pitch-400 hover:text-pitch-300 hover:underline"
                >
                  + Add {selectedTeam.name}&apos;s roster as members
                </button>
              )}
            </div>

            <div>
              <label className={labelClass}>Members ({selectedMemberIds.size} selected)</label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search players..."
                className={`${inputClass} mb-2`}
              />
              <div className="max-h-64 overflow-y-auto border border-border-strong rounded-lg divide-y divide-border scrollbar-thin">
                {filteredPlayers.length === 0 ? (
                  <p className="text-sm text-ink-muted p-3">No players found.</p>
                ) : (
                  filteredPlayers.map((p) => {
                    const uid = playerUserId(p);
                    const checked = selectedMemberIds.has(uid);
                    return (
                      <label key={p._id} className="flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-surface-hover">
                        <span className="text-sm text-ink">{playerDisplayName(p)}</span>
                        <input type="checkbox" checked={checked} onChange={() => toggleMember(uid)} className="accent-pitch-500" />
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting || !name.trim()} className="w-full">
              {isSubmitting ? 'Creating...' : 'Create Group'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
