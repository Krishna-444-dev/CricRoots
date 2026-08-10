'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface Team {
  _id: string;
  name: string;
}

export default function NewMatchPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [title, setTitle] = useState('');
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [matchType, setMatchType] = useState('T20');
  const [venue, setVenue] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(data => {
        if (data.success) setTeams(data.teams);
      });
  }, []);

  if (!isLoading && !user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (team1Id && team1Id === team2Id) {
      setError('Team 1 and Team 2 must be different');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/matches', {
        method: 'POST',
        body: JSON.stringify({ title, team1Id, team2Id, matchType, venue, scheduledDate }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/match/${data.match._id}/score`);
      } else {
        setError(data.message || 'Could not create match');
      }
    } catch {
      setError('Could not reach the CricSync server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-sm bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">New Match</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">
            {error}
          </div>
        )}
        {teams.length < 2 ? (
          <p className="text-sm text-gray-600">
            You need at least two teams before creating a match. Create one at{' '}
            <a href="/teams/new" className="text-blue-600 hover:underline">/teams/new</a>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                type="text" id="title" required value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
            <div>
              <label htmlFor="team1" className="block text-sm font-medium text-gray-700 mb-1">Team 1</label>
              <select
                id="team1" required value={team1Id} onChange={(e) => setTeam1Id(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
              >
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="team2" className="block text-sm font-medium text-gray-700 mb-1">Team 2</label>
              <select
                id="team2" required value={team2Id} onChange={(e) => setTeam2Id(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
              >
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="matchType" className="block text-sm font-medium text-gray-700 mb-1">Match Type</label>
              <select
                id="matchType" value={matchType} onChange={(e) => setMatchType(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md"
              >
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                <option value="Test">Test</option>
                <option value="Friendly">Friendly</option>
              </select>
            </div>
            <div>
              <label htmlFor="venue" className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
              <input
                type="text" id="venue" required value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
            <div>
              <label htmlFor="scheduledDate" className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input
                type="datetime-local" id="scheduledDate" required value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
              />
            </div>
            <button
              type="submit" disabled={isSubmitting}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {isSubmitting ? 'Creating...' : 'Create Match'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
