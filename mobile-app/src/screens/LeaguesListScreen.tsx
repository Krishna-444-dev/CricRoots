import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { League } from '../shared/types';

export default function LeaguesListScreen({ navigation }: any) {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.leagues
      .getLeagues()
      .then(({ leagues }) => setLeagues(leagues))
      .catch(() => setLeagues([]))
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
        <Text style={styles.title}>Leagues</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateLeague')}>
          <Text style={styles.createBtnText}>+ New League</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : (
        <FlatList
          data={leagues}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.pitch400} />}
          ListEmptyComponent={<Text style={styles.muted}>No leagues yet.</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('LeagueDetail', { leagueId: item._id })}
            >
              <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
              {!!item.description && <Text style={styles.cardSub} numberOfLines={2}>{item.description}</Text>}
              <Text style={styles.cardMeta}>
                Organized by {typeof item.organizer === 'string' ? 'Unknown' : item.organizer?.name || 'Unknown'}
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
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.inkSecondary, fontSize: 12, marginTop: 6 },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
});
