'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

const CATEGORIES = ['general', 'tournament-update', 'club-news', 'tips'];

export default function NewNewsPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && (!user || !['organizer', 'admin'].includes(user.role))) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <p className="text-ink-secondary">Only organizers and admins can publish news posts.</p>
      </main>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/news', {
        method: 'POST',
        body: JSON.stringify({ title, category, body }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/news/${data.post._id}`);
      } else {
        setError(data.message || 'Could not create post');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-ink mb-6">New News Post</h1>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Body</label>
            <textarea required rows={8} value={body} onChange={(e) => setBody(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Publishing...' : 'Publish Post'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
