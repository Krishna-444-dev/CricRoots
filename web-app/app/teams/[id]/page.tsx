'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { inputClass, errorBoxClass } from '@/components/ui/formStyles';
import { resolveRefId, resolveRefName } from '@/lib/resolveRef';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string; email: string } | string;
  specialization: string;
  battingStyle: string;
  bowlingStyle: string;
}

interface Team {
  _id: string;
  name: string;
  city: string;
  description?: string;
  // A team's captain/viceCaptain can resolve to null server-side if the referenced Player
  // was deleted (a dangling ref, not just an unpopulated string) - captain being required at
  // creation time doesn't guarantee it stays populatable forever.
  captain: PlayerDoc | null;
  viceCaptain: PlayerDoc | null;
  coaches: PlayerDoc[];
  players: PlayerDoc[];
}

// `p` itself (not just `p.user`) can be null - a team's captain/viceCaptain/roster entry is a
// ref to a Player that may since have been deleted, which Mongoose resolves to null rather
// than omitting the field. Every caller here treats a null player as "removed" and shows a
// placeholder instead of crashing.
function playerName(p: PlayerDoc | null | undefined): string {
  if (!p) return 'Removed player';
  return resolveRefName(p.user, p._id);
}

function playerUserId(p: PlayerDoc | null | undefined): string | null {
  if (!p) return null;
  return resolveRefId(p.user);
}

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerDoc[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [selectedViceCaptainId, setSelectedViceCaptainId] = useState('');
  const [isSettingViceCaptain, setIsSettingViceCaptain] = useState(false);
  const [selectedCoachId, setSelectedCoachId] = useState('');
  const [isAddingCoach, setIsAddingCoach] = useState(false);
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [teamRes, playersRes] = await Promise.all([
      fetch(`/api/teams/${params.id}`),
      fetch('/api/players'),
    ]);
    const teamData = await teamRes.json();
    const playersData = await playersRes.json();
    if (teamData.success) setTeam(teamData.team);
    if (playersData.success) setAllPlayers(playersData.players);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!team) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Team not found.</p></main>;
  }

  const captainUserId = playerUserId(team.captain);
  const isCaptain = user?.id === captainUserId;
  const viceCaptainUserId = team.viceCaptain ? playerUserId(team.viceCaptain) : null;
  const isViceCaptain = !!viceCaptainUserId && user?.id === viceCaptainUserId;
  const isCoach = team.coaches.some(c => user?.id === playerUserId(c));
  // Admin-level: day-to-day roster/team management is delegable to vice-captain/coaches.
  // Structural actions (delete team, role assignment) stay isCaptain-only below.
  const isAdmin = isCaptain || isViceCaptain || isCoach;
  const rosterIds = new Set(team.players.map(p => p._id));
  const candidates = allPlayers.filter(p => !rosterIds.has(p._id));
  const coachIds = new Set(team.coaches.map(c => c._id));
  const viceCaptainCandidates = team.players.filter(p => p._id !== team.captain?._id);
  const coachCandidates = team.players.filter(p => p._id !== team.captain?._id && !coachIds.has(p._id));

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayerId) return;
    setError(null);
    setIsAdding(true);
    try {
      const res = await apiFetch(`/api/teams/${team._id}/add-player`, {
        method: 'POST',
        body: JSON.stringify({ playerId: selectedPlayerId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedPlayerId('');
        await load();
      } else {
        setError(data.message || 'Could not add player');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSetViceCaptain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedViceCaptainId) return;
    setRoleError(null);
    setIsSettingViceCaptain(true);
    try {
      const res = await apiFetch(`/api/teams/${team._id}/vice-captain`, {
        method: 'PUT',
        body: JSON.stringify({ playerId: selectedViceCaptainId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedViceCaptainId('');
        await load();
      } else {
        setRoleError(data.message || 'Could not set vice-captain');
      }
    } catch {
      setRoleError('Could not reach the CricRoots server');
    } finally {
      setIsSettingViceCaptain(false);
    }
  };

  const handleClearViceCaptain = async () => {
    setRoleError(null);
    setIsSettingViceCaptain(true);
    try {
      const res = await apiFetch(`/api/teams/${team._id}/vice-captain`, {
        method: 'PUT',
        body: JSON.stringify({ playerId: null }),
      });
      const data = await res.json();
      if (data.success) {
        await load();
      } else {
        setRoleError(data.message || 'Could not clear vice-captain');
      }
    } catch {
      setRoleError('Could not reach the CricRoots server');
    } finally {
      setIsSettingViceCaptain(false);
    }
  };

  const handleAddCoach = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoachId) return;
    setRoleError(null);
    setIsAddingCoach(true);
    try {
      const res = await apiFetch(`/api/teams/${team._id}/coaches`, {
        method: 'POST',
        body: JSON.stringify({ playerId: selectedCoachId }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedCoachId('');
        await load();
      } else {
        setRoleError(data.message || 'Could not add coach');
      }
    } catch {
      setRoleError('Could not reach the CricRoots server');
    } finally {
      setIsAddingCoach(false);
    }
  };

  const handleRemoveCoach = async (playerId: string) => {
    setRoleError(null);
    setRemovingCoachId(playerId);
    try {
      const res = await apiFetch(`/api/teams/${team._id}/coaches/${playerId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        await load();
      } else {
        setRoleError(data.message || 'Could not remove coach');
      }
    } catch {
      setRoleError('Could not reach the CricRoots server');
    } finally {
      setRemovingCoachId(null);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">{team.name}</h1>
          <p className="text-ink-secondary">{team.city}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <Link href={`/teams/${team._id}/chat`} className="text-pitch-400 hover:text-pitch-300 text-sm font-medium whitespace-nowrap">
            💬 Team Chat
          </Link>
          <Link href={`/groups/new?teamId=${team._id}`} className="text-ink-secondary hover:text-ink text-sm font-medium whitespace-nowrap">
            + Create a Group
          </Link>
        </div>
      </div>
      {team.description && <p className="text-ink-secondary mb-6">{team.description}</p>}

      <Card className="mb-6">
        <h2 className="text-lg font-semibold text-ink mb-3">Roster ({team.players.length})</h2>
        <ul className="divide-y divide-border">
          {team.players.map(p => (
            <li key={p._id} className="py-2.5 flex justify-between items-center">
              <span className="text-ink flex items-center gap-2">
                {playerName(p)}
                {p._id === team.captain?._id && <Badge variant="gold">Captain</Badge>}
                {team.viceCaptain && p._id === team.viceCaptain._id && <Badge variant="info">Vice Captain</Badge>}
                {coachIds.has(p._id) && <Badge variant="success">Coach</Badge>}
              </span>
              <span className="text-sm text-ink-secondary">{p.specialization}</span>
            </li>
          ))}
        </ul>
      </Card>

      {isAdmin && (
        <Card className={isCaptain ? 'mb-6' : ''}>
          <h2 className="text-lg font-semibold text-ink mb-3">Add Player</h2>
          {error && <div className={`${errorBoxClass} mb-3`}>{error}</div>}
          {candidates.length === 0 ? (
            <p className="text-sm text-ink-secondary">No other registered players available to add.</p>
          ) : (
            <form onSubmit={handleAddPlayer} className="flex gap-2">
              <select value={selectedPlayerId} onChange={(e) => setSelectedPlayerId(e.target.value)} className={`flex-1 ${inputClass}`}>
                <option value="">Select a player</option>
                {candidates.map(p => (
                  <option key={p._id} value={p._id}>{playerName(p)} ({p.specialization})</option>
                ))}
              </select>
              <Button type="submit" disabled={isAdding || !selectedPlayerId}>Add</Button>
            </form>
          )}
        </Card>
      )}

      {isCaptain && (
        <Card>
          <h2 className="text-lg font-semibold text-ink mb-3">Team Roles</h2>
          {roleError && <div className={`${errorBoxClass} mb-3`}>{roleError}</div>}

          <div className="mb-4">
            <h3 className="text-sm font-medium text-ink-secondary mb-2">Vice Captain</h3>
            {team.viceCaptain ? (
              <div className="flex items-center justify-between">
                <span className="text-ink">{playerName(team.viceCaptain)}</span>
                <Button type="button" variant="secondary" disabled={isSettingViceCaptain} onClick={handleClearViceCaptain}>
                  Remove
                </Button>
              </div>
            ) : viceCaptainCandidates.length === 0 ? (
              <p className="text-sm text-ink-secondary">No other roster players available to assign.</p>
            ) : (
              <form onSubmit={handleSetViceCaptain} className="flex gap-2">
                <select value={selectedViceCaptainId} onChange={(e) => setSelectedViceCaptainId(e.target.value)} className={`flex-1 ${inputClass}`}>
                  <option value="">Select a player</option>
                  {viceCaptainCandidates.map(p => (
                    <option key={p._id} value={p._id}>{playerName(p)}</option>
                  ))}
                </select>
                <Button type="submit" disabled={isSettingViceCaptain || !selectedViceCaptainId}>Set</Button>
              </form>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-ink-secondary mb-2">Coaches</h3>
            {team.coaches.length > 0 && (
              <ul className="divide-y divide-border mb-3">
                {team.coaches.map(c => (
                  <li key={c._id} className="py-2 flex justify-between items-center">
                    <span className="text-ink">{playerName(c)}</span>
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={removingCoachId === c._id}
                      onClick={() => handleRemoveCoach(c._id)}
                    >
                      {removingCoachId === c._id ? 'Removing...' : 'Remove'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {coachCandidates.length === 0 ? (
              <p className="text-sm text-ink-secondary">No other roster players available to add as coach.</p>
            ) : (
              <form onSubmit={handleAddCoach} className="flex gap-2">
                <select value={selectedCoachId} onChange={(e) => setSelectedCoachId(e.target.value)} className={`flex-1 ${inputClass}`}>
                  <option value="">Select a player</option>
                  {coachCandidates.map(p => (
                    <option key={p._id} value={p._id}>{playerName(p)}</option>
                  ))}
                </select>
                <Button type="submit" disabled={isAddingCoach || !selectedCoachId}>Add</Button>
              </form>
            )}
          </div>
        </Card>
      )}
    </main>
  );
}
