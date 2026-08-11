'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">New Lesson</h1>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md capitalize">
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className="w-full px-3 py-3 border border-gray-300 rounded-md capitalize">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
            <textarea
              required rows={10} value={content} onChange={(e) => setContent(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-base"
            />
          </div>
          <button
            type="submit" disabled={isSubmitting}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {isSubmitting ? 'Publishing...' : 'Publish Lesson'}
          </button>
        </form>
      </div>
    </main>
  );
}
