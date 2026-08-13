// Post-match player performance report - the mobile port of
// web-app/app/match/[id]/report/[playerId]/page.tsx. Shows this match's batting/bowling
// figures, a career-average comparison, a recent-form sequence, milestone/achievement badges,
// and - the differentiated part, given the same visual priority here as on web - a "tactical
// read" on whether each dismissal matched a zone the matchup-shrinkage engine had already
// flagged as high-risk for this batter against the dismissing bowler.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, ActivityIndicator, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import type {
  PerformanceReport,
  PerformanceRecentFormEntry,
  PerformanceDismissalDetail,
} from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';

type Props = NativeStackScreenProps<MatchesStackParamList, 'PerformanceReport'>;

// Same split-and-capitalize convention as PlayerStatsScreen's zoneLabel - line/length values
// come back from the backend as kebab-case enum values (e.g. "good-length").
function labelize(value: string): string {
  return value.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: colors.pitch400,
  medium: colors.gold400,
  low: colors.wicket400,
  none: colors.inkMuted,
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function deltaText(value: number, unit: string): string {
  return `${value >= 0 ? '+' : ''}${value}${unit}`;
}

// Recent-form trend as a row of small bars (no charting library - same lightweight approach as
// the wagon wheel on PlayerStatsScreen, just laid out horizontally instead of as label+track
// rows since this is a short sequence rather than a fixed set of zones).
function TrendBars({
  label,
  entries,
  valueOf,
  unit,
}: {
  label: string;
  entries: PerformanceRecentFormEntry[];
  valueOf: (e: PerformanceRecentFormEntry) => number | null;
  unit: string;
}) {
  const points = entries.filter((e) => valueOf(e) !== null);
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((e) => valueOf(e) ?? 0));

  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={styles.trendLabel}>{label}</Text>
      <View style={styles.trendRow}>
        {points.map((e) => {
          const value = valueOf(e) ?? 0;
          const barHeight = Math.max(6, (value / max) * 64);
          return (
            <View key={e.matchId} style={styles.trendCol}>
              <Text style={styles.trendValue}>{value}{unit}</Text>
              <View style={styles.trendBarTrack}>
                <View
                  style={[
                    styles.trendBar,
                    { height: barHeight },
                    e.isThisMatch && styles.trendBarThisMatch,
                  ]}
                />
              </View>
              <Text style={[styles.trendDate, e.isThisMatch && styles.trendDateThisMatch]} numberOfLines={1}>
                {e.isThisMatch ? 'This match' : formatDate(e.scheduledDate)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function TacticalDismissalCard({ dismissal, index }: { dismissal: PerformanceDismissalDetail; index: number }) {
  const hasZones = dismissal.line !== 'unknown' && dismissal.length !== 'unknown';
  const flagged = dismissal.matchedRiskZone === true;
  const offPattern = dismissal.matchedRiskZone === false;

  return (
    <View style={styles.dismissalCard}>
      <View style={styles.dismissalHeaderRow}>
        <Text style={styles.dismissalTitle}>
          Dismissal {index + 1}{hasZones ? ` · ${labelize(dismissal.length)}, ${labelize(dismissal.line)}` : ''}
        </Text>
        {dismissal.matchedRiskZone !== undefined && (
          <View style={[styles.pill, flagged ? styles.pillDanger : offPattern ? styles.pillSuccess : styles.pillNeutral]}>
            <Text style={styles.pillText}>{flagged ? 'Flagged risk zone' : 'Off-pattern'}</Text>
          </View>
        )}
      </View>
      <Text style={styles.dismissalType}>{dismissal.wicketType || 'unknown dismissal'}</Text>
      <Text style={styles.dismissalNote}>{dismissal.note}</Text>
      {dismissal.topRiskBuckets && dismissal.topRiskBuckets.length > 0 && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.riskZonesLabel}>Top risk zones (this matchup)</Text>
          {dismissal.topRiskBuckets.map((b, i) => (
            <View key={i} style={styles.riskZoneRow}>
              <Text style={styles.riskZoneText}>{labelize(b.length)}, {labelize(b.line)}</Text>
              <View style={styles.riskZoneRight}>
                <Text style={styles.riskZoneRate}>{b.blendedDismissalRate}% dismissal</Text>
                <Text style={[styles.riskZoneConfidence, { color: CONFIDENCE_COLOR[b.confidence] ?? colors.inkMuted }]}>
                  {b.confidence}
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

export default function PerformanceReportScreen({ route }: Props) {
  const { matchId, playerId } = route.params;

  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [matchTitle, setMatchTitle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.matches.getPerformanceReport(matchId, playerId)
      .then((data) => setReport(data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load performance report'))
      .finally(() => { setLoading(false); setRefreshing(false); });

    api.matches.getMatchById(matchId)
      .then(({ match }) => setMatchTitle(match?.title ?? null))
      .catch(() => setMatchTitle(null));
  }, [matchId, playerId]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.inkMuted} />
        <Text style={styles.errorText}>{error || 'Report unavailable.'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      <View style={styles.header}>
        <Text style={styles.playerName}>{report.player.name}</Text>
        <Text style={styles.headerSubtitle}>
          {report.player.specialization}{matchTitle ? ` · ${matchTitle}` : ''}
        </Text>
      </View>

      {!report.participated ? (
        <View style={styles.section}>
          <View style={styles.card}>
            <Text style={styles.muted}>{report.message}</Text>
          </View>
        </View>
      ) : (
        <>
          {/* Headline this-match numbers */}
          <View style={styles.section}>
            <View style={styles.headlineRow}>
              {report.thisMatch?.batting && (
                <View style={[styles.card, styles.headlineCard]}>
                  <Text style={styles.cardLabel}>Batting</Text>
                  <Text style={styles.headlineValue}>
                    {report.thisMatch.batting.runs}
                    <Text style={styles.headlineValueSuffix}>{report.thisMatch.batting.out ? '' : '*'}</Text>
                  </Text>
                  <Text style={styles.headlineSub}>
                    {report.thisMatch.batting.balls}b · {report.thisMatch.batting.fours}x4 · {report.thisMatch.batting.sixes}x6 · SR {report.thisMatch.batting.strikeRate}
                  </Text>
                  <Text style={styles.headlineFooter}>{report.thisMatch.batting.out ? 'Out' : 'Not out'}</Text>
                </View>
              )}
              {report.thisMatch?.bowling && (
                <View style={[styles.card, styles.headlineCard]}>
                  <Text style={styles.cardLabel}>Bowling</Text>
                  <Text style={styles.headlineValue}>
                    {report.thisMatch.bowling.wickets}
                    <Text style={styles.headlineValueSuffix}>/{report.thisMatch.bowling.runs}</Text>
                  </Text>
                  <Text style={styles.headlineSub}>
                    {report.thisMatch.bowling.overs} ov · Econ {report.thisMatch.bowling.economy}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Tactical read - the differentiated section, given the same top-of-page priority as web */}
          <View style={styles.section}>
            <View style={[styles.card, styles.tacticalCard]}>
              <View style={styles.tacticalHeaderRow}>
                <Text style={styles.sectionTitle}>Tactical read</Text>
                <View style={[styles.pill, styles.pillGold]}>
                  <Text style={styles.pillTextDark}>Matchup model</Text>
                </View>
              </View>
              <Text style={styles.tacticalSubtitle}>
                Whether each dismissal came from a zone the hierarchical matchup-shrinkage model had already flagged as high-risk for this batter against this bowler.
              </Text>
              {report.tacticalTieBack && report.tacticalTieBack.dismissals.length > 0 ? (
                report.tacticalTieBack.dismissals.map((d, i) => (
                  <TacticalDismissalCard key={i} dismissal={d} index={i} />
                ))
              ) : (
                <Text style={styles.muted}>{report.tacticalTieBack?.message ?? 'Nothing to cross-reference this match.'}</Text>
              )}
            </View>
          </View>

          {/* Career-average comparison */}
          {(report.careerComparison?.batting || report.careerComparison?.bowling) && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Vs. your career average</Text>
                {report.careerComparison.batting && (
                  <View style={styles.comparisonBlock}>
                    <View style={styles.comparisonHeaderRow}>
                      <Text style={styles.comparisonLabel}>Batting</Text>
                      {report.careerComparison.batting.hasEnoughHistory && (
                        <>
                          <View style={[styles.pill, report.careerComparison.batting.runsDelta >= 0 ? styles.pillSuccess : styles.pillDanger]}>
                            <Text style={styles.pillText}>{deltaText(report.careerComparison.batting.runsDelta, ' runs')}</Text>
                          </View>
                          <View style={[styles.pill, report.careerComparison.batting.strikeRateDelta >= 0 ? styles.pillSuccess : styles.pillDanger]}>
                            <Text style={styles.pillText}>{deltaText(report.careerComparison.batting.strikeRateDelta, ' SR')}</Text>
                          </View>
                        </>
                      )}
                    </View>
                    <Text style={styles.comparisonMessage}>{report.careerComparison.batting.message}</Text>
                  </View>
                )}
                {report.careerComparison.bowling && (
                  <View style={styles.comparisonBlock}>
                    <View style={styles.comparisonHeaderRow}>
                      <Text style={styles.comparisonLabel}>Bowling</Text>
                      {report.careerComparison.bowling.hasEnoughHistory && (
                        <View style={[styles.pill, report.careerComparison.bowling.economyDelta <= 0 ? styles.pillSuccess : styles.pillDanger]}>
                          <Text style={styles.pillText}>{deltaText(report.careerComparison.bowling.economyDelta, ' econ')}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.comparisonMessage}>{report.careerComparison.bowling.message}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Recent-form trend */}
          {report.recentForm && report.recentForm.length > 1 && (
            <View style={styles.section}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Recent form (last {report.recentForm.length} matches)</Text>
                <TrendBars label="Runs" entries={report.recentForm} valueOf={(e) => e.runs} unit="" />
                <TrendBars label="Wickets" entries={report.recentForm} valueOf={(e) => e.wickets} unit="w" />
              </View>
            </View>
          )}

          {/* Milestones & achievements */}
          {report.milestones && (
            <View style={[styles.section, { paddingBottom: 32 }]}>
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Milestones</Text>
                {report.milestones.battingMessage && (
                  <View style={styles.milestoneRow}>
                    {report.milestones.isCareerBestBatting && (
                      <View style={[styles.pill, styles.pillGold]}><Text style={styles.pillTextDark}>New Best</Text></View>
                    )}
                    <Text style={styles.milestoneMessage}>{report.milestones.battingMessage}</Text>
                  </View>
                )}
                {report.milestones.bowlingMessage && (
                  <View style={styles.milestoneRow}>
                    {report.milestones.isCareerBestBowling && (
                      <View style={[styles.pill, styles.pillGold]}><Text style={styles.pillTextDark}>New Best</Text></View>
                    )}
                    <Text style={styles.milestoneMessage}>{report.milestones.bowlingMessage}</Text>
                  </View>
                )}

                {report.milestones.badgesThisMatch.length > 0 && (
                  <View style={{ marginTop: 8, marginBottom: 4 }}>
                    <Text style={styles.badgesLabel}>Earned this match</Text>
                    <View style={styles.badgesRow}>
                      {report.milestones.badgesThisMatch.map((b) => (
                        <View key={b.key} style={[styles.pill, styles.pillGold]}>
                          <Text style={styles.pillTextDark}>{b.label}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

                <View style={{ marginTop: 8 }}>
                  <Text style={styles.badgesLabel}>Career achievements</Text>
                  <View style={styles.badgesRow}>
                    {report.milestones.careerAchievements.filter((a) => a.earned).map((a) => (
                      <View key={a.key} style={[styles.pill, styles.pillSuccess]}>
                        <Text style={styles.pillText}>{a.label}{a.count > 1 ? ` x${a.count}` : ''}</Text>
                      </View>
                    ))}
                    {report.milestones.careerAchievements.every((a) => !a.earned) && (
                      <Text style={styles.muted}>No career badges earned yet.</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          )}
        </>
      )}
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
  muted: { color: colors.inkMuted, fontSize: 13 },

  header: { padding: 16, paddingBottom: 8 },
  playerName: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: colors.inkSecondary, fontSize: 13, marginTop: 4 },

  section: { paddingHorizontal: 16, marginTop: 14 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 8 },

  card: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  cardLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 },

  headlineRow: { flexDirection: 'row', gap: 10 },
  headlineCard: { flex: 1 },
  headlineValue: { color: colors.ink, fontSize: 26, fontWeight: '800' },
  headlineValueSuffix: { fontSize: 14, fontWeight: '400', color: colors.inkMuted },
  headlineSub: { color: colors.inkSecondary, fontSize: 12, marginTop: 4 },
  headlineFooter: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },

  tacticalCard: { borderColor: colors.gold600 },
  tacticalHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tacticalSubtitle: { color: colors.inkMuted, fontSize: 11, marginBottom: 12, lineHeight: 15 },

  dismissalCard: {
    backgroundColor: colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    padding: 12, marginTop: 10,
  },
  dismissalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
  dismissalTitle: { color: colors.ink, fontSize: 13, fontWeight: '700', flex: 1 },
  dismissalType: { color: colors.inkMuted, fontSize: 11, marginBottom: 4, textTransform: 'capitalize' },
  dismissalNote: { color: colors.inkSecondary, fontSize: 13, lineHeight: 18 },

  riskZonesLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  riskZoneRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  riskZoneText: { color: colors.inkSecondary, fontSize: 11, textTransform: 'capitalize' },
  riskZoneRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  riskZoneRate: { color: colors.inkMuted, fontSize: 11 },
  riskZoneConfidence: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { color: colors.background, fontSize: 10, fontWeight: '700' },
  pillTextDark: { color: colors.background, fontSize: 10, fontWeight: '700' },
  pillSuccess: { backgroundColor: colors.pitch500 },
  pillDanger: { backgroundColor: colors.wicket500 },
  pillNeutral: { backgroundColor: colors.surfaceHover },
  pillGold: { backgroundColor: colors.gold500 },

  comparisonBlock: { marginTop: 6 },
  comparisonHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' },
  comparisonLabel: { color: colors.inkSecondary, fontSize: 13, fontWeight: '700' },
  comparisonMessage: { color: colors.inkSecondary, fontSize: 13, lineHeight: 18 },

  trendLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 8 },
  trendRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  trendCol: { alignItems: 'center', width: 52 },
  trendValue: { color: colors.inkMuted, fontSize: 11, marginBottom: 4 },
  trendBarTrack: { height: 64, justifyContent: 'flex-end' },
  trendBar: { width: 18, backgroundColor: colors.pitch700, borderRadius: 4 },
  trendBarThisMatch: { backgroundColor: colors.gold500 },
  trendDate: { color: colors.inkMuted, fontSize: 9, marginTop: 4, textAlign: 'center' },
  trendDateThisMatch: { color: colors.gold400, fontWeight: '700' },

  milestoneRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  milestoneMessage: { color: colors.inkSecondary, fontSize: 13, flex: 1, lineHeight: 18 },
  badgesLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: 6 },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
