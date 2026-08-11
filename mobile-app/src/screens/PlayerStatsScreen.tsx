// Player Stats screen - career batting/bowling/fielding stats, wagon wheel, and achievement
// badges, all computed live from real match data by the backend (see backend/src/services/
// tendencyAnalytics.js). Works for both "my own stats" and "someone else's stats" - the
// screen only ever cares about the `playerId` route param, it does not special-case the
// logged-in user.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { PlayerCareerStats } from '../shared/types';

const ACHIEVEMENT_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  'century-maker': 'trophy',
  'half-century-hero': 'ribbon',
  'five-wicket-haul': 'flame',
  'hat-trick-hero': 'flash',
  'golden-duck': 'egg',
  'century-of-wickets': 'medal',
  'all-rounder': 'star',
  'wicketkeeper-great': 'shield-checkmark',
};

function zoneLabel(zone: string): string {
  return zone.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

interface StatRow {
  label: string;
  value: string | number;
}

function StatGrid({ rows }: { rows: StatRow[] }) {
  return (
    <View style={styles.statGrid}>
      {rows.map(row => (
        <View key={row.label} style={styles.statCell}>
          <Text style={styles.statValue}>{row.value}</Text>
          <Text style={styles.statLabel}>{row.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function PlayerStatsScreen({ route }: any) {
  const playerId: string | undefined = route?.params?.playerId;

  const [stats, setStats] = useState<PlayerCareerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!playerId) {
      setError('No player specified.');
      setLoading(false);
      setRefreshing(false);
      return;
    }
    setError(null);
    api.playerStats.getStats(playerId)
      .then(({ stats: fetched }) => setStats(fetched))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load stats'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [playerId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  if (error || !stats) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.inkMuted} />
        <Text style={styles.errorText}>{error || 'Stats unavailable.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const { player, batting, bowling, fielding, overall, wagonWheel, achievements } = stats;
  const sortedWagonWheel = [...(wagonWheel || [])].sort((a, b) => b.runsPercent - a.runsPercent);
  const maxRunsPercent = sortedWagonWheel.length > 0 ? Math.max(...sortedWagonWheel.map(z => z.runsPercent), 1) : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{player?.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
        </View>
        <Text style={styles.playerName}>{player?.name ?? 'Player'}</Text>
        <View style={styles.specBadge}>
          <Text style={styles.specBadgeText}>{player?.specialization ?? 'Player'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <StatGrid
          rows={[
            { label: 'Matches', value: overall.matches },
            { label: 'Wins', value: overall.wins },
            { label: 'Losses', value: overall.losses },
            { label: 'Win %', value: `${overall.winPercentage}%` },
            { label: 'Man of the Match', value: overall.manOfTheMatch },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Batting</Text>
        <StatGrid
          rows={[
            { label: 'Innings', value: batting.innings },
            { label: 'Runs', value: batting.runs },
            { label: 'Highest', value: batting.highestScore },
            { label: 'Average', value: batting.average },
            { label: 'Strike Rate', value: batting.strikeRate },
            { label: '100s', value: batting.centuries },
            { label: '50s', value: batting.halfCenturies },
            { label: 'Ducks', value: batting.ducks },
            { label: 'Not Outs', value: batting.notOuts },
            { label: 'Fours', value: batting.fours },
            { label: 'Sixes', value: batting.sixes },
            { label: 'Balls Faced', value: batting.balls },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bowling</Text>
        <StatGrid
          rows={[
            { label: 'Innings', value: bowling.innings },
            { label: 'Wickets', value: bowling.wickets },
            { label: 'Runs Conceded', value: bowling.runs },
            { label: 'Average', value: bowling.average },
            { label: 'Economy', value: bowling.economyRate },
            { label: 'Balls Bowled', value: bowling.balls },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Fielding & Wicketkeeping</Text>
        <StatGrid
          rows={[
            { label: 'Catches', value: fielding.catches },
            { label: 'Run Outs', value: fielding.runOuts },
            { label: 'Stumpings', value: fielding.stumpings },
          ]}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Wagon Wheel</Text>
        <Text style={styles.sectionSubtitle}>Runs distribution by shot zone</Text>
        {sortedWagonWheel.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.muted}>No shot-zone data recorded yet.</Text>
          </View>
        ) : (
          <View style={styles.wagonWheel}>
            {sortedWagonWheel.map(zone => (
              <View key={zone.zone} style={styles.wagonRow}>
                <Text style={styles.wagonZoneLabel}>{zoneLabel(zone.zone)}</Text>
                <View style={styles.wagonBarTrack}>
                  <View
                    style={[
                      styles.wagonBarFill,
                      { width: `${Math.max((zone.runsPercent / maxRunsPercent) * 100, 4)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.wagonStats}>{zone.runs}r ({zone.runsPercent}%)</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, { paddingBottom: 32 }]}>
        <Text style={styles.sectionTitle}>Achievements</Text>
        <View style={styles.achievementsGrid}>
          {achievements.map(achievement => (
            <View
              key={achievement.key}
              style={[styles.achievementCard, achievement.earned && styles.achievementCardEarned]}
            >
              <Ionicons
                name={ACHIEVEMENT_ICONS[achievement.key] ?? 'trophy'}
                size={26}
                color={achievement.earned ? colors.gold400 : colors.inkMuted}
              />
              <Text style={[styles.achievementLabel, achievement.earned && styles.achievementLabelEarned]}>
                {achievement.label}
              </Text>
              <Text style={styles.achievementDescription}>{achievement.description}</Text>
              {achievement.earned && achievement.count > 0 && (
                <View style={styles.achievementCountBadge}>
                  <Text style={styles.achievementCountText}>x{achievement.count}</Text>
                </View>
              )}
              {!achievement.earned && (
                <Ionicons name="lock-closed" size={12} color={colors.inkMuted} style={styles.lockIcon} />
              )}
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.inkSecondary, fontSize: 14, marginTop: 10, textAlign: 'center' },
  retryButton: {
    marginTop: 16, backgroundColor: colors.pitch500, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20,
  },
  retryButtonText: { color: colors.background, fontWeight: '700' },

  header: { alignItems: 'center', padding: 24 },
  avatar: {
    width: 72, height: 72, borderRadius: 36, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center', marginBottom: 10,
  },
  avatarText: { color: colors.pitch400, fontSize: 30, fontWeight: 'bold' },
  playerName: { color: colors.ink, fontSize: 20, fontWeight: 'bold' },
  specBadge: {
    marginTop: 6, backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4,
  },
  specBadgeText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700' },

  section: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  sectionSubtitle: { color: colors.inkMuted, fontSize: 12, marginBottom: 12 },
  muted: { color: colors.inkMuted },

  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: {
    width: '31%', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', paddingVertical: 12,
  },
  statValue: { color: colors.ink, fontSize: 17, fontWeight: 'bold' },
  statLabel: { color: colors.inkMuted, fontSize: 11, marginTop: 4, textAlign: 'center' },

  emptyBox: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 20, alignItems: 'center',
  },
  wagonWheel: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  wagonRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  wagonZoneLabel: { color: colors.inkSecondary, fontSize: 12, width: 78 },
  wagonBarTrack: {
    flex: 1, height: 10, backgroundColor: colors.surfaceAlt, borderRadius: 6, overflow: 'hidden', marginHorizontal: 8,
  },
  wagonBarFill: { height: '100%', backgroundColor: colors.pitch500, borderRadius: 6 },
  wagonStats: { color: colors.inkMuted, fontSize: 11, width: 68, textAlign: 'right' },

  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  achievementCard: {
    width: '47%', backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, alignItems: 'center', opacity: 0.55, position: 'relative',
  },
  achievementCardEarned: {
    opacity: 1, borderColor: colors.gold500, backgroundColor: colors.surfaceAlt,
  },
  achievementLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  achievementLabelEarned: { color: colors.gold400 },
  achievementDescription: { color: colors.inkMuted, fontSize: 10, marginTop: 4, textAlign: 'center' },
  achievementCountBadge: {
    position: 'absolute', top: 8, right: 8, backgroundColor: colors.gold500, borderRadius: 999,
    paddingHorizontal: 6, paddingVertical: 1,
  },
  achievementCountText: { color: colors.background, fontSize: 10, fontWeight: '800' },
  lockIcon: { position: 'absolute', top: 10, right: 10 },
});
