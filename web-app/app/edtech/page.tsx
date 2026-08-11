'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

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
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="Learn Cricket"
        description="Community-written lessons for players and coaches."
        action={<Link href="/edtech/new" className={buttonVariants('primary')}>+ New Lesson</Link>}
      />

      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategory('')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${category === '' ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface-alt text-ink-secondary hover:text-ink'}`}
        >
          All
        </button>
        {CATEGORIES.map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${category === c ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface-alt text-ink-secondary hover:text-ink'}`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : lessons.length === 0 ? (
        <EmptyState icon="📘" title={`No lessons yet${category ? ` in ${category}` : ''}`} />
      ) : (
        <div className="space-y-3">
          {lessons.map(l => (
            <Link key={l._id} href={`/edtech/${l._id}`}>
              <Card hover>
                <div className="flex justify-between items-start gap-3">
                  <h2 className="font-semibold text-ink">{l.title}</h2>
                  <Badge variant="neutral" className="capitalize">{l.difficulty}</Badge>
                </div>
                <p className="text-sm text-ink-secondary mt-1 capitalize">{l.category} · by {l.author?.name ?? 'Unknown'}</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
