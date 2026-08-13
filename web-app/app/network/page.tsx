'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';
import { resolveRefId, resolveRefName } from '@/lib/resolveRef';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string | null;
  specialization: string;
}

export default function NetworkPage() {
  const { user } = useAuth();
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const loads: Promise<any>[] = [fetch('/api/players').then(r => r.json())];
    if (user) loads.push(fetch(`/api/users/${user.id}/following`).then(r => r.json()));

    Promise.all(loads).then(([playersData, followingData]) => {
      if (playersData.success) setPlayers(playersData.players);
      if (followingData?.success) {
        // A followed user can have been deleted since - populate resolves that entry to null
        // rather than dropping it from the array.
        setFollowingIds(new Set(followingData.following.filter((u: any) => u).map((u: any) => u._id)));
      }
      setLoading(false);
    });
  }, [user]);

  const toggleFollow = async (targetUserId: string) => {
    if (!user || busyId) return;
    setBusyId(targetUserId);
    const isFollowing = followingIds.has(targetUserId);
    try {
      const res = await apiFetch(`/api/users/${targetUserId}/follow`, { method: isFollowing ? 'DELETE' : 'POST' });
      const data = await res.json();
      if (data.success) {
        setFollowingIds(prev => {
          const next = new Set(prev);
          if (isFollowing) next.delete(targetUserId); else next.add(targetUserId);
          return next;
        });
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Network" description="Find and follow players in your local cricket scene." />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : players.length === 0 ? (
        <EmptyState icon="🤝" title="No registered players yet" />
      ) : (
        <div className="space-y-3">
          {players.filter(p => resolveRefId(p.user) !== null).map(p => {
            const uid = resolveRefId(p.user) as string; // filtered above, always non-null here
            const name = resolveRefName(p.user, p._id);
            const isSelf = user?.id === uid;
            const isFollowing = followingIds.has(uid);
            return (
              <Card key={p._id} className="flex justify-between items-center">
                <div>
                  <Link href={`/network/${uid}`} className="font-semibold text-ink hover:text-pitch-400 transition-colors">
                    {name}
                  </Link>
                  <p className="text-sm text-ink-secondary">{p.specialization}</p>
                </div>
                {!isSelf && user && (
                  <button
                    onClick={() => toggleFollow(uid)}
                    disabled={busyId === uid}
                    className={buttonVariants(isFollowing ? 'outline' : 'primary', 'sm')}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
