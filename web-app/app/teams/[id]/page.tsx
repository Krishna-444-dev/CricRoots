'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { inputClass, errorBoxClass } from '@/components/ui/formStyles';

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
  captain: PlayerDoc;
  players: PlayerDoc[];
}

function playerName(p: PlayerDoc): string {
  return typeof p.user === 'string' ? p._id : p.user.name;
}

export default function TeamDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [allPlayers, setAllPlayers] = useState<PlayerDoc[]>([]);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

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

  const captainUserId = typeof team.captain.user === 'string' ? team.captain.user : team.captain.user._id;
  const isCaptain = user?.id === captainUserId;
  const rosterIds = new Set(team.players.map(p => p._id));
  const candidates = allPlayers.filter(p => !rosterIds.has(p._id));

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
                {p._id === team.captain._id && <Badge variant="gold">Captain</Badge>}
              </span>
              <span className="text-sm text-ink-secondary">{p.specialization}</span>
            </li>
          ))}
        </ul>
      </Card>

      {isCaptain && (
        <Card>
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
    </main>
  );
}
