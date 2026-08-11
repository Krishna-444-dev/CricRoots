'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

export default function NewTeamPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  if (!isLoading && !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/teams', {
        method: 'POST',
        body: JSON.stringify({ name, city, description }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/teams/${data.team._id}`);
      } else {
        setError(data.message || 'Could not create team');
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
        <h1 className="text-2xl font-bold text-ink mb-2">New Team</h1>
        <p className="text-sm text-ink-secondary mb-6">You&apos;ll automatically be set as captain.</p>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className={labelClass}>Team Name</label>
            <input type="text" id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="city" className={labelClass}>City</label>
            <input type="text" id="city" required value={city} onChange={(e) => setCity(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={inputClass} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Creating...' : 'Create Team'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
