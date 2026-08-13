'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import AITacticalAdvisor from '@/components/AITacticalAdvisor';
import ManhattanChart from '@/components/insights/ManhattanChart';
import WormChart from '@/components/insights/WormChart';
import PredictionWidget from '@/components/match/PredictionWidget';
import styles from './page.module.css';

interface ChartInnings {
  team: { _id: string; name: string } | string | null;
  overs: { over: number; runs: number; wickets: number }[];
  cumulative: { over: number; total: number }[];
}

interface KeyMoment {
  ballIndex: number;
  ballNumber: number;
  commentary: string;
  isWicket: boolean;
  runs: number;
  winProbabilityBefore: number;
  winProbabilityAfter: number;
  delta: number;
}

interface Ball {
  ballNumber: number;
  batsmanId?: string;
  bowlerId?: string;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: string;
  commentary?: string;
}

interface Interruption {
  revisedOvers: number;
  oversBowledAtInterruption: number;
  wicketsLostAtInterruption: number;
  resourcePercentRemaining: number;
  parScore: number;
  target: number;
  appliedAt: string;
}

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  matchType: string;
  totalOvers?: number;
  interruption?: Interruption | null;
  innings: Array<{
    team: string;
    runs: number;
    wickets: number;
    overs: number;
    balls: Ball[];
  }>;
  manOfTheMatch?: { _id: string; user?: { name?: string } } | null;
  createdBy?: { _id: string; name: string };
  umpires?: ({ _id: string; name: string } | string)[];
}

interface PlayerDirectoryEntry {
  _id: string;
  user?: { _id: string; name?: string } | string;
}

interface UserOption {
  userId: string;
  name: string;
}

/** All players in this match's directory that appear as a batsman or bowler on any ball -
 * the roster for the "Player Performance Reports" links below. Derived from ball data rather
 * than team.players (which isn't reliably populated with real rosters in this codebase yet)
 * so every player who actually appeared in the match gets a link, not just whoever was added
 * to the team via the separate add-player flow. */
function playersWhoAppeared(innings: Match['innings']): string[] {
  const ids = new Set<string>();
  for (const inn of innings) {
    for (const ball of inn.balls) {
      if (ball.batsmanId) ids.add(ball.batsmanId);
      if (ball.bowlerId) ids.add(ball.bowlerId);
    }
  }
  return [...ids];
}

/** Over.ball notation, derived the same filtered-legal-balls way the backend computes overs -
 * wides/no-balls don't advance the over count, so this can't be derived from array index alone. */
