import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import Svg, { Polyline, Polygon, Line as SvgLine, Text as SvgText, Circle } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match, BallEvent, Prediction, Player } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';
import AtTheCrease from '../components/AtTheCrease';
import FieldingPlan from '../components/FieldingPlan';
import AITacticalAdvisor from '../components/AITacticalAdvisor';
import { resolveRefId } from '../shared/utils/resolveRef';
import { computeCanScore } from '../shared/utils/matchAuth';
import { battingStatsFor, bowlingStatsFor, maidenOversFor, dismissalFor } from '../shared/utils/matchStats';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

function teamName(team: Match['team1'] | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'string' ? 'TBD' : team.name;
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

// Manhattan chart: a column of rows, each a label plus a proportionally-filled bar View - the
// same list-row pattern PlayerStatsScreen's wagon wheel uses. One color per innings (batting
// order). The Worm Chart below is a real SVG line/area chart instead (see WormChartSvg) - a
// growing bar per over doesn't show what a worm chart is for (each team's scoring *rate*,
// compared side by side, with a crossing point once the second innings catches up).
const CHART_TEAM_COLORS = [colors.pitch500, colors.gold500];

function chartTeamName(team: any, fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

// Mobile port of web-app/components/insights/WormChart.tsx's SVG design (two polylines showing
// cumulative runs per over, an area fill under each, wicket dots) rather than the bar-list style
// used for the Manhattan Chart above. react-native-svg ships inside Expo Go itself (it's in
// Expo's own "bundled native modules" list: docs.expo.dev/versions/latest/sdk/svg), so this
// doesn't need a custom dev client or break the Expo Go pilot-distribution path.
function WormChartSvg({ innings }: { innings: ChartInnings[] }) {
  const maxOvers = Math.max(1, ...innings.map((inn) => inn.cumulative.length));
  const maxTotal = Math.max(1, ...innings.flatMap((inn) => inn.cumulative.map((c) => c.total)));

  const width = Math.max(320, maxOvers * 26);
  const height = 200;
  const paddingLeft = 32;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const labelStep = Math.max(1, Math.ceil(maxOvers / 12));

  const xFor = (overNumber: number) => paddingLeft + (overNumber / maxOvers) * chartWidth;
  const yFor = (total: number) => paddingTop + chartHeight - (total / maxTotal) * chartHeight;
  const baselineY = paddingTop + chartHeight;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {[0, 0.5, 1].map((f) => (
            <React.Fragment key={f}>
              <SvgLine
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={paddingTop + chartHeight * (1 - f)}
                y2={paddingTop + chartHeight * (1 - f)}
                stroke={colors.border}
                strokeWidth={1}
                opacity={0.6}
              />
              <SvgText x={paddingLeft - 6} y={paddingTop + chartHeight * (1 - f) + 3} textAnchor="end" fontSize={9} fill={colors.inkMuted}>
                {Math.round(maxTotal * f)}
              </SvgText>
            </React.Fragment>
          ))}

          {Array.from({ length: maxOvers + 1 }).map((_, overNumber) =>
            overNumber % labelStep === 0 ? (
              <SvgText
                key={overNumber}
                x={xFor(overNumber)}
                y={height - paddingBottom + 14}
                textAnchor="middle"
                fontSize={9}
                fill={colors.inkMuted}
              >
                {overNumber}
              </SvgText>
            ) : null
          )}

          {innings.map((inn, teamIdx) => {
            if (inn.cumulative.length === 0) return null;
            const points = [{ over: 0, total: 0 }, ...inn.cumulative.map((c) => ({ over: c.over + 1, total: c.total }))];
            const linePoints = points.map((p) => `${xFor(p.over)},${yFor(p.total)}`).join(' ');
            const areaPoints = `${xFor(0)},${baselineY} ${linePoints} ${xFor(points[points.length - 1].over)},${baselineY}`;
            const color = CHART_TEAM_COLORS[teamIdx % 2];
            return (
              <React.Fragment key={teamIdx}>
                <Polygon points={areaPoints} fill={color} opacity={0.1} />
                <Polyline
                  points={linePoints}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {inn.overs.map((o, i) =>
                  o.wickets > 0 ? (
                    <Circle key={i} cx={xFor(o.over + 1)} cy={yFor(points[i + 1].total)} r={3} fill={colors.wicket500} />
                  ) : null
                )}
              </React.Fragment>
            );
          })}

          <SvgLine x1={paddingLeft} x2={width - paddingRight} y1={baselineY} y2={baselineY} stroke={colors.borderStrong} strokeWidth={1} />
        </Svg>
      </ScrollView>
      <View style={styles.chartLegendRow}>
        {innings.map((inn, i) => (
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
  );
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
  return resolveRefId(p.predictedWinner);
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
  const { user, token } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
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
  // Full player list, for the same broadened "who can score this match" check LiveScoringScreen
  // uses (see shared/utils/matchAuth.ts) - this screen's own "Score this match" button needs to
  // agree with what that screen will actually let someone do once they get there.
  const [players, setPlayers] = useState<Player[]>([]);

  const load = useCallback(() => {
    api.matches
      .getMatchById(matchId)
      .then(({ match, powerplayOvers }) => {
        setMatch(match);
        setPowerplayOvers(powerplayOvers ?? null);
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
        setPlayers(players);
      })
      .catch(() => {
        if (!cancelled) {
          setPlayerDirectory(new Map());
          setPlayers([]);
        }
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

  const { canScore: canManageMatch } = computeCanScore(match, user?.id, players);
  const canScore = canManageMatch && (match.status === 'Live' || match.status === 'Scheduled');

  const team1Id = teamIdOf(match.team1);
  const team2Id = teamIdOf(match.team2);
  const myPickId = predictedWinnerId(prediction?.mine);
  const predictionTotal = prediction?.totalPredictions ?? 0;
  const team1Picks = prediction?.communitySplit?.[team1Id] ?? 0;
  const team2Picks = prediction?.communitySplit?.[team2Id] ?? 0;
  const team1Pct = predictionTotal > 0 ? Math.round((team1Picks / predictionTotal) * 100) : 0;
  const team2Pct = predictionTotal > 0 ? Math.round((team2Picks / predictionTotal) * 100) : 0;

  // Target score - replaced by the rain-rule revised target once match.interruption is set.
  // Mirrors web-app's app/match/[id]/page.tsx exactly (same field, same fallback).
  const targetScore = match.interruption ? match.interruption.target : (match.innings[0]?.runs || 0);

  const activeIdx = activeInningsIndex(match);
  const currentInnings = match.innings[activeIdx];
  const activeBalls = match.innings[activeIdx]?.balls ?? [];
  const recentBalls = activeBalls.slice(-12);
  const recentCommentary = [...activeBalls].slice(-8).reverse();

  const activeChart = chartInnings?.[activeIdx];
  const maxOverRuns = activeChart?.overs?.length
    ? Math.max(6, ...activeChart.overs.map((o) => o.runs))
    : 6;

  // Manhattan scaling - computed across BOTH innings (not just the active one), so the two
  // teams' bars stay comparable row-to-row. (WormChartSvg does its own equivalent scaling.)
  const hasChartData = !!chartInnings?.some((inn) => inn.overs.some((o) => o.runs > 0 || o.wickets > 0));
  const manhattanMaxOvers = chartInnings?.length ? Math.max(0, ...chartInnings.map((inn) => inn.overs.length)) : 0;
  const manhattanMaxRuns = chartInnings?.length
    ? Math.max(1, ...chartInnings.flatMap((inn) => inn.overs.map((o) => o.runs)))
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
          {match.status === 'Live' && powerplayOvers != null && currentInnings && currentInnings.overs < powerplayOvers && (
            <View style={styles.powerplayBadge}>
              <Text style={styles.powerplayBadgeText}>⚡ Powerplay (overs 1-{powerplayOvers})</Text>
            </View>
          )}
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

        <View style={styles.targetRow}>
          <Text style={styles.targetLabel}>{match.interruption ? 'Revised Target' : 'Target Score'}</Text>
          <Text style={styles.targetValue}>{targetScore} runs</Text>
        </View>
      </View>

      {/* Rain-rule interruption callout - see backend/src/services/rainRuleCalculator.js for
          the calculation and its real accuracy/scope caveats (an approximation inspired by
          Duckworth-Lewis-Stern, not the official licensed DLS algorithm). Mirrors web-app's
          app/match/[id]/page.tsx wording exactly. */}
      {match.interruption && (
        <View style={styles.interruptionCallout}>
          <Text style={styles.interruptionTitle}>
            Rain rule applied — revised to {match.interruption.revisedOvers} overs
          </Text>
          <Text style={styles.interruptionBody}>
            Par score {match.interruption.parScore} ({match.interruption.resourcePercentRemaining}% resources
            remaining at the point of interruption, {match.interruption.wicketsLostAtInterruption} wicket(s) down).
            This is an approximate rain-rule estimate inspired by the Duckworth-Lewis-Stern method, not the
            official licensed calculation — treat it as a guide, not a binding result.
          </Text>
        </View>
      )}

      {/* At the Crease - live striker/non-striker/bowler figures. Mirrors web-app's
          app/match/[id]/page.tsx "At the Crease" block. */}
      {match.status === 'Live' && currentInnings?.liveState && (
        <AtTheCrease liveState={currentInnings.liveState} />
      )}

      {/* Recommended field placements for whoever's currently batting - see FieldingPlan.tsx
          for why this is a ranked text list rather than a diagram on mobile. */}
      {match.status === 'Live' && currentInnings?.liveState && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommended Field</Text>
          <View style={styles.fieldingList}>
            {currentInnings.liveState.currentBatsmen.map((batsman, i) => (
              batsman && (
                <FieldingPlan
                  key={batsman.id}
                  playerId={batsman.id}
                  playerName={batsman.name}
                  roleLabel={i === 0 ? 'Striker' : 'Non-striker'}
                />
              )
            ))}
          </View>
        </View>
      )}

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

      {/* Scouting report / matchup finder - see ScoutingReportScreen, mirrors web-app's
          /match/[id]/scouting page. */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.scoutingButton}
          onPress={() => navigation.navigate('ScoutingReport', { matchId: match._id })}
        >
          <Text style={styles.scoutingButtonText}>Scouting Report &rarr;</Text>
        </TouchableOpacity>
      </View>

      {/* Full Scorecard - read-only, visible to anyone viewing the match (not just the scorer;
      LiveScoringScreen has its own copy of this for the scorer specifically). Batting/bowling
      order is derived from first appearance in the ball log, same source playersWhoAppeared
      below uses, since team.players isn't reliably populated with real rosters on this endpoint. */}
      {match.innings.some((inn) => inn.balls.length > 0) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Full Scorecard</Text>
          {match.innings.map((innings, idx) => {
            if (innings.balls.length === 0) return null;
            const battingOrder: string[] = [];
            const bowlingOrder: string[] = [];
            for (const b of innings.balls) {
              if (b.batsmanId && !battingOrder.includes(b.batsmanId)) battingOrder.push(b.batsmanId);
              if (b.bowlerId && !bowlingOrder.includes(b.bowlerId)) bowlingOrder.push(b.bowlerId);
            }
            return (
              <View key={idx} style={styles.scorecardInnings}>
                <Text style={styles.scorecardTeamName}>
                  {teamName(innings.team)} - {innings.runs}/{innings.wickets} ({innings.overs.toFixed(1)} ov)
                </Text>

                <View style={styles.scorecardHeaderRow}>
                  <Text style={[styles.scorecardHeaderCell, styles.scorecardNameCol]}>Batsman</Text>
                  <Text style={styles.scorecardHeaderCell}>R</Text>
                  <Text style={styles.scorecardHeaderCell}>B</Text>
                  <Text style={styles.scorecardHeaderCell}>4s</Text>
                  <Text style={styles.scorecardHeaderCell}>6s</Text>
                  <Text style={styles.scorecardHeaderCell}>SR</Text>
                </View>
                {battingOrder.map((playerId) => {
                  const stats = battingStatsFor(innings.balls, playerId);
                  const dismissal = dismissalFor(innings.balls, playerId, (id) => (id ? playerDirectory.get(id) : undefined));
                  return (
                    <View key={playerId} style={styles.scorecardRow}>
                      <View style={[styles.scorecardNameCol, { flexShrink: 1 }]}>
                        <Text style={styles.scorecardNameText} numberOfLines={1}>
                          {playerDirectory.get(playerId) ?? 'Player'}
                        </Text>
                        <Text style={styles.scorecardDismissal} numberOfLines={1}>
                          {dismissal ?? 'not out'}
                        </Text>
                      </View>
                      <Text style={styles.scorecardCell}>{stats.runs}</Text>
                      <Text style={styles.scorecardCell}>{stats.ballsFaced}</Text>
                      <Text style={styles.scorecardCell}>{stats.fours}</Text>
                      <Text style={styles.scorecardCell}>{stats.sixes}</Text>
                      <Text style={styles.scorecardCell}>{stats.strikeRate.toFixed(1)}</Text>
                    </View>
                  );
                })}

                <View style={[styles.scorecardHeaderRow, { marginTop: 10 }]}>
                  <Text style={[styles.scorecardHeaderCell, styles.scorecardNameCol]}>Bowler</Text>
                  <Text style={styles.scorecardHeaderCell}>O</Text>
                  <Text style={styles.scorecardHeaderCell}>M</Text>
                  <Text style={styles.scorecardHeaderCell}>R</Text>
                  <Text style={styles.scorecardHeaderCell}>W</Text>
                  <Text style={styles.scorecardHeaderCell}>Econ</Text>
                </View>
                {bowlingOrder.map((playerId) => {
                  const stats = bowlingStatsFor(innings.balls, playerId);
                  const maidens = maidenOversFor(innings.balls, playerId);
                  return (
                    <View key={playerId} style={styles.scorecardRow}>
                      <Text style={[styles.scorecardCell, styles.scorecardNameCol]} numberOfLines={1}>
                        {playerDirectory.get(playerId) ?? 'Player'}
                      </Text>
                      <Text style={styles.scorecardCell}>{stats.overs.toFixed(1)}</Text>
                      <Text style={styles.scorecardCell}>{maidens}</Text>
                      <Text style={styles.scorecardCell}>{stats.runsConceded}</Text>
                      <Text style={styles.scorecardCell}>{stats.wickets}</Text>
                      <Text style={styles.scorecardCell}>{stats.economy.toFixed(2)}</Text>
                    </View>
                  );
                })}
              </View>
            );
          })}
        </View>
      )}

      {/* Player Performance Reports - mobile port of web-app's per-player report links. */}
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

      {/* AI Tactical Advisor - win probability + tactical advice, wired up with a REST fetch
          on mount (so it shows real data immediately) plus the existing WebSocket for live
          updates as balls land. See AITacticalAdvisor.tsx. */}
      {match.status === 'Live' && (
        <View style={styles.section}>
          <AITacticalAdvisor
            matchId={match._id}
            userId={user?.id ?? ''}
            token={token ?? ''}
            isLive={match.status === 'Live'}
          />
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
            <WormChartSvg innings={chartInnings} />
          </View>
        </View>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

function teamIdOf(team: Match['team1']): string {
  return resolveRefId(team) ?? '';
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
  powerplayBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  powerplayBadgeText: { color: colors.gold400, fontSize: 11, fontWeight: '700' },

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

  targetRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    alignItems: 'center',
  },
  targetLabel: { color: colors.inkMuted, fontSize: 11, fontWeight: '600', marginBottom: 2 },
  targetValue: { color: colors.ink, fontSize: 16, fontWeight: '800' },

  interruptionCallout: {
    marginHorizontal: 16,
    marginTop: 10,
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  interruptionTitle: { color: colors.gold400, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  interruptionBody: { color: colors.inkSecondary, fontSize: 11, lineHeight: 16 },

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

  scoutingButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.gold500,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  scoutingButtonText: { color: colors.gold400, fontWeight: '700', fontSize: 13 },

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

  scorecardInnings: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 12, marginBottom: 12,
  },
  scorecardTeamName: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  scorecardHeaderRow: {
    flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 6, marginBottom: 4,
  },
  scorecardHeaderCell: { flex: 1, color: colors.inkMuted, fontSize: 10, fontWeight: '700', textAlign: 'right' },
  scorecardRow: { flexDirection: 'row', paddingVertical: 4 },
  scorecardCell: { flex: 1, color: colors.inkSecondary, fontSize: 12, textAlign: 'right' },
  scorecardNameCol: { flex: 3, textAlign: 'left' },
  scorecardNameText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600', textAlign: 'left' },
  scorecardDismissal: { color: colors.inkMuted, fontSize: 10, textAlign: 'left', marginTop: 1 },

  reportsHint: { color: colors.inkMuted, fontSize: 12, marginBottom: 10 },
  reportChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportChip: {
    backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  reportChipText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },

  fieldingList: { gap: 10 },

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
