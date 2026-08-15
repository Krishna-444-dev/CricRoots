'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LatestResultCard from '@/components/LatestResultCard';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const result = await login(email, password);
    setIsSubmitting(false);
    if (result.success) {
      router.push('/');
    } else {
      setError(result.message || 'Login failed');
    }
  };

  return (
    <main className="relative overflow-hidden min-h-[calc(100vh-4rem)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(34,197,94,0.10),_transparent_60%)]" />
      <div className="relative max-w-5xl mx-auto px-4 py-16 grid lg:grid-cols-2 gap-12 items-center">
        {/* Brand panel - what the form used to sit in front of nothing at all. On mobile this
            drops below the form entirely rather than competing with it above the fold. */}
        <div className="order-2 lg:order-1 text-center lg:text-left">
          <span className="inline-block text-xs font-semibold tracking-widest uppercase text-gold-500 mb-4">
            Built for local &amp; club cricket
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink tracking-tight mb-4">
            Welcome back to your <span className="text-pitch-500">cricket season</span>
          </h1>
          <p className="text-ink-secondary mb-8 max-w-md mx-auto lg:mx-0">
            Score matches ball-by-ball, run tournaments, and keep your whole club connected —
            picking up right where you left off.
          </p>
          <LatestResultCard compact />
        </div>

        <div className="order-1 lg:order-2 flex justify-center">
          <Card padding="lg" className="w-full max-w-sm">
            <div className="text-center mb-6">
              <span className="text-4xl">🏏</span>
              <h2 className="text-2xl font-bold text-ink mt-2">Log in to CricRoots</h2>
            </div>
            {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className={labelClass}>Email</label>
                <input type="email" id="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label htmlFor="password" className={labelClass}>Password</label>
                <input type="password" id="password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              </div>
              <Button type="submit" disabled={isSubmitting} className="w-full">
                {isSubmitting ? 'Logging in...' : 'Log in'}
              </Button>
            </form>
            <p className="mt-4 text-sm text-ink-secondary text-center">
              No account? <Link href="/register" className="text-pitch-400 hover:underline">Register</Link>
            </p>
          </Card>
        </div>
      </div>
    </main>
  );
}
