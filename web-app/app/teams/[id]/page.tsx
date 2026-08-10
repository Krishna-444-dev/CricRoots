'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

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
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!team) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Team not found.</p></main>;
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
      setError('Could not reach the CricSync server');
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900">{team.name}</h1>
        <p className="text-gray-500 mb-6">{team.city}</p>
        {team.description && <p className="text-gray-600 mb-6">{team.description}</p>}

        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Roster ({team.players.length})</h2>
          <ul className="divide-y divide-gray-200">
            {team.players.map(p => (
              <li key={p._id} className="py-2 flex justify-between items-center">
                <span>
                  {playerName(p)}
                  {p._id === team.captain._id && <span className="ml-2 text-xs text-blue-600 font-medium">Captain</span>}
                </span>
                <span className="text-sm text-gray-500">{p.specialization}</span>
              </li>
            ))}
          </ul>
        </div>

        {isCaptain && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <h2 className="text-lg font-medium text-gray-900 mb-3">Add Player</h2>
            {error && (
              <div className="mb-3 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
                {error}
              </div>
            )}
            {candidates.length === 0 ? (
              <p className="text-sm text-gray-500">No other registered players available to add.</p>
            ) : (
              <form onSubmit={handleAddPlayer} className="flex gap-2">
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="">Select a player</option>
                  {candidates.map(p => (
                    <option key={p._id} value={p._id}>{playerName(p)} ({p.specialization})</option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isAdding || !selectedPlayerId}
                  className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
                >
                  Add
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
