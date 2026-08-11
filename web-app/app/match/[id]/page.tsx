'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AITacticalAdvisor from '@/components/AITacticalAdvisor';
import styles from './page.module.css';

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
  }>;
}

export default function MatchPage() {
  const params = useParams();
  const matchId = params.id as string;

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'ai-insights'>('scorecard');

  useEffect(() => {
    fetchMatch();
    const interval = setInterval(fetchMatch, 10000);
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
          <Link href={`/match/${matchId}/scouting`} style={{ display: 'block', marginTop: '0.5rem', fontSize: '0.875rem' }}>
            📋 Scouting Report
          </Link>
        </div>
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
          </>
        ) : (
          <AITacticalAdvisor matchId={matchId} isLive={match.status === 'Live'} />
        )}
      </div>
    </div>
  );
}
