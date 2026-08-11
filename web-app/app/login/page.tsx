'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
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
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-sm">
        <div className="text-center mb-6">
          <span className="text-4xl">🏏</span>
          <h1 className="text-2xl font-bold text-ink mt-2">Log in to CricSync</h1>
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
    </main>
  );
}
