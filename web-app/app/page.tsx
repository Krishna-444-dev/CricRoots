'use client';

import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';
import { buttonVariants } from '@/components/ui/buttonStyles';

const FEATURES = [
  { href: '/matches', icon: '🏏', title: 'Live Scoring', description: 'Ball-by-ball scoring with line, length, and shot-zone tagging.' },
  { href: '/tournaments', icon: '🏆', title: 'Tournaments', description: 'Run a full tournament with standings and announcements.' },
  { href: '/network', icon: '🤝', title: 'Network', description: 'Follow players, build your cricket network.' },
  { href: '/edtech', icon: '📘', title: 'Learn Cricket', description: 'Community-written lessons on batting, bowling, fielding, and rules.' },
  { href: '/news', icon: '📰', title: 'News', description: 'Updates and announcements from organizers.' },
  { href: '/marketplace', icon: '🛒', title: 'Marketplace', description: 'Buy and sell gear with other local players.' },
];

export default function HomePage() {
  const { user, isLoading } = useAuth();

  return (
    <main className="min-h-[calc(100vh-4rem)]">
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.12),_transparent_60%)]" />
        <div className="relative max-w-4xl mx-auto px-4 py-20 text-center">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-500 mb-4">
            Built for local &amp; club cricket
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-ink tracking-tight mb-4">
            One app for your entire <span className="text-pitch-500">cricket season</span>
          </h1>
          <p className="text-lg text-ink-secondary max-w-xl mx-auto mb-8">
            Score matches ball-by-ball, run tournaments, get AI-backed tactical insights, and keep your
            whole club connected — all in one place.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {!isLoading && !user ? (
              <>
                <Link href="/register" className={buttonVariants('primary', 'lg')}>Get Started</Link>
                <Link href="/matches" className={buttonVariants('outline', 'lg')}>Browse Matches</Link>
              </>
            ) : (
              <>
                <Link href="/matches/new" className={buttonVariants('primary', 'lg')}>Create a Match</Link>
                <Link href="/teams/new" className={buttonVariants('outline', 'lg')}>Create a Team</Link>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(f => (
            <Link key={f.href} href={f.href}>
              <Card hover padding="lg" className="h-full">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-bold text-ink mb-1">{f.title}</h3>
                <p className="text-sm text-ink-secondary">{f.description}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
