import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { League, Tournament } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

// Populated relations on GET /leagues/:id use raw Mongoose `_id`, not the `id` field the shared
// User type declares - same defensive resolution TournamentDetailScreen uses for `organizer`.
function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

function organizerName(ref: any): string {
  if (!ref) return 'Unknown';
  return typeof ref === 'string' ? 'Unknown' : ref.name || 'Unknown';
}

interface Props {
  route: { params: { leagueId: string } };
  navigation: any;
}

export default function LeagueDetailScreen({ route, navigation }: Props) {
  const { leagueId } = route.params;
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    setError('');
    api.leagues
      .getLeagueById(leagueId)
      .then(({ league, tournaments }) => {
        setLeague(league);
        setTournaments(tournaments);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load league'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [leagueId]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const isOrganizer = !!user && !!league && resolveId(league.organizer) === user.id;

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }

  if (!league) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'League not found.'}</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      <View style={styles.header}>
        <Text style={styles.name}>{league.name}</Text>
        <Text style={styles.meta}>Organized by {organizerName(league.organizer)}</Text>
        {!!league.description && <Text style={styles.description}>{league.description}</Text>}

        {isOrganizer && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => navigation.navigate('CreateTournament', { leagueId: league._id })}
          >
            <Text style={styles.actionBtnText}>+ Create Tournament</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.errorBanner}>{error}</Text>}

      <View style={styles.sectionBody}>
        <Text style={styles.sectionTitle}>Tournaments ({tournaments.length})</Text>
        {tournaments.length === 0 ? (
          <Text style={styles.muted}>No tournaments yet.</Text>
        ) : (
          tournaments.map(t => (
            <TouchableOpacity
              key={t._id}
              style={styles.card}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: t._id })}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{t.name}</Text>
                <Text style={styles.cardStatus}>{t.status}</Text>
              </View>
              <Text style={styles.cardSub}>{t.format} · {t.venue}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  name: { color: colors.ink, fontSize: 22, fontWeight: 'bold' },
  meta: { color: colors.inkSecondary, fontSize: 13, marginTop: 6 },
  description: { color: colors.inkMuted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  actionBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 16 },
  actionBtnText: { color: colors.background, fontWeight: '700', fontSize: 14 },
  sectionBody: { padding: 16, paddingTop: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  muted: { color: colors.inkMuted, fontSize: 13 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  cardStatus: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  cardSub: { color: colors.inkSecondary, fontSize: 12, marginTop: 6 },
});
