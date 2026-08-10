'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  scheduledDate: string;
}

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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Matches</h1>
          <Link href="/matches/new" className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition">
            + New Match
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : matches.length === 0 ? (
          <p className="text-gray-500">No matches yet.</p>
        ) : (
          <div className="space-y-3">
            {matches.map(match => (
              <div key={match._id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">{match.title}</h2>
                    <p className="text-sm text-gray-500">
                      {match.team1?.name} vs {match.team2?.name} · {match.venue}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(match.scheduledDate).toLocaleDateString()} · {match.status}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Link href={`/match/${match._id}`} className="text-sm text-blue-600 hover:underline">
                      View
                    </Link>
                    <Link href={`/match/${match._id}/score`} className="text-sm text-blue-600 hover:underline">
                      Score
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
