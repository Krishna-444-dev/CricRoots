'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';
import { useDirectMessageSocket } from '@/hooks/useDirectMessageSocket';
import { buttonVariants } from '@/components/ui/buttonStyles';

const NAV_LINKS = [
  { href: '/matches', label: 'Matches' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/teams', label: 'Teams' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/players', label: 'Players' },
  { href: '/network', label: 'Network' },
  { href: '/edtech', label: 'Learn' },
  { href: '/news', label: 'News' },
  { href: '/marketplace', label: 'Market' },
  { href: '/predictions/leaderboard', label: 'Predict' },
];

export default function Navbar() {
  const pathname = usePathname();
  const { user, token, isLoading, logout } = useAuth();
  const { items } = useCart();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const cartCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

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
            <span>Cric<span className="text-pitch-500">Sync</span></span>
          </Link>

          <nav className="hidden lg:flex items-center gap-1 mx-4">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive(link.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                }`}
              >
                {link.label}
              </Link>
            ))}
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
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-2 rounded-lg text-sm font-medium ${
                isActive(link.href) ? 'text-pitch-400 bg-pitch-500/10' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
              }`}
            >
              {link.label}
            </Link>
          ))}
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
