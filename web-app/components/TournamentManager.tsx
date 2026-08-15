'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './TournamentManager.module.css';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useChatSocket, ChatMessage } from '@/hooks/useChatSocket';
import { inputClass, labelClass, errorBoxClass } from '@/components/ui/formStyles';
import { buttonVariants } from '@/components/ui/buttonStyles';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';

const TOURNAMENT_FORMATS = ['League', 'Knockout', 'Group', 'Round-Robin'] as const;
const TOURNAMENT_MATCH_TYPES = ['T20', 'T10', 'ODI', 'Test'] as const;

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

interface TournamentGroup {
  name: string;
  teams: { _id: string; name: string }[];
}

interface TournamentDivision {
  name: string;
  teams: { _id: string; name: string }[];
  groups: TournamentGroup[];
  awards: TournamentAwards;
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
  groups?: TournamentGroup[];
  divisions?: TournamentDivision[];
  organizer: { _id: string; name: string };
  houseRules?: string;
  houseRulesDocument?: { url: string | null; fileName: string | null; uploadedAt: string | null };
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

// Only present on the standings response when the tournament has groups (see
// getTournamentStandings in tournamentController.js) - a flat tournament instead returns
// {success, leaderboard}, unchanged from before groups existed.
interface GroupStandingsResponse {
  name: string;
  standings: any[];
}

const KNOCKOUT_ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'] as const;

interface TournamentMatch {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  scheduledDate: string;
  round?: (typeof KNOCKOUT_ROUNDS)[number] | 'Group';
  group?: string | null;
  division?: string | null;
  result?: { winningTeam: string; margin: string; marginValue: number } | null;
}

interface League {
  _id: string;
  name: string;
}

interface LeaderboardBatsman {
  player: { _id: string; name: string; specialization: string };
  matches: number;
  runs: number;
  highestScore: number;
  average: number;
  strikeRate: number;
}

interface LeaderboardBowler {
  player: { _id: string; name: string; specialization: string };
  matches: number;
  wickets: number;
  average: number;
  economyRate: number;
}

interface LeaderboardFielder {
  player: { _id: string; name: string; specialization: string };
  matches: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  dismissals: number;
}

interface LeaderboardTopPerformer {
  player: { _id: string; name: string; specialization: string };
  points: number;
}

interface TournamentManagerProps {
  tournamentId?: string;
  // Pre-fills and opens the create-tournament form scoped to this league - set when arriving
  // from a league's "Create Tournament" action (see app/leagues/[id]/page.tsx).
  initialLeagueId?: string;
}

export const TournamentManager: React.FC<TournamentManagerProps> = ({ tournamentId, initialLeagueId }) => {
  const { user, token } = useAuth();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'standings' | 'matches' | 'bracket' | 'statistics' | 'announcements' | 'awards' | 'rules'>('list');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [announcements, setAnnouncements] = useState<ChatMessage[]>([]);
  const [announcementText, setAnnouncementText] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [tournamentMatches, setTournamentMatches] = useState<TournamentMatch[]>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [generatingFixtures, setGeneratingFixtures] = useState(false);
  const [computingAwards, setComputingAwards] = useState(false);
  const [awardsError, setAwardsError] = useState('');
  const [leaderboard, setLeaderboard] = useState<{ batsmen: LeaderboardBatsman[]; bowlers: LeaderboardBowler[]; fielding: LeaderboardFielder[]; topPerformers: LeaderboardTopPerformer[] } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [groupStandings, setGroupStandings] = useState<GroupStandingsResponse[] | null>(null);
  const [groupStandingsLoading, setGroupStandingsLoading] = useState(false);
  const [groupCountInput, setGroupCountInput] = useState('2');
  const [assigningGroups, setAssigningGroups] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  // Divisions - a tournament with divisions runs each as a fully independent competition
  // (own groups/standings/bracket/awards). selectedDivision scopes every division-aware tab.
  const [selectedDivision, setSelectedDivision] = useState<string | null>(null);
  const [divisionCountInput, setDivisionCountInput] = useState('2');
  const [assigningDivisions, setAssigningDivisions] = useState(false);
  const [divisionsError, setDivisionsError] = useState('');
  const [qualifiersInput, setQualifiersInput] = useState('4');
  const [generatingKnockout, setGeneratingKnockout] = useState(false);
  const [advancingRound, setAdvancingRound] = useState(false);
  const [knockoutError, setKnockoutError] = useState('');
  const [houseRulesText, setHouseRulesText] = useState('');
  const [savingHouseRules, setSavingHouseRules] = useState(false);
  const [houseRulesError, setHouseRulesError] = useState('');
  const [houseRulesSaved, setHouseRulesSaved] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');
  const docFileInputRef = React.useRef<HTMLInputElement>(null);

  // Create tournament form
  const [createName, setCreateName] = useState('');
  const [createDescription, setCreateDescription] = useState('');
  const [createFormat, setCreateFormat] = useState<(typeof TOURNAMENT_FORMATS)[number]>('League');
  const [createMatchType, setCreateMatchType] = useState<(typeof TOURNAMENT_MATCH_TYPES)[number]>('T20');
  const [createVenue, setCreateVenue] = useState('');
  const [createStartDate, setCreateStartDate] = useState('');
  const [createEndDate, setCreateEndDate] = useState('');
  const [createRegistrationDeadline, setCreateRegistrationDeadline] = useState('');
  const [createMaxTeams, setCreateMaxTeams] = useState('');
  const [createLeagueId, setCreateLeagueId] = useState('');
  const [creatingTournament, setCreatingTournament] = useState(false);
  const [createError, setCreateError] = useState('');
  const [leagues, setLeagues] = useState<League[]>([]);

  const isOrganizer = Boolean(user && selectedTournament && selectedTournament.organizer?._id === user.id);

  useEffect(() => {
    setHouseRulesText(selectedTournament?.houseRules || '');
    setHouseRulesError('');
    setHouseRulesSaved(false);
  }, [selectedTournament?._id]);

  // Default to the first division whenever a divisioned tournament is opened, or clear it for
  // a tournament with no divisions - every division-scoped tab reads selectedDivision.
  useEffect(() => {
    setSelectedDivision(selectedTournament?.divisions?.[0]?.name ?? null);
  }, [selectedTournament?._id, selectedTournament?.divisions?.length]);

  useEffect(() => {
    if (activeTab === 'announcements' && selectedTournament) {
      fetch(`/api/tournaments/${selectedTournament._id}/messages`)
        .then(r => r.json())
        .then(data => { if (data.success) setAnnouncements(data.messages); });
    }
  }, [activeTab, selectedTournament]);

  useEffect(() => {
    if (activeTab === 'awards' && selectedTournament) {
      const hasDivisions = (selectedTournament.divisions?.length ?? 0) > 0;
      if (hasDivisions && !selectedDivision) return; // waiting on the division-default effect
      setLeaderboardLoading(true);
      const query = hasDivisions ? `?limit=20&division=${encodeURIComponent(selectedDivision!)}` : '?limit=20';
      fetch(`/api/tournaments/${selectedTournament._id}/leaderboard${query}`)
        .then(r => r.json())
        .then(data => { if (data.success) setLeaderboard({ batsmen: data.batsmen, bowlers: data.bowlers, fielding: data.fielding, topPerformers: data.topPerformers }); })
        .finally(() => setLeaderboardLoading(false));
    }
  }, [activeTab, selectedTournament, selectedDivision]);

  const fetchTournamentMatches = (id: string) => {
    setMatchesLoading(true);
    return fetch(`/api/tournaments/${id}/matches`)
      .then(r => r.json())
      .then(data => { if (data.success) setTournamentMatches(data.matches); })
      .finally(() => setMatchesLoading(false));
  };

  useEffect(() => {
    if ((activeTab === 'matches' || activeTab === 'bracket') && selectedTournament) {
      fetchTournamentMatches(selectedTournament._id);
    }
  }, [activeTab, selectedTournament]);

  // Grouped per-group standings live on a separate response shape from GET .../standings (see
  // getTournamentStandings) - {groups: [...]} for a tournament with flat groups, or
  // {divisions: [{name, groups}]} for one with divisions, in which case only the currently
  // selected division's groups get displayed.
  useEffect(() => {
    const hasGroups = (selectedTournament?.groups?.length ?? 0) > 0;
    const hasDivisions = (selectedTournament?.divisions?.length ?? 0) > 0;
    if (activeTab === 'standings' && selectedTournament && (hasGroups || hasDivisions)) {
      setGroupStandingsLoading(true);
      fetch(`/api/tournaments/${selectedTournament._id}/standings`)
        .then((r) => r.json())
        .then((data) => {
          if (!data.success) return;
          if (data.groups) setGroupStandings(data.groups);
          else if (data.divisions) {
            const division = data.divisions.find((d: { name: string; groups: GroupStandingsResponse[] }) => d.name === selectedDivision);
            setGroupStandings(division?.groups ?? null);
          }
        })
        .finally(() => setGroupStandingsLoading(false));
    } else {
      setGroupStandings(null);
    }
  }, [activeTab, selectedTournament, selectedDivision]);

  const handleAssignDivisions = async () => {
    if (!selectedTournament || assigningDivisions) return;
    const count = parseInt(divisionCountInput, 10);
    if (!count || count < 1) {
      setDivisionsError('Enter a valid number of divisions');
      return;
    }
    setAssigningDivisions(true);
    setDivisionsError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/assign-divisions`, {
        method: 'POST',
        body: JSON.stringify({ divisionCount: count }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments((prev) => prev.map((t) => (t._id === data.tournament._id ? data.tournament : t)));
      } else {
        setDivisionsError(data.message || 'Failed to assign divisions');
      }
    } catch (error) {
      console.error('Error assigning divisions:', error);
      setDivisionsError('Failed to assign divisions');
    } finally {
      setAssigningDivisions(false);
    }
  };

  const handleAssignGroups = async () => {
    if (!selectedTournament || assigningGroups) return;
    const count = parseInt(groupCountInput, 10);
    if (!count || count < 1) {
      setGroupsError('Enter a valid number of groups');
      return;
    }
    setAssigningGroups(true);
    setGroupsError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/assign-groups`, {
        method: 'POST',
        body: JSON.stringify({ groupCount: count, division: selectedTournament.divisions?.length ? selectedDivision : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments((prev) => prev.map((t) => (t._id === data.tournament._id ? data.tournament : t)));
      } else {
        setGroupsError(data.message || 'Failed to assign groups');
      }
    } catch (error) {
      console.error('Error assigning groups:', error);
      setGroupsError('Failed to assign groups');
    } finally {
      setAssigningGroups(false);
    }
  };

  const handleGenerateKnockoutStage = async () => {
    if (!selectedTournament || generatingKnockout) return;
    const qualifiersPerGroup = parseInt(qualifiersInput, 10) || 4;
    setGeneratingKnockout(true);
    setKnockoutError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/generate-knockout-stage`, {
        method: 'POST',
        body: JSON.stringify({ qualifiersPerGroup, division: selectedTournament.divisions?.length ? selectedDivision : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTournamentMatches(selectedTournament._id);
      } else {
        setKnockoutError(data.message || 'Failed to generate the knockout stage');
      }
    } catch (error) {
      console.error('Error generating knockout stage:', error);
      setKnockoutError('Failed to generate the knockout stage');
    } finally {
      setGeneratingKnockout(false);
    }
  };

  const handleAdvanceKnockoutRound = async () => {
    if (!selectedTournament || advancingRound) return;
    setAdvancingRound(true);
    setKnockoutError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/advance-knockout-round`, {
        method: 'POST',
        body: JSON.stringify({ division: selectedTournament.divisions?.length ? selectedDivision : undefined }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchTournamentMatches(selectedTournament._id);
        if (data.tournament) {
          setSelectedTournament(data.tournament);
          setTournaments((prev) => prev.map((t) => (t._id === data.tournament._id ? data.tournament : t)));
        }
      } else {
        setKnockoutError(data.message || 'Failed to advance the knockout stage');
      }
    } catch (error) {
      console.error('Error advancing knockout round:', error);
      setKnockoutError('Failed to advance the knockout stage');
    } finally {
      setAdvancingRound(false);
    }
  };

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

  const handleUploadHouseRulesDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTournament) return;
    setUploadingDoc(true);
    setDocUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/tournaments/${selectedTournament._id}/house-rules-document`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments(prev => prev.map(t => (t._id === data.tournament._id ? data.tournament : t)));
      } else {
        setDocUploadError(data.message || 'Upload failed');
      }
    } catch {
      setDocUploadError('Could not reach the CricRoots server');
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleRemoveHouseRulesDocument = async () => {
    if (!selectedTournament) return;
    setDocUploadError('');
    try {
      const res = await apiFetch(`/api/tournaments/${selectedTournament._id}/house-rules-document`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (data.success) {
        setSelectedTournament(data.tournament);
        setTournaments(prev => prev.map(t => (t._id === data.tournament._id ? data.tournament : t)));
      } else {
        setDocUploadError(data.message || 'Failed to remove document');
      }
    } catch {
      setDocUploadError('Could not reach the CricRoots server');
    }
  };

  const resetCreateForm = () => {
    setCreateName('');
    setCreateDescription('');
    setCreateFormat('League');
    setCreateMatchType('T20');
    setCreateVenue('');
    setCreateStartDate('');
    setCreateEndDate('');
    setCreateRegistrationDeadline('');
    setCreateMaxTeams('');
    setCreateLeagueId('');
    setCreateError('');
  };

  const handleCreateTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingTournament) return;
    if (!createName.trim() || !createVenue.trim() || !createStartDate || !createEndDate || !createRegistrationDeadline) {
      setCreateError('Please fill in all required fields');
      return;
    }
    setCreatingTournament(true);
    setCreateError('');
    try {
      const res = await apiFetch('/api/tournaments', {
        method: 'POST',
        body: JSON.stringify({
          name: createName.trim(),
          description: createDescription.trim() || undefined,
          format: createFormat,
          matchType: createMatchType,
          venue: createVenue.trim(),
          startDate: createStartDate,
          endDate: createEndDate,
          registrationDeadline: createRegistrationDeadline,
          maxTeams: createMaxTeams ? Number(createMaxTeams) : undefined,
          leagueId: createLeagueId || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setTournaments(prev => [data.tournament, ...prev]);
        setSelectedTournament(data.tournament);
        setActiveTab('standings');
        setShowCreateForm(false);
        resetCreateForm();
      } else {
        setCreateError(data.message || 'Could not create tournament');
      }
    } catch (error) {
      console.error('Error creating tournament:', error);
      setCreateError('Could not reach the CricRoots server');
    } finally {
      setCreatingTournament(false);
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
    fetch('/api/leagues')
      .then(r => r.json())
      .then(data => { if (data.success) setLeagues(data.leagues); });
  }, []);

  // Arriving from a league's "Create Tournament" action - open the form pre-scoped to it.
  useEffect(() => {
    if (initialLeagueId) {
      setCreateLeagueId(initialLeagueId);
      setShowCreateForm(true);
    }
  }, [initialLeagueId]);

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
        <button
          className={styles.createBtn}
          onClick={() => {
            const next = !showCreateForm;
            setShowCreateForm(next);
            if (next) {
              setActiveTab('list');
            } else {
              resetCreateForm();
            }
          }}
        >
          {showCreateForm ? 'Cancel' : '+ Create Tournament'}
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
              className={`${styles.tab} ${activeTab === 'bracket' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('bracket')}
            >
              🥇 Bracket
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
        {!showCreateForm && selectedTournament && (selectedTournament.divisions?.length ?? 0) > 0 &&
          ['standings', 'matches', 'bracket', 'awards'].includes(activeTab) && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
              {selectedTournament.divisions!.map((d) => (
                <button
                  key={d.name}
                  onClick={() => setSelectedDivision(d.name)}
                  className={buttonVariants(d.name === selectedDivision ? 'primary' : 'secondary')}
                  style={{ padding: '6px 14px', fontSize: 13 }}
                >
                  {d.name}
                </button>
              ))}
            </div>
          )}

