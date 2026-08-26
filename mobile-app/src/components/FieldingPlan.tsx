// Recommended field placement for a batsman currently at the crease - see
// backend/src/routes/insightsRoutes.js's fielding-plan endpoint and
// documentation/hierarchical-matchup-shrinkage-research.md for how recommendedZones is derived
// (this batter's own scoring zones, falling back to similar-batsmen pooled data, then a generic
// tip when there's not enough of either).
//
// web-app/components/insights/FieldingPlan.tsx draws this as an inline-SVG 8-wedge circle with
// numbered fielder markers. Mobile has no SVG/charting library in scope (see
// MatchDetailScreen's Manhattan/Worm charts, built as plain Views for the exact same Expo Go
// distribution constraint) - this renders the same ranked recommendation as a clean textual
// list instead of porting the wheel diagram. Self-contained/self-fetching, same pattern as
// LiveMatchupPanel.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { PlayerLink } from './IdentityLink';
import { api } from '../shared/api/apiClient';

function labelize(value: string): string {
  return value
    .split(/[-\s]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface RecommendedZone {
  zone: string;
  balls: number;
  runs: number;
  runsPercent: number;
}

interface FieldingPlanResponse {
  success: boolean;
  source: 'own-data' | 'pool-data' | 'generic';
  sampleSize?: number;
  confidence?: 'high' | 'medium' | 'low';
  recommendedZones?: RecommendedZone[];
  message: string;
}

interface FieldingPlanProps {
  playerId: string;
  playerName: string;
  roleLabel: string;
}

export default function FieldingPlan({ playerId, playerName, roleLabel }: FieldingPlanProps) {
  const [plan, setPlan] = useState<FieldingPlanResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.insights
      .getFieldingPlan(playerId)
      .then((data) => {
        if (!cancelled) setPlan(data as FieldingPlanResponse);
      })
      .catch(() => {
        if (!cancelled) setPlan(null);
      });
    return () => {
      cancelled = true;
    };
  }, [playerId]);

  const zones = plan?.recommendedZones ?? [];

  return (
    <View style={styles.container}>
      <View style={styles.roleLabelRow}>
        <Text style={styles.roleLabel}>{roleLabel}: </Text>
        <PlayerLink id={playerId} name={playerName} style={styles.roleLabel} numberOfLines={1} />
      </View>
      {zones.length > 0 && (
        <View style={styles.zoneList}>
          {zones.slice(0, 4).map((z, i) => (
            <View key={z.zone} style={styles.zoneRow}>
              <View style={[styles.zoneRank, i === 0 && styles.zoneRankTop]}>
                <Text style={[styles.zoneRankText, i === 0 && styles.zoneRankTextTop]}>{i + 1}</Text>
              </View>
              <Text style={styles.zoneName} numberOfLines={1}>{labelize(z.zone)}</Text>
              <Text style={styles.zonePct}>{z.runsPercent}% · {z.balls} balls</Text>
            </View>
          ))}
        </View>
      )}
      {plan && (
        <Text style={styles.message}>
          {plan.message}
          {plan.source !== 'generic' && plan.confidence === 'low' ? ' (light sample so far)' : ''}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  roleLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleLabel: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  zoneList: { gap: 6 },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  zoneRank: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.wicket400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneRankTop: { backgroundColor: colors.wicket400 },
  zoneRankText: { color: colors.wicket400, fontSize: 10, fontWeight: '800' },
  zoneRankTextTop: { color: '#2A0A0A' },
  zoneName: { flex: 1, color: colors.ink, fontSize: 13 },
  zonePct: { color: colors.inkSecondary, fontSize: 11 },
  message: { color: colors.inkSecondary, fontSize: 12, marginTop: 8 },
});
