'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import PlayerStatsDashboard from '@/components/PlayerStatsDashboard';
import Card from '@/components/ui/Card';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface Profile {
  user: { _id: string; name: string; role: string; createdAt: string };
  followerCount: number;
  followingCount: number;
}

export default function ProfilePage({ params }: { params: { id: string } }) {
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [profileRes, playersRes, followersRes] = await Promise.all([
      fetch(`/api/users/${params.id}`).then(r => r.json()),
      fetch('/api/players').then(r => r.json()),
      currentUser ? fetch(`/api/users/${currentUser.id}/following`).then(r => r.json()) : Promise.resolve(null),
    ]);

    if (profileRes.success) setProfile(profileRes);

    if (playersRes.success) {
      const match = playersRes.players.find((p: any) => (typeof p.user === 'string' ? p.user : p.user._id) === params.id);
      if (match) setPlayerId(match._id);
    }

    if (followersRes?.success) {
      setIsFollowing(followersRes.following.some((u: any) => u._id === params.id));
    }

    setLoading(false);
  }, [params.id, currentUser]);

  useEffect(() => { load(); }, [load]);

  const toggleFollow = async () => {
    if (!currentUser || busy) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/users/${params.id}/follow`, { method: isFollowing ? 'DELETE' : 'POST' });
      const data = await res.json();
      if (data.success) {
        setIsFollowing(!isFollowing);
        setProfile(prev => prev ? { ...prev, followerCount: prev.followerCount + (isFollowing ? -1 : 1) } : prev);
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!profile) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">User not found.</p></main>;
  }

  const isSelf = currentUser?.id === params.id;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Card className="mb-6 flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-ink">{profile.user.name}</h1>
          <p className="text-sm text-ink-secondary capitalize">{profile.user.role}</p>
          <p className="text-sm text-ink-secondary mt-2">
            <span className="font-semibold text-ink">{profile.followerCount}</span> followers ·{' '}
            <span className="font-semibold text-ink">{profile.followingCount}</span> following
          </p>
        </div>
        {!isSelf && currentUser && (
          <div className="flex items-center gap-2">
            <Link href={`/messages/${params.id}`} className={buttonVariants('outline', 'sm')}>
              Message
            </Link>
            <button onClick={toggleFollow} disabled={busy} className={buttonVariants(isFollowing ? 'outline' : 'primary', 'sm')}>
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          </div>
        )}
      </Card>

      {playerId && <PlayerStatsDashboard playerId={playerId} />}
    </main>
  );
}
