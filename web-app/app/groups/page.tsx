'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface GroupSummary {
  _id: string;
  name: string;
  team: { _id: string; name: string } | null;
  members: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export default function GroupsPage() {
  const { user, token, isLoading } = useAuth();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch('/api/groups')
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setGroups(data.groups);
        } else {
          setError(data.message || 'Could not load groups');
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Could not reach the CricSync server');
        setLoading(false);
      });
  }, [token]);

  if (isLoading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to view your groups.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader
        title="My Groups"
        description="Group chats with your teams and squads."
        action={<Link href="/groups/new" className={buttonVariants('primary')}>+ New Group</Link>}
      />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : error ? (
        <p className="text-ink-secondary">{error}</p>
      ) : groups.length === 0 ? (
        <EmptyState
          icon="💬"
          title="No groups yet"
          description="Create a group to chat, poll, and share with your team or squad."
          action={<Link href="/groups/new" className={buttonVariants('primary')}>+ New Group</Link>}
        />
      ) : (
        <div className="space-y-3">
          {groups.map((g) => (
            <Link key={g._id} href={`/groups/${g._id}`}>
              <Card hover className="flex justify-between items-center">
                <div className="min-w-0">
                  <p className="font-semibold text-ink truncate">{g.name}</p>
                  <p className="text-sm text-ink-secondary">{g.members.length} member{g.members.length === 1 ? '' : 's'}</p>
                </div>
                {g.team && <Badge variant="neutral" className="shrink-0 ml-3">{g.team.name}</Badge>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