function overBallLabel(balls: Ball[], index: number): string {
  let legalCount = 0;
  for (let i = 0; i <= index; i++) {
    const b = balls[i];
    const isLegal = !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType));
    if (i === index) {
      const over = Math.floor(legalCount / 6);
      const ballInOver = isLegal ? (legalCount % 6) + 1 : (legalCount % 6);
      return `${over}.${Math.max(ballInOver, 1)}`;
    }
    if (isLegal) legalCount += 1;
  }
  return '';
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;
  const { user, token } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [chartsInnings, setChartsInnings] = useState<ChartInnings[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [playerDirectory, setPlayerDirectory] = useState<Map<string, string>>(new Map());
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [umpireToAdd, setUmpireToAdd] = useState('');
  const [umpireBusy, setUmpireBusy] = useState(false);
  const [umpireError, setUmpireError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'ai-insights'>('scorecard');

  useEffect(() => {
    fetchMatch();
    fetchCharts();
    fetchKeyMoments();
    fetchPlayerDirectory();
    const interval = setInterval(() => {
      fetchMatch();
      fetchCharts();
      fetchKeyMoments();
    }, 10000);
    return () => clearInterval(interval);
  }, [matchId]);

  // Names for the batsman/bowler IDs recorded on each ball - GET /api/players is the one
  // endpoint that populates the player -> user name relationship, unlike the team roster
  // endpoints (see playersWhoAppeared above), so it's fetched once here for the "Player
  // Performance Reports" links below.
  const fetchPlayerDirectory = async () => {
    try {
      const response = await fetch('/api/players');
      const data = await response.json();
      if (data.success) {
        const entries: PlayerDirectoryEntry[] = data.players;
        const map = new Map<string, string>();
        const userMap = new Map<string, string>();
        for (const p of entries) {
          if (typeof p.user === 'string' || !p.user) continue;
          if (p.user.name) map.set(p._id, p.user.name);
          if (p.user.name) userMap.set(p.user._id, p.user.name);
        }
        setPlayerDirectory(map);
        setUserOptions([...userMap.entries()].map(([userId, name]) => ({ userId, name })).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();

      if (data.success) {
        setMatch(data.match);
        setError(null);
      } else {
        setError('Failed to fetch match');
      }
    } catch (err) {
      setError('Error fetching match data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/charts`);
      const data = await response.json();
      if (data.success) {
        setChartsInnings(data.innings);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKeyMoments = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/key-moments`);
      const data = await response.json();
      // Not every match has enough of a chase yet (or is a Test match) - a failure response
      // here just means "nothing to show", not an error worth surfacing to the user.
      setKeyMoments(data.success ? data.keyMoments : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddUmpire = async () => {
    if (!umpireToAdd || umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      const res = await apiFetch(`/api/matches/${matchId}/umpires`, {
        method: 'POST',
        body: JSON.stringify({ userId: umpireToAdd }),
      });
      const data = await res.json();
      if (data.success) {
        setUmpireToAdd('');
        fetchMatch();
      } else {
        setUmpireError(data.message || 'Could not add umpire');
      }
    } finally {
      setUmpireBusy(false);
    }
  };

  const handleRemoveUmpire = async (userId: string) => {
    if (umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      const res = await apiFetch(`/api/matches/${matchId}/umpires/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchMatch();
      } else {
        setUmpireError(data.message || 'Could not remove umpire');
      }
    } finally {
      setUmpireBusy(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading match details...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error || 'Match not found'}</p>
        </div>
      </div>
    );
  }

  // A Live match sits in its first innings until the second one actually has balls -
  // match.status alone can't tell those apart.
  const currentInnings = match.innings[(match.innings[1]?.balls?.length ?? 0) > 0 ? 1 : 0];
  const targetScore = match.interruption ? match.interruption.target : (match.innings[0]?.runs || 0);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.matchTitle}>{match.title}</h1>
          <p className={styles.matchInfo}>
            {match.matchType} • {match.venue}
          </p>
          <span className={`${styles.status} ${styles[match.status.toLowerCase()]}`}>
            {match.status}
          </span>
          <Link href={`/match/${matchId}/scouting`} className="block mt-3 text-sm font-medium text-gold-500 hover:text-gold-400 transition-colors">
            📋 Scouting Report &rarr;
          </Link>
          {(match.status === 'Scheduled' || match.status === 'Live') && user && (
            <Link href={`/match/${matchId}/score`} className="block mt-2 text-sm font-medium text-pitch-400 hover:text-pitch-300 transition-colors">
              🏏 Score this match &rarr;
            </Link>
          )}
          {match.manOfTheMatch?.user?.name && (
            <p className="mt-2 text-sm font-medium text-gold-500">
              🏆 Man of the Match: {match.manOfTheMatch.user.name}
            </p>
          )}
        </div>
      </div>

      {user?.id === match.createdBy?._id && (
        <div className="max-w-[1200px] mx-auto px-5 mt-4">
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-ink mb-1">Umpires</h3>
            <p className="text-xs text-ink-muted mb-3">
              Umpires can score this match the same way you can, without needing to be on either team's roster.
            </p>
            {(match.umpires || []).length > 0 && (
              <ul className="mb-3 space-y-1.5">
                {(match.umpires || []).map((u) => {
                  const uid = typeof u === 'string' ? u : u._id;
                  const name = typeof u === 'string' ? uid : u.name;
                  return (
                    <li key={uid} className="flex items-center justify-between text-sm">
                      <span className="text-ink-secondary">{name}</span>
                      <button
                        onClick={() => handleRemoveUmpire(uid)}
                        disabled={umpireBusy}
                        className="text-xs text-wicket-400 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="flex gap-2">
              <select
                value={umpireToAdd}
                onChange={(e) => setUmpireToAdd(e.target.value)}
                className="flex-1 min-w-0 text-sm bg-surface-alt border border-border-strong rounded-lg px-3 py-1.5 text-ink"
              >
                <option value="">Select a person...</option>
                {userOptions
                  .filter((o) => !(match.umpires || []).some((u) => (typeof u === 'string' ? u : u._id) === o.userId))
                  .filter((o) => o.userId !== match.createdBy?._id)
                  .map((o) => (
                    <option key={o.userId} value={o.userId}>{o.name}</option>
                  ))}
              </select>
              <button
                onClick={handleAddUmpire}
                disabled={!umpireToAdd || umpireBusy}
                className="text-sm px-3 py-1.5 bg-pitch-500 text-[#06170D] font-medium rounded-lg disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {umpireError && <p className="mt-2 text-xs text-wicket-400">{umpireError}</p>}
          </div>
        </div>
      )}

      {/* Predict the Winner */}
      <div className="max-w-[1200px] mx-auto px-5 mt-4">
        <PredictionWidget
          matchId={matchId}
          matchStatus={match.status}
          team1={match.team1}
          team2={match.team2}
        />
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tab} ${activeTab === 'scorecard' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('scorecard')}
        >
          📊 Scorecard
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'ai-insights' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('ai-insights')}
        >
          🤖 AI Insights
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'scorecard' ? (
          <>
            {/* Team Scores */}
            <div className={styles.scoreBoard}>
              <div className={styles.teamScoreContainer}>
                <div className={styles.teamScore}>
                  <h2 className={styles.teamName}>{match.team1.name}</h2>
                  <div className={styles.score}>
                    <span className={styles.runs}>{match.innings[0]?.runs || 0}</span>
                    <span className={styles.wickets}>/{match.innings[0]?.wickets || 0}</span>
                  </div>
                  <p className={styles.overs}>
                    ({(match.innings[0]?.overs || 0).toFixed(1)} overs)
                  </p>
                </div>

                <div className={styles.vsContainer}>
                  <span className={styles.vs}>VS</span>
                </div>

                <div className={styles.teamScore}>
                  <h2 className={styles.teamName}>{match.team2.name}</h2>
                  <div className={styles.score}>
                    <span className={styles.runs}>{match.innings[1]?.runs || 0}</span>
                    <span className={styles.wickets}>/{match.innings[1]?.wickets || 0}</span>
                  </div>
                  <p className={styles.overs}>
                    ({(match.innings[1]?.overs || 0).toFixed(1)} overs)
                  </p>
                </div>
              </div>

              <div className={styles.targetContainer}>
                <p className={styles.targetLabel}>{match.interruption ? 'Revised Target' : 'Target Score'}</p>
                <p className={styles.targetValue}>{targetScore} runs</p>
              </div>
            </div>

            {match.interruption && (
              <div className="mt-3 bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 text-xs text-ink-secondary">
                <p className="font-semibold text-gold-400 mb-1">
                  Rain rule applied — revised to {match.interruption.revisedOvers} overs
                </p>
                <p>
                  Par score {match.interruption.parScore} ({match.interruption.resourcePercentRemaining}% resources
                  remaining at the point of interruption, {match.interruption.wicketsLostAtInterruption} wicket(s) down).
                  This is an approximate rain-rule estimate inspired by the Duckworth-Lewis-Stern method, not the
                  official licensed calculation — treat it as a guide, not a binding result.
                </p>
              </div>
            )}

            {/* Player Performance Reports */}
            {playersWhoAppeared(match.innings).length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-1">Player Performance Reports</h3>
                <p className="text-xs text-ink-muted mb-3">
                  This match&apos;s numbers vs. career average, recent form, and a tactical read on every dismissal.
                </p>
                <div className="flex flex-wrap gap-2">
                  {playersWhoAppeared(match.innings).map((playerId) => (
                    <Link
                      key={playerId}
                      href={`/match/${matchId}/report/${playerId}`}
                      className="text-sm px-3 py-1.5 bg-surface border border-border rounded-full text-ink-secondary hover:text-pitch-400 hover:border-pitch-500/40 transition-colors"
                    >
                      {playerDirectory.get(playerId) ?? 'View report'} &rarr;
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Balls */}
            <div className={styles.ballsSection}>
              <h3 className={styles.ballsTitle}>Recent Deliveries</h3>
              <div className={styles.ballsGrid}>
                {currentInnings?.balls?.slice(-12).map((ball, index) => (
                  <div key={index} className={styles.ballBox}>
                    <span className={styles.ballRuns}>{ball.runs}</span>
                    {ball.isWicket && <span className={styles.wicketBadge}>W</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Live Commentary */}
            {currentInnings?.balls && currentInnings.balls.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-3">Live Commentary</h3>
                <div className="bg-surface border border-border rounded-xl divide-y divide-border max-h-96 overflow-y-auto">
                  {currentInnings.balls.slice(-10).reverse().map((ball, i, arr) => {
                    const originalIndex = currentInnings.balls.length - 1 - i;
                    return (
                      <div key={originalIndex} className="p-3 flex gap-3 items-start">
                        <span className="text-xs font-mono text-ink-muted mt-0.5 shrink-0 w-10">
                          {overBallLabel(currentInnings.balls, originalIndex)}
                        </span>
                        <p className={`text-sm ${ball.isWicket ? 'text-wicket-400 font-medium' : ball.runs === 4 || ball.runs === 6 ? 'text-pitch-400 font-medium' : 'text-ink-secondary'}`}>
                          {ball.commentary || `${ball.runs} run${ball.runs === 1 ? '' : 's'}.`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Key Moments */}
            {keyMoments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-3">🔑 Key Moments</h3>
                <p className="text-xs text-ink-muted mb-3">
                  The deliveries that swung the win probability the most, biggest swing first.
                </p>
                <div className="bg-surface border border-border rounded-xl divide-y divide-border">
                  {keyMoments.map((moment) => {
                    const swungTowardsChasers = moment.winProbabilityAfter > moment.winProbabilityBefore;
                    return (
                      <div key={moment.ballIndex} className="p-3 flex gap-3 items-start">
                        <span className="text-xs font-mono text-ink-muted mt-0.5 shrink-0 w-10">
                          {overBallLabel(match.innings[1].balls, moment.ballIndex)}
                        </span>
                        <div className="flex-1">
                          <p className={`text-sm ${moment.isWicket ? 'text-wicket-400 font-medium' : moment.runs === 4 || moment.runs === 6 ? 'text-pitch-400 font-medium' : 'text-ink-secondary'}`}>
                            {moment.commentary || `${moment.runs} run${moment.runs === 1 ? '' : 's'}.`}
                          </p>
                          <p className="text-xs text-ink-muted mt-1">
                            Win probability {swungTowardsChasers ? '+' : '-'}{(moment.delta * 100).toFixed(1)}%
                            {' '}({(moment.winProbabilityBefore * 100).toFixed(0)}% → {(moment.winProbabilityAfter * 100).toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manhattan & Worm Charts */}
            {chartsInnings.some((inn) => inn.overs.length > 0) && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-3">Match Analytics</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Manhattan Chart</h4>
                    <ManhattanChart innings={chartsInnings} />
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Worm Chart</h4>
                    <WormChart innings={chartsInnings} />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <AITacticalAdvisor
            matchId={matchId}
            userId={user?.id || ''}
            token={token || ''}
            isLive={match.status === 'Live'}
          />
        )}
      </div>
    </div>
  );
}
