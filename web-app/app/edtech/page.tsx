'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
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
  const { user } = useAuth();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);

  const [recommended, setRecommended] = useState<Lesson[]>([]);
  const [recReason, setRecReason] = useState('');
  const [recLoading, setRecLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const qs = category ? `?category=${category}` : '';
    fetch(`/api/lessons${qs}`)
      .then(r => r.json())
      .then(data => { if (data.success) setLessons(data.lessons); })
      .finally(() => setLoading(false));
  }, [category]);

  useEffect(() => {
    if (!user) {
      setRecommended([]);
      setRecLoading(false);
      return;
    }
    setRecLoading(true);
    apiFetch('/api/lessons/for-me')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setRecommended(data.lessons);
          setRecReason(data.reason);
        }
      })
      .finally(() => setRecLoading(false));
  }, [user]);

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="Learn Cricket"
        description="Community-written lessons for players and coaches."
        action={<Link href="/edtech/new" className={buttonVariants('primary')}>+ New Lesson</Link>}
      />

      {user && !recLoading && recommended.length > 0 && (
        <div className="mb-8 rounded-xl border border-gold-500/30 bg-gold-500/5 p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-gold-400 uppercase tracking-wide mb-1">Recommended for You</h2>
          <p className="text-sm text-ink-secondary mb-4">{recReason}</p>
          <div className="space-y-3">
            {recommended.map(l => (
              <Link key={l._id} href={`/edtech/${l._id}`}>
                <Card hover className="bg-surface">
                  <div className="flex justify-between items-start gap-3">
                    <h3 className="font-semibold text-ink">{l.title}</h3>
                    <Badge variant="neutral" className="capitalize">{l.difficulty}</Badge>
                  </div>
                  <p className="text-sm text-ink-secondary mt-1 capitalize">{l.category} · by {l.author?.name ?? 'Unknown'}</p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

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
