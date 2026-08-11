'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface Lesson {
  _id: string;
  title: string;
  category: string;
  difficulty: string;
  content: string;
  author: { _id: string; name: string };
  createdAt: string;
}

export default function LessonDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/lessons/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data.success) setLesson(data.lesson); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Delete this lesson?')) return;
    const res = await apiFetch(`/api/lessons/${params.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) router.push('/edtech');
  };

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!lesson) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Lesson not found.</p></main>;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/edtech" className="text-sm text-pitch-400 hover:underline">&larr; Back to lessons</Link>
      <Card padding="lg" className="mt-4">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h1 className="text-2xl font-bold text-ink">{lesson.title}</h1>
          <Badge variant="neutral" className="capitalize whitespace-nowrap">{lesson.difficulty}</Badge>
        </div>
        <p className="text-sm text-ink-secondary mb-6 capitalize">
          {lesson.category} · by {lesson.author?.name ?? 'Unknown'} · {new Date(lesson.createdAt).toLocaleDateString()}
        </p>
        <div className="text-ink-secondary whitespace-pre-wrap leading-relaxed">{lesson.content}</div>

        {user?.id === lesson.author?._id && (
          <button onClick={handleDelete} className="mt-6 text-sm text-wicket-500 hover:text-wicket-400 transition-colors">
            Delete lesson
          </button>
        )}
      </Card>
    </main>
  );
}
