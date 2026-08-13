'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './TournamentManager.module.css';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useChatSocket, ChatMessage } from '@/hooks/useChatSocket';
import { inputClass } from '@/components/ui/formStyles';
import { buttonVariants } from '@/components/ui/buttonStyles';
import Badge from '@/components/ui/Badge';

interface AwardTeam {
  _id: string;
  name: string;
}

interface AwardPlayer {
  _id: string;
  specialization: string;
  user?: { name: string };
}

interface TournamentAwards {
  winner?: AwardTeam | null;
  runnerUp?: AwardTeam | null;
  thirdPlace?: AwardTeam | null;
  manOfTheTournament?: AwardPlayer | null;
  bestBatsman?: AwardPlayer | null;
  bestBowler?: AwardPlayer | null;
}

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
  organizer: { _id: string; name: string };
  houseRules?: string;
  statistics: {
    totalMatches: number;
    completedMatches: number;
    totalRuns: number;
    totalWickets: number;
    highestScore: number;
    lowestScore: number;
    highestIndividualScore: number;
    bestBowlingFigures: string;
  };
  awards?: TournamentAwards;
}

interface TournamentMatch {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  scheduledDate: string;
}

interface TournamentManagerProps {
  tournamentId?: string;
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({ tournamentId }) => {
  const { user, token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'standings' | 'matches' | 'statistics' | 'announcements' | 'awards' | 'rules'>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [generatingFixtures, setGeneratingFixtures] = useState(false);
  const [computingAwards, setComputingAwards] = useState(false);
  const [awardsError, setAwardsError] = useState('');
  const [houseRulesText, setHouseRulesText] = useState('');
  const [savingHouseRules, setSavingHouseRules] = useState(false);
  const [houseRulesError, setHouseRulesError] = useState('');
  const [houseRulesSaved, setHouseRulesSaved] = useState(false);

  const isOrganizer = Boolean(user && selectedTournament && selectedTournament.organizer?._id === user.id);

  useEffect(() => {
    setHouseRulesText(selectedTournament?.houseRules || '');
    setHouseRulesError('');
    setHouseRulesSaved(false);
  }, [selectedTournament?._id]);

  useEffect(() => {
    if (activeTab === 'announcements' && selectedTournament) {
      fetch(`/api/tournaments/${selectedTournament._id}/messages`)
        .then(r => r.json())
        .then(data => { if (data.success) setAnnouncements(data.messages); });
    }
  }, [activeTab, selectedTournament]);

  const fetchTournamentMatches = (id: string) => {
    setMatchesLoading(true);
    return fetch(`/api/tournaments/${id}/matches`)
      .then(r => r.json())
      .then(data => { if (data.success) setTournamentMatches(data.matches); })
      .finally(() => setMatchesLoading(false));
  };

  useEffect(() => {
    if (activeTab === 'matches' && selectedTournament) {
      fetchTournamentMatches(selectedTournament._id);
    }
  }, [activeTab, selectedTournament]);

  const handleGenerateFixtures = async () => {
    if (!selectedTournament || generatingFixtures) return;
    setGeneratingFixtures(true);
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/generate-fixtures`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTournamentMatches(selectedTournament._id);
      } else {
        alert(data.message || 'Failed to generate fixtures');
      }
    } catch (error) {
      console.error('Error generating fixtures:', error);
    } finally {
      setGeneratingFixtures(false);
    }
  };

  const handleComputeAwards = async () => {
    if (!selectedTournament || computingAwards) return;
    setComputingAwards(true);
    setAwardsError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/compute-awards`, {
        method: 'POST',
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments(prev => prev.map(t => (t._id === data.tournament._id ? data.tournament : t)));
      } else {
        setAwardsError(data.message || 'Failed to compute awards');
      }
    } catch (error) {
      console.error('Error computing awards:', error);
      setAwardsError('Failed to compute awards');
    } finally {
      setComputingAwards(false);
    }
  };

  const handleSaveHouseRules = async () => {
    if (!selectedTournament || savingHouseRules) return;
    setSavingHouseRules(true);
    setHouseRulesError('');
    setHouseRulesSaved(false);
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}`, {
        method: 'PUT',
        body: JSON.stringify({ houseRules: houseRulesText }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments(prev => prev.map(t => (t._id === data.tournament._id ? data.tournament : t)));
        setHouseRulesSaved(true);
      } else {
        setHouseRulesError(data.message || 'Failed to save house rules');
      }
    } catch (error) {
      console.error('Error saving house rules:', error);
      setHouseRulesError('Failed to save house rules');
    } finally {
      setSavingHouseRules(false);
    }
  };

  useChatSocket({
    scope: 'tournament',
    id: selectedTournament?._id || '',
    token,
    enabled: activeTab === 'announcements' && Boolean(selectedTournament),
    onMessage: (message) => setAnnouncements(prev => [...prev, message]),
  });

  const handlePostAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announcementText.trim() || !selectedTournament || postingAnnouncement) return;
    setPostingAnnouncement(true);
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: announcementText }),
      });
      const data = await res.json();
      if (data.success) setAnnouncementText('');
    } finally {
      setPostingAnnouncement(false);
    }
  };

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
            <button
              className={`${styles.tab} ${activeTab === 'announcements' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('announcements')}
            >
              📢 Announcements
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'awards' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('awards')}
            >
              🎖️ Awards
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'rules' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              📜 House Rules
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
            {selectedTournament.standings.length === 0 ? (
              <p className={styles.infoText}>No standings yet — register teams and complete a match to populate the points table.</p>
            ) : (
              <div className={styles.standingsTable}>
                <div className={styles.tableHeader}>
                  <div className={styles.col1}>Rank</div>
                  <div className={styles.col2}>Team</div>
                  <div className={styles.col3}>P</div>
                  <div className={styles.col4}>W</div>
                  <div className={styles.col5}>L</div>
                  <div className={styles.col6}>T</div>
                  <div className={styles.col7}>NR</div>
                  <div className={styles.col8}>Pts</div>
                  <div className={styles.col9}>NRR</div>
                </div>
                {selectedTournament.standings.map((standing, idx) => (
                  <div key={idx} className={styles.tableRow}>
                    <div className={styles.col1}>{idx + 1}</div>
                    <div className={styles.col2}>{standing.team?.name || 'Team'}</div>
                    <div className={styles.col3}>{standing.played}</div>
                    <div className={styles.col4}>{standing.won}</div>
                    <div className={styles.col5}>{standing.lost}</div>
                    <div className={styles.col6}>{standing.tied}</div>
                    <div className={styles.col7}>{standing.noResult}</div>
                    <div className={styles.col8}>{standing.points}</div>
                    <div className={styles.col9}>{standing.netRunRate >= 0 ? '+' : ''}{standing.netRunRate.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'matches' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Matches</h2>
            {matchesLoading ? (
              <p className={styles.infoText}>Loading matches...</p>
            ) : tournamentMatches.length === 0 ? (
              <>
                <p className={styles.infoText}>
                  No matches linked to this tournament yet. Create one from the New Match page and select this tournament.
                </p>
                {isOrganizer && (
                  <button
                    className={styles.createBtn}
                    onClick={handleGenerateFixtures}
                    disabled={generatingFixtures}
                  >
                    {generatingFixtures ? 'Generating Fixtures...' : '⚡ Generate Fixtures'}
                  </button>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-3 mt-4">
                {tournamentMatches.map(m => (
                  <Link
                    key={m._id}
                    href={m.status === 'Completed' ? `/match/${m._id}` : `/match/${m._id}/score`}
                    className="flex items-center justify-between gap-3 bg-surface-alt border border-border rounded-lg p-3 hover:bg-surface-hover transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-ink">{m.team1.name} vs {m.team2.name}</p>
                      <p className="text-xs text-ink-muted">{new Date(m.scheduledDate).toLocaleDateString()}</p>
                    </div>
                    <Badge variant={m.status === 'Live' ? 'live' : m.status === 'Completed' ? 'success' : m.status === 'Cancelled' ? 'danger' : 'neutral'} pulse={m.status === 'Live'}>
                      {m.status}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
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

        {activeTab === 'announcements' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Announcements</h2>
            {isOrganizer && (
              <form onSubmit={handlePostAnnouncement} className="flex gap-2 my-4">
                <input
                  type="text"
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="Post an announcement to everyone following this tournament..."
                  className={`flex-1 ${inputClass}`}
                />
                <button type="submit" disabled={postingAnnouncement || !announcementText.trim()} className={buttonVariants('primary')}>
                  Post
                </button>
              </form>
            )}
            {announcements.length === 0 ? (
              <p className={styles.infoText}>No announcements yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {announcements.map(a => (
                  <div key={a._id} className="border-b border-border pb-2">
                    <p className="text-xs text-ink-muted">
                      {a.sender.name} · {new Date(a.createdAt).toLocaleString()}
                    </p>
                    <p className="text-ink">{a.text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'awards' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - Awards</h2>
            {!selectedTournament.awards?.winner ? (
              <>
                <p className={styles.infoText}>
                  {selectedTournament.status === 'Completed'
                    ? 'Awards have not been computed for this tournament yet.'
                    : 'Awards can be computed once this tournament is marked Completed.'}
                </p>
                {awardsError && <p className={styles.infoText} style={{ color: '#F87171' }}>{awardsError}</p>}
                {isOrganizer && selectedTournament.status === 'Completed' && (
                  <button
                    className={buttonVariants('accent')}
                    onClick={handleComputeAwards}
                    disabled={computingAwards}
                  >
                    {computingAwards ? 'Computing...' : '🎖️ Compute Awards'}
                  </button>
                )}
              </>
            ) : (
              <div className={styles.statsGrid}>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Winner</span>
                  <span className={styles.statValue}>{selectedTournament.awards.winner?.name || '-'}</span>
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Runner-up</span>
                  <span className={styles.statValue}>{selectedTournament.awards.runnerUp?.name || '-'}</span>
                </div>
                {selectedTournament.awards.thirdPlace && (
                  <div className={styles.statBox}>
                    <span className={styles.statLabel}>Third Place</span>
                    <span className={styles.statValue}>{selectedTournament.awards.thirdPlace?.name || '-'}</span>
                  </div>
                )}
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Man of the Tournament</span>
                  <span className={styles.statValue}>{selectedTournament.awards.manOfTheTournament?.user?.name || '-'}</span>
                  {selectedTournament.awards.manOfTheTournament?.specialization && (
                    <span className={styles.statSubtext}>{selectedTournament.awards.manOfTheTournament.specialization}</span>
                  )}
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Best Batsman</span>
                  <span className={styles.statValue}>{selectedTournament.awards.bestBatsman?.user?.name || '-'}</span>
                  {selectedTournament.awards.bestBatsman?.specialization && (
                    <span className={styles.statSubtext}>{selectedTournament.awards.bestBatsman.specialization}</span>
                  )}
                </div>
                <div className={styles.statBox}>
                  <span className={styles.statLabel}>Best Bowler</span>
                  <span className={styles.statValue}>{selectedTournament.awards.bestBowler?.user?.name || '-'}</span>
                  {selectedTournament.awards.bestBowler?.specialization && (
                    <span className={styles.statSubtext}>{selectedTournament.awards.bestBowler.specialization}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'rules' && selectedTournament && (
          <div className={styles.card}>
            <h2>{selectedTournament.name} - House Rules</h2>
            {isOrganizer ? (
              <>
                <p className={styles.infoText}>
                  Used by the in-app assistant to answer rules questions specific to your tournament — anything that
                  differs from standard cricket laws (overs, boundary rules, wide/no-ball variants, etc.) should go here.
                </p>
                <textarea
                  className={`${inputClass} w-full`}
                  rows={8}
                  maxLength={5000}
                  value={houseRulesText}
                  onChange={(e) => {
                    setHouseRulesText(e.target.value);
                    setHouseRulesSaved(false);
                  }}
                  placeholder="e.g. Boundary is 4 runs, not 6. Maximum 4 overs per bowler. Retired players may bat again..."
                />
                <div className="flex items-center gap-3 mt-3">
                  <button
                    className={buttonVariants('primary')}
                    onClick={handleSaveHouseRules}
                    disabled={savingHouseRules}
                  >
                    {savingHouseRules ? 'Saving...' : 'Save House Rules'}
                  </button>
                  <span className="text-xs text-ink-muted">{houseRulesText.length}/5000</span>
                  {houseRulesSaved && <span className="text-sm text-pitch-500">Saved</span>}
                </div>
                {houseRulesError && (
                  <p className={styles.infoText} style={{ color: '#F87171' }}>{houseRulesError}</p>
                )}
              </>
            ) : selectedTournament.houseRules ? (
              <p className={styles.infoText} style={{ whiteSpace: 'pre-wrap' }}>{selectedTournament.houseRules}</p>
            ) : (
              <p className={styles.infoText}>The organizer hasn&apos;t set any house rules for this tournament.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManager;
