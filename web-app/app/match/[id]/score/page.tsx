'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BallByBallScoring, { BallEvent, InningsData } from '@/components/scoring/BallByBallScoring';
import BatsmanInsights from '@/components/insights/BatsmanInsights';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Button from '@/components/ui/Button';
import { inputClass, labelClass } from '@/components/ui/formStyles';
import { resolveRefId, resolveRefName } from '@/lib/resolveRef';

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string | null;
  specialization: string;
}

interface TeamDoc {
  _id: string;
  name: string;
  players: string[]; // unpopulated Player ObjectIds from GET /api/matches/:id
}

interface MatchInningsDoc {
  team: string;
  balls: unknown[];
  liveState?: InningsData | null;
}

interface MatchDoc {
  _id: string;
  title: string;
  team1: TeamDoc;
  team2: TeamDoc;
  createdBy: { _id: string; name: string };
  umpires?: ({ _id: string; name: string } | string)[];
  status: string;
  tournament: string | null;
  innings: MatchInningsDoc[];
}

interface UiPlayer {
  id: string;
  name: string;
  role: string;
}

function toUiPlayer(p: PlayerDoc): UiPlayer {
  return {
    id: p._id,
    name: resolveRefName(p.user, p._id),
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
      player, overs: 0, balls: 0, maidens: 0, runs: 0, runsThisOver: 0, wickets: 0, economy: 0, wides: 0, noBalls: 0,
    })),
  };
}

