'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Lesson {
  _id: string;
  title: string;
  category: string;
  difficulty: string;
  author: { name: string };
  createdAt: string;
}

const CATEGORIES = ['batting', 'bowling', 'fielding', 'fitness', 'rules', 'strategy'];

export default function EdtechPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = category ? `?category=${category}` : '';
    fetch(`/api/lessons${qs}`)
      .then(r => r.json())
      .then(data => { if (data.success) setLessons(data.lessons); })
      .finally(() => setLoading(false));
  }, [category]);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Learn Cricket</h1>
          <Link href="/edtech/new" className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition">
            + New Lesson
          </Link>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1 rounded-full text-sm font-medium ${category === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${category === c ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              {c}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : lessons.length === 0 ? (
          <p className="text-gray-500">No lessons yet{category ? ` in ${category}` : ''}.</p>
        ) : (
          <div className="space-y-3">
            {lessons.map(l => (
              <Link
                key={l._id}
                href={`/edtech/${l._id}`}
                className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-medium text-gray-900">{l.title}</h2>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">{l.difficulty}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1 capitalize">{l.category} · by {l.author?.name ?? 'Unknown'}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
