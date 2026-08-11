import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="border-t border-border mt-16">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-ink-muted">
          &copy; {new Date().getFullYear()} CricSync — the all-in-one cricket application.
        </p>
        <div className="flex items-center gap-5 text-sm text-ink-secondary">
          <Link href="/terms" className="hover:text-ink transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-ink transition-colors">Privacy</Link>
        </div>
      </div>
    </footer>
  );
}
