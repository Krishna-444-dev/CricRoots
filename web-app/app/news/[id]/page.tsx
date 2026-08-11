'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface NewsPost {
  _id: string;
  title: string;
  category: string;
  body: string;
  author: { _id: string; name: string };
  createdAt: string;
}

export default function NewsDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const router = useRouter();
  const [post, setPost] = useState<NewsPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/news/${params.id}`)
      .then(r => r.json())
      .then(data => { if (data.success) setPost(data.post); })
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDelete = async () => {
    if (!confirm('Delete this post?')) return;
    const res = await apiFetch(`/api/news/${params.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) router.push('/news');
  };

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!post) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Post not found.</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href="/news" className="text-sm text-blue-600 hover:underline">&larr; Back to news</Link>
        <div className="bg-white rounded-lg shadow-sm p-6 mt-4">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
            <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 whitespace-nowrap ml-2">{post.category}</span>
          </div>
          <p className="text-sm text-gray-500 mb-6">
            {post.author?.name ?? 'Unknown'} · {new Date(post.createdAt).toLocaleDateString()}
          </p>
          <div className="prose text-gray-800 whitespace-pre-wrap leading-relaxed">{post.body}</div>

          {user?.id === post.author?._id && (
            <button onClick={handleDelete} className="mt-6 text-sm text-red-600 hover:underline">
              Delete post
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
