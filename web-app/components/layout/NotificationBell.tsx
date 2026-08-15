'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

// Polling interval for the unread-count badge. This app has no push infrastructure (see
// documentation/cricclubs-feature-roadmap.md's notifications backlog item) so a bell icon has
// to poll like everything else here does - matched to the match detail page's own 10s poll
// (web-app/app/match/[id]/page.tsx), the interval this codebase already treats as reasonable
// for "fresh enough without hammering the API".
const POLL_MS = 10000;
interface AppNotification {
  _id: string;
  type: 'match_live' | 'match_completed' | 'tournament_announcement';
  title: string;
  message: string;
  link: string;
  read: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const refreshUnreadCount = useCallback(async () => {
    const res = await apiFetch('/api/notifications/unread-count');
    const data = await res.json();
    if (data.success) setUnreadCount(data.count);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setNotifications([]);
      setOpen(false);
      return;
    }
    refreshUnreadCount();
    const interval = setInterval(refreshUnreadCount, POLL_MS);
    return () => clearInterval(interval);
  }, [user, refreshUnreadCount]);

  // Closes the dropdown on an outside click, same pattern Navbar.tsx already uses for its own
  // Compete/Community dropdowns.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      // The backend caps this at 50 server-side (notificationController.js's LIST_LIMIT) -
      // no client-side limit param needed.
      const res = await apiFetch('/api/notifications');
      const data = await res.json();
      if (data.success) setNotifications(data.notifications);
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next) fetchNotifications();
  };

  const markAllRead = async () => {
    await apiFetch('/api/notifications/read-all', { method: 'PATCH' });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const openNotification = async (n: AppNotification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
      apiFetch(`/api/notifications/${n._id}/read`, { method: 'PATCH' }).catch(() => {});
    }
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  if (!user) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={toggleOpen}
        className="relative p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-gold-500 text-[#241503] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-80 max-w-[90vw] rounded-lg border border-border bg-surface shadow-lg overflow-hidden z-50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border">
            <span className="text-sm font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-pitch-400 hover:text-pitch-300">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-6 text-center text-sm text-ink-muted">Loading...</div>
            ) : notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-ink-muted">No notifications yet.</div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n._id}
                  onClick={() => openNotification(n)}
                  className={`block w-full text-left px-3 py-3 border-b border-border last:border-b-0 hover:bg-surface-hover transition-colors ${
                    !n.read ? 'bg-pitch-500/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-pitch-400 shrink-0" />}
                    <div className={`min-w-0 ${n.read ? 'pl-4' : ''}`}>
                      <p className={`text-sm ${!n.read ? 'font-semibold text-ink' : 'font-medium text-ink-secondary'}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-ink-muted mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[11px] text-ink-muted mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
