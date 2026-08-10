'use client';

import React, { useState, useEffect } from 'react';
import styles from './TournamentManager.module.css';

interface Tournament {
  _id: string;
  name: string;
  description: string;
  format: string;
  matchType: string;
  status: string;
  venue: string;
  startDate: string;
  endDate: string;
  teams: any[];
  maxTeams: number;
  standings: any[];
  statistics: {
    totalMatches: number;
    completedMatches: number;
    totalRuns: number;
  };
}

interface TournamentManagerProps {
  tournamentId?: string;
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({ tournamentId }) => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'standings' | 'matches' | 'statistics'>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchTournaments();
  }, []);

  const fetchTournaments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/tournaments');
      const data = await response.json();
      
      if (data.success) {
        setTournaments(data.tournaments);
        if (tournamentId) {
          const selected = data.tournaments.find((t: Tournament) => t._id === tournamentId);
          if (selected) {
            setSelectedTournament(selected);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Draft':
        return '#999';
      case 'Registration':
        return '#FF9800';
      case 'Ongoing':
        return '#4CAF50';
      case 'Completed':
        return '#2196F3';
      default:
        return '#999';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'Draft':
        return '📝';
      case 'Registration':
        return '📋';
      case 'Ongoing':
        return '🔴';
      case 'Completed':
        return '✅';
      default:
        return '❓';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading tournaments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Tournament Management</h1>
        <button className={styles.createBtn} onClick={() => setShowCreateForm(!showCreateForm)}>
          + Create Tournament
        </button>
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tab} ${activeTab === 'list' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('list')}
        >
          📋 Tournaments
        </button>
        {selectedTournament && (
          <>
            <button
              className={`${styles.tab} ${activeTab === 'standings' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('standings')}
            >
              🏆 Standings
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'matches' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              🏏 Matches
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'statistics' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('statistics')}
            >
              📊 Statistics
            </button>
          </>
        )}
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'list' && (
          <div className={styles.tournamentsList}>
            {tournaments.length === 0 ? (
              <div className={styles.emptyState}>
                <p>No tournaments found</p>
              </div>
            ) : (
              tournaments.map((tournament) => (
                <div
                  key={tournament._id}
                  className={`${styles.tournamentCard} ${selectedTournament?._id === tournament._id ? styles.selected : ''}`}
                  onClick={() => {
                    setSelectedTournament(tournament);
                    setActiveTab('standings');
                  }}
                >
                  <div className={styles.cardHeader}>
                    <h3>{tournament.name}</h3>
                    <span className={styles.status} style={{ backgroundColor: getStatusColor(tournament.status) }}>
                      {getStatusEmoji(tournament.status)} {tournament.status}
                    </span>
                  </div>
                  <p className={styles.description}>{tournament.description}</p>
                  <div className={styles.cardDetails}>
                    <div className={styles.detail}>
                      <span className={styles.label}>Format</span>
                      <span className={styles.value}>{tournament.format}</span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Teams</span>
                      <span className={styles.value}>
                        {tournament.teams.length}/{tournament.maxTeams}
                      </span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Matches</span>
                      <span className={styles.value}>
                        {tournament.statistics.completedMatches}/{tournament.statistics.totalMatches}
                      </span>
                    </div>
                    <div className={styles.detail}>
                      <span className={styles.label}>Venue</span>
                      <span className={styles.value}>{tournament.venue}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'standings' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Standings</h2>
            <div className={styles.standingsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.col1}>Rank</div>
                <div className={styles.col2}>Team</div>
                <div className={styles.col3}>P</div>
                <div className={styles.col4}>W</div>
                <div className={styles.col5}>L</div>
                <div className={styles.col6}>Pts</div>
                <div className={styles.col7}>NRR</div>
              </div>
              {selectedTournament.standings.map((standing, idx) => (
                <div key={idx} className={styles.tableRow}>
                  <div className={styles.col1}>{idx + 1}</div>
                  <div className={styles.col2}>{standing.team?.name || 'Team'}</div>
                  <div className={styles.col3}>{standing.played}</div>
                  <div className={styles.col4}>{standing.won}</div>
                  <div className={styles.col5}>{standing.lost}</div>
                  <div className={styles.col6}>{standing.points}</div>
                  <div className={styles.col7}>{standing.netRunRate.toFixed(2)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'matches' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Matches</h2>
            <p className={styles.infoText}>
              Total Matches: {selectedTournament.statistics.totalMatches} | Completed:{' '}
              {selectedTournament.statistics.completedMatches}
            </p>
          </div>
        )}

        {activeTab === 'statistics' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Statistics</h2>
            <div className={styles.statsGrid}>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Total Runs</span>
                <span className={styles.statValue}>{selectedTournament.statistics.totalRuns}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Total Wickets</span>
                <span className={styles.statValue}>{selectedTournament.statistics.totalWickets}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Highest Score</span>
                <span className={styles.statValue}>{selectedTournament.statistics.highestScore}</span>
              </div>
              <div className={styles.statBox}>
                <span className={styles.statLabel}>Lowest Score</span>
                <span className={styles.statValue}>{selectedTournament.statistics.lowestScore}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManager;