        {showCreateForm && (
          <div className={styles.card} style={{ marginBottom: 24 }}>
            <h2>Create Tournament</h2>
            {createError && <div className={`${errorBoxClass} mb-4`}>{createError}</div>}
            <form onSubmit={handleCreateTournament} className="space-y-4">
              <div>
                <label htmlFor="t-name" className={labelClass}>Tournament Name</label>
                <input
                  id="t-name"
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="t-description" className={labelClass}>Description</label>
                <textarea
                  id="t-description"
                  rows={3}
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  className={`${inputClass} w-full`}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="t-format" className={labelClass}>Format</label>
                  <select id="t-format" value={createFormat} onChange={(e) => setCreateFormat(e.target.value as typeof createFormat)} className={inputClass}>
                    {TOURNAMENT_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="t-matchType" className={labelClass}>Match Type</label>
                  <select id="t-matchType" value={createMatchType} onChange={(e) => setCreateMatchType(e.target.value as typeof createMatchType)} className={inputClass}>
                    {TOURNAMENT_MATCH_TYPES.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="t-venue" className={labelClass}>Venue</label>
                <input
                  id="t-venue"
                  type="text"
                  required
                  value={createVenue}
                  onChange={(e) => setCreateVenue(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="t-start" className={labelClass}>Start Date</label>
                  <input
                    id="t-start"
                    type="date"
                    required
                    value={createStartDate}
                    onChange={(e) => setCreateStartDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="t-end" className={labelClass}>End Date</label>
                  <input
                    id="t-end"
                    type="date"
                    required
                    value={createEndDate}
                    onChange={(e) => setCreateEndDate(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="t-reg" className={labelClass}>Registration Deadline</label>
                  <input
                    id="t-reg"
                    type="date"
                    required
                    value={createRegistrationDeadline}
                    onChange={(e) => setCreateRegistrationDeadline(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="t-maxTeams" className={labelClass}>Max Teams</label>
                  <input
                    id="t-maxTeams"
                    type="number"
                    min={2}
                    placeholder="8"
                    value={createMaxTeams}
                    onChange={(e) => setCreateMaxTeams(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="t-league" className={labelClass}>League (optional)</label>
                <select id="t-league" value={createLeagueId} onChange={(e) => setCreateLeagueId(e.target.value)} className={inputClass}>
                  <option value="">None</option>
                  {leagues.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" disabled={creatingTournament}>
                  {creatingTournament ? 'Creating...' : 'Create Tournament'}
                </Button>
                <button
                  type="button"
                  className="text-sm text-ink-muted hover:underline"
                  onClick={() => {
                    setShowCreateForm(false);
                    resetCreateForm();
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

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
            {(selectedTournament.groups?.length ?? 0) > 0 ? (
              groupStandingsLoading || !groupStandings ? (
                <p className={styles.infoText}>Loading group standings...</p>
              ) : (
                groupStandings.map((group) => (
                  <div key={group.name} style={{ marginBottom: 28 }}>
                    <h3 style={{ marginBottom: 8 }}>{group.name}</h3>
                    {group.standings.length === 0 ? (
                      <p className={styles.infoText}>No completed matches in this group yet.</p>
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
                        {group.standings.map((standing, idx) => (
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
                ))
              )
            ) : selectedTournament.standings.length === 0 ? (
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

        {activeTab === 'matches' && selectedTournament && (() => {
          const hasDivisions = (selectedTournament.divisions?.length ?? 0) > 0;
          const currentDivision = selectedTournament.divisions?.find((d) => d.name === selectedDivision);
          const scopedMatches = hasDivisions
            ? tournamentMatches.filter((m) => m.division === selectedDivision)
            : tournamentMatches;

          return (
            <div className={styles.card}>
              <h2>{selectedTournament.name} - Matches{hasDivisions ? ` - ${selectedDivision}` : ''}</h2>
              {matchesLoading ? (
                <p className={styles.infoText}>Loading matches...</p>
              ) : tournamentMatches.length === 0 ? (
                <>
                  <p className={styles.infoText}>
                    No matches linked to this tournament yet. Create one from the New Match page and select this tournament.
                  </p>
                  {isOrganizer && !hasDivisions && !selectedTournament.groups?.length && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                      <label htmlFor="division-count" className={labelClass} style={{ margin: 0 }}>
                        Split into divisions (optional)
                      </label>
                      <input
                        id="division-count"
                        type="number"
                        min={2}
                        value={divisionCountInput}
                        onChange={(e) => setDivisionCountInput(e.target.value)}
                        className={inputClass}
                        style={{ width: 70 }}
                      />
                      <button
                        className={buttonVariants('secondary')}
                        onClick={handleAssignDivisions}
                        disabled={assigningDivisions || selectedTournament.teams.length < 2}
                      >
                        {assigningDivisions ? 'Assigning...' : 'Assign Divisions'}
                      </button>
                    </div>
                  )}
                  {divisionsError && <p className={styles.infoText} style={{ color: '#F87171' }}>{divisionsError}</p>}

                  {hasDivisions ? (
                    <div style={{ margin: '12px 0' }}>
                      <p className={styles.infoText}>
                        {currentDivision?.groups.length
                          ? `${currentDivision.groups.length} groups assigned in ${selectedDivision} (${currentDivision.groups.map((g) => `${g.name}: ${g.teams.length}`).join(', ')}).`
                          : `No groups assigned in ${selectedDivision} yet - every division needs its own groups before fixtures can be generated.`}
                      </p>
                      {isOrganizer && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                          <label htmlFor="group-count" className={labelClass} style={{ margin: 0 }}>
                            Groups in {selectedDivision}
                          </label>
                          <input
                            id="group-count"
                            type="number"
                            min={2}
                            value={groupCountInput}
                            onChange={(e) => setGroupCountInput(e.target.value)}
                            className={inputClass}
                            style={{ width: 70 }}
                          />
                          <button
                            className={buttonVariants('secondary')}
                            onClick={handleAssignGroups}
                            disabled={assigningGroups || (currentDivision?.teams.length ?? 0) < 2}
                          >
                            {assigningGroups ? 'Assigning...' : `Assign Groups in ${selectedDivision}`}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      {isOrganizer && !selectedTournament.groups?.length && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '12px 0' }}>
                          <label htmlFor="group-count" className={labelClass} style={{ margin: 0 }}>
                            Split into groups (optional)
                          </label>
                          <input
                            id="group-count"
                            type="number"
                            min={2}
                            value={groupCountInput}
                            onChange={(e) => setGroupCountInput(e.target.value)}
                            className={inputClass}
                            style={{ width: 70 }}
                          />
                          <button
                            className={buttonVariants('secondary')}
                            onClick={handleAssignGroups}
                            disabled={assigningGroups || selectedTournament.teams.length < 2}
                          >
                            {assigningGroups ? 'Assigning...' : 'Assign Groups'}
                          </button>
                        </div>
                      )}
                      {selectedTournament.groups?.length ? (
                        <p className={styles.infoText}>
                          {selectedTournament.groups.length} groups assigned ({selectedTournament.groups.map((g) => `${g.name}: ${g.teams.length}`).join(', ')}).
                          Generating fixtures below will create a round-robin within each group.
                        </p>
                      ) : null}
                    </>
                  )}
                  {groupsError && <p className={styles.infoText} style={{ color: '#F87171' }}>{groupsError}</p>}
                  {isOrganizer && (
                    <button
                      className={styles.createBtn}
                      onClick={handleGenerateFixtures}
                      disabled={generatingFixtures}
                    >
                      {generatingFixtures ? 'Generating Fixtures...' : '⚡ Generate Fixtures (all divisions)'}
                    </button>
                  )}
                </>
              ) : (
                <div className="flex flex-col gap-3 mt-4">
                  {scopedMatches.map(m => (
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
          );
        })()}

        {activeTab === 'bracket' && selectedTournament && (() => {
          const hasDivisions = (selectedTournament.divisions?.length ?? 0) > 0;
          const currentDivision = selectedTournament.divisions?.find((d) => d.name === selectedDivision);
          const scopedMatches = hasDivisions
            ? tournamentMatches.filter((m) => m.division === selectedDivision)
            : tournamentMatches;
          const knockoutMatches = scopedMatches.filter((m) => m.round && m.round !== 'Group');
          const byRound = KNOCKOUT_ROUNDS.map((round) => ({
            round,
            matches: knockoutMatches.filter((m) => m.round === round),
          })).filter((r) => r.matches.length > 0);
          const hasGroups = hasDivisions
            ? (currentDivision?.groups.length ?? 0) > 0
            : (selectedTournament.groups?.length ?? 0) > 0;
          const finalDone = knockoutMatches.some((m) => m.round === 'Final' && m.status === 'Completed');

          const winnerName = (m: TournamentMatch) => {
            if (m.status !== 'Completed' || !m.result?.winningTeam) return null;
            return m.result.winningTeam === m.team1._id ? m.team1.name : m.team2.name;
          };

          return (
            <div className={styles.card}>
              <h2>{selectedTournament.name} - Knockout Bracket{hasDivisions ? ` - ${selectedDivision}` : ''}</h2>
              {!hasGroups ? (
                <p className={styles.infoText}>
                  {hasDivisions
                    ? `${selectedDivision} has no group stage yet, so there's no bracket to generate here.`
                    : "This tournament has no group stage, so there's no bracket to generate here."}
                </p>
              ) : (
                <>
                  {isOrganizer && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
                      {knockoutMatches.length === 0 ? (
                        <>
                          <label htmlFor="qualifiers" className={labelClass} style={{ margin: 0 }}>
                            Qualifiers per group
                          </label>
                          <input
                            id="qualifiers"
                            type="number"
                            min={2}
                            value={qualifiersInput}
                            onChange={(e) => setQualifiersInput(e.target.value)}
                            className={inputClass}
                            style={{ width: 70 }}
                          />
                          <button
                            className={buttonVariants('accent')}
                            onClick={handleGenerateKnockoutStage}
                            disabled={generatingKnockout}
                          >
                            {generatingKnockout ? 'Generating...' : '🥇 Generate Knockout Stage'}
                          </button>
                        </>
                      ) : !finalDone ? (
                        <button
                          className={buttonVariants('accent')}
                          onClick={handleAdvanceKnockoutRound}
                          disabled={advancingRound}
                        >
                          {advancingRound ? 'Advancing...' : '➡️ Advance to Next Round'}
                        </button>
                      ) : (
                        <p className={styles.infoText} style={{ margin: 0 }}>
                          The Final is complete. Check the Awards tab for the tournament winner.
                        </p>
                      )}
                    </div>
                  )}
                  {knockoutError && <p className={styles.infoText} style={{ color: '#F87171' }}>{knockoutError}</p>}

                  {byRound.length === 0 ? (
                    <p className={styles.infoText}>
                      No knockout matches yet. {isOrganizer ? 'Generate the knockout stage above once the group stage is far enough along.' : 'Check back once the organizer generates it.'}
                    </p>
                  ) : (
                    <div className="flex flex-col gap-6">
                      {byRound.map(({ round, matches }) => (
                        <div key={round}>
                          <h3 style={{ marginBottom: 8 }}>{round}</h3>
                          <div className="flex flex-col gap-2">
                            {matches.map((m) => {
                              const winner = winnerName(m);
                              return (
                                <Link
                                  key={m._id}
                                  href={m.status === 'Completed' ? `/match/${m._id}` : `/match/${m._id}/score`}
                                  className="flex items-center justify-between gap-3 bg-surface-alt border border-border rounded-lg p-3 hover:bg-surface-hover transition-colors"
                                >
                                  <div className="text-sm text-ink">
                                    <span style={{ fontWeight: winner === m.team1.name ? 700 : 400 }}>{m.team1.name}</span>
                                    {' vs '}
                                    <span style={{ fontWeight: winner === m.team2.name ? 700 : 400 }}>{m.team2.name}</span>
                                    {winner && <span className="text-ink-muted"> · {winner} won</span>}
                                  </div>
                                  <Badge variant={m.status === 'Live' ? 'live' : m.status === 'Completed' ? 'success' : 'neutral'} pulse={m.status === 'Live'}>
                                    {m.status}
                                  </Badge>
                                </Link>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })()}

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

        {activeTab === 'awards' && selectedTournament && (() => {
          const hasDivisions = (selectedTournament.divisions?.length ?? 0) > 0;
          const currentDivision = selectedTournament.divisions?.find((d) => d.name === selectedDivision);
          const awards = hasDivisions ? currentDivision?.awards : selectedTournament.awards;

          return (
            <>
              <div className={styles.card}>
                <h2>{selectedTournament.name} - Awards{hasDivisions ? ` - ${selectedDivision}` : ''}</h2>
                {!awards?.winner ? (
                  <>
                    <p className={styles.infoText}>
                      {hasDivisions
                        ? `${selectedDivision}'s winner is set automatically once its Final completes (see the Bracket tab) - other awards for it can be computed below once the whole tournament is Completed.`
                        : selectedTournament.status === 'Completed'
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
                      <span className={styles.statValue}>{awards.winner?.name || '-'}</span>
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Runner-up</span>
                      <span className={styles.statValue}>{awards.runnerUp?.name || '-'}</span>
                    </div>
                    {awards.thirdPlace && (
                      <div className={styles.statBox}>
                        <span className={styles.statLabel}>Third Place</span>
                        <span className={styles.statValue}>{awards.thirdPlace?.name || '-'}</span>
                      </div>
                    )}
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Man of the Tournament</span>
                      <span className={styles.statValue}>{awards.manOfTheTournament?.user?.name || '-'}</span>
                      {awards.manOfTheTournament?.specialization && (
                        <span className={styles.statSubtext}>{awards.manOfTheTournament.specialization}</span>
                      )}
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Best Batsman</span>
                      <span className={styles.statValue}>{awards.bestBatsman?.user?.name || '-'}</span>
                      {awards.bestBatsman?.specialization && (
                        <span className={styles.statSubtext}>{awards.bestBatsman.specialization}</span>
                      )}
                    </div>
                    <div className={styles.statBox}>
                      <span className={styles.statLabel}>Best Bowler</span>
                      <span className={styles.statValue}>{awards.bestBowler?.user?.name || '-'}</span>
                      {awards.bestBowler?.specialization && (
                        <span className={styles.statSubtext}>{awards.bestBowler.specialization}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.card} style={{ marginTop: 20 }}>
                <h2>Top Performers{hasDivisions ? ` - ${selectedDivision}` : ''}</h2>
                {leaderboardLoading || !leaderboard ? (
                  <p className={styles.infoText}>Loading...</p>
                ) : leaderboard.batsmen.length === 0 && leaderboard.bowlers.length === 0 ? (
                  <p className={styles.infoText}>No completed matches yet - top performers appear once some matches finish.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div>
                      <h3 style={{ marginBottom: 8 }}>Leading Run Scorers</h3>
                      {leaderboard.batsmen.length === 0 ? (
                        <p className={styles.infoText}>No qualifying innings yet.</p>
                      ) : (
                        leaderboard.batsmen.map((b, i) => (
                          <div key={b.player._id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                            <span className="text-ink">
                              {b.player._id === awards?.bestBatsman?._id && '🏆 '}
                              {i + 1}. {b.player.name}
                            </span>
                            <span className="text-ink-secondary font-mono">
                              {b.runs} runs · avg {b.average} · SR {b.strikeRate}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <h3 style={{ marginBottom: 8 }}>Leading Wicket Takers</h3>
                      {leaderboard.bowlers.length === 0 ? (
                        <p className={styles.infoText}>No qualifying spells yet.</p>
                      ) : (
                        leaderboard.bowlers.map((b, i) => (
                          <div key={b.player._id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                            <span className="text-ink">
                              {b.player._id === awards?.bestBowler?._id && '🏆 '}
                              {i + 1}. {b.player.name}
                            </span>
                            <span className="text-ink-secondary font-mono">
                              {b.wickets} wkts · avg {b.average} · econ {b.economyRate}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                    <div>
                      <h3 style={{ marginBottom: 8 }}>Leading Fielders</h3>
                      {leaderboard.fielding.length === 0 ? (
                        <p className={styles.infoText}>No qualifying dismissals yet.</p>
                      ) : (
                        leaderboard.fielding.map((f, i) => (
                          <div key={f.player._id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                            <span className="text-ink">
                              {i + 1}. {f.player.name}
                            </span>
                            <span className="text-ink-secondary font-mono">
                              {f.dismissals} dis · {f.catches}c {f.runOuts}ro {f.stumpings}st
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Combined points ranking across batting/bowling/fielding - a different kind of
                  list from the department-specific ones above, so it gets distinct gold styling
                  rather than looking like a fourth department. */}
              <div
                className={styles.card}
                style={{ marginTop: 20, border: '1px solid #F5A62355', background: 'linear-gradient(180deg, rgba(245,166,35,0.06), transparent)' }}
              >
                <h2 className="flex items-center gap-2">
                  <span className="text-gold-500">🏅</span> Top Performer of Series{hasDivisions ? ` - ${selectedDivision}` : ''}
                </h2>
                <p className={styles.infoText} style={{ marginBottom: 8 }}>
                  Ranked by combined MVP points (batting + bowling + fielding), the same scoring used to pick each match&apos;s Man of the Match.
                </p>
                {leaderboardLoading || !leaderboard ? (
                  <p className={styles.infoText}>Loading...</p>
                ) : leaderboard.topPerformers.length === 0 ? (
                  <p className={styles.infoText}>No completed matches yet.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
                    {leaderboard.topPerformers.map((p, i) => (
                      <div key={p.player._id} className="flex items-center justify-between py-2 border-b border-border text-sm">
                        <span className="text-ink">
                          {i + 1}. {p.player.name}
                        </span>
                        <span className="text-gold-500 font-mono font-semibold">{p.points} pts</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        })()}

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

                <div className="mt-5 pt-4 border-t border-border">
                  <p className={styles.infoText} style={{ marginBottom: 8 }}>
                    Attach a PDF or Word doc as a downloadable reference (e.g. the full printed rulebook) - this is separate
                    from the free-text above, which is what the assistant actually reads.
                  </p>
                  {selectedTournament.houseRulesDocument?.url ? (
                    <div className="flex items-center gap-3">
                      <a
                        href={selectedTournament.houseRulesDocument.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-pitch-400 hover:underline"
                      >
                        📎 {selectedTournament.houseRulesDocument.fileName}
                      </a>
                      <button
                        type="button"
                        className="text-xs text-wicket-400 hover:underline"
                        onClick={handleRemoveHouseRulesDocument}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className={buttonVariants('secondary')}
                      onClick={() => docFileInputRef.current?.click()}
                      disabled={uploadingDoc}
                    >
                      {uploadingDoc ? 'Uploading...' : '📎 Attach Document'}
                    </button>
                  )}
                  <input
                    ref={docFileInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: 'none' }}
                    onChange={handleUploadHouseRulesDocument}
                  />
                  {docUploadError && (
                    <p className={styles.infoText} style={{ color: '#F87171', marginTop: 6 }}>{docUploadError}</p>
                  )}
                </div>
              </>
            ) : (
              <>
                {selectedTournament.houseRules ? (
                  <p className={styles.infoText} style={{ whiteSpace: 'pre-wrap' }}>{selectedTournament.houseRules}</p>
                ) : (
                  <p className={styles.infoText}>The organizer hasn&apos;t set any house rules for this tournament.</p>
                )}
                {selectedTournament.houseRulesDocument?.url && (
                  <a
                    href={selectedTournament.houseRulesDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-pitch-400 hover:underline mt-3 inline-block"
                  >
                    📎 {selectedTournament.houseRulesDocument.fileName}
                  </a>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentManager;
