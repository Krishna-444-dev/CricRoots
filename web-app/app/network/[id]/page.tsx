'use client';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import PlayerStatsDashboard from '@/components/PlayerStatsDashboard';

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
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!profile) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">User not found.</p></main>;
  }

  const isSelf = currentUser?.id === params.id;

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6 flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{profile.user.name}</h1>
            <p className="text-sm text-gray-500 capitalize">{profile.user.role}</p>
            <p className="text-sm text-gray-600 mt-2">
              <span className="font-medium">{profile.followerCount}</span> followers ·{' '}
              <span className="font-medium">{profile.followingCount}</span> following
            </p>
          </div>
          {!isSelf && currentUser && (
            <button
              onClick={toggleFollow}
              disabled={busy}
              className={`text-sm px-4 py-2 rounded-md transition disabled:opacity-50 ${
                isFollowing ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>

        {playerId && <PlayerStatsDashboard playerId={playerId} />}
      </div>
    </main>
  );
}
