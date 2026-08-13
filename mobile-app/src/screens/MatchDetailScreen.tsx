import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match, BallEvent, Prediction } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

function teamName(team: Match['team1'] | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'string' ? 'TBD' : team.name;
}

// Match.createdBy may arrive as a bare id string, a raw Mongoose doc (`_id`), or the
// register/login-shaped `{id}` object - normalize defensively rather than assume one shape.
function resolveUserId(u: Match['createdBy'] | undefined | null): string | null {
  if (!u) return null;
  if (typeof u === 'string') return u;
  const any = u as any;
  return any._id ?? any.id ?? null;
}

// Which innings is "current" for the Recent Deliveries / commentary panel: whichever one has
// balls bowled most recently. innings[1] only has balls once the second innings has started,
// so preferring it when non-empty naturally tracks the match's progress.
function activeInningsIndex(match: Match): 0 | 1 {
  return match.innings[1]?.balls?.length ? 1 : 0;
}

// Every player (batsman or bowler) who appears anywhere in this match's ball-by-ball data -
// the mobile port of web-app/app/match/[id]/page.tsx's playersWhoAppeared, feeding the
// per-player "View Report" links below (see PerformanceReportScreen).
function playersWhoAppeared(innings: Match['innings']): string[] {
  const ids = new Set<string>();
  for (const inn of innings) {
    for (const ball of inn.balls) {
      if (ball.batsmanId) ids.add(ball.batsmanId);
      if (ball.bowlerId) ids.add(ball.bowlerId);
    }
  }
  return [...ids];
}

function ballChip(ball: BallEvent): { label: string; style: any; textStyle: any } {
  if (ball.isWicket) return { label: 'W', style: styles.chipWicket, textStyle: styles.chipTextWicket };
  if (ball.isExtra) {
    const shortLabels: Record<string, string> = {
      wide: 'wd',
      'no-ball': 'nb',
      bye: 'b',
      'leg-bye': 'lb',
      penalty: 'pen',
    };
    return {
      label: `${shortLabels[ball.extraType] || 'ex'}${ball.runs ? `+${ball.runs}` : ''}`,
      style: styles.chipExtra,
      textStyle: styles.chipTextExtra,
    };
  }
  if (ball.runs === 4 || ball.runs === 6) {
    return { label: String(ball.runs), style: styles.chipBoundary, textStyle: styles.chipTextBoundary };
  }
  return { label: String(ball.runs), style: styles.chipNormal, textStyle: styles.chipTextNormal };
}

interface ChartOver {
  over: number;
  runs: number;
  wickets: number;
}
interface ChartInnings {
  team: any;
  overs: ChartOver[];
  cumulative: { over: number; total: number }[];
}

// Manhattan/Worm charts - dependency-free equivalent of web-app's inline-SVG
// ManhattanChart/WormChart, built the same way as PlayerStatsScreen's wagon wheel: a column of
// rows, each a label plus a proportionally-filled bar View. No react-native-svg or charting
// library, per the Expo Go pilot-distribution constraint. One color per innings (batting order).
const CHART_TEAM_COLORS = [colors.pitch500, colors.gold500];

