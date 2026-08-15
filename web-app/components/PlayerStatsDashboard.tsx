'use client';

import React, { useState, useEffect } from 'react';
import styles from './PlayerStatsDashboard.module.css';
import WagonWheel from './insights/WagonWheel';
import RunsPerInnings, { RunsPerInningsEntry } from './insights/RunsPerInnings';
import DismissalBreakdown, { DismissalEntry } from './insights/DismissalBreakdown';

interface PlayerStats {
  _id: string;
  player: {
    _id: string;
    name: string;
    specialization: string;
  };
  batting: {
    matches: number;
    innings: number;
    runs: number;
    balls: number;
    highestScore: number;
    average: number;
    strikeRate: number;
    centuries: number;
    halfCenturies: number;
    fours: number;
    sixes: number;
    ducks: number;
    notOuts: number;
  };
  byFormat: Array<{
    matchType: string;
    matches: number;
    innings: number;
    notOuts: number;
    runs: number;
    balls: number;
    average: number;
    strikeRate: number;
    highestScore: number;
    centuries: number;
    halfCenturies: number;
    ducks: number;
    fours: number;
    sixes: number;
  }>;
  bowling: {
    matches: number;
    innings: number;
    balls: number;
    runs: number;
    wickets: number;
    average: number;
    economyRate: number;
  };
  fielding: {
    catches: number;
    runOuts: number;
    stumpings: number;
  };
  overall: {
    matches: number;
    wins: number;
    losses: number;
    winPercentage: number;
    manOfTheMatch: number;
  };
  recentForm: Array<{
    date: string;
    runs: number;
    wickets: number;
    rating: number;
  }>;
  wagonWheel: Array<{
    zone: string;
    balls: number;
    runs: number;
    runsPercent: number;
  }>;
  runsPerInnings: RunsPerInningsEntry[];
  dismissalBreakdown: {
    totalInnings: number;
    notOut: number;
    dismissals: DismissalEntry[];
  };
  achievements: Array<{
    key: string;
    label: string;
    description: string;
    earned: boolean;
    count: number;
  }>;
}

interface PlayerStatsDashboardProps {
  playerId?: string;
}

