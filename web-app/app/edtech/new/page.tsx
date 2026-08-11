'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

const CATEGORIES = ['batting', 'bowling', 'fielding', 'fitness', 'rules', 'strategy'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function NewLessonPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('batting');
  const [difficulty, setDifficulty] = useState('beginner');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isLoading && !user) {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/lessons', {
        method: 'POST',
        body: JSON.stringify({ title, category, difficulty, content }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/edtech/${data.lesson._id}`);
      } else {
        setError(data.message || 'Could not create lesson');
      }
    } catch {
      setError('Could not reach the CricSync server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-ink mb-6">New Lesson</h1>
        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelClass}>Title</label>
            <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} capitalize`}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={`${inputClass} capitalize`}>
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Content</label>
            <textarea required rows={10} value={content} onChange={(e) => setContent(e.target.value)} className={inputClass} />
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Publishing...' : 'Publish Lesson'}
          </Button>
        </form>
      </Card>
    </main>
  );
}
