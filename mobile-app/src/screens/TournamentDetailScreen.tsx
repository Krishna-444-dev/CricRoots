import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, FlatList, TextInput, Linking } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { colors } from '../theme';
import { api, resolveAttachmentUrl } from '../shared/api/apiClient';
import { Tournament, Match, TournamentStanding } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

// Populated relations depend on which endpoint returned them - GET /tournaments/:id populates
// organizer/teams/standings.team/awards.* (players' awards get a nested `user` populate too),
// but the raw Mongoose docs use `_id`, not the `id` field our shared User type declares. These
// helpers stay defensive (accept `any`) rather than trusting the declared type shape at runtime.
function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

function teamName(ref: any): string {
  if (!ref) return 'TBD';
  return typeof ref === 'string' ? 'Team' : ref.name || 'Team';
}

function awardTeamName(ref: any): string | null {
  if (!ref) return null;
  return typeof ref === 'string' ? 'Team' : ref.name || 'Team';
}

function awardPlayerName(ref: any): string | null {
  if (!ref) return null;
  if (typeof ref === 'string') return 'Player';
  const u = ref.user;
  if (u && typeof u === 'object') return u.name || 'Player';
  return ref.specialization || 'Player';
}

function statusColor(status: string) {
  switch (status) {
    case 'Registration':
      return colors.gold500;
    case 'Ongoing':
      return colors.pitch500;
    case 'Completed':
      return colors.info;
    case 'Cancelled':
      return colors.wicket500;
    default:
      return colors.inkMuted;
  }
}

function formatDate(d?: string) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

type Section = 'standings' | 'matches' | 'bracket' | 'statistics' | 'awards' | 'announcements' | 'rules';

const KNOCKOUT_ROUNDS = ['Quarterfinal', 'Semifinal', 'Final'] as const;

function winnerName(m: Match): string | null {
  if (m.status !== 'Completed' || !m.result?.winningTeam) return null;
  const t1Id = resolveId(m.team1);
  return m.result.winningTeam === t1Id ? teamName(m.team1) : teamName(m.team2);
}

interface TournamentStatistics {
  totalMatches: number;
  completedMatches: number;
  totalRuns: number;
  totalWickets: number;
  highestScore: number;
  lowestScore: number;
  highestIndividualScore: number;
  bestBowlingFigures: string;
}

interface Props {
  route: { params: { tournamentId: string } };
  navigation: any;
}

