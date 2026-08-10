import Link from 'next/link';

const links = [
  { href: '/match/demo', label: 'View Sample Match' },
  { href: '/match/demo/score', label: 'Live Scoring (demo)' },
  { href: '/tournaments', label: 'Tournaments' },
  { href: '/players', label: 'Player Stats' },
  { href: '/register', label: 'Player Registration' },
];

export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold mb-2">CricSync</h1>
      <p className="text-gray-600 mb-8">The All-in-One Cricket Application</p>
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
