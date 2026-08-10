'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Teams</h1>
          <Link href="/teams/new" className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition">
            + New Team
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : teams.length === 0 ? (
          <p className="text-gray-500">No teams yet.</p>
        ) : (
          <div className="space-y-3">
            {teams.map(team => (
              <Link
                key={team._id}
                href={`/teams/${team._id}`}
                className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
              >
                <h2 className="text-lg font-medium text-gray-900">{team.name}</h2>
                <p className="text-sm text-gray-500">{team.city} · {team.players?.length ?? 0} players</p>
                {team.description && <p className="text-sm text-gray-600 mt-1">{team.description}</p>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