function chartTeamName(team: any, fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

interface PredictionSplit {
  mine: Prediction | null;
  totalPredictions: number;
  communitySplit: Record<string, number>;
}

// predictedWinner arrives as a bare Team id string from GET /predictions/match/:matchId (the
// endpoint this screen uses), but type it defensively in case a populated shape ever shows up.
function predictedWinnerId(p: Prediction | null | undefined): string | null {
  if (!p) return null;
  return typeof p.predictedWinner === 'string' ? p.predictedWinner : p.predictedWinner._id;
}

interface KeyMoment {
  ballIndex: number;
  ballNumber: number;
  commentary: string;
  isWicket: boolean;
  runs: number;
  winProbabilityBefore: number;
  winProbabilityAfter: number;
  delta: number;
}

export default function MatchDetailScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartInnings, setChartInnings] = useState<ChartInnings[] | null>(null);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[] | null>(null);
  const [prediction, setPrediction] = useState<PredictionSplit | null>(null);
  const [predicting, setPredicting] = useState(false);
  // Player id -> display name, for the "View Report" links below - the directory endpoint
  // doesn't come back scoped to just this match's participants, so it's fetched once here,
  // same non-blocking pattern as web-app's fetchPlayerDirectory.
  const [playerDirectory, setPlayerDirectory] = useState<Map<string, string>>(new Map());

  const load = useCallback(() => {
    api.matches
      .getMatchById(matchId)
      .then(({ match }) => {
        setMatch(match);
        setError(null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load match'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Over-by-over chart data is a nice-to-have, fetched separately and non-blocking - if it
  // fails or the match hasn't started, the section simply doesn't render.
  useEffect(() => {
    if (!match || match.status === 'Scheduled') {
      setChartInnings(null);
      return;
    }
    let cancelled = false;
    api.matches
      .getCharts(match._id)
      .then(({ innings }) => {
        if (!cancelled) setChartInnings(innings as ChartInnings[]);
      })
      .catch(() => {
        if (!cancelled) setChartInnings(null);
      });
    return () => {
      cancelled = true;
    };
  }, [match?._id, match?.status]);

  // Key moments (WPA-style win-probability swings) is also a nice-to-have, non-blocking fetch -
  // it 400s for Test matches or chases with no deliveries yet, which just means nothing to show.
  useEffect(() => {
    if (!match || match.status === 'Scheduled' || match.matchType === 'Test') {
      setKeyMoments(null);
      return;
    }
    let cancelled = false;
    api.matches
      .getKeyMoments(match._id)
      .then(({ keyMoments }) => {
        if (!cancelled) setKeyMoments(keyMoments as KeyMoment[]);
      })
      .catch(() => {
        if (!cancelled) setKeyMoments(null);
      });
    return () => {
      cancelled = true;
    };
  }, [match?._id, match?.status]);

  // The predict-the-winner widget's data (community split + the logged-in user's own pick, if
  // any) - a nice-to-have, non-blocking fetch that never blocks the match view if it fails.
  useEffect(() => {
    if (!match) {
      setPrediction(null);
      return;
    }
    let cancelled = false;
    api.predictions
      .getForMatch(match._id)
      .then((data) => {
        if (!cancelled) setPrediction(data);
      })
      .catch(() => {
        if (!cancelled) setPrediction(null);
      });
    return () => {
      cancelled = true;
    };
  }, [match?._id, match?.status]);

  // Player-report link directory - fetched once, independent of match state, purely to attach
  // display names to the "View Report" chips below.
  useEffect(() => {
    let cancelled = false;
    api.players
      .getPlayers()
      .then(({ players }) => {
        if (cancelled) return;
        const map = new Map<string, string>();
        for (const p of players) {
          const name = typeof p.user === 'string' ? null : p.user?.name;
          if (name) map.set(p._id, name);
        }
        setPlayerDirectory(map);
      })
      .catch(() => {
        if (!cancelled) setPlayerDirectory(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePredict = async (teamId: string) => {
    if (!match || !user || predicting) return;
    setPredicting(true);
    try {
      await api.predictions.submit(match._id, teamId);
      // Re-fetch rather than trust the submit response alone - it also refreshes the
      // community split, which shifts as soon as this pick is counted.
      const fresh = await api.predictions.getForMatch(match._id);
      setPrediction(fresh);
    } catch {
      // Non-critical - the picker simply doesn't reflect the change; user can retry the tap.
    } finally {
      setPredicting(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }

  if (!match) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Match not found</Text>
        <Text style={styles.muted}>{error || 'It may have been removed.'}</Text>
      </View>
    );
  }

  const ownerId = resolveUserId(match.createdBy);
  const isOwner = !!user && !!ownerId && ownerId === user.id;
  const canScore = isOwner && (match.status === 'Live' || match.status === 'Scheduled');

  const team1Id = teamIdOf(match.team1);
  const team2Id = teamIdOf(match.team2);
  const myPickId = predictedWinnerId(prediction?.mine);
  const predictionTotal = prediction?.totalPredictions ?? 0;
  const team1Picks = prediction?.communitySplit?.[team1Id] ?? 0;
  const team2Picks = prediction?.communitySplit?.[team2Id] ?? 0;
  const team1Pct = predictionTotal > 0 ? Math.round((team1Picks / predictionTotal) * 100) : 0;
  const team2Pct = predictionTotal > 0 ? Math.round((team2Picks / predictionTotal) * 100) : 0;

  const activeIdx = activeInningsIndex(match);
  const activeBalls = match.innings[activeIdx]?.balls ?? [];
  const recentBalls = activeBalls.slice(-12);
  const recentCommentary = [...activeBalls].slice(-8).reverse();

  const activeChart = chartInnings?.[activeIdx];
  const maxOverRuns = activeChart?.overs?.length
    ? Math.max(6, ...activeChart.overs.map((o) => o.runs))
    : 6;

  // Manhattan/Worm scaling - computed across BOTH innings (not just the active one), so the
  // two teams' bars stay comparable row-to-row.
  const hasChartData = !!chartInnings?.some((inn) => inn.overs.some((o) => o.runs > 0 || o.wickets > 0));
  const manhattanMaxOvers = chartInnings?.length ? Math.max(0, ...chartInnings.map((inn) => inn.overs.length)) : 0;
  const manhattanMaxRuns = chartInnings?.length
    ? Math.max(1, ...chartInnings.flatMap((inn) => inn.overs.map((o) => o.runs)))
    : 1;
  const wormMaxOvers = chartInnings?.length ? Math.max(0, ...chartInnings.map((inn) => inn.cumulative.length)) : 0;
  const wormMaxTotal = chartInnings?.length
    ? Math.max(1, ...chartInnings.flatMap((inn) => inn.cumulative.map((c) => c.total)))
    : 1;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      <View style={styles.header}>
        <Text style={styles.matchType}>{match.matchType} · {match.venue}</Text>
        <Text style={styles.title}>{match.title}</Text>
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, match.status === 'Live' && styles.statusBadgeLive]}>
            <Text style={[styles.statusBadgeText, match.status === 'Live' && styles.statusBadgeTextLive]}>
              {match.status}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.scoreCard}>
        {[0, 1].map((idx) => {
          const innings = match.innings[idx];
          const team = idx === 0 ? match.team1 : match.team2;
          const isActive = idx === activeIdx && match.status === 'Live';
          return (
            <View key={idx} style={[styles.scoreRow, idx === 0 && styles.scoreRowDivider]}>
              <View style={styles.scoreRowLeft}>
                {isActive && <View style={styles.liveDot} />}
                <Text style={styles.scoreTeamName}>{teamName(team)}</Text>
              </View>
              <Text style={styles.scoreValue}>
                {innings ? `${innings.runs}/${innings.wickets}` : '-'}
                <Text style={styles.scoreOvers}>{innings ? `  (${innings.overs.toFixed(1)} ov)` : ''}</Text>
              </Text>
            </View>
          );
        })}

        {match.status === 'Completed' && match.result && (
          <Text style={styles.resultText}>
            {match.result.winningTeam == null
              ? 'Match tied'
              : `${
                  teamName(match.result.winningTeam === teamIdOf(match.team1) ? match.team1 : match.team2)
                } won by ${match.result.marginValue} ${match.result.margin}`}
          </Text>
        )}
      </View>

      {canScore && (
        <TouchableOpacity
          style={styles.scoreButton}
          onPress={() => navigation.navigate('LiveScoring', { matchId: match._id })}
        >
          <Text style={styles.scoreButtonText}>
            {match.status === 'Live' ? 'Continue Scoring' : 'Score this match'}
          </Text>
        </TouchableOpacity>
      )}

      {match.status === 'Scheduled' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Predict the Winner</Text>
          <View style={styles.predictCard}>
            {!user && (
              <Text style={styles.predictLoginPrompt}>Log in to predict this match and earn points.</Text>
            )}

            {user && (
              <View style={styles.predictButtonRow}>
                <TouchableOpacity
                  style={[styles.predictButton, myPickId === team1Id && styles.predictButtonSelected]}
                  onPress={() => handlePredict(team1Id)}
                  disabled={predicting}
                >
                  <Text style={[styles.predictButtonText, myPickId === team1Id && styles.predictButtonTextSelected]}>
                    {teamName(match.team1)}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.predictButton, myPickId === team2Id && styles.predictButtonSelected]}
                  onPress={() => handlePredict(team2Id)}
                  disabled={predicting}
                >
                  <Text style={[styles.predictButtonText, myPickId === team2Id && styles.predictButtonTextSelected]}>
                    {teamName(match.team2)}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {myPickId && (
              <Text style={styles.predictHint}>
                Your pick: {myPickId === team1Id ? teamName(match.team1) : teamName(match.team2)} · tap the other team to change it
              </Text>
            )}

            {predictionTotal > 0 && (
              <View style={styles.predictSplit}>
                <Text style={styles.predictSplitLabel}>
                  {predictionTotal} prediction{predictionTotal === 1 ? '' : 's'} so far
                </Text>
                <View style={styles.predictSplitRow}>
                  <Text style={styles.predictSplitTeamLabel} numberOfLines={1}>{teamName(match.team1)}</Text>
                  <View style={styles.predictBarTrack}>
                    <View style={[styles.predictBar, { flex: Math.max(team1Pct, 1) }]} />
                    <View style={{ flex: Math.max(100 - team1Pct, 1) }} />
                  </View>
                  <Text style={styles.predictSplitPct}>{team1Pct}%</Text>
                </View>
                <View style={styles.predictSplitRow}>
                  <Text style={styles.predictSplitTeamLabel} numberOfLines={1}>{teamName(match.team2)}</Text>
                  <View style={styles.predictBarTrack}>
                    <View style={[styles.predictBar, { flex: Math.max(team2Pct, 1) }]} />
                    <View style={{ flex: Math.max(100 - team2Pct, 1) }} />
                  </View>
                  <Text style={styles.predictSplitPct}>{team2Pct}%</Text>
                </View>
              </View>
            )}
          </View>
        </View>
      )}

      {match.status !== 'Scheduled' && prediction?.mine && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Prediction</Text>
          <View style={styles.predictCard}>
            <Text style={styles.predictLockedPick}>
              You predicted {myPickId === team1Id ? teamName(match.team1) : teamName(match.team2)} to win
            </Text>
            {prediction.mine.status === 'settled' ? (
              <Text style={[styles.predictResult, prediction.mine.points > 0 ? styles.predictResultWin : styles.predictResultLoss]}>
                {prediction.mine.wonOnWinner
                  ? `Correct winner! +${prediction.mine.points} points`
                  : prediction.mine.points > 0
                  ? `+${prediction.mine.points} points`
                  : 'Not this time - 0 points'}
              </Text>
            ) : (
              <Text style={styles.predictHint}>Predictions are locked - result pending.</Text>
            )}
          </View>
        </View>
      )}

      {/* Player Performance Reports - mobile port of web-app's per-player report links.
          Additive/self-contained block; intentionally not touching scorecard rendering
          elsewhere in this file. */}
      {playersWhoAppeared(match.innings).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Player Performance Reports</Text>
          <Text style={styles.reportsHint}>
            This match&apos;s numbers vs. career average, recent form, and a tactical read on every dismissal.
          </Text>
          <View style={styles.reportChipRow}>
            {playersWhoAppeared(match.innings).map((playerId) => (
              <TouchableOpacity
                key={playerId}
                style={styles.reportChip}
                onPress={() => navigation.navigate('PerformanceReport', { matchId: match._id, playerId })}
              >
                <Text style={styles.reportChipText}>
                  {playerDirectory.get(playerId) ?? 'View report'} &rarr;
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {recentBalls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Deliveries</Text>
          <View style={styles.chipRow}>
            {recentBalls.map((ball, i) => {
              const chip = ballChip(ball);
              return (
                <View key={i} style={[styles.chip, chip.style]}>
                  <Text style={[styles.chipText, chip.textStyle]}>{chip.label}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {recentCommentary.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Commentary</Text>
          {recentCommentary.map((ball, i) => (
            <View key={i} style={styles.commentaryRow}>
              <Text style={styles.commentaryText}>
                {ball.commentary || `${ball.isWicket ? 'Wicket!' : `${ball.runs} run(s).`}`}
              </Text>
            </View>
          ))}
        </View>
      )}

      {keyMoments && keyMoments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🔑 Key Moments</Text>
          {keyMoments.map((moment) => {
            const swungTowardsChasers = moment.winProbabilityAfter > moment.winProbabilityBefore;
            return (
              <View key={moment.ballIndex} style={styles.keyMomentRow}>
                <Text style={styles.commentaryText}>
                  {moment.commentary || `${moment.runs} run(s).`}
                </Text>
                <Text style={styles.keyMomentDelta}>
                  Win probability {swungTowardsChasers ? '+' : '-'}{(moment.delta * 100).toFixed(1)}%
                  {'  '}({(moment.winProbabilityBefore * 100).toFixed(0)}% → {(moment.winProbabilityAfter * 100).toFixed(0)}%)
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {activeChart && activeChart.overs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Over-by-over</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chartRow}>
              {activeChart.overs.map((o) => (
                <View key={o.over} style={styles.chartBarWrap}>
                  <View style={styles.chartBarTrack}>
                    <View
                      style={[
                        styles.chartBar,
                        { height: 8 + (o.runs / maxOverRuns) * 56 },
                        o.wickets > 0 && styles.chartBarWicket,
                      ]}
                    />
                  </View>
                  <Text style={styles.chartBarRuns}>{o.runs}</Text>
                  <Text style={styles.chartBarLabel}>{o.over + 1}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Manhattan / Worm charts - additive block, dependency-free (see CHART_TEAM_COLORS
          comment above); intentionally separate from the existing "Over-by-over" section
          above, which only shows the currently-batting innings. These cover both innings. */}
      {hasChartData && chartInnings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Manhattan Chart</Text>
          <Text style={styles.reportsHint}>Runs scored per over</Text>
          <View style={styles.chartListCard}>
            <ScrollView style={styles.chartListScroll} nestedScrollEnabled>
              {Array.from({ length: manhattanMaxOvers }).map((_, overIdx) => (
                <View key={overIdx} style={styles.chartListRow}>
                  <Text style={styles.chartListLabel}>{overIdx + 1}</Text>
                  <View style={styles.chartListBars}>
                    {chartInnings.map((inn, teamIdx) => {
                      const over = inn.overs[overIdx];
                      const widthPct = over ? Math.max(4, (over.runs / manhattanMaxRuns) * 100) : 0;
                      return (
                        <View key={teamIdx} style={styles.chartMiniBarRow}>
                          <View style={styles.chartMiniBarTrack}>
                            <View
                              style={[
                                styles.chartMiniBarFill,
                                { width: `${widthPct}%`, backgroundColor: CHART_TEAM_COLORS[teamIdx % 2] },
                              ]}
                            />
                          </View>
                          {over && over.wickets > 0 && <View style={styles.chartWicketDot} />}
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.chartListValue}>
                    {chartInnings.map((inn) => (inn.overs[overIdx] ? inn.overs[overIdx].runs : '-')).join(' · ')}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chartLegendRow}>
              {chartInnings.map((inn, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: CHART_TEAM_COLORS[i % 2] }]} />
                  <Text style={styles.legendText}>{chartTeamName(inn.team, `Team ${i + 1}`)}</Text>
                </View>
              ))}
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.wicket500 }]} />
                <Text style={styles.legendText}>Wicket that over</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {hasChartData && chartInnings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worm Chart</Text>
          <Text style={styles.reportsHint}>Cumulative team total after each over</Text>
          <View style={styles.chartListCard}>
            <ScrollView style={styles.chartListScroll} nestedScrollEnabled>
              {Array.from({ length: wormMaxOvers }).map((_, overIdx) => (
                <View key={overIdx} style={styles.chartListRow}>
                  <Text style={styles.chartListLabel}>{overIdx + 1}</Text>
                  <View style={styles.chartListBars}>
                    {chartInnings.map((inn, teamIdx) => {
                      const point = inn.cumulative[overIdx];
                      const widthPct = point ? Math.max(4, (point.total / wormMaxTotal) * 100) : 0;
                      return (
                        <View key={teamIdx} style={styles.chartMiniBarRow}>
                          <View style={styles.chartMiniBarTrack}>
                            <View
                              style={[
                                styles.chartMiniBarFill,
                                { width: `${widthPct}%`, backgroundColor: CHART_TEAM_COLORS[teamIdx % 2] },
                              ]}
                            />
                          </View>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={styles.chartListValue}>
                    {chartInnings.map((inn) => (inn.cumulative[overIdx] ? inn.cumulative[overIdx].total : '-')).join(' · ')}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <View style={styles.chartLegendRow}>
              {chartInnings.map((inn, i) => (
                <View key={i} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: CHART_TEAM_COLORS[i % 2] }]} />
                  <Text style={styles.legendText}>{chartTeamName(inn.team, `Team ${i + 1}`)}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function teamIdOf(team: Match['team1']): string {
  return typeof team === 'string' ? team : team._id;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  muted: { color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
  errorTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 },

  header: { padding: 16, paddingBottom: 8 },
  matchType: { color: colors.gold500, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800', marginBottom: 10 },
  statusRow: { flexDirection: 'row' },
  statusBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeLive: { backgroundColor: colors.pitch900 },
  statusBadgeText: { color: colors.inkSecondary, fontSize: 11, fontWeight: '700' },
  statusBadgeTextLive: { color: colors.pitch400 },

  scoreCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  scoreRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8 },
  scoreRowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  scoreRowLeft: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.pitch400, marginRight: 8 },
  scoreTeamName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  scoreValue: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  scoreOvers: { color: colors.inkMuted, fontSize: 12, fontWeight: '500' },
  resultText: { color: colors.gold400, fontSize: 13, fontWeight: '700', marginTop: 10, textAlign: 'center' },

  scoreButton: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.pitch500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  scoreButtonText: { color: colors.background, fontWeight: '800', fontSize: 15 },

  section: { marginTop: 22, paddingHorizontal: 16 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '700', marginBottom: 10 },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  chipText: { fontSize: 13, fontWeight: '800' },
  chipNormal: { backgroundColor: colors.surfaceAlt },
  chipTextNormal: { color: colors.inkSecondary },
  chipBoundary: { backgroundColor: colors.gold600 },
  chipTextBoundary: { color: colors.background },
  chipWicket: { backgroundColor: colors.wicket500 },
  chipTextWicket: { color: '#fff' },
  chipExtra: { backgroundColor: colors.surfaceHover, borderWidth: 1, borderColor: colors.info || colors.border },
  chipTextExtra: { color: colors.inkSecondary, fontSize: 11 },

  commentaryRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    marginBottom: 8,
  },
  commentaryText: { color: colors.inkSecondary, fontSize: 13, lineHeight: 18 },

  keyMomentRow: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gold600,
    padding: 10,
    marginBottom: 8,
  },
  keyMomentDelta: { color: colors.gold400, fontSize: 11, fontWeight: '700', marginTop: 6 },

  predictCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  predictLoginPrompt: { color: colors.inkSecondary, fontSize: 13, textAlign: 'center', paddingVertical: 4 },
  predictButtonRow: { flexDirection: 'row', gap: 10 },
  predictButton: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 14,
    alignItems: 'center',
  },
  predictButtonSelected: { backgroundColor: colors.pitch900, borderColor: colors.pitch500 },
  predictButtonText: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  predictButtonTextSelected: { color: colors.pitch400 },
  predictHint: { color: colors.inkMuted, fontSize: 12, marginTop: 10, textAlign: 'center' },
  predictSplit: { marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
  predictSplitLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '600', marginBottom: 8 },
  predictSplitRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  predictSplitTeamLabel: { color: colors.inkSecondary, fontSize: 12, width: 84 },
  predictBarTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
  },
  predictBar: { backgroundColor: colors.gold500, borderRadius: 4 },
  predictSplitPct: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700', width: 36, textAlign: 'right' },
  predictLockedPick: { color: colors.ink, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  predictResult: { fontSize: 13, fontWeight: '700', textAlign: 'center', marginTop: 8 },
  predictResultWin: { color: colors.pitch400 },
  predictResultLoss: { color: colors.inkMuted },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingBottom: 4 },
  chartBarWrap: { alignItems: 'center', width: 28 },
  chartBarTrack: { height: 64, justifyContent: 'flex-end' },
  chartBar: { width: 16, backgroundColor: colors.pitch500, borderRadius: 4 },
  chartBarWicket: { backgroundColor: colors.wicket500 },
  chartBarRuns: { color: colors.ink, fontSize: 11, fontWeight: '700', marginTop: 4 },
  chartBarLabel: { color: colors.inkMuted, fontSize: 10, marginTop: 1 },

  reportsHint: { color: colors.inkMuted, fontSize: 12, marginBottom: 10 },
  reportChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportChip: {
    backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  reportChipText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },

  // Manhattan/Worm chart list rows - one row per over, label + proportionally-filled bar
  // View(s), same pattern as PlayerStatsScreen's wagon wheel rows.
  chartListCard: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  chartListScroll: { maxHeight: 280 },
  chartListRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, gap: 8 },
  chartListLabel: { color: colors.inkMuted, fontSize: 11, width: 20, textAlign: 'right' },
  chartListBars: { flex: 1, gap: 3 },
  chartMiniBarRow: { flexDirection: 'row', alignItems: 'center' },
  chartMiniBarTrack: {
    flex: 1, height: 7, backgroundColor: colors.surfaceAlt, borderRadius: 4, overflow: 'hidden',
  },
  chartMiniBarFill: { height: '100%', borderRadius: 4 },
  chartWicketDot: {
    width: 5, height: 5, borderRadius: 3, backgroundColor: colors.wicket500, marginLeft: 4,
  },
  chartListValue: { color: colors.inkSecondary, fontSize: 11, width: 56, textAlign: 'right' },
  chartLegendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.inkSecondary, fontSize: 11 },
});
