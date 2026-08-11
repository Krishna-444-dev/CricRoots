'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import { buttonVariants } from '@/components/ui/buttonStyles';

interface RegistrationResult {
  name: string;
  email: string;
  password: string;
  accountCreated: boolean;
  playerProfileCreated: boolean;
  error: string | null;
}

export default function RegistrationSuccessPage() {
  const [result, setResult] = useState<RegistrationResult | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('cricsync_registration');
    if (raw) {
      setResult(JSON.parse(raw));
      sessionStorage.removeItem('cricsync_registration');
    }
  }, []);

  if (!result) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-2">No registration found</h1>
          <Link href="/register" className="text-pitch-400 hover:underline">
            Go to registration
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="max-w-md w-full text-center">
        {result.accountCreated ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-ink mb-2">Welcome, {result.name}!</h1>
            <p className="text-ink-secondary mb-4">
              Your CricSync account has been created and you&apos;re logged in.
              {result.playerProfileCreated
                ? ' Your player profile is set up too.'
                : ' Your account is ready, but the cricket profile could not be saved.'}
            </p>
            <div className="bg-surface-alt border border-border-strong rounded-lg p-4 text-left text-sm mb-4">
              <p className="text-ink"><span className="font-medium text-ink-secondary">Email:</span> {result.email}</p>
              <p className="text-ink"><span className="font-medium text-ink-secondary">Password:</span> {result.password}</p>
              <p className="text-xs text-ink-muted mt-2">
                Save this password to log in again later from another device.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-ink mb-2">Registration failed</h1>
            <p className="text-ink-secondary mb-4">{result.error || 'Something went wrong.'}</p>
          </>
        )}
        <Link href="/" className={buttonVariants('primary')}>
          Back to Home
        </Link>
      </Card>
    </main>
  );
}
