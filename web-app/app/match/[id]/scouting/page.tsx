'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface MatchDoc {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  venue: string;
  pitchType: string;
}

interface BowlerReport {
  playerId: string;
  name: string;
  specialization: string;
  bowlingStyle: string;
  hasData: boolean;
  stats: { economy: number; strikeRate: number | null; wickets: number; balls: number; blendedEconomy: number | null; confidence: string } | null;
  note: string;
}

function BowlerCard({ bowler, rank }: { bowler: BowlerReport; rank: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium text-gray-900">#{rank} {bowler.name}</p>
          <p className="text-sm text-gray-500">{bowler.specialization} · {bowler.bowlingStyle}</p>
        </div>
        {bowler.hasData && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 whitespace-nowrap">
            Economy {bowler.stats?.economy}
          </span>
        )}
      </div>
      <p className="text-sm text-gray-700 mt-2">{bowler.note}</p>
    </div>
  );
}

export default function ScoutingReportPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [team1Bowlers, setTeam1Bowlers] = useState<BowlerReport[]>([]);
  const [team2Bowlers, setTeam2Bowlers] = useState<BowlerReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/matches/${params.id}`)
      .then(r => r.json())
      .then(async (data) => {
        if (!data.success) return;
        setMatch(data.match);
        const [r1, r2] = await Promise.all([
          fetch(`/api/insights/teams/${data.match.team1._id}/bowler-scouting`).then(r => r.json()),
          fetch(`/api/insights/teams/${data.match.team2._id}/bowler-scouting`).then(r => r.json()),
        ]);
        if (r1.success) setTeam1Bowlers(r1.bowlers);
        if (r2.success) setTeam2Bowlers(r2.bowlers);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!match) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Match not found.</p></main>;
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <Link href={`/match/${params.id}`} className="text-sm text-blue-600 hover:underline">&larr; Back to match</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-4">{match.title} · Scouting Report</h1>
        <p className="text-sm text-gray-500 mb-6 capitalize">
          {match.venue} · {match.pitchType !== 'unknown' ? `${match.pitchType} pitch` : 'pitch type unknown'}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-3">{match.team1.name} bowlers</h2>
            <div className="space-y-3">
              {team1Bowlers.length === 0 ? (
                <p className="text-sm text-gray-500">No roster data yet.</p>
              ) : (
                team1Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
              )}
            </div>
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-3">{match.team2.name} bowlers</h2>
            <div className="space-y-3">
              {team2Bowlers.length === 0 ? (
                <p className="text-sm text-gray-500">No roster data yet.</p>
              ) : (
                team2Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
