'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';
import { useDirectMessageSocket } from '@/hooks/useDirectMessageSocket';
import { buttonVariants } from '@/components/ui/buttonStyles';
import NotificationBell from './NotificationBell';

type NavLink = { href: string; label: string };
type NavEntry = NavLink | { label: string; items: NavLink[] };

// Grouped so the top-level bar stays short - a flat 12-link row was overflowing the viewport
// at normal desktop widths. "Compete" is the structured-play surfaces, "Community" is
// people/content discovery (Groups here means group chats, not tournament groups - it belongs
// here, not in Compete). Calendar/Market/Predict stay top-level since they're single
// destinations, not categories, and each is a distinct enough surface to not bury.
const NAV_ENTRIES: NavEntry[] = [
  { label: 'Compete', items: [
    { href: '/matches', label: 'Matches' },
    { href: '/tournaments', label: 'Tournaments' },
    { href: '/leagues', label: 'Leagues' },
    { href: '/teams', label: 'Teams' },
  ] },
  { href: '/calendar', label: 'Calendar' },
  { label: 'Community', items: [
    { href: '/players', label: 'Players' },
    { href: '/network', label: 'Network' },
    { href: '/groups', label: 'Groups' },
    { href: '/news', label: 'News' },
    { href: '/edtech', label: 'Learn' },
    { href: '/community', label: 'Trivia & Polls' },
  ] },
  { href: '/marketplace', label: 'Market' },
  { href: '/predictions/leaderboard', label: 'Predict' },
];
const NAV_LINKS: NavLink[] = NAV_ENTRIES.flatMap((e) => ('items' in e ? e.items : [e]));

export default function Navbar() {
  const pathname = usePathname();
  const { user, token, isLoading, logout } = useAuth();
  const { items } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const navRef = useRef<HTMLElement>(null);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const isGroupActive = (items: NavLink[]) => items.some((i) => isActive(i.href));

  // Closes an open dropdown on outside click or route change, so it never lingers after the
  // user has clearly moved on.
  useEffect(() => {
    if (!openGroup) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpenGroup(null);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [openGroup]);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  const refreshUnreadCount = useCallback(async () => {
    const res = await apiFetch('/api/messages/unread-count');
    const data = await res.json();
    if (data.success) setUnreadCount(data.count);
  }, []);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    refreshUnreadCount();
  }, [user, refreshUnreadCount]);

  // Live-updates the badge the moment a new DM arrives, instead of polling.
  useDirectMessageSocket({
    token,
    enabled: Boolean(user && token),
    onMessage: () => refreshUnreadCount(),
  });

  return (
    <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur border-b border-border">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-extrabold text-lg text-ink shrink-0">
            <span className="text-2xl leading-none">🏏</span>
            <span>Cric<span className="text-pitch-500">Roots</span></span>
          </Link>

          <nav ref={navRef} className="hidden lg:flex items-center gap-1 mx-4">
            {NAV_ENTRIES.map(entry =>
              'items' in entry ? (
                <div key={entry.label} className="relative">
                  <button
                    onClick={() => setOpenGroup(prev => (prev === entry.label ? null : entry.label))}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isGroupActive(entry.items) || openGroup === entry.label
                        ? 'text-pitch-400 bg-pitch-500/10'
                        : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                    }`}
                    aria-expanded={openGroup === entry.label}
                  >
                    {entry.label}
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                      className={`transition-transform ${openGroup === entry.label ? 'rotate-180' : ''}`}>
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {openGroup === entry.label && (
                    <div className="absolute left-0 top-full mt-1 min-w-[10rem] py-1 rounded-lg border border-border bg-surface shadow-lg">
                      {entry.items.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`block px-3 py-2 text-sm font-medium transition-colors ${
                            isActive(item.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                          }`}
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={entry.href}
                  href={entry.href}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive(entry.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                  }`}
                >
                  {entry.label}
                </Link>
              )
            )}
          </nav>

          <div className="hidden lg:flex items-center gap-3 shrink-0">
            {user && (
              <Link href="/messages" className="relative p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors" aria-label="Messages">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-gold-500 text-[#241503] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <Link href="/cart" className="relative p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors" aria-label="Cart">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
              {cartCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-gold-500 text-[#241503] text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </Link>

            {!isLoading && (
              user ? (
                <div className="flex items-center gap-3">
                  <Link href={`/network/${user.id}`} className="text-sm text-ink-secondary hover:text-ink transition-colors">
                    {user.name.split(' ')[0]}
                  </Link>
                  <button onClick={logout} className={buttonVariants('outline', 'sm')}>Log out</button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link href="/login" className={buttonVariants('ghost', 'sm')}>Log in</Link>
                  <Link href="/register" className={buttonVariants('primary', 'sm')}>Register</Link>
                </div>
              )
            )}
          </div>

          {/* Visible at every breakpoint (unlike the icon group above, which is desktop-only) -
              the bell needs to be reachable from the collapsed mobile header too, not just
              inside the hamburger menu's link list. */}
          <NotificationBell />

          <button
            onClick={() => setMobileOpen(prev => !prev)}
            className="lg:hidden p-2 rounded-lg text-ink hover:bg-surface-hover"
            aria-label="Toggle menu"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {mobileOpen ? <path d="M18 6 6 18M6 6l12 12" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="lg:hidden border-t border-border bg-surface px-4 py-3 space-y-1">
          {NAV_ENTRIES.map(entry =>
            'items' in entry ? (
              <div key={entry.label} className="pt-2 first:pt-0">
                <div className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">{entry.label}</div>
                {entry.items.map(item => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                      isActive(item.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                key={entry.href}
                href={entry.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                  isActive(entry.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                }`}
              >
                {entry.label}
              </Link>
            )
          )}
          {user && (
            <Link href="/messages" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover">
              Messages {unreadCount > 0 ? `(${unreadCount})` : ''}
            </Link>
          )}
          <Link href="/cart" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded-lg text-sm font-medium text-ink-secondary hover:text-ink hover:bg-surface-hover">
            Cart {cartCount > 0 ? `(${cartCount})` : ''}
          </Link>
          <div className="pt-2 border-t border-border mt-2">
            {!isLoading && (
              user ? (
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-ink-secondary">{user.name}</span>
                  <button onClick={logout} className={buttonVariants('outline', 'sm')}>Log out</button>
                </div>
              ) : (
                <div className="flex gap-2 px-3 py-2">
                  <Link href="/login" onClick={() => setMobileOpen(false)} className={buttonVariants('ghost', 'sm')}>Log in</Link>
                  <Link href="/register" onClick={() => setMobileOpen(false)} className={buttonVariants('primary', 'sm')}>Register</Link>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </header>
  );
}