type InningsState = InningsData;

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
  const [isFinishing, setIsFinishing] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches/${params.id}`).then(r => r.json()),
      fetch('/api/players').then(r => r.json()),
    ]).then(([matchData, playersData]) => {
      if (matchData.success) {
        const m: MatchDoc = matchData.match;
        setMatch(m);
        // Resume scoring in progress instead of restarting from "Start Innings" - a previous
        // scorer's session may have ended abruptly (phone died, tab closed) without finishing
        // the innings, and re-selecting striker/non-striker/bowler from scratch would both
        // lose the actual live state (partnerships, fall of wickets, who's on strike right
        // now) and risk duplicate/conflicting ball numbers once new balls are recorded.
        const idx: 0 | 1 = (m.innings[1]?.balls?.length ?? 0) > 0 ? 1 : 0;
        const savedState = m.innings[idx]?.liveState;
        if (savedState) {
          setInningsIndex(idx);
          setBattingTeamId(m.innings[idx].team);
          setInningsData(savedState);
        }
      }
      if (playersData.success) setPlayers(playersData.players);
      setLoading(false);
    });
  }, [params.id]);

  const playersById = useMemo(() => new Map(players.map(p => [p._id, p])), [players]);

  if (loading || authLoading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!match) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Match not found.</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to score this match.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  // Scoring is open to whoever created the match, any appointed umpire, or anyone actually
  // rostered on either playing team - not just the creator. Mirrors canManageMatch() on the
  // backend, which is the real enforcement; this is just so the UI doesn't show the scoring
  // form to someone who'll get a 403 the moment they try to use it.
  const myPlayer = players.find(p => resolveRefId(p.user) === user.id);
  const isCreator = user.id === match.createdBy._id;
  const isUmpire = (match.umpires || []).some(u => (typeof u === 'string' ? u : u._id) === user.id);
  const isRostered = !!myPlayer && (match.team1.players.includes(myPlayer._id) || match.team2.players.includes(myPlayer._id));
  const canScore = isCreator || isUmpire || isRostered;

  if (!canScore) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <p className="text-ink-secondary">
          Only players from {match.team1.name} or {match.team2.name}, an appointed umpire, or {match.createdBy.name} (who created this match) can score it.
        </p>
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
    // Nothing else in the app ever flips the match to Live - it's created as Scheduled and
    // stayed that way even while balls were being recorded, which is what left the AI Insights
    // tab and the "Live" badge elsewhere unable to tell a match had actually started.
    if (match.status === 'Scheduled') {
      apiFetch(`/api/matches/${match._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Live' }),
      }).catch(() => { /* scoring can proceed even if this call fails; next load will retry */ });
    }
  };

  const handleBallRecorded = async (updated: InningsState, ballEvent: BallEvent) => {
    setInningsData(updated);
    setSyncError(null);
    try {
      const res = await apiFetch(`/api/matches/${match._id}/record-ball`, {
        method: 'POST',
        // liveState rides along on every ball so another scorer/device can resume this exact
        // innings (current striker/non-striker/bowler, scorecards, partnerships) if this
        // session drops - see the innings.liveState comment in the backend Match model.
        body: JSON.stringify({ inningsIndex, ...ballEvent, liveState: updated }),
      });
      const data = await res.json();
      if (!data.success) {
        setSyncError(data.message || 'Ball recorded locally but failed to save to the server');
      }
    } catch {
      setSyncError('Ball recorded locally but could not reach the server');
    }
  };

  const handleFinishMatch = async () => {
    if (isFinishing) return;
    setIsFinishing(true);
    setSyncError(null);
    try {
      const res = await apiFetch(`/api/matches/${match._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: 'Completed' }),
      });
      const data = await res.json();
      if (data.success) {
        setFinished(true);
      } else {
        setSyncError(data.message || 'Could not finish the match');
      }
    } catch {
      setSyncError('Could not reach the server to finish the match');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <main className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-xl font-bold text-ink mb-1">{match.title}</h1>
      <p className="text-sm text-ink-secondary mb-4">
        {match.team1.name} <span className="text-ink-muted">vs</span> {match.team2.name}
      </p>

      {syncError && (
        <div className="mb-4 p-3 bg-gold-500/10 border border-gold-500/30 text-gold-400 rounded-lg text-sm">
          {syncError}
        </div>
      )}

      {finished ? (
        <div className="bg-surface border border-border rounded-xl shadow-card p-6 text-center">
          <p className="text-2xl mb-2">🏁</p>
          <h2 className="text-lg font-semibold text-ink mb-1">Match completed</h2>
          <p className="text-sm text-ink-secondary mb-4">
            The result has been recorded{match.tournament ? ' and the tournament points table has been updated.' : '.'}
          </p>
          <Link href={`/match/${match._id}`} className="text-pitch-400 hover:underline text-sm">
            View match summary
          </Link>
        </div>
      ) : !inningsData ? (
        <form onSubmit={handleStartInnings} className="bg-surface border border-border rounded-xl shadow-card p-4 sm:p-5 space-y-4">
          <h2 className="text-lg font-semibold text-ink">Start Innings</h2>
          <div>
            <label className={labelClass}>Batting first</label>
            <select
              value={battingTeamId}
              onChange={(e) => { setBattingTeamId(e.target.value); setStrikerId(''); setNonStrikerId(''); setBowlerId(''); }}
              className={inputClass}
            >
              <option value="">Select team</option>
              <option value={match.team1._id}>{match.team1.name}</option>
              <option value={match.team2._id}>{match.team2.name}</option>
            </select>
          </div>

          {battingTeamId && (
            <>
              <div>
                <label className={labelClass}>Striker</label>
                <select value={strikerId} onChange={(e) => setStrikerId(e.target.value)} className={inputClass}>
                  <option value="">Select batsman</option>
                  {battingRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Non-striker</label>
                <select value={nonStrikerId} onChange={(e) => setNonStrikerId(e.target.value)} className={inputClass}>
                  <option value="">Select batsman</option>
                  {battingRoster.filter(p => p.id !== strikerId).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelClass}>Opening bowler</label>
                <select value={bowlerId} onChange={(e) => setBowlerId(e.target.value)} className={inputClass}>
                  <option value="">Select bowler</option>
                  {bowlingRoster.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </>
          )}

          <Button
            type="submit"
            disabled={!battingTeamId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId}
            className="w-full"
          >
            Start Scoring
          </Button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowInsights(prev => !prev)}
            className="w-full mb-4 bg-surface border border-border rounded-xl p-3 text-left text-sm font-medium text-pitch-400 hover:bg-surface-hover transition-colors"
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
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => { setInningsData(null); setBattingTeamId(''); setStrikerId(''); setNonStrikerId(''); setBowlerId(''); }}
              className="flex-1 py-2 text-sm text-ink-secondary hover:text-ink transition-colors"
            >
              End Innings / Start Next Innings
            </button>
            <button
              onClick={handleFinishMatch}
              disabled={isFinishing}
              className="flex-1 py-2 rounded-lg text-sm font-medium bg-wicket-500/10 border border-wicket-500/30 text-wicket-400 hover:bg-wicket-500/20 disabled:opacity-50 transition-colors"
            >
              {isFinishing ? 'Finishing...' : 'Finish Match'}
            </button>
          </div>
        </>
      )}
    </main>
  );
}
