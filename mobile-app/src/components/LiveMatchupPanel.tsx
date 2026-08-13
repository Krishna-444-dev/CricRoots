// Live, in-match version of the matchup finder on the pre-match scouting report screen - see
// backend/src/services/tendencyAnalytics.js#getLiveMatchupPlan and
// documentation/hierarchical-matchup-shrinkage-research.md for the algorithm. Deliberately
// compact/quiet (small type, muted panel, collapsible) since it sits inside the already-dense
// LiveScoringScreen - a hint for the bowling captain, not a headline. Mirrors
// web-app/components/scoring/LiveMatchupPanel.tsx.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

function labelize(v: string): string {
  return v
    .split(/[-\s]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface LiveBucket {
  line: string;
  length: string;
  todayAdjustedRate: number | null;
  confidence: string;
  liveBalls: number;
}

interface LivePlan {
  success: boolean;
  targetBuckets?: LiveBucket[];
  message: string;
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: colors.pitch400,
  medium: colors.gold400,
  low: colors.wicket400,
  pool: colors.inkMuted,
  none: colors.inkMuted,
};

interface LiveMatchupPanelProps {
  matchId: string;
  batsmanId?: string | null;
  bowlerId?: string | null;
  // Bump this (e.g. balls recorded so far this innings) to force a refetch after every ball
  // recorded - the live-bowling-plan endpoint's answer changes as soon as a new ball lands, not
  // just when the striker/bowler themselves change.
  refreshKey: string | number;
}

export default function LiveMatchupPanel({ matchId, batsmanId, bowlerId, refreshKey }: LiveMatchupPanelProps) {
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!batsmanId || !bowlerId) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.insights
      .getLiveMatchupPlan(batsmanId, bowlerId, matchId)
      .then((data) => {
        if (!cancelled) setPlan(data as LivePlan);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, batsmanId, bowlerId, refreshKey]);

  if (!batsmanId || !bowlerId) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.headerRow} onPress={() => setCollapsed((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.headerText}>Live tactical read</Text>
        <View style={styles.headerRight}>
          {loading && <Text style={styles.updatingText}>updating...</Text>}
          <Text style={styles.collapseIcon}>{collapsed ? '+' : '-'}</Text>
        </View>
      </TouchableOpacity>

      {!collapsed &&
        (plan?.targetBuckets && plan.targetBuckets.length > 0 ? (
          <View style={styles.bucketList}>
            {plan.targetBuckets.slice(0, 2).map((b, i) => (
              <View key={i} style={styles.bucketRow}>
                <Text style={styles.bucketLabel} numberOfLines={1}>
                  {labelize(b.length)}, {labelize(b.line)}
                </Text>
                <View style={styles.bucketRight}>
                  {b.liveBalls > 0 && <Text style={styles.liveBallsText}>{b.liveBalls} today</Text>}
                  <View style={[styles.rateBadge, { borderColor: CONFIDENCE_COLOR[b.confidence] ?? colors.inkMuted }]}>
                    <Text style={[styles.rateBadgeText, { color: CONFIDENCE_COLOR[b.confidence] ?? colors.inkMuted }]}>
                      {b.todayAdjustedRate}%
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>{plan?.message || 'Not enough tagged data yet for a tactical read.'}</Text>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 10,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  updatingText: { color: colors.inkMuted, fontSize: 11 },
  collapseIcon: { color: colors.inkMuted, fontSize: 13, fontWeight: '700', width: 14, textAlign: 'center' },

  bucketList: { marginTop: 6, gap: 6 },
  bucketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bucketLabel: { color: colors.ink, fontSize: 13, flex: 1, marginRight: 8 },
  bucketRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveBallsText: { color: colors.gold400, fontSize: 11, fontWeight: '600' },
  rateBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  rateBadgeText: { fontSize: 11, fontWeight: '700' },

  emptyText: { color: colors.inkSecondary, fontSize: 12, marginTop: 6 },
});
