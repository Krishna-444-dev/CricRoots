import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Animated } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Match } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchesList'>;

function teamName(team: Match['team1'] | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'string' ? 'TBD' : team.name;
}

// Small pulsing dot used on the LIVE badge - a quiet "something is happening right now" cue
// that a static badge color alone doesn't convey.
function PulseDot() {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.7, duration: 650, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [scale]);

  return <Animated.View style={[styles.pulseDot, { transform: [{ scale }] }]} />;
}

function StatusBadge({ status }: { status: Match['status'] }) {
  if (status === 'Live') {
    return (
      <View style={[styles.badge, styles.badgeLive]}>
        <PulseDot />
        <Text style={styles.badgeTextLive}>LIVE</Text>
      </View>
    );
  }
  if (status === 'Scheduled') {
    return (
      <View style={[styles.badge, styles.badgeScheduled]}>
        <Text style={styles.badgeTextScheduled}>Scheduled</Text>
      </View>
    );
  }
  // Completed / Cancelled - muted
  return (
    <View style={[styles.badge, styles.badgeMuted]}>
      <Text style={styles.badgeTextMuted}>{status}</Text>
    </View>
  );
}

export default function MatchesListScreen({ navigation }: Props) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.matches
      .getMatches()
      .then(({ matches }) => {
        setMatches(matches);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load matches'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Matches</Text>
        <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateMatch')}>
          <Text style={styles.createBtnText}>+ New Match</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text style={styles.muted}>Loading matches...</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item._id}
          contentContainerStyle={matches.length === 0 ? styles.listEmpty : styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />
          }
          ListEmptyComponent={
            <View style={styles.centered}>
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.muted}>
                {error || 'Matches created on CricRoots will show up here.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('MatchDetail', { matchId: item._id })}
            >
              <View style={styles.cardTopRow}>
                <Text style={styles.matchType}>{item.matchType}</Text>
                <StatusBadge status={item.status} />
              </View>
              <Text style={styles.teams} numberOfLines={1}>
                {teamName(item.team1)} vs {teamName(item.team2)}
              </Text>
              <Text style={styles.venue} numberOfLines={1}>
                {item.venue}
              </Text>
              {item.status !== 'Scheduled' && (
                <View style={styles.scoreRow}>
                  <Text style={styles.scoreText}>
                    {teamName(item.team1)} {item.innings?.[0]?.runs ?? 0}/{item.innings?.[0]?.wickets ?? 0}
                    <Text style={styles.scoreDivider}>   ·   </Text>
                    {teamName(item.team2)} {item.innings?.[1]?.runs ?? 0}/{item.innings?.[1]?.wickets ?? 0}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingBottom: 0 },
  headerTitle: { color: colors.ink, fontSize: 22, fontWeight: 'bold' },
  createBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  muted: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  list: { paddingHorizontal: 16, paddingVertical: 16 },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 12,
  },
  cardTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  matchType: { color: colors.gold500, fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  teams: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 4 },
  venue: { color: colors.inkMuted, fontSize: 12 },
  scoreRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  scoreText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600' },
  scoreDivider: { color: colors.inkMuted },
  badge: { flexDirection: 'row', alignItems: 'center', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeLive: { backgroundColor: colors.pitch900 },
  badgeTextLive: { color: colors.pitch400, fontSize: 11, fontWeight: '800', letterSpacing: 0.5, marginLeft: 6 },
  pulseDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pitch400 },
  badgeScheduled: { backgroundColor: colors.surfaceAlt },
  badgeTextScheduled: { color: colors.inkSecondary, fontSize: 11, fontWeight: '700' },
  badgeMuted: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  badgeTextMuted: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
});
