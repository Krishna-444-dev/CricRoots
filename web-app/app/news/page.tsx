'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="News"
        description="Announcements and updates from organizers."
        action={canPost ? <Link href="/news/new" className={buttonVariants('primary')}>+ New Post</Link> : undefined}
      />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : posts.length === 0 ? (
        <EmptyState icon="📰" title="No news yet" />
      ) : (
        <div className="space-y-3">
          {posts.map(p => (
            <Link key={p._id} href={`/news/${p._id}`}>
              <Card hover>
                <div className="flex justify-between items-start gap-3">
                  <h2 className="font-semibold text-ink">{p.title}</h2>
                  <Badge variant="neutral">{p.category}</Badge>
                </div>
                <p className="text-sm text-ink-secondary mt-1">
                  {p.author?.name ?? 'Unknown'} · {new Date(p.createdAt).toLocaleDateString()}
                </p>
                <p className="text-sm text-ink-secondary mt-2 line-clamp-2">{p.body.slice(0, 160)}{p.body.length > 160 ? '...' : ''}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
