import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Tournament } from '../shared/types';

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

function formatDateRange(start: string, end: string) {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return '';
  return `${s.toLocaleDateString(undefined, opts)} - ${e.toLocaleDateString(undefined, opts)}`;
}

export default function TournamentsListScreen({ navigation }: any) {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.tournaments
      .getTournaments()
      .then(({ tournaments }) => setTournaments(tournaments))
      .catch(() => setTournaments([]))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tournaments</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateTournament')}>
          <Text style={styles.createBtnText}>+ New Tournament</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : (
        <FlatList
          data={tournaments}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.pitch400} />}
          ListEmptyComponent={<Text style={styles.muted}>No tournaments yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('TournamentDetail', { tournamentId: item._id })}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(item.status) + '26', borderColor: statusColor(item.status) }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor(item.status) }]}>{item.status}</Text>
                </View>
              </View>
              <Text style={styles.cardSub}>{item.format} · {item.venue}</Text>
              <Text style={styles.cardMeta}>
                {formatDateRange(item.startDate, item.endDate)} · {item.teams?.length ?? 0}/{item.maxTeams} teams
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: colors.ink, fontSize: 22, fontWeight: 'bold' },
  createBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.inkMuted, padding: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  cardSub: { color: colors.inkSecondary, fontSize: 12, marginTop: 6 },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontSize: 11, fontWeight: '700' },
});
