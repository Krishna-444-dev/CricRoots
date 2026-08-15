'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

// Shape returned by GET /api/matches?status=Completed&limit=1 - just enough of the real
// getAllMatches response to render this card. Shared between the home page hero and the auth
// pages' brand panel so both fetch/render the same real result the same way.
interface HeroMatch {
  _id: string;
  team1: { _id: string; name: string } | null;
  team2: { _id: string; name: string } | null;
  innings: { runs: number; wickets: number }[];
  result?: { winningTeam: string | null; margin: string; marginValue: number };
}

export default function LatestResultCard({ compact = false }: { compact?: boolean }) {
  const [match, setMatch] = useState<HeroMatch | null>(null);

  useEffect(() => {
    fetch('/api/matches?status=Completed&limit=1')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.matches[0]) setMatch(data.matches[0]);
      })
      .catch(() => {});
  }, []);

  if (!match || !match.team1 || !match.team2) return null;

  const team1Id = match.team1._id;
  const team2Id = match.team2._id;
  const winningTeamId = match.result?.winningTeam;
  const winnerName = winningTeamId === team1Id ? match.team1.name : winningTeamId === team2Id ? match.team2.name : null;
  const marginText = match.result
    ? match.result.margin === 'runs'
      ? `${match.result.marginValue} run${match.result.marginValue === 1 ? '' : 's'}`
      : match.result.margin === 'wickets'
      ? `${match.result.marginValue} wicket${match.result.marginValue === 1 ? '' : 's'}`
      : null
    : null;

  const scoreSize = compact ? 'text-4xl sm:text-5xl' : 'text-5xl sm:text-6xl';

  return (
    <Link
      href={`/match/${match._id}`}
      className="group block bg-surface/80 backdrop-blur border border-border-strong rounded-2xl px-6 py-8 sm:px-10 sm:py-10 hover:border-pitch-500/50 transition-colors"
    >
      <div className="text-center text-xs font-semibold tracking-widest uppercase text-ink-muted mb-6">
        Latest result on CricRoots
      </div>
      <div className="flex items-center justify-center gap-4 sm:gap-10">
        <div className="flex-1 min-w-0 text-center">
          <div className={`text-xs sm:text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-1 ${compact ? '' : 'truncate'}`}>
            {match.team1.name}
          </div>
          <div className={`${scoreSize} font-black text-ink tabular-nums leading-none`}>
            {match.innings[0]?.runs ?? 0}
            <span className="text-pitch-500">/{match.innings[0]?.wickets ?? 0}</span>
          </div>
        </div>
        <div className="text-ink-muted text-sm font-bold shrink-0">vs</div>
        <div className="flex-1 min-w-0 text-center">
          <div className={`text-xs sm:text-sm font-semibold text-ink-secondary uppercase tracking-wide mb-1 ${compact ? '' : 'truncate'}`}>
            {match.team2.name}
          </div>
          <div className={`${scoreSize} font-black text-ink tabular-nums leading-none`}>
            {match.innings[1]?.runs ?? 0}
            <span className="text-pitch-500">/{match.innings[1]?.wickets ?? 0}</span>
          </div>
        </div>
      </div>
      {winnerName && marginText && (
        <div className="text-center mt-7 text-base sm:text-lg font-bold text-gold-500">
          {winnerName} won by {marginText}
        </div>
      )}
      <div className="text-center mt-2 text-sm text-ink-muted group-hover:text-pitch-400 transition-colors">
        View full scorecard →
      </div>
    </Link>
  );
}
