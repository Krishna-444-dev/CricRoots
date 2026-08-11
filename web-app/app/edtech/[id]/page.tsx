'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useRouter } from 'next/navigation';

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
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!lesson) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Lesson not found.</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/edtech" className="text-sm text-blue-600 hover:underline">&larr; Back to lessons</Link>
        <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{lesson.title}</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize whitespace-nowrap ml-2">{lesson.difficulty}</span>
          </div>
          <p className="text-sm text-gray-500 mb-6 capitalize">
            {lesson.category} · by {lesson.author?.name ?? 'Unknown'} · {new Date(lesson.createdAt).toLocaleDateString()}
          </p>
          <div className="prose text-gray-800 whitespace-pre-wrap leading-relaxed">{lesson.content}</div>

          {user?.id === lesson.author?._id && (
            <button onClick={handleDelete} className="mt-6 text-sm text-red-600 hover:underline">
              Delete lesson
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
