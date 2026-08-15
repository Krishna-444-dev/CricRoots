// Community feed - trivia-of-the-day card plus poll-creation/browsing entry points scoped to
// the viewer's own teams/tournaments (api.teams.getMyTeams / api.tournaments.getMyTournaments,
// the same "what is this user actually part of" join leaguesAPI.getMyLeagues established this
// session, applied to teams/tournaments instead of leagues - see teamController.js's
// getMyTeams/tournamentController.js's getMyTournaments). Mirrors web-app's
// app/community/page.tsx.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Team, Tournament } from '../shared/types';
import { useAuth } from '../hooks/useAuth';
import TriviaCard from '../components/TriviaCard';
import PollsSection from '../components/PollsSection';

function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

// Same team-admin bar as TeamDetailScreen.tsx (captain/vice-captain/coach) - who can create/
// close a poll for this team. Every `!!x &&` guard matters, same reasoning as elsewhere this
// session's auth-display fixes established: never a bare `===` on two possibly-undefined ids.
function isTeamManager(team: Team, userId: string | undefined): boolean {
  if (!userId) return false;
  const captain = typeof team.captain === 'object' ? team.captain : null;
  const captainUserId = captain ? resolveId(captain.user) : '';
  if (!!captainUserId && captainUserId === userId) return true;

  const viceCaptain = team.viceCaptain && typeof team.viceCaptain === 'object' ? team.viceCaptain : null;
  const viceCaptainUserId = viceCaptain ? resolveId(viceCaptain.user) : '';
  if (!!viceCaptainUserId && viceCaptainUserId === userId) return true;

  return (team.coaches || []).some((c) => {
    if (typeof c === 'string') return false;
    const coachUserId = resolveId(c.user);
    return !!coachUserId && coachUserId === userId;
  });
}

export default function CommunityScreen({ navigation }: any) {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    if (!user) {
      setTeams([]);
      setTournaments([]);
      setRefreshing(false);
      return;
    }
    Promise.all([
      api.teams.getMyTeams().then(({ teams }) => setTeams(teams)).catch(() => setTeams([])),
      api.tournaments.getMyTournaments().then(({ tournaments }) => setTournaments(tournaments)).catch(() => setTournaments([])),
    ]).finally(() => setRefreshing(false));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community</Text>
        <Text style={styles.headerSub}>Trivia, polls, and what's happening across your teams and tournaments.</Text>
      </View>

      <View style={styles.section}>
        <TriviaCard />
      </View>

      {!user ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Log in to see your polls</Text>
          <Text style={styles.emptyDesc}>Polls are scoped to your own teams and tournaments.</Text>
        </View>
      ) : (
        <>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your Teams</Text>
            {teams === null ? (
              <ActivityIndicator color={colors.pitch400} />
            ) : teams.length === 0 ? (
              <Text style={styles.muted}>You're not on a team yet.</Text>
            ) : (
              teams.map((team) => (
                <View key={team._id} style={styles.scopeCard}>
                  <TouchableOpacity onPress={() => navigation.navigate('Teams', { screen: 'TeamDetail', params: { teamId: team._id } })}>
                    <View style={styles.scopeHeaderRow}>
                      <Text style={styles.scopeName}>{team.name}</Text>
                      <Text style={styles.scopeMeta}>{team.city}</Text>
                    </View>
                  </TouchableOpacity>
                  <PollsSection scope="team" scopeId={team._id} canManage={isTeamManager(team, user?.id)} />
                </View>
              ))
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Your Tournaments</Text>
            {tournaments === null ? (
              <ActivityIndicator color={colors.pitch400} />
            ) : tournaments.length === 0 ? (
              <Text style={styles.muted}>You're not part of a tournament yet.</Text>
            ) : (
              tournaments.map((tournament) => {
                const organizerId = resolveId(tournament.organizer);
                const isOrganizer = !!user?.id && !!organizerId && organizerId === user.id;
                return (
                  <View key={tournament._id} style={styles.scopeCard}>
                    <TouchableOpacity onPress={() => navigation.navigate('Tournaments', { screen: 'TournamentDetail', params: { tournamentId: tournament._id } })}>
                      <View style={styles.scopeHeaderRow}>
                        <Text style={styles.scopeName}>{tournament.name}</Text>
                        <Text style={styles.scopeMeta}>{tournament.venue}</Text>
                      </View>
                    </TouchableOpacity>
                    <PollsSection scope="tournament" scopeId={tournament._id} canManage={isOrganizer} />
                  </View>
                );
              })
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { padding: 20, paddingTop: 24 },
  headerTitle: { color: colors.ink, fontSize: 24, fontWeight: 'bold' },
  headerSub: { color: colors.inkSecondary, fontSize: 13, marginTop: 6, lineHeight: 18 },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 },
  muted: { color: colors.inkSecondary, fontSize: 13 },
  scopeCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 14, marginBottom: 14,
  },
  scopeHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  scopeName: { color: colors.ink, fontSize: 15, fontWeight: 'bold' },
  scopeMeta: { color: colors.inkMuted, fontSize: 12 },
  emptyState: { marginHorizontal: 16, padding: 24, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 14, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  emptyDesc: { color: colors.inkSecondary, fontSize: 12, marginTop: 4, textAlign: 'center' },
});
