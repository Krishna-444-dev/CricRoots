'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string;
  specialization: string;
}

export default function NetworkPage() {
  const { user, token } = useAuth();
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
        setFollowingIds(new Set(followingData.following.map((u: any) => u._id)));
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
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Network</h1>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : players.length === 0 ? (
          <p className="text-gray-500">No registered players yet.</p>
        ) : (
          <div className="space-y-3">
            {players.map(p => {
              const uid = typeof p.user === 'string' ? p.user : p.user._id;
              const name = typeof p.user === 'string' ? p._id : p.user.name;
              const isSelf = user?.id === uid;
              const isFollowing = followingIds.has(uid);
              return (
                <div key={p._id} className="bg-white rounded-lg shadow-sm p-4 flex justify-between items-center">
                  <div>
                    <Link href={`/network/${uid}`} className="font-medium text-gray-900 hover:underline">
                      {name}
                    </Link>
                    <p className="text-sm text-gray-500">{p.specialization}</p>
                  </div>
                  {!isSelf && user && (
                    <button
                      onClick={() => toggleFollow(uid)}
                      disabled={busyId === uid}
                      className={`text-sm px-3 py-1.5 rounded-md transition disabled:opacity-50 ${
                        isFollowing ? 'border border-gray-300 text-gray-700 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
