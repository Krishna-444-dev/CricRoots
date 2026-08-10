'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

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
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <h1 className="text-2xl font-bold mb-2">No registration found</h1>
          <Link href="/register" className="text-blue-600 hover:underline">
            Go to registration
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-6 text-center">
        {result.accountCreated ? (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome, {result.name}!</h1>
            <p className="text-gray-600 mb-4">
              Your CricSync account has been created.
              {result.playerProfileCreated
                ? ' Your player profile is set up too.'
                : ' Your account is ready, but the cricket profile could not be saved.'}
            </p>
            <div className="bg-gray-50 rounded-md p-4 text-left text-sm mb-4">
              <p><span className="font-medium">Email:</span> {result.email}</p>
              <p><span className="font-medium">Password:</span> {result.password}</p>
              <p className="text-xs text-gray-500 mt-2">
                This is a demo password generated for you — there's no login screen yet, so save it for when one exists.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="text-5xl mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Registration failed</h1>
            <p className="text-gray-600 mb-4">{result.error || 'Something went wrong.'}</p>
          </>
        )}
        <Link href="/" className="inline-block bg-blue-600 text-white py-2 px-6 rounded-md hover:bg-blue-700 transition">
          Back to Home
        </Link>
      </div>
    </main>
  );
}
