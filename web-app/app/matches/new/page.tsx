'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

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
  const [pitchType, setPitchType] = useState('unknown');
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

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  if (!isLoading && !user) return null;

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
        body: JSON.stringify({ title, team1Id, team2Id, matchType, venue, pitchType, scheduledDate }),
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
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink mb-6">New Match</h1>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        {teams.length < 2 ? (
          <p className="text-sm text-ink-secondary">
            You need at least two teams before creating a match.{' '}
            <Link href="/teams/new" className="text-pitch-400 hover:underline">Create one here</Link>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="title" className={labelClass}>Title</label>
              <input type="text" id="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="team1" className={labelClass}>Team 1</label>
              <select id="team1" required value={team1Id} onChange={(e) => setTeam1Id(e.target.value)} className={inputClass}>
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="team2" className={labelClass}>Team 2</label>
              <select id="team2" required value={team2Id} onChange={(e) => setTeam2Id(e.target.value)} className={inputClass}>
                <option value="">Select team</option>
                {teams.map(t => <option key={t._id} value={t._id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="matchType" className={labelClass}>Match Type</label>
              <select id="matchType" value={matchType} onChange={(e) => setMatchType(e.target.value)} className={inputClass}>
                <option value="T20">T20</option>
                <option value="ODI">ODI</option>
                <option value="Test">Test</option>
                <option value="Friendly">Friendly</option>
              </select>
            </div>
            <div>
              <label htmlFor="venue" className={labelClass}>Venue</label>
              <input type="text" id="venue" required value={venue} onChange={(e) => setVenue(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="pitchType" className={labelClass}>Pitch Type (if known)</label>
              <select id="pitchType" value={pitchType} onChange={(e) => setPitchType(e.target.value)} className={`${inputClass} capitalize`}>
                <option value="unknown">Unknown</option>
                <option value="dry">Dry</option>
                <option value="green">Green</option>
                <option value="flat">Flat</option>
                <option value="dusty">Dusty</option>
              </select>
            </div>
            <div>
              <label htmlFor="scheduledDate" className={labelClass}>Date</label>
              <input type="datetime-local" id="scheduledDate" required value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={inputClass} />
            </div>
            <Button type="submit" disabled={isSubmitting} className="w-full">
              {isSubmitting ? 'Creating...' : 'Create Match'}
            </Button>
          </form>
        )}
      </Card>
    </main>
  );
}
