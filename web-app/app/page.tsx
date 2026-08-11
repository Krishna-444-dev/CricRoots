'use client';

import Link from 'next/link';
import { useAuth } from '@/AuthContext';

const links = [
  { href: '/teams', label: 'Teams' },
  { href: '/matches', label: 'Matches' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/players', label: 'Player Stats' },
  { href: '/network', label: 'Network' },
  { href: '/edtech', label: 'Learn Cricket' },
];

export default function HomePage() {
  const { user, isLoading, logout } = useAuth();

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold mb-2">CricSync</h1>
      <p className="text-gray-600 mb-4">The All-in-One Cricket Application</p>

      {!isLoading && (
        <p className="text-sm text-gray-500 mb-6">
          {user ? (
            <>
              Hi, {user.name} ·{' '}
              <button onClick={logout} className="text-blue-600 hover:underline">
                Log out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
              {' '}or{' '}
              <Link href="/register" className="text-blue-600 hover:underline">register</Link>
            </>
          )}
        </p>
      )}

      <div className="flex flex-col gap-3 w-full max-w-xs">
        {links.map(link => (
          <Link
            key={link.href}
            href={link.href}
            className="bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </main>
  );
}