export const PlayerStatsDashboard: React.FC<PlayerStatsDashboardProps> = ({ playerId }) => {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [topBatsmen, setTopBatsmen] = useState<PlayerStats[]>([]);
  const [topBowlers, setTopBowlers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'batting' | 'bowling' | 'rankings'>('overview');

  useEffect(() => {
    fetchData();
  }, [playerId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      if (playerId) {
        const response = await fetch(`/api/player-stats/${playerId}`);
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        }
      }

      // Fetch top batsmen and bowlers
      const [batsmenRes, bowlersRes] = await Promise.all([
        fetch('/api/player-stats/rankings/batsmen?limit=5'),
        fetch('/api/player-stats/rankings/bowlers?limit=5')
      ]);

      const batsmenData = await batsmenRes.json();
      const bowlersData = await bowlersRes.json();

      if (batsmenData.success) setTopBatsmen(batsmenData.batsmen);
      if (bowlersData.success) setTopBowlers(bowlersData.bowlers);
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading statistics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Player Statistics Dashboard</h1>
        <p className={styles.subtitle}>Comprehensive cricket performance analytics</p>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tab} ${activeTab === 'overview' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Overview
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'batting' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('batting')}
        >
          🏏 Batting
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'bowling' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('bowling')}
        >
          🎯 Bowling
        </button>
        <button
          className={`${styles.tab} ${activeTab === 'rankings' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('rankings')}
        >
          🏆 Rankings
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'overview' && !stats && (
          <div className={styles.emptyState}>
            <div className={styles.emptyStateIcon}>🏏</div>
            <p className={styles.emptyStateTitle}>No player selected</p>
            <p className={styles.emptyStateDescription}>
              This page shows one player's full stats at a time - get here from a team roster or
              your own profile. In the meantime, the Rankings tab has the real leaderboard.
            </p>
            <button className={styles.emptyStateAction} onClick={() => setActiveTab('rankings')}>
              See Rankings →
            </button>
          </div>
        )}
        {activeTab === 'overview' && stats && (
          <div className={styles.overviewGrid}>
            {/* Player Card */}
            <div className={styles.playerCard}>
              <h2>{stats.player.name}</h2>
              <p className={styles.specialization}>{stats.player.specialization}</p>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.label}>Matches</span>
                  <span className={styles.value}>{stats.overall.matches}</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.label}>Win %</span>
                  <span className={styles.value}>{stats.overall.winPercentage}%</span>
                </div>
              </div>
            </div>

            {/* Batting Overview */}
            <div className={styles.card}>
              <h3>Batting</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.label}>Average</span>
                  <span className={styles.value}>{stats.batting.average.toFixed(2)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Runs</span>
                  <span className={styles.value}>{stats.batting.runs}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Strike Rate</span>
                  <span className={styles.value}>{stats.batting.strikeRate.toFixed(2)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Centuries</span>
                  <span className={styles.value}>{stats.batting.centuries}</span>
                </div>
              </div>
            </div>

            {/* Bowling Overview */}
            <div className={styles.card}>
              <h3>Bowling</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.label}>Average</span>
                  <span className={styles.value}>{stats.bowling.average.toFixed(2)}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Wickets</span>
                  <span className={styles.value}>{stats.bowling.wickets}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Economy</span>
                  <span className={styles.value}>{stats.bowling.economyRate.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {/* Fielding Overview */}
            <div className={styles.card}>
              <h3>Fielding</h3>
              <div className={styles.statsGrid}>
                <div className={styles.statItem}>
                  <span className={styles.label}>Catches</span>
                  <span className={styles.value}>{stats.fielding.catches}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Run Outs</span>
                  <span className={styles.value}>{stats.fielding.runOuts}</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.label}>Stumpings</span>
                  <span className={styles.value}>{stats.fielding.stumpings}</span>
                </div>
              </div>
            </div>

            {/* Achievements */}
            {stats.achievements && stats.achievements.length > 0 && (
              <div className={styles.card}>
                <h3>🏅 Achievements</h3>
                <div className={styles.badgeGrid}>
                  {stats.achievements.map((badge) => (
                    <div
                      key={badge.key}
                      className={`${styles.badge} ${badge.earned ? styles.badgeEarned : styles.badgeLocked}`}
                      title={badge.description}
                    >
                      <span className={styles.badgeLabel}>{badge.label}</span>
                      <span className={styles.badgeDescription}>{badge.description}</span>
                      {badge.earned && badge.count > 1 && (
                        <span className={styles.badgeCount}>×{badge.count}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Form */}
            <div className={styles.card}>
              <h3>Recent Form</h3>
              <div className={styles.recentForm}>
                {stats.recentForm.slice(0, 5).map((match, idx) => (
                  <div key={idx} className={styles.formItem}>
                    <span className={styles.rating}>{match.rating}/10</span>
                    <span className={styles.details}>
                      {match.runs > 0 && `${match.runs} runs`}
                      {match.wickets > 0 && ` ${match.wickets}w`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'batting' && (
          <div className={styles.card}>
            <h3>Batting Statistics</h3>
            {stats && (
              <div className={styles.detailedStats}>
                <div className={styles.statRow}>
                  <span>Matches</span>
                  <span>{stats.batting.matches}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Runs</span>
                  <span>{stats.batting.runs}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Average</span>
                  <span>{stats.batting.average.toFixed(2)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Highest Score</span>
                  <span>{stats.batting.highestScore}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Strike Rate</span>
                  <span>{stats.batting.strikeRate.toFixed(2)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Centuries</span>
                  <span>{stats.batting.centuries}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'batting' && stats && stats.byFormat.length > 0 && (
          <div className={styles.card}>
            <h3>Batting by Format</h3>
            <div className={styles.tableWrap}>
              <table className={styles.formatTable}>
                <thead>
                  <tr>
                    <th>Format</th>
                    <th>Mat</th>
                    <th>Inns</th>
                    <th>NO</th>
                    <th>Runs</th>
                    <th>Balls</th>
                    <th>Ave</th>
                    <th>SR</th>
                    <th>HS</th>
                    <th>100s</th>
                    <th>50s</th>
                    <th>0s</th>
                    <th>4s</th>
                    <th>6s</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className={styles.formatRowAll}>
                    <td>All Formats</td>
                    <td>{stats.batting.matches}</td>
                    <td>{stats.batting.innings}</td>
                    <td>{stats.batting.notOuts}</td>
                    <td>{stats.batting.runs}</td>
                    <td>{stats.batting.balls}</td>
                    <td>{stats.batting.average.toFixed(2)}</td>
                    <td>{stats.batting.strikeRate.toFixed(2)}</td>
                    <td>{stats.batting.highestScore}</td>
                    <td>{stats.batting.centuries}</td>
                    <td>{stats.batting.halfCenturies}</td>
                    <td>{stats.batting.ducks}</td>
                    <td>{stats.batting.fours}</td>
                    <td>{stats.batting.sixes}</td>
                  </tr>
                  {stats.byFormat.map((row) => (
                    <tr key={row.matchType}>
                      <td>{row.matchType}</td>
                      <td>{row.matches}</td>
                      <td>{row.innings}</td>
                      <td>{row.notOuts}</td>
                      <td>{row.runs}</td>
                      <td>{row.balls}</td>
                      <td>{row.average.toFixed(2)}</td>
                      <td>{row.strikeRate.toFixed(2)}</td>
                      <td>{row.highestScore}</td>
                      <td>{row.centuries}</td>
                      <td>{row.halfCenturies}</td>
                      <td>{row.ducks}</td>
                      <td>{row.fours}</td>
                      <td>{row.sixes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'batting' && stats && stats.runsPerInnings.length > 0 && (
          <div className={styles.card}>
            <h3>Runs per Innings</h3>
            <RunsPerInnings innings={stats.runsPerInnings} />
          </div>
        )}

        {activeTab === 'batting' && stats && stats.dismissalBreakdown.totalInnings > 0 && (
          <div className={styles.card}>
            <h3>Dismissal Type</h3>
            <DismissalBreakdown
              dismissals={stats.dismissalBreakdown.dismissals}
              notOut={stats.dismissalBreakdown.notOut}
              totalInnings={stats.dismissalBreakdown.totalInnings}
            />
          </div>
        )}

        {activeTab === 'batting' && stats && stats.wagonWheel.length > 0 && (
          <div className={styles.card}>
            <h3>Wagon Wheel</h3>
            <WagonWheel zones={stats.wagonWheel} />
          </div>
        )}

        {activeTab === 'bowling' && (
          <div className={styles.card}>
            <h3>Bowling Statistics</h3>
            {stats && (
              <div className={styles.detailedStats}>
                <div className={styles.statRow}>
                  <span>Matches</span>
                  <span>{stats.bowling.matches}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Wickets</span>
                  <span>{stats.bowling.wickets}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Average</span>
                  <span>{stats.bowling.average.toFixed(2)}</span>
                </div>
                <div className={styles.statRow}>
                  <span>Economy Rate</span>
                  <span>{stats.bowling.economyRate.toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rankings' && (
          <div className={styles.rankingsGrid}>
            {/* Top Batsmen */}
            <div className={styles.card}>
              <h3>🏏 Top Batsmen</h3>
              <div className={styles.rankingsList}>
                {topBatsmen.map((player, idx) => (
                  <div key={idx} className={styles.rankingItem}>
                    <span className={styles.rank}>#{idx + 1}</span>
                    <div className={styles.playerInfo}>
                      <p className={styles.playerName}>{player.player.name}</p>
                      <p className={styles.playerStat}>Avg: {player.batting.average.toFixed(2)}</p>
                    </div>
                    <span className={styles.score}>{player.batting.runs} runs</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Bowlers */}
            <div className={styles.card}>
              <h3>🎯 Top Bowlers</h3>
              <div className={styles.rankingsList}>
                {topBowlers.map((player, idx) => (
                  <div key={idx} className={styles.rankingItem}>
                    <span className={styles.rank}>#{idx + 1}</span>
                    <div className={styles.playerInfo}>
                      <p className={styles.playerName}>{player.player.name}</p>
                      <p className={styles.playerStat}>Avg: {player.bowling.average.toFixed(2)}</p>
                    </div>
                    <span className={styles.score}>{player.bowling.wickets}w</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlayerStatsDashboard;
