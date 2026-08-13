'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

const SPECIALIZATIONS = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'];
const BATTING_STYLES = ['Right-hand', 'Left-hand'];
const BOWLING_STYLES = ['None', 'Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin'];

// Standalone player-profile completion for an EXISTING logged-in user - distinct from
// PlayerRegistrationForm.tsx, which is a full account-creation wizard (name/email/password
// plus cricket info) used only at signup. There was previously no way for a user who already
// has an account but no linked Player document (e.g. registered via mobile, which doesn't
// collect this, or - as found in practice - had their Player record removed some other way)
// to complete it afterward; every flow that required a player profile (creating a team, etc.)
// just dead-ended on a plain error message. This is that missing self-serve path, reachable
// from any of those error messages via a real link, not just referenced in prose.
export default function CompleteProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading } = useAuth();

  const [checking, setChecking] = useState(true);
  const [alreadyHasProfile, setAlreadyHasProfile] = useState(false);
  const [specialization, setSpecialization] = useState('');
  const [battingStyle, setBattingStyle] = useState('');
  const [bowlingStyle, setBowlingStyle] = useState('None');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/players/me/profile')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setAlreadyHasProfile(true);
      })
      .finally(() => setChecking(false));
  }, [user]);

  if (isLoading || checking || !user) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  const redirectTo = searchParams.get('redirect') || `/network/${user.id}`;

  if (alreadyHasProfile) {
    return (
      <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
        <Card padding="lg" className="w-full max-w-sm text-center">
          <p className="text-ink-secondary mb-4">You already have a player profile set up.</p>
          <Button onClick={() => router.push(redirectTo)}>Continue</Button>
        </Card>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!specialization || !battingStyle) {
      setError('Please choose a specialization and batting style.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/players/register', {
        method: 'POST',
        body: JSON.stringify({ specialization, battingStyle, bowlingStyle }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(redirectTo);
      } else {
        setError(data.message || 'Could not create your player profile');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-ink mb-2">Complete Your Player Profile</h1>
        <p className="text-sm text-ink-secondary mb-6">
          A few cricket details needed before you can create a team, join a match, or show up in career stats.
        </p>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="specialization" className={labelClass}>Specialization</label>
            <select id="specialization" required value={specialization} onChange={(e) => setSpecialization(e.target.value)} className={inputClass}>
              <option value="" disabled>Select...</option>
              {SPECIALIZATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="battingStyle" className={labelClass}>Batting Style</label>
            <select id="battingStyle" required value={battingStyle} onChange={(e) => setBattingStyle(e.target.value)} className={inputClass}>
              <option value="" disabled>Select...</option>
              {BATTING_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="bowlingStyle" className={labelClass}>Bowling Style</label>
            <select id="bowlingStyle" value={bowlingStyle} onChange={(e) => setBowlingStyle(e.target.value)} className={inputClass}>
              {BOWLING_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? 'Saving...' : 'Complete Profile'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
