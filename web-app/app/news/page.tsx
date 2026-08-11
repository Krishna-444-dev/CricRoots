'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';

interface NewsPost {
  _id: string;
  title: string;
  category: string;
  body: string;
  author: { name: string };
  createdAt: string;
}

export default function NewsPage() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const canPost = user && ['organizer', 'admin'].includes(user.role);

  useEffect(() => {
    fetch('/api/news')
      .then(r => r.json())
      .then(data => { if (data.success) setPosts(data.posts); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">News</h1>
          {canPost && (
            <Link href="/news/new" className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition">
              + New Post
            </Link>
          )}
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : posts.length === 0 ? (
          <p className="text-gray-500">No news yet.</p>
        ) : (
          <div className="space-y-3">
            {posts.map(p => (
              <Link key={p._id} href={`/news/${p._id}`} className="block bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <h2 className="text-lg font-medium text-gray-900">{p.title}</h2>
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap ml-2">{p.category}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {p.author?.name ?? 'Unknown'} · {new Date(p.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-700 mt-2 line-clamp-2">{p.body.slice(0, 160)}{p.body.length > 160 ? '...' : ''}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
