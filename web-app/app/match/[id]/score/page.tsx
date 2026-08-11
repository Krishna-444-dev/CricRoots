'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BallByBallScoring, { BallEvent } from '@/components/scoring/BallByBallScoring';
import BatsmanInsights from '@/components/insights/BatsmanInsights';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string;
  specialization: string;
}

interface TeamDoc {
  _id: string;
  name: string;
  players: string[]; // unpopulated Player ObjectIds from GET /api/matches/:id
}

interface MatchDoc {
  _id: string;
  title: string;
  team1: TeamDoc;
  team2: TeamDoc;
  createdBy: { _id: string; name: string };
  status: string;
}

interface UiPlayer {
  id: string;
  name: string;
  role: string;
}

function toUiPlayer(p: PlayerDoc): UiPlayer {
  return {
    id: p._id,
    name: typeof p.user === 'string' ? p._id : p.user.name,
    role: p.specialization,
  };
}

function buildInnings(battingRoster: UiPlayer[], bowlingRoster: UiPlayer[], strikerId: string, nonStrikerId: string, bowlerId: string) {
  const striker = battingRoster.find(p => p.id === strikerId)!;
  const nonStriker = battingRoster.find(p => p.id === nonStrikerId)!;
  const bowler = bowlingRoster.find(p => p.id === bowlerId)!;

  return {
    battingTeam: { name: 'Batting' },
    bowlingTeam: { name: 'Bowling' },
    totalRuns: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    currentBatsmen: [striker, nonStriker] as [UiPlayer | null, UiPlayer | null],
    currentBowler: bowler,
    partnerships: [],
    fallOfWickets: [],
    battingScorecard: battingRoster.map(player => ({
      player,
      runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0,
      status: player.id === strikerId || player.id === nonStrikerId ? 'not out' : 'yet to bat',
      outBowler: null, outFielder: null, outMethod: null,
    })),
    bowlingScorecard: bowlingRoster.map(player => ({
      player, overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0, wides: 0, noBalls: 0,
    })),
  };
}

type InningsState = ReturnType<typeof buildInnings>;

export default function LiveScoringPage({ params }: { params: { id: string } }) {
  const { user, token, isLoading: authLoading } = useAuth();
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [players, setPlayers] = useState<PlayerDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [battingTeamId, setBattingTeamId] = useState('');
  const [strikerId, setStrikerId] = useState('');
  const [nonStrikerId, setNonStrikerId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [inningsData, setInningsData] = useState<InningsState | null>(null);
  const [inningsIndex, setInningsIndex] = useState<0 | 1>(0);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches/${params.id}`).then(r => r.json()),
      fetch('/api/players').then(r => r.json()),
    ]).then(([matchData, playersData]) => {
      if (matchData.success) setMatch(matchData.match);
      if (playersData.success) setPlayers(playersData.players);
      setLoading(false);
    });
  }, [params.id]);

  const playersById = useMemo(() => new Map(players.map(p => [p._id, p])), [players]);

  if (loading || authLoading) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Loading...</p></main>;
  }

  if (!match) {
    return <main className="min-h-screen flex items-center justify-center"><p className="text-gray-500">Match not found.</p></main>;
  }

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-600 mb-4">You need to be logged in to score this match.</p>
          <Link href="/login" className="text-blue-600 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  if (user.id !== match.createdBy._id) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <p className="text-gray-600">Only {match.createdBy.name}, who created this match, can score it.</p>
      </main>
    );
  }

  const team1Roster = match.team1.players.map(id => playersById.get(id)).filter(Boolean).map(p => toUiPlayer(p!));
  const team2Roster = match.team2.players.map(id => playersById.get(id)).filter(Boolean).map(p => toUiPlayer(p!));
  const battingRoster = battingTeamId === match.team1._id ? team1Roster : team2Roster;
  const bowlingRoster = battingTeamId === match.team1._id ? team2Roster : team1Roster;

  const handleStartInnings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!battingTeamId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId) return;
    setInningsIndex(battingTeamId === match.team1._id ? 0 : 1);
    setInningsData(buildInnings(battingRoster, bowlingRoster, strikerId, nonStrikerId, bowlerId));
  };

  const handleBallRecorded = async (updated: InningsState, ballEvent: BallEvent) => {
    setInningsData(updated);
    setSyncError(null);
    try {
      const res = await apiFetch(`/api/matches/${match._id}/record-ball`, {
        method: 'POST',
        body: JSON.stringify({ inningsIndex, ...ballEvent }),
      });
      const data = await res.json();
      if (!data.success) {
        setSyncError(data.message || 'Ball recorded locally but failed to save to the server');
      }
    } catch {
      setSyncError('Ball recorded locally but could not reach the server');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">{match.title}</h1>
        <p className="text-sm text-gray-500 mb-4">
          {match.team1.name} vs {match.team2.name}
        </p>

        {syncError && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-md text-sm">
            {syncError}
          </div>
        )}

        {!inningsData ? (
          <form onSubmit={handleStartInnings} className="bg-white rounded-lg shadow-sm p-4 space-y-4">
            <h2 className="text-lg font-medium text-gray-900">Start Innings</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Batting first</label>
              <select
                value={battingTeamId}
                onChange={(e) => { setBattingTeamId(e.target.value); setStrikerId(''); setNonStrikerId(''); setBowlerId(''); }}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="">Select team</option>
                <option value={match.team1._id}>{match.team1.name}</option>
                <option value={match.team2._id}>{match.team2.name}</option>
              </select>
            </div>

            {battingTeamId && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Striker</label>
                  <select value={strikerId} onChange={(e) => setStrikerId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
                    <option value="">Select batsman</option>
                    {battingRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Non-striker</label>
                  <select value={nonStrikerId} onChange={(e) => setNonStrikerId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
                    <option value="">Select batsman</option>
                    {battingRoster.filter(p => p.id !== strikerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening bowler</label>
                  <select value={bowlerId} onChange={(e) => setBowlerId(e.target.value)} className="w-full border border-gray-300 rounded-md px-3 py-2">
                    <option value="">Select bowler</option>
                    {bowlingRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={!battingTeamId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId}
              className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              Start Scoring
            </button>
          </form>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setShowInsights(prev => !prev)}
              className="w-full mb-4 bg-white rounded-lg shadow-sm p-3 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
            >
              {showInsights ? '▼' : '▶'} AI Insights for {inningsData.currentBatsmen[0]?.name}
            </button>
            {showInsights && inningsData.currentBatsmen[0] && (
              <div className="mb-4">
                <BatsmanInsights batsmanId={inningsData.currentBatsmen[0].id} label={`Striker: ${inningsData.currentBatsmen[0].name}`} />
              </div>
            )}

            <BallByBallScoring
              matchId={match._id}
              inningsData={inningsData}
              onBallRecorded={handleBallRecorded}
            />
            <button
              onClick={() => { setInningsData(null); setBattingTeamId(''); setStrikerId(''); setNonStrikerId(''); setBowlerId(''); }}
              className="w-full mt-4 py-2 text-sm text-gray-600 hover:underline"
            >
              End Innings / Start Next Innings
            </button>
          </>
        )}
      </div>
    </main>
  );
}