export default function TournamentDetailScreen({ route, navigation }: Props) {
  const { tournamentId } = route.params;
  const { user } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchesLoaded, setMatchesLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<Section>('standings');

  // Register-team picker
  const [registerOpen, setRegisterOpen] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [registerError, setRegisterError] = useState('');

  // Generate fixtures
  const [generating, setGenerating] = useState(false);
  const [fixturesError, setFixturesError] = useState('');

  // Groups + knockout bracket
  const [groupStandings, setGroupStandings] = useState<{ name: string; standings: TournamentStanding[] }[] | null>(null);
  const [groupStandingsLoading, setGroupStandingsLoading] = useState(false);
  const [groupCountInput, setGroupCountInput] = useState('2');
  const [assigningGroups, setAssigningGroups] = useState(false);
  const [groupsError, setGroupsError] = useState('');
  const [qualifiersInput, setQualifiersInput] = useState('4');
  const [generatingKnockout, setGeneratingKnockout] = useState(false);
  const [advancingRound, setAdvancingRound] = useState(false);
  const [knockoutError, setKnockoutError] = useState('');

  // Compute awards
  const [computing, setComputing] = useState(false);
  const [awardsError, setAwardsError] = useState('');

  // Statistics - lazy-loaded the first time the tab is opened (GET /tournaments/:id/statistics
  // is a separate endpoint from the main tournament fetch above).
  const [statistics, setStatistics] = useState<TournamentStatistics | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [statsError, setStatsError] = useState('');

  // Top performers - lazy-loaded the first time the Awards tab is opened.
  const [leaderboard, setLeaderboard] = useState<{ batsmen: any[]; bowlers: any[] } | null>(null);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Announcements - GET is public, POST is organizer-only (enforced server-side too)
  const [announcements, setAnnouncements] = useState<any[] | null>(null);
  const [announcementText, setAnnouncementText] = useState('');
  const [postingAnnouncement, setPostingAnnouncement] = useState(false);
  const [announcementError, setAnnouncementError] = useState('');

  // House rules - organizer-only edit, read-only display for everyone else.
  const [houseRulesText, setHouseRulesText] = useState('');
  const [savingHouseRules, setSavingHouseRules] = useState(false);
  const [houseRulesError, setHouseRulesError] = useState('');
  const [houseRulesSaved, setHouseRulesSaved] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');

  const load = useCallback(() => {
    setError('');
    Promise.all([
      api.tournaments.getTournamentById(tournamentId),
      api.tournaments.getTournamentMatches(tournamentId).catch(() => ({ matches: [] })),
    ])
      .then(([tRes, mRes]) => {
        setTournament(tRes.tournament);
        setMatches(mRes.matches || []);
        setMatchesLoaded(true);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load tournament'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [tournamentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setHouseRulesText(tournament?.houseRules || '');
    setHouseRulesError('');
    setHouseRulesSaved(false);
  }, [tournament?._id]);

  useEffect(() => {
    api.tournaments
      .getMessages(tournamentId)
      .then(({ messages }) => setAnnouncements(messages))
      .catch(() => setAnnouncements(null));
  }, [tournamentId]);

  useEffect(() => {
    if (section !== 'statistics' || statsLoaded) return;
    setStatsLoading(true);
    setStatsError('');
    api.tournaments
      .getStatistics(tournamentId)
      .then((res: any) => {
        setStatistics(res.statistics);
        setStatsLoaded(true);
      })
      .catch((err: any) => setStatsError(err instanceof Error ? err.message : 'Failed to load statistics'))
      .finally(() => setStatsLoading(false));
  }, [section, statsLoaded, tournamentId]);

  useEffect(() => {
    if (section !== 'awards') return;
    setLeaderboardLoading(true);
    api.tournaments
      .getLeaderboard(tournamentId, 20)
      .then((res: any) => setLeaderboard({ batsmen: res.batsmen, bowlers: res.bowlers }))
      .catch(() => {})
      .finally(() => setLeaderboardLoading(false));
  }, [section, tournamentId]);

  // Grouped per-group standings live on a separate response shape from getStandings (see
  // getTournamentStandings on the backend) - only fetched once the tournament actually has
  // groups; otherwise tournament.standings (already in hand) is used directly.
  useEffect(() => {
    if (section !== 'standings' || !tournament || !(tournament.groups?.length ?? 0)) {
      setGroupStandings(null);
      return;
    }
    setGroupStandingsLoading(true);
    api.tournaments
      .getStandings(tournamentId)
      .then((res: any) => { if (res.groups) setGroupStandings(res.groups); })
      .finally(() => setGroupStandingsLoading(false));
  }, [section, tournament, tournamentId]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handlePostAnnouncement = async () => {
    if (!announcementText.trim()) return;
    setPostingAnnouncement(true);
    setAnnouncementError('');
    try {
      await api.tournaments.postMessage(tournamentId, announcementText.trim());
      setAnnouncementText('');
      const { messages: updated } = await api.tournaments.getMessages(tournamentId);
      setAnnouncements(updated);
    } catch (err) {
      setAnnouncementError(err instanceof Error ? err.message : 'Failed to post announcement');
    } finally {
      setPostingAnnouncement(false);
    }
  };

  const handleSaveHouseRules = async () => {
    if (savingHouseRules) return;
    setSavingHouseRules(true);
    setHouseRulesError('');
    setHouseRulesSaved(false);
    try {
      const { tournament: updated } = await api.tournaments.updateTournament(tournamentId, {
        houseRules: houseRulesText,
      });
      setTournament(updated);
      setHouseRulesSaved(true);
    } catch (err) {
      setHouseRulesError(err instanceof Error ? err.message : 'Failed to save house rules');
    } finally {
      setSavingHouseRules(false);
    }
  };

  const handleUploadHouseRulesDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingDoc(true);
    setDocUploadError('');
    try {
      const { tournament: updated } = await api.tournaments.uploadHouseRulesDocument(tournamentId, {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/pdf'
      });
      setTournament(updated);
    } catch (err) {
      setDocUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleRemoveHouseRulesDocument = async () => {
    setDocUploadError('');
    try {
      const { tournament: updated } = await api.tournaments.deleteHouseRulesDocument(tournamentId);
      setTournament(updated);
    } catch (err) {
      setDocUploadError(err instanceof Error ? err.message : 'Failed to remove document');
    }
  };

  // Organizer identity: tournament.organizer is a populated User doc (real shape has `_id`,
  // not the `id` the shared User type declares) - see resolveId note above. useAuth's user.id
  // is already normalized from either raw.id or raw._id, so this comparison lines up.
  const organizerId = tournament ? resolveId(tournament.organizer) : '';
  const isOrganizer = !!user && !!organizerId && organizerId === user.id;

  const registeredTeamIds = useMemo(() => new Set((tournament?.teams || []).map(resolveId)), [tournament]);
  const selectableTeams = useMemo(
    () => availableTeams.filter(t => !registeredTeamIds.has(t._id)),
    [availableTeams, registeredTeamIds]
  );

  const openRegisterPicker = () => {
    setRegisterError('');
    setRegisterOpen(true);
    setTeamsLoading(true);
    api.teams
      .getTeams()
      .then(({ teams }) => setAvailableTeams(teams))
      .catch(() => setAvailableTeams([]))
      .finally(() => setTeamsLoading(false));
  };

  const handleRegisterTeam = async (teamId: string) => {
    setRegisteringId(teamId);
    setRegisterError('');
    try {
      await api.tournaments.registerTeam(tournamentId, teamId);
      setRegisterOpen(false);
      load();
    } catch (err) {
      setRegisterError(err instanceof Error ? err.message : 'Failed to register team');
    } finally {
      setRegisteringId(null);
    }
  };

  // Gated on: organizer, at least 2 registered teams, and no matches generated yet for this
  // tournament - mirrors the backend's own checks in generateFixtures() so a non-organizer (or
  // a tournament that already has fixtures) never even sees the button, not just gets a 403/400.
  const canGenerateFixtures = isOrganizer && (tournament?.teams?.length ?? 0) >= 2 && matchesLoaded && matches.length === 0;

  const handleGenerateFixtures = async () => {
    if (!canGenerateFixtures || generating) return;
    setGenerating(true);
    setFixturesError('');
    try {
      await api.tournaments.generateFixtures(tournamentId);
      await load();
      setSection('matches');
    } catch (err) {
      setFixturesError(err instanceof Error ? err.message : 'Failed to generate fixtures');
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignGroups = async () => {
    const count = parseInt(groupCountInput, 10);
    if (!count || count < 1) {
      setGroupsError('Enter a valid number of groups');
      return;
    }
    setAssigningGroups(true);
    setGroupsError('');
    try {
      const { tournament: updated } = await api.tournaments.assignGroups(tournamentId, count);
      setTournament(updated);
    } catch (err) {
      setGroupsError(err instanceof Error ? err.message : 'Failed to assign groups');
    } finally {
      setAssigningGroups(false);
    }
  };

  const knockoutMatches = useMemo(() => matches.filter((m) => m.round && m.round !== 'Group'), [matches]);
  const finalDone = knockoutMatches.some((m) => m.round === 'Final' && m.status === 'Completed');

  const handleGenerateKnockoutStage = async () => {
    const qualifiersPerGroup = parseInt(qualifiersInput, 10) || 4;
    setGeneratingKnockout(true);
    setKnockoutError('');
    try {
      await api.tournaments.generateKnockoutStage(tournamentId, qualifiersPerGroup);
      await load();
      setSection('bracket');
    } catch (err) {
      setKnockoutError(err instanceof Error ? err.message : 'Failed to generate the knockout stage');
    } finally {
      setGeneratingKnockout(false);
    }
  };

  const handleAdvanceKnockoutRound = async () => {
    setAdvancingRound(true);
    setKnockoutError('');
    try {
      await api.tournaments.advanceKnockoutRound(tournamentId);
      await load();
    } catch (err) {
      setKnockoutError(err instanceof Error ? err.message : 'Failed to advance the knockout stage');
    } finally {
      setAdvancingRound(false);
    }
  };

  // Gated on: organizer and status === 'Completed' - mirrors the backend's computeAwards() check.
  const canComputeAwards = isOrganizer && tournament?.status === 'Completed';

  const handleComputeAwards = async () => {
    if (!canComputeAwards || computing) return;
    setComputing(true);
    setAwardsError('');
    try {
      await api.tournaments.computeAwards(tournamentId);
      await load();
    } catch (err) {
      setAwardsError(err instanceof Error ? err.message : 'Failed to compute awards');
    } finally {
      setComputing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }

  if (!tournament) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Tournament not found.'}</Text>
      </View>
    );
  }

  const standings = tournament.standings || [];
  const awards = tournament.awards;
  const hasAwards = !!awards?.winner;

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <Text style={styles.name}>{tournament.name}</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor(tournament.status) + '26', borderColor: statusColor(tournament.status) }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor(tournament.status) }]}>{tournament.status}</Text>
            </View>
          </View>
          {!!tournament.description && <Text style={styles.description}>{tournament.description}</Text>}
          <Text style={styles.meta}>{tournament.format} · {tournament.matchType} · {tournament.venue}</Text>
          <Text style={styles.meta}>{formatDate(tournament.startDate)} - {formatDate(tournament.endDate)}</Text>
          <Text style={styles.meta}>{tournament.teams?.length ?? 0}/{tournament.maxTeams} teams registered</Text>

          {tournament.status === 'Registration' && (
            <TouchableOpacity style={styles.actionBtn} onPress={openRegisterPicker}>
              <Text style={styles.actionBtnText}>Register a Team</Text>
            </TouchableOpacity>
          )}
        </View>

        {!!error && <Text style={styles.errorBanner}>{error}</Text>}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll} contentContainerStyle={styles.segmentRow}>
          {(['standings', 'matches', 'bracket', 'statistics', 'awards', 'announcements', 'rules'] as Section[]).map(s => (
            <TouchableOpacity
              key={s}
              style={[styles.segmentBtn, section === s && styles.segmentBtnActive]}
              onPress={() => setSection(s)}
            >
              <Text style={[styles.segmentText, section === s && styles.segmentTextActive]}>
                {s === 'standings' ? 'Standings' : s === 'matches' ? 'Matches' : s === 'bracket' ? 'Bracket' : s === 'statistics' ? 'Statistics' : s === 'awards' ? 'Awards' : s === 'announcements' ? 'Announcements' : 'House Rules'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {section === 'standings' && (
          <View style={styles.sectionBody}>
            {(tournament.groups?.length ?? 0) > 0 ? (
              groupStandingsLoading || !groupStandings ? (
                <ActivityIndicator color={colors.pitch400} />
              ) : (
                groupStandings.map((group) => (
                  <View key={group.name} style={{ marginBottom: 20 }}>
                    <Text style={styles.groupTitle}>{group.name}</Text>
                    {group.standings.length === 0 ? (
                      <Text style={styles.muted}>No completed matches in this group yet.</Text>
                    ) : (
                      <StandingsTable standings={group.standings} />
                    )}
                  </View>
                ))
              )
            ) : standings.length === 0 ? (
              <Text style={styles.muted}>No standings yet - register teams and complete matches to populate the points table.</Text>
            ) : (
              <StandingsTable standings={standings} />
            )}
          </View>
        )}

        {section === 'matches' && (
          <View style={styles.sectionBody}>
            {matches.length === 0 ? (
              <>
                <Text style={styles.muted}>No matches linked to this tournament yet.</Text>
                {isOrganizer && !tournament.groups?.length && (
                  <View style={styles.groupAssignRow}>
                    <TextInput
                      style={[styles.input, styles.groupCountInput]}
                      value={groupCountInput}
                      onChangeText={setGroupCountInput}
                      keyboardType="number-pad"
                    />
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.groupAssignBtn, (assigningGroups || (tournament.teams?.length ?? 0) < 2) && styles.sendBtnDisabled]}
                      onPress={handleAssignGroups}
                      disabled={assigningGroups || (tournament.teams?.length ?? 0) < 2}
                    >
                      <Text style={styles.actionBtnText}>{assigningGroups ? 'Assigning...' : 'Assign Groups'}</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {!!tournament.groups?.length && (
                  <Text style={styles.muted}>
                    {tournament.groups.length} groups assigned. Generating fixtures below will create a round-robin within each group.
                  </Text>
                )}
                {!!groupsError && <Text style={styles.errorBanner}>{groupsError}</Text>}
                {canGenerateFixtures && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleGenerateFixtures} disabled={generating}>
                    <Text style={styles.actionBtnText}>{generating ? 'Generating...' : 'Generate Fixtures'}</Text>
                  </TouchableOpacity>
                )}
                {!!fixturesError && <Text style={styles.errorBanner}>{fixturesError}</Text>}
              </>
            ) : (
              matches.map(m => (
                <TouchableOpacity
                  key={m._id}
                  style={styles.matchCard}
                  onPress={() => navigation.navigate('Matches', { screen: 'MatchDetail', params: { matchId: m._id } })}
                >
                  <View style={styles.matchCardRow}>
                    <Text style={styles.matchTeams} numberOfLines={1}>{teamName(m.team1)} vs {teamName(m.team2)}</Text>
                    <View style={[styles.statusBadgeSmall, m.status === 'Live' && styles.statusBadgeLive]}>
                      <Text style={styles.statusBadgeSmallText}>{m.status}</Text>
                    </View>
                  </View>
                  <Text style={styles.matchMeta}>{formatDate(m.scheduledDate)} · {m.venue}</Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {section === 'bracket' && (
          <View style={styles.sectionBody}>
            {!tournament.groups?.length ? (
              <Text style={styles.muted}>This tournament has no group stage, so there&apos;s no bracket to generate here.</Text>
            ) : (
              <>
                {isOrganizer && (
                  <>
                    {knockoutMatches.length === 0 ? (
                      <View style={styles.groupAssignRow}>
                        <TextInput
                          style={[styles.input, styles.groupCountInput]}
                          value={qualifiersInput}
                          onChangeText={setQualifiersInput}
                          keyboardType="number-pad"
                        />
                        <TouchableOpacity
                          style={[styles.actionBtn, styles.groupAssignBtn, generatingKnockout && styles.sendBtnDisabled]}
                          onPress={handleGenerateKnockoutStage}
                          disabled={generatingKnockout}
                        >
                          <Text style={styles.actionBtnText}>{generatingKnockout ? 'Generating...' : 'Generate Knockout Stage'}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : !finalDone ? (
                      <TouchableOpacity
                        style={[styles.actionBtn, advancingRound && styles.sendBtnDisabled]}
                        onPress={handleAdvanceKnockoutRound}
                        disabled={advancingRound}
                      >
                        <Text style={styles.actionBtnText}>{advancingRound ? 'Advancing...' : 'Advance to Next Round'}</Text>
                      </TouchableOpacity>
                    ) : (
                      <Text style={styles.muted}>The Final is complete. Check the Awards tab for the tournament winner.</Text>
                    )}
                  </>
                )}
                {!!knockoutError && <Text style={styles.errorBanner}>{knockoutError}</Text>}

                {knockoutMatches.length === 0 ? (
                  <Text style={[styles.muted, { marginTop: 12 }]}>
                    No knockout matches yet.{isOrganizer ? ' Generate the knockout stage above once the group stage is far enough along.' : ' Check back once the organizer generates it.'}
                  </Text>
                ) : (
                  KNOCKOUT_ROUNDS.map((round) => {
                    const roundMatches = knockoutMatches.filter((m) => m.round === round);
                    if (roundMatches.length === 0) return null;
                    return (
                      <View key={round} style={{ marginTop: 16 }}>
                        <Text style={styles.groupTitle}>{round}</Text>
                        {roundMatches.map((m) => {
                          const winner = winnerName(m);
                          return (
                            <TouchableOpacity
                              key={m._id}
                              style={styles.matchCard}
                              onPress={() => navigation.navigate('Matches', { screen: 'MatchDetail', params: { matchId: m._id } })}
                            >
                              <View style={styles.matchCardRow}>
                                <Text style={styles.matchTeams} numberOfLines={1}>
                                  {teamName(m.team1)} vs {teamName(m.team2)}
                                </Text>
                                <View style={[styles.statusBadgeSmall, m.status === 'Live' && styles.statusBadgeLive]}>
                                  <Text style={styles.statusBadgeSmallText}>{m.status}</Text>
                                </View>
                              </View>
                              {!!winner && <Text style={styles.matchMeta}>{winner} won</Text>}
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    );
                  })
                )}
              </>
            )}
          </View>
        )}

        {section === 'statistics' && (
          <View style={styles.sectionBody}>
            {statsLoading ? (
              <ActivityIndicator color={colors.pitch400} />
            ) : statsError ? (
              <Text style={styles.errorBanner}>{statsError}</Text>
            ) : (
              <View style={styles.awardsGrid}>
                <StatBox label="Total Runs" value={statistics?.totalRuns ?? 0} />
                <StatBox label="Total Wickets" value={statistics?.totalWickets ?? 0} />
                <StatBox label="Highest Score" value={statistics?.highestScore ?? 0} />
                <StatBox label="Lowest Score" value={statistics?.lowestScore ?? 0} />
              </View>
            )}
          </View>
        )}

        {section === 'awards' && (
          <View style={styles.sectionBody}>
            {!hasAwards ? (
              <>
                <Text style={styles.muted}>
                  {tournament.status === 'Completed'
                    ? 'Awards have not been computed for this tournament yet.'
                    : 'Awards can be computed once this tournament is marked Completed.'}
                </Text>
                {!!awardsError && <Text style={styles.errorBanner}>{awardsError}</Text>}
                {canComputeAwards && (
                  <TouchableOpacity style={styles.actionBtn} onPress={handleComputeAwards} disabled={computing}>
                    <Text style={styles.actionBtnText}>{computing ? 'Computing...' : 'Compute Awards'}</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <View style={styles.awardsGrid}>
                <AwardBox label="Winner" value={awardTeamName(awards?.winner)} />
                <AwardBox label="Runner-up" value={awardTeamName(awards?.runnerUp)} />
                {!!awards?.thirdPlace && <AwardBox label="Third Place" value={awardTeamName(awards?.thirdPlace)} />}
                <AwardBox label="Man of the Tournament" value={awardPlayerName(awards?.manOfTheTournament)} />
                <AwardBox label="Best Batsman" value={awardPlayerName(awards?.bestBatsman)} />
                <AwardBox label="Best Bowler" value={awardPlayerName(awards?.bestBowler)} />
              </View>
            )}

            <Text style={[styles.groupTitle, { marginTop: 24 }]}>Top Performers</Text>
            {leaderboardLoading || !leaderboard ? (
              <ActivityIndicator color={colors.pitch400} />
            ) : leaderboard.batsmen.length === 0 && leaderboard.bowlers.length === 0 ? (
              <Text style={styles.muted}>No completed matches yet - top performers appear once some matches finish.</Text>
            ) : (
              <>
                <Text style={[styles.groupTitle, { fontSize: 13, marginTop: 12 }]}>Leading Run Scorers</Text>
                {leaderboard.batsmen.length === 0 ? (
                  <Text style={styles.muted}>No qualifying innings yet.</Text>
                ) : (
                  leaderboard.batsmen.map((b, i) => (
                    <View key={b.player._id} style={styles.leaderRow}>
                      <Text style={styles.leaderName} numberOfLines={1}>
                        {b.player._id === resolveId(awards?.bestBatsman) ? '🏆 ' : ''}{i + 1}. {b.player.name}
                      </Text>
                      <Text style={styles.leaderStat}>{b.runs} runs · avg {b.average} · SR {b.strikeRate}</Text>
                    </View>
                  ))
                )}

                <Text style={[styles.groupTitle, { fontSize: 13, marginTop: 16 }]}>Leading Wicket Takers</Text>
                {leaderboard.bowlers.length === 0 ? (
                  <Text style={styles.muted}>No qualifying spells yet.</Text>
                ) : (
                  leaderboard.bowlers.map((b, i) => (
                    <View key={b.player._id} style={styles.leaderRow}>
                      <Text style={styles.leaderName} numberOfLines={1}>
                        {b.player._id === resolveId(awards?.bestBowler) ? '🏆 ' : ''}{i + 1}. {b.player.name}
                      </Text>
                      <Text style={styles.leaderStat}>{b.wickets} wkts · avg {b.average} · econ {b.economyRate}</Text>
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        )}

        {section === 'announcements' && (
          <View style={styles.sectionBody}>
            {announcements === null ? (
              <Text style={styles.muted}>Announcements aren't available right now.</Text>
            ) : announcements.length === 0 ? (
              <Text style={styles.muted}>No announcements yet.</Text>
            ) : (
              announcements.slice(-30).reverse().map(m => (
                <View key={m._id} style={styles.messageRow}>
                  <Text style={styles.messageSender}>{m.sender?.name || 'Organizer'}</Text>
                  <Text style={styles.messageText}>{m.text}</Text>
                </View>
              ))
            )}
            {!!announcementError && <Text style={styles.errorBanner}>{announcementError}</Text>}
            {isOrganizer && (
              <View style={styles.messageInputRow}>
                <TextInput
                  style={styles.messageInput}
                  value={announcementText}
                  onChangeText={setAnnouncementText}
                  placeholder="Post an announcement..."
                  placeholderTextColor={colors.inkMuted}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!announcementText.trim() || postingAnnouncement) && styles.sendBtnDisabled]}
                  onPress={handlePostAnnouncement}
                  disabled={postingAnnouncement || !announcementText.trim()}
                >
                  <Text style={styles.sendBtnText}>{postingAnnouncement ? '...' : 'Post'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {section === 'rules' && (
          <View style={styles.sectionBody}>
            {isOrganizer ? (
              <>
                <Text style={styles.muted}>
                  Used by the in-app assistant to answer rules questions specific to your tournament - anything that
                  differs from standard cricket laws (overs, boundary rules, wide/no-ball variants, etc.) should go here.
                </Text>
                <TextInput
                  style={[styles.input, styles.textArea, { marginTop: 10 }]}
                  value={houseRulesText}
                  onChangeText={(t) => {
                    setHouseRulesText(t);
                    setHouseRulesSaved(false);
                  }}
                  placeholder="e.g. Boundary is 4 runs, not 6. Maximum 4 overs per bowler..."
                  placeholderTextColor={colors.inkMuted}
                  multiline
                  numberOfLines={6}
                  maxLength={5000}
                />
                <View style={styles.houseRulesFooterRow}>
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.houseRulesSaveBtn, savingHouseRules && styles.sendBtnDisabled]}
                    onPress={handleSaveHouseRules}
                    disabled={savingHouseRules}
                  >
                    <Text style={styles.actionBtnText}>{savingHouseRules ? 'Saving...' : 'Save House Rules'}</Text>
                  </TouchableOpacity>
                  {houseRulesSaved && <Text style={styles.savedText}>Saved</Text>}
                </View>
                {!!houseRulesError && <Text style={styles.errorBanner}>{houseRulesError}</Text>}

                <View style={styles.docSection}>
                  <Text style={styles.muted}>
                    Attach a PDF or Word doc as a downloadable reference (e.g. the full printed rulebook) - separate from
                    the free-text above, which is what the assistant actually reads.
                  </Text>
                  {tournament.houseRulesDocument?.url ? (
                    <View style={styles.docRow}>
                      <TouchableOpacity onPress={() => Linking.openURL(resolveAttachmentUrl(tournament.houseRulesDocument!.url!))}>
                        <Text style={styles.docLink}>📎 {tournament.houseRulesDocument.fileName}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={handleRemoveHouseRulesDocument}>
                        <Text style={styles.docRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.houseRulesSaveBtn, uploadingDoc && styles.sendBtnDisabled]}
                      onPress={handleUploadHouseRulesDocument}
                      disabled={uploadingDoc}
                    >
                      <Text style={styles.actionBtnText}>{uploadingDoc ? 'Uploading...' : '📎 Attach Document'}</Text>
                    </TouchableOpacity>
                  )}
                  {!!docUploadError && <Text style={styles.errorBanner}>{docUploadError}</Text>}
                </View>
              </>
            ) : (
              <>
                {tournament.houseRules ? (
                  <Text style={styles.rulesText}>{tournament.houseRules}</Text>
                ) : (
                  <Text style={styles.muted}>The organizer hasn&apos;t set any house rules for this tournament.</Text>
                )}
                {!!tournament.houseRulesDocument?.url && (
                  <TouchableOpacity onPress={() => Linking.openURL(resolveAttachmentUrl(tournament.houseRulesDocument!.url!))}>
                    <Text style={[styles.docLink, { marginTop: 12 }]}>📎 {tournament.houseRulesDocument.fileName}</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={registerOpen} animationType="slide" transparent onRequestClose={() => setRegisterOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Register a Team</Text>
              <TouchableOpacity onPress={() => setRegisterOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            {!!registerError && <Text style={styles.errorBanner}>{registerError}</Text>}
            {teamsLoading ? (
              <ActivityIndicator color={colors.pitch400} style={{ margin: 20 }} />
            ) : (
              <FlatList
                data={selectableTeams}
                keyExtractor={t => t._id}
                style={{ maxHeight: 420 }}
                ListEmptyComponent={<Text style={styles.muted}>No more teams available to register.</Text>}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.pickerRow}
                    disabled={registeringId === item._id}
                    onPress={() => handleRegisterTeam(item._id)}
                  >
                    <Text style={styles.pickerName}>{item.name}</Text>
                    <Text style={styles.pickerMeta}>{registeringId === item._id ? 'Registering...' : item.city}</Text>
                  </TouchableOpacity>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StandingsTable({ standings }: { standings: TournamentStanding[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <View style={styles.tableRow}>
          <Text style={[styles.tableHeaderCell, styles.colRank]}>#</Text>
          <Text style={[styles.tableHeaderCell, styles.colTeam]}>Team</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>P</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>W</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>L</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>T</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>NR</Text>
          <Text style={[styles.tableHeaderCell, styles.colStat]}>Pts</Text>
          <Text style={[styles.tableHeaderCell, styles.colNrr]}>NRR</Text>
        </View>
        {standings.map((row, idx) => (
          <View key={idx} style={[styles.tableRow, idx % 2 === 1 && styles.tableRowAlt]}>
            <Text style={[styles.tableCell, styles.colRank]}>{idx + 1}</Text>
            <Text style={[styles.tableCell, styles.colTeam]} numberOfLines={1}>{teamName(row.team)}</Text>
            <Text style={[styles.tableCell, styles.colStat]}>{row.played}</Text>
            <Text style={[styles.tableCell, styles.colStat]}>{row.won}</Text>
            <Text style={[styles.tableCell, styles.colStat]}>{row.lost}</Text>
            <Text style={[styles.tableCell, styles.colStat]}>{row.tied}</Text>
            <Text style={[styles.tableCell, styles.colStat]}>{row.noResult}</Text>
            <Text style={[styles.tableCell, styles.colStat, styles.pointsCell]}>{row.points}</Text>
            <Text style={[styles.tableCell, styles.colNrr]}>{row.netRunRate >= 0 ? '+' : ''}{row.netRunRate.toFixed(2)}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

function AwardBox({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.awardBox}>
      <Text style={styles.awardLabel}>{label}</Text>
      <Text style={styles.awardValue}>{value || '-'}</Text>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.awardBox}>
      <Text style={styles.awardLabel}>{label}</Text>
      <Text style={styles.awardValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.wicket400, fontSize: 14, textAlign: 'center' },
  errorBanner: {
    color: colors.wicket400,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.wicket500,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 13,
  },
  header: { padding: 16, paddingBottom: 8 },
  headerTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  name: { color: colors.ink, fontSize: 22, fontWeight: 'bold', flexShrink: 1 },
  description: { color: colors.inkMuted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  meta: { color: colors.inkSecondary, fontSize: 13, marginTop: 6 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
  actionBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  actionBtnText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  segmentScroll: { marginHorizontal: 16, marginTop: 16, backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  segmentRow: { flexDirection: 'row', padding: 4 },
  segmentBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
  segmentBtnActive: { backgroundColor: colors.pitch900 },
  segmentText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  segmentTextActive: { color: colors.pitch400 },
  sectionBody: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13 },
  rulesText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  textArea: { minHeight: 120, textAlignVertical: 'top' },
  houseRulesFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 12 },
  houseRulesSaveBtn: { marginTop: 0, flexShrink: 1, paddingHorizontal: 20 },
  savedText: { color: colors.pitch400, fontSize: 13, fontWeight: '600' },
  docSection: { marginTop: 18, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.border },
  docRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  docLink: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  docRemove: { color: colors.wicket400, fontSize: 12, fontWeight: '600' },
  leaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  leaderName: { color: colors.ink, fontSize: 13, flexShrink: 1 },
  leaderStat: { color: colors.inkSecondary, fontSize: 12 },
  messageRow: { marginBottom: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10 },
  messageSender: { color: colors.gold500, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  messageText: { color: colors.ink, fontSize: 13 },
  messageInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  messageInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 13,
  },
  sendBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  tableRowAlt: { backgroundColor: colors.surface },
  tableHeaderCell: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  tableCell: { color: colors.ink, fontSize: 13 },
  pointsCell: { color: colors.gold500, fontWeight: '700' },
  colRank: { width: 28 },
  colTeam: { width: 140 },
  colStat: { width: 32, textAlign: 'center' },
  colNrr: { width: 56, textAlign: 'right' },
  groupTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 8 },
  groupAssignRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  groupCountInput: { width: 60, paddingVertical: 8, textAlign: 'center' },
  groupAssignBtn: { marginTop: 0, flexShrink: 1, paddingHorizontal: 20 },
  matchCard: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  matchCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  matchTeams: { color: colors.ink, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  matchMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  statusBadgeSmall: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeLive: { backgroundColor: colors.pitch900 },
  statusBadgeSmallText: { color: colors.inkSecondary, fontSize: 11, fontWeight: '700' },
  awardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  awardBox: { width: '47%', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  awardLabel: { color: colors.gold500, fontSize: 11, fontWeight: '700', letterSpacing: 0.3 },
  awardValue: { color: colors.ink, fontSize: 15, fontWeight: '600', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: colors.border, paddingBottom: 24, maxHeight: '75%' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  pickerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  pickerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pickerMeta: { color: colors.inkMuted, fontSize: 12 },
});
