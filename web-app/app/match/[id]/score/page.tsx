'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import BallByBallScoring, { BallEvent, InningsData } from '@/components/scoring/BallByBallScoring';
import ScorecardView from '@/components/scoring/ScorecardView';
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
  tournament: { _id: string; rules?: { powerplayOvers?: number } } | string | null;
  innings: MatchInningsDoc[];
  toss?: { winningTeam: { _id: string; name?: string } | string | null; decision?: string | null } | null;
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
  const [showScorecard, setShowScorecard] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [finished, setFinished] = useState(false);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
  // Toss - captured once, alongside the very first "Start Innings" submission for a still-
  // Scheduled match (the same moment status flips to Live). tossCaptured starts true if the
  // fetched match already has one (a previous session set it, or this is innings 2+ within
  // this session) so the fields never resurface once set.
  const [tossCaptured, setTossCaptured] = useState(false);
  const [tossWinnerId, setTossWinnerId] = useState('');
  const [tossDecision, setTossDecision] = useState<'bat' | 'bowl' | ''>('');

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches/${params.id}`).then(r => r.json()),
      fetch('/api/players').then(r => r.json()),
    ]).then(([matchData, playersData]) => {
      if (matchData.success) {
        const m: MatchDoc = matchData.match;
        setMatch(m);
        setPowerplayOvers(matchData.powerplayOvers ?? null);
        if (m.toss?.winningTeam) setTossCaptured(true);
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

  // Scoring is open to whoever created the match, any appointed umpire, or anyone actually
  // rostered on either playing team - not just the creator. Mirrors canManageMatch() on the
  // backend, which is the real enforcement; this is just so the UI doesn't show the scoring
  // form to someone who'll get a 403 the moment they try to use it. Computed as a memo
  // (rather than inline further down, after early returns) so the lock-acquisition effect
  // below - which must run unconditionally per the Rules of Hooks - can depend on it.
  const canScore = useMemo(() => {
    if (!match || !user) return false;
    const myPlayer = players.find(p => resolveRefId(p.user) === user.id);
    const isCreator = user.id === match.createdBy._id;
    const isUmpire = (match.umpires || []).some(u => (typeof u === 'string' ? u : u._id) === user.id);
    const isRostered = !!myPlayer && (match.team1.players.includes(myPlayer._id) || match.team2.players.includes(myPlayer._id));
    return isCreator || isUmpire || isRostered;
  }, [match, user, players]);

  // Only one person may score a match at a time (opening scoring up to the whole roster plus
  // umpires means two people could otherwise record conflicting balls simultaneously). Claim
  // the lock as soon as we know this user is allowed to score, renew it periodically while
  // this page stays open, and release it on the way out. A held-but-abandoned lock expires
  // server-side on its own (LOCK_TIMEOUT_MS) so a dead session can't lock everyone out
  // forever - that's what makes this safe to combine with the resume-scoring feature.
  const [lockState, setLockState] = useState<'idle' | 'acquiring' | 'held' | 'locked'>('idle');
  const [lockedByName, setLockedByName] = useState<string | null>(null);

  useEffect(() => {
    if (!match || !canScore) return;
    let cancelled = false;

    const claim = async () => {
      setLockState((prev) => (prev === 'held' ? prev : 'acquiring'));
      try {
        const res = await apiFetch(`/api/matches/${match._id}/scoring-lock`, { method: 'POST' });
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setLockState('held');
          setLockedByName(null);
        } else {
          setLockState('locked');
          setLockedByName(data.activeScorer?.name ?? null);
        }
      } catch {
        if (!cancelled) setLockState('locked');
      }
    };

    claim();
    // Renew while held, and keep retrying while locked-by-someone-else in case they finish.
    const interval = setInterval(claim, 30000);

    const release = () => {
      apiFetch(`/api/matches/${match._id}/scoring-lock`, { method: 'DELETE' }).catch(() => {});
    };
    window.addEventListener('beforeunload', release);

    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener('beforeunload', release);
      release();
    };
  }, [match, canScore]);

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

  if (!canScore) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <p className="text-ink-secondary">
          Only players from {match.team1.name} or {match.team2.name}, an appointed umpire, or {match.createdBy.name} (who created this match) can score it.
        </p>
      </main>
    );
  }

  if (lockState === 'idle' || lockState === 'acquiring') {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Checking scoring status...</p></main>;
  }

  if (lockState === 'locked') {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <p className="text-ink-secondary">
          {lockedByName ?? 'Someone'} is currently scoring this match. Only one person can score at a time -
          this will unlock automatically if their session goes idle, or check back once they&apos;re done.
        </p>
      </main>
    );
  }

  const team1Roster = match.team1.players.map(id => playersById.get(id)).filter(Boolean).map(p => toUiPlayer(p!));
  const team2Roster = match.team2.players.map(id => playersById.get(id)).filter(Boolean).map(p => toUiPlayer(p!));
  const battingRoster = battingTeamId === match.team1._id ? team1Roster : team2Roster;
  const bowlingRoster = battingTeamId === match.team1._id ? team2Roster : team1Roster;

  // Toss is only ever relevant the very first time a still-Scheduled match starts scoring -
  // once status has moved past that (this call already ran, or a previous session/pre-existing
  // match already recorded one), it should never resurface.
  const needsToss = !tossCaptured && match.status === 'Scheduled';

  const handleStartInnings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!battingTeamId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId) return;
    if (needsToss && (!tossWinnerId || !tossDecision)) return;
    setInningsIndex(battingTeamId === match.team1._id ? 0 : 1);
    setInningsData(buildInnings(battingRoster, bowlingRoster, strikerId, nonStrikerId, bowlerId));
    // Nothing else in the app ever flips the match to Live - it's created as Scheduled and
    // stayed that way even while balls were being recorded, which is what left the AI Insights
    // tab and the "Live" badge elsewhere unable to tell a match had actually started. The toss
    // rides along on this same call so it's set exactly once, before any ball is recorded.
    if (match.status === 'Scheduled') {
      const body: { status: string; toss?: { winningTeam: string; decision: string } } = { status: 'Live' };
      if (needsToss && tossWinnerId && tossDecision) {
        body.toss = { winningTeam: tossWinnerId, decision: tossDecision };
      }
      apiFetch(`/api/matches/${match._id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      }).catch(() => { /* scoring can proceed even if this call fails; next load will retry */ });
      setTossCaptured(true);
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
        apiFetch(`/api/matches/${match._id}/scoring-lock`, { method: 'DELETE' }).catch(() => {});
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
        {inningsData && powerplayOvers != null && inningsData.overs < powerplayOvers && (
          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gold-500/15 text-gold-400 border border-gold-500/30 align-middle">
            ⚡ Powerplay - overs 1-{powerplayOvers}
          </span>
        )}
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

          {needsToss && (
            <div className="pb-4 border-b border-border space-y-3">
              <p className="text-sm font-semibold text-ink">🪙 Toss</p>
              <div>
                <label className={labelClass}>Won by</label>
                <select value={tossWinnerId} onChange={(e) => setTossWinnerId(e.target.value)} className={inputClass}>
                  <option value="">Select team</option>
                  <option value={match.team1._id}>{match.team1.name}</option>
                  <option value={match.team2._id}>{match.team2.name}</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Elected to</label>
                <select value={tossDecision} onChange={(e) => setTossDecision(e.target.value as 'bat' | 'bowl' | '')} className={inputClass}>
                  <option value="">Select decision</option>
                  <option value="bat">Bat first</option>
                  <option value="bowl">Bowl first</option>
                </select>
              </div>
            </div>
          )}

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
            disabled={
              !battingTeamId || !strikerId || !nonStrikerId || !bowlerId || strikerId === nonStrikerId ||
              (needsToss && (!tossWinnerId || !tossDecision))
            }
            className="w-full"
          >
            Start Scoring
          </Button>
        </form>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setShowScorecard(prev => !prev)}
            className="w-full mb-2 bg-surface border border-border rounded-xl p-3 text-left text-sm font-medium text-pitch-400 hover:bg-surface-hover transition-colors"
          >
            {showScorecard ? '▼' : '▶'} Full Scorecard
          </button>
          {showScorecard && (
            <div className="mb-4">
              <ScorecardView inningsData={inningsData} />
            </div>
          )}

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
