'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
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
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: string;
  commentary?: string;
}

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  matchType: string;
  innings: Array<{
    team: string;
    runs: number;
    wickets: number;
    overs: number;
    balls: Ball[];
  }>;
  manOfTheMatch?: { _id: string; user?: { name?: string } } | null;
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

  const [match, setMatch] = useState<Match | null>(null);
  const [chartsInnings, setChartsInnings] = useState<ChartInnings[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'ai-insights'>('scorecard');

  useEffect(() => {
    fetchMatch();
    fetchCharts();
    fetchKeyMoments();
    const interval = setInterval(() => {
      fetchMatch();
      fetchCharts();
      fetchKeyMoments();
    }, 10000);
    return () => clearInterval(interval);
  }, [matchId]);

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

  const currentInnings = match.innings[match.status === 'Live' ? 1 : 0];
  const targetScore = match.innings[0]?.runs || 0;

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
          {match.manOfTheMatch?.user?.name && (
            <p className="mt-2 text-sm font-medium text-gold-500">
              🏆 Man of the Match: {match.manOfTheMatch.user.name}
            </p>
          )}
        </div>
      </div>

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
                <p className={styles.targetLabel}>Target Score</p>
                <p className={styles.targetValue}>{targetScore} runs</p>
              </div>
            </div>

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
          <AITacticalAdvisor matchId={matchId} isLive={match.status === 'Live'} />
        )}
      </div>
    </div>
  );
}
