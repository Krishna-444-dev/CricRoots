// Leaderboard for the free, points-based match prediction game (backend/src/routes/
// predictionRoutes.js) - NOT real-money betting, just predict-the-winner-and-earn-points.
// Two tabs: the global leaderboard (public) and "My Predictions" (the logged-in user's own
// prediction history, GET /predictions/me - surfaced here since it has no other home yet).
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { LeaderboardEntry, Prediction } from '../shared/types';
import { resolveRefName } from '../shared/utils/resolveRef';

type Tab = 'leaderboard' | 'mine';

// resolveRefName expects a `.name` field, but a populated match's display field is `.title` -
// same null/string/populated tri-state, just checked inline rather than forcing it through that
// helper.
function matchTitle(p: Prediction): string {
  if (!p.match) return 'Match';
  return typeof p.match === 'string' ? 'Match' : p.match.title || 'Match';
}

function matchTeams(p: Prediction): string {
  if (!p.match || typeof p.match === 'string') return '';
  return `${p.match.team1?.name || 'Team'} vs ${p.match.team2?.name || 'Team'}`;
}

function winnerName(p: Prediction): string {
  return resolveRefName(p.predictedWinner, 'your pick');
}

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('leaderboard');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [myPredictions, setMyPredictions] = useState<Prediction[] | null>(null);
  const [myTotalPoints, setMyTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    const tasks: Promise<any>[] = [
      api.predictions.getLeaderboard().then(({ leaderboard: rows }) => setLeaderboard(rows)),
    ];
    if (user) {
      tasks.push(
        api.predictions.getMine().then(({ predictions, totalPoints }) => {
          setMyPredictions(predictions);
          setMyTotalPoints(totalPoints);
        })
      );
    }
    Promise.all(tasks)
      .then(() => setError(null))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load leaderboard'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'leaderboard' && styles.tabButtonActive]}
          onPress={() => setTab('leaderboard')}
        >
          <Text style={[styles.tabButtonText, tab === 'leaderboard' && styles.tabButtonTextActive]}>Leaderboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, tab === 'mine' && styles.tabButtonActive]}
          onPress={() => setTab('mine')}
        >
          <Text style={[styles.tabButtonText, tab === 'mine' && styles.tabButtonTextActive]}>My Predictions</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.pitch400} />
        </View>
      ) : (
        <ScrollView
          style={styles.container}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
        >
          {error && <Text style={styles.errorText}>{error}</Text>}

          {tab === 'leaderboard' && (
            <View style={styles.section}>
              {(leaderboard ?? []).length === 0 && !error && (
                <Text style={styles.muted}>No predictions have been settled yet - check back after some matches finish.</Text>
              )}
              {(leaderboard ?? []).map((entry) => {
                const isMe = !!user && entry.userId === user.id;
                return (
                  <View key={entry.userId} style={[styles.row, isMe && styles.rowHighlight]}>
                    <Text style={[styles.rank, isMe && styles.rankHighlight]}>#{entry.rank}</Text>
                    <View style={styles.rowMain}>
                      <Text style={[styles.rowName, isMe && styles.rowNameHighlight]} numberOfLines={1}>
                        {entry.name}{isMe ? ' (You)' : ''}
                      </Text>
                      <Text style={styles.rowSub}>
                        {entry.correctPredictions}/{entry.totalPredictions} correct
                      </Text>
                    </View>
                    <Text style={styles.rowPoints}>{entry.totalPoints} pts</Text>
                  </View>
                );
              })}
            </View>
          )}

          {tab === 'mine' && (
            <View style={styles.section}>
              {!user ? (
                <Text style={styles.muted}>Log in to see your prediction history and points.</Text>
              ) : (
                <>
                  <View style={styles.totalCard}>
                    <Text style={styles.totalLabel}>Your total points</Text>
                    <Text style={styles.totalValue}>{myTotalPoints}</Text>
                  </View>
                  {(myPredictions ?? []).length === 0 && (
                    <Text style={styles.muted}>You haven't made any predictions yet - pick a winner on an upcoming match.</Text>
                  )}
                  {(myPredictions ?? []).map((p) => (
                    <View key={p._id} style={styles.predictionRow}>
                      <View style={styles.predictionRowTop}>
                        <Text style={styles.predictionTitle} numberOfLines={1}>{matchTitle(p)}</Text>
                        <View style={[styles.statusBadge, p.status === 'settled' && styles.statusBadgeSettled]}>
                          <Text style={[styles.statusBadgeText, p.status === 'settled' && styles.statusBadgeTextSettled]}>
                            {p.status === 'settled' ? 'Settled' : 'Pending'}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.predictionTeams}>{matchTeams(p)}</Text>
                      <Text style={styles.predictionPick}>You picked {winnerName(p)}</Text>
                      {p.status === 'settled' && (
                        <Text style={[styles.predictionResult, p.points > 0 ? styles.predictionResultWin : styles.predictionResultLoss]}>
                          {p.wonOnWinner
                            ? `Correct winner! +${p.points} points`
                            : p.points > 0
                            ? `+${p.points} points`
                            : 'Not this time - 0 points'}
                        </Text>
                      )}
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', padding: 24 },
  errorText: { color: colors.wicket400, fontSize: 13, textAlign: 'center', padding: 16 },
  section: { padding: 16 },

  tabRow: { flexDirection: 'row', padding: 16, paddingBottom: 0, gap: 10 },
  tabButton: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    alignItems: 'center',
  },
  tabButtonActive: { backgroundColor: colors.pitch900, borderColor: colors.pitch500 },
  tabButtonText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '700' },
  tabButtonTextActive: { color: colors.pitch400 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  rowHighlight: { borderColor: colors.pitch500, backgroundColor: colors.pitch900 },
  rank: { color: colors.inkMuted, fontSize: 14, fontWeight: '800', width: 32 },
  rankHighlight: { color: colors.pitch400 },
  rowMain: { flex: 1 },
  rowName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rowNameHighlight: { color: colors.pitch400 },
  rowSub: { color: colors.inkMuted, fontSize: 11, marginTop: 2 },
  rowPoints: { color: colors.gold400, fontSize: 15, fontWeight: '800' },

  totalCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  totalLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },
  totalValue: { color: colors.gold400, fontSize: 28, fontWeight: '800', marginTop: 4 },

  predictionRow: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  predictionRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  predictionTitle: { color: colors.ink, fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8 },
  predictionTeams: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  predictionPick: { color: colors.inkSecondary, fontSize: 12, marginTop: 4 },
  predictionResult: { fontSize: 12, fontWeight: '700', marginTop: 6 },
  predictionResultWin: { color: colors.pitch400 },
  predictionResultLoss: { color: colors.inkMuted },

  statusBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeSettled: { backgroundColor: colors.pitch900 },
  statusBadgeText: { color: colors.inkSecondary, fontSize: 10, fontWeight: '700' },
  statusBadgeTextSettled: { color: colors.pitch400 },
});
