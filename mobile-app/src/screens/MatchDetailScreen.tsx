import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, FlatList, Image, Alert, TextInput } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Polyline, Polygon, Line as SvgLine, Text as SvgText, Circle, Rect, Path } from 'react-native-svg';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { scorebook, NUM } from '../theme/scorebook';
import { PlayerLink, TeamLink } from '../components/IdentityLink';
import CollapsibleSection from '../components/CollapsibleSection';
import { api, resolveAttachmentUrl } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match, BallEvent, Prediction, Player, RosterTeam, MatchPhoto } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';
import AtTheCrease from '../components/AtTheCrease';
import FieldingPlan from '../components/FieldingPlan';
import AITacticalAdvisor from '../components/AITacticalAdvisor';
import { resolveRefId, resolveRefName } from '../shared/utils/resolveRef';
import { computeCanScore, resolveUserId } from '../shared/utils/matchAuth';
import { battingStatsFor, bowlingStatsFor, maidenOversFor, dismissalFor, overByOver, commentaryOvers, ballOutcomeLabel, inningsExtras, fallOfWickets, inningsRunRate } from '../shared/utils/matchStats';
import { getInitials } from '../shared/utils/formatters';

type Props = NativeStackScreenProps<MatchesStackParamList, 'MatchDetail'>;

function teamName(team: Match['team1'] | undefined): string {
  if (!team) return 'TBD';
  return typeof team === 'string' ? 'TBD' : team.name;
}

// manOfTheMatch arrives as a populated Player doc with a nested populated `user` ref (see
// backend's MAN_OF_THE_MATCH_POPULATE) - same defensive Player | string handling teamName above
// uses for Team | string, plus an extra unwrap for the nested user ref.
function manOfTheMatchName(mom: Match['manOfTheMatch']): string | null {
  if (!mom || typeof mom === 'string') return null;
  const user = mom.user;
  if (!user || typeof user === 'string') return null;
  return user.name || null;
}

function squadPlayerName(player?: Player | string | null): string {
  if (!player || typeof player === 'string') return 'TBD';
  const u = player.user;
  return u && typeof u === 'object' ? u.name || 'TBD' : 'TBD';
}

// Image-only subset of GroupDetailScreen.tsx's guessMimeType - the Gallery upload picker is
// restricted to images (mediaTypes: ['images']), so no video branch is needed here.
function guessImageMimeType(uri: string): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp' };
  return (ext && map[ext]) || 'image/jpeg';
}

// Player.profilePicture defaults to the literal string 'no-photo.jpg' (see
// backend/src/models/Player.js), not a real URL - mirrors TournamentDetailScreen.tsx's
// PlayerAvatar fallback-to-initials pattern for the Squads section below.
function SquadAvatar({ player }: { player?: Player | string | null }) {
  if (!player || typeof player === 'string') {
    return (
      <View style={styles.rosterAvatarFallback}>
        <Text style={styles.rosterAvatarFallbackText}>?</Text>
      </View>
    );
  }
  const hasRealPhoto = !!player.profilePicture && player.profilePicture !== 'no-photo.jpg';
  if (hasRealPhoto) {
    return <Image source={{ uri: resolveAttachmentUrl(player.profilePicture!) }} style={styles.rosterAvatarImg} />;
  }
  return (
    <View style={styles.rosterAvatarFallback}>
      <Text style={styles.rosterAvatarFallbackText}>{getInitials(squadPlayerName(player))}</Text>
    </View>
  );
}

const SQUAD_PREVIEW_COUNT = 5;

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

// "Yet to bat" only makes sense while an innings is still in progress - once the batting side
// is all out (wickets down to one short of the full roster) or its overs allocation is used up,
// whoever's left just didn't get a turn, which isn't what CricClubs shows this list for.
// oversAllocation falls back through a mid-innings interruption's revised allocation (only ever
// applies to the second innings, see Interruption's comment) before the match's own total, and
// is skipped entirely for Test (no over cap). Mirrors web-app's inningsInProgress.
function inningsInProgress(idx: 0 | 1, innings: Match['innings'][number], roster: RosterPlayer[], match: Match): boolean {
  if (roster.length === 0) return false;
  const allOut = innings.wickets >= Math.max(1, roster.length - 1);
  const oversAllocation = idx === 1 && match.interruption ? match.interruption.revisedOvers : match.totalOvers ?? 20;
  const oversComplete = match.matchType !== 'Test' && innings.overs >= oversAllocation;
  return !allOut && !oversComplete;
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
interface ChartPartnership {
  batsmen: string[];
  runs: number;
  balls: number;
  outBatsmanId: string | null;
}
interface ChartInnings {
  team: any;
  overs: ChartOver[];
  cumulative: { over: number; total: number }[];
  extrasBreakdown: { type: string; runs: number }[];
  runsTypeBreakdown: { runs: string; count: number }[];
  boundaryBallBreakdown: { ball: number; count: number; percent: number }[];
  partnerships: ChartPartnership[];
}

// A team roster entry from GET /api/teams/:id (players populated with their user's name) -
// just enough shape for the "Yet to bat" list on the Full Scorecard tab.
interface RosterPlayer {
  _id: string;
  user: { _id: string; name: string } | string | null;
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

// Mobile port of web-app/components/insights/ManhattanChart.tsx's SVG design - clustered
// vertical bars (one per team per over) against a shared runs axis, rather than the previous
// horizontal bar-list rows, which read as an odd, non-standard "growing sideways" layout next
// to a real broadcast Manhattan chart.
function ManhattanChartSvg({ innings }: { innings: ChartInnings[] }) {
  const maxOvers = Math.max(1, ...innings.map((inn) => inn.overs.length));
  const maxRuns = Math.max(1, ...innings.flatMap((inn) => inn.overs.map((o) => o.runs)));

  const width = Math.max(320, maxOvers * 30);
  const height = 200;
  const paddingLeft = 28;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const clusterWidth = chartWidth / maxOvers;
  const barGap = 3;
  const barWidth = Math.max(3, (clusterWidth - barGap * (innings.length + 1)) / innings.length);
  const labelStep = Math.max(1, Math.ceil(maxOvers / 12));

  const yFor = (runs: number) => paddingTop + chartHeight - (runs / maxRuns) * chartHeight;
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
                {Math.round(maxRuns * f)}
              </SvgText>
            </React.Fragment>
          ))}

          {Array.from({ length: maxOvers }).map((_, overIdx) => {
            const clusterX = paddingLeft + overIdx * clusterWidth;
            return (
              <React.Fragment key={overIdx}>
                {innings.map((inn, teamIdx) => {
                  const over = inn.overs[overIdx];
                  if (!over) return null;
                  const barX = clusterX + barGap + teamIdx * (barWidth + barGap);
                  const barY = yFor(over.runs);
                  const barH = Math.max(0, baselineY - barY);
                  const color = CHART_TEAM_COLORS[teamIdx % 2];
                  return (
                    <React.Fragment key={teamIdx}>
                      <Rect x={barX} y={barY} width={barWidth} height={barH} fill={color} opacity={0.9} rx={1.5} />
                      {over.wickets > 0 && (
                        <Circle cx={barX + barWidth / 2} cy={Math.max(paddingTop - 4, barY - 7)} r={2.5} fill={colors.wicket500} />
                      )}
                    </React.Fragment>
                  );
                })}
                {overIdx % labelStep === 0 && (
                  <SvgText x={clusterX + clusterWidth / 2} y={height - paddingBottom + 14} textAnchor="middle" fontSize={9} fill={colors.inkMuted}>
                    {overIdx + 1}
                  </SvgText>
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

const EXTRA_LABELS: Record<string, string> = {
  wide: 'Wides',
  'no-ball': 'No Balls',
  bye: 'Byes',
  'leg-bye': 'Leg Byes',
  penalty: 'Penalty',
};

// Mobile port of web-app/components/insights/ExtrasChart.tsx - clustered vertical bars (one per
// team per extra type), same axis/cluster approach as ManhattanChartSvg above but categorical
// (extra type) instead of sequential (over number) on the x-axis.
function ExtrasChartSvg({ innings }: { innings: ChartInnings[] }) {
  const types = Object.keys(EXTRA_LABELS).filter((type) =>
    innings.some((inn) => (inn.extrasBreakdown.find((e) => e.type === type)?.runs ?? 0) > 0)
  );

  const maxRuns = Math.max(1, ...innings.flatMap((inn) => inn.extrasBreakdown.map((e) => e.runs)));

  const width = Math.max(280, types.length * 64);
  const height = 170;
  const paddingLeft = 20;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const clusterWidth = chartWidth / types.length;
  const barGap = 4;
  const barWidth = Math.max(8, (clusterWidth - barGap * (innings.length + 1)) / innings.length);

  const yFor = (runs: number) => paddingTop + chartHeight - (runs / maxRuns) * chartHeight;
  const baselineY = paddingTop + chartHeight;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {types.map((type, typeIdx) => {
            const clusterX = paddingLeft + typeIdx * clusterWidth;
            return (
              <React.Fragment key={type}>
                {innings.map((inn, teamIdx) => {
                  const runs = inn.extrasBreakdown.find((e) => e.type === type)?.runs ?? 0;
                  if (runs === 0) return null;
                  const barX = clusterX + barGap + teamIdx * (barWidth + barGap);
                  const barY = yFor(runs);
                  const barH = Math.max(0, baselineY - barY);
                  const color = CHART_TEAM_COLORS[teamIdx % 2];
                  return (
                    <React.Fragment key={teamIdx}>
                      <Rect x={barX} y={barY} width={barWidth} height={barH} fill={color} opacity={0.9} rx={1.5} />
                      <SvgText x={barX + barWidth / 2} y={barY - 4} textAnchor="middle" fontSize={9} fill={colors.inkMuted}>
                        {runs}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
                <SvgText x={clusterX + clusterWidth / 2} y={height - paddingBottom + 14} textAnchor="middle" fontSize={9} fill={colors.inkMuted}>
                  {EXTRA_LABELS[type]}
                </SvgText>
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
      </View>
    </View>
  );
}

const RUNS_TYPE_ORDER = ['0', '1', '2', '3', '4', '5', '6+'];

// Mobile port of web-app/components/insights/RunsTypeChart.tsx - same clustered-bar approach as
// ExtrasChartSvg above, bucketed by runs scored off the bat instead of extra type.
function RunsTypeChartSvg({ innings }: { innings: ChartInnings[] }) {
  const buckets = RUNS_TYPE_ORDER.filter((runs) =>
    innings.some((inn) => (inn.runsTypeBreakdown.find((r) => r.runs === runs)?.count ?? 0) > 0)
  );

  const maxCount = Math.max(1, ...innings.flatMap((inn) => inn.runsTypeBreakdown.map((r) => r.count)));

  const width = Math.max(280, buckets.length * 56);
  const height = 170;
  const paddingLeft = 20;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 22;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const clusterWidth = chartWidth / buckets.length;
  const barGap = 4;
  const barWidth = Math.max(8, (clusterWidth - barGap * (innings.length + 1)) / innings.length);

  const yFor = (count: number) => paddingTop + chartHeight - (count / maxCount) * chartHeight;
  const baselineY = paddingTop + chartHeight;

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <Svg width={width} height={height}>
          {buckets.map((runs, bucketIdx) => {
            const clusterX = paddingLeft + bucketIdx * clusterWidth;
            return (
              <React.Fragment key={runs}>
                {innings.map((inn, teamIdx) => {
                  const count = inn.runsTypeBreakdown.find((r) => r.runs === runs)?.count ?? 0;
                  if (count === 0) return null;
                  const barX = clusterX + barGap + teamIdx * (barWidth + barGap);
                  const barY = yFor(count);
                  const barH = Math.max(0, baselineY - barY);
                  const color = CHART_TEAM_COLORS[teamIdx % 2];
                  return (
                    <React.Fragment key={teamIdx}>
                      <Rect x={barX} y={barY} width={barWidth} height={barH} fill={color} opacity={0.9} rx={1.5} />
                      <SvgText x={barX + barWidth / 2} y={barY - 4} textAnchor="middle" fontSize={9} fill={colors.inkMuted}>
                        {count}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
                <SvgText x={clusterX + clusterWidth / 2} y={height - paddingBottom + 14} textAnchor="middle" fontSize={9} fill={colors.inkMuted}>
                  {runs}
                </SvgText>
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
      </View>
    </View>
  );
}

// Same fixed-order validated dark categorical set web's DismissalBreakdown.tsx / PlayerStatsScreen's
// DISMISSAL_ORDER use (see that file's comment) - reused here rather than re-validated since it's
// the same 6-of-8-slot subset.
const BALL_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];

function polarToXY(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polarToXY(cx, cy, rOuter, startAngle);
  const p2 = polarToXY(cx, cy, rOuter, endAngle);
  const p3 = polarToXY(cx, cy, rInner, endAngle);
  const p4 = polarToXY(cx, cy, rInner, startAngle);
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
}

// Mobile port of web-app/components/insights/BoundaryBallChart.tsx - a donut of what share of
// an innings' boundaries (4s/6s off the bat) landed on each ball-of-the-over position.
function BoundaryBallChartSvg({ data }: { data: ChartInnings['boundaryBallBreakdown'] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const size = 200;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 84;
  const rInner = 48;

  let angle = -90;
  const wedges = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const sweep = (d.count / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      return { ...d, startAngle, endAngle, color: BALL_COLORS[(d.ball - 1) % BALL_COLORS.length] };
    });

  return (
    <View style={{ alignItems: 'center' }}>
      <Svg width={size} height={size}>
        {wedges.map((w) => (
          <Path key={w.ball} d={wedgePath(cx, cy, rOuter, rInner, w.startAngle, w.endAngle)} fill={w.color} stroke={colors.surface} strokeWidth={2} />
        ))}
        <SvgText x={cx} y={cy - 4} textAnchor="middle" fontSize={20} fontWeight="800" fill={colors.ink}>
          {total}
        </SvgText>
        <SvgText x={cx} y={cy + 14} textAnchor="middle" fontSize={10} fill={colors.inkMuted}>
          boundaries
        </SvgText>
      </Svg>
      <View style={styles.chartLegendRow}>
        {wedges.map((w) => (
          <View key={w.ball} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: w.color }]} />
            <Text style={styles.legendText}>Ball {w.ball}: {w.count} ({w.percent}%)</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Mobile port of web-app/components/insights/RunRateChart.tsx - run rate after over N =
// cumulative runs / overs completed, derived from the same `cumulative` data WormChartSvg
// already receives (see that web component's comment on the one known imprecision this carries
// for an innings whose last over ended mid-over).
function RunRateChartSvg({ innings }: { innings: ChartInnings[] }) {
  const seriesByTeam = innings.map((inn) => inn.cumulative.map((c) => ({ over: c.over + 1, rate: c.total / (c.over + 1) })));
  const maxOvers = Math.max(1, ...innings.map((inn) => inn.cumulative.length));
  const maxRate = Math.max(1, ...seriesByTeam.flatMap((pts) => pts.map((p) => p.rate)));

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
  const yFor = (rate: number) => paddingTop + chartHeight - (rate / maxRate) * chartHeight;
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
                {(maxRate * f).toFixed(1)}
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

          {seriesByTeam.map((points, teamIdx) => {
            if (points.length === 0) return null;
            const linePoints = points.map((p) => `${xFor(p.over)},${yFor(p.rate)}`).join(' ');
            return <Polyline key={teamIdx} points={linePoints} fill="none" stroke={CHART_TEAM_COLORS[teamIdx % 2]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
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

// CricClubs-style tabbed match center, matching the web restructure (see MatchDetailScreen's
// git history / web-app/app/match/[id]/page.tsx) - Info / Ball By Ball / Full Scorecard /
// Over by Over / Charts, plus our own AI Insights tab.
type TabKey = 'info' | 'story' | 'ballByBall' | 'scorecard' | 'overByOver' | 'charts' | 'mvp' | 'gallery' | 'aiInsights';

interface MVPEntry {
  playerId: string;
  points: number;
}

export default function MatchDetailScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { user, token } = useAuth();

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [match, setMatch] = useState<Match | null>(null);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chartInnings, setChartInnings] = useState<ChartInnings[] | null>(null);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[] | null>(null);
  const [mvpRanking, setMvpRanking] = useState<MVPEntry[] | null>(null);
  // Mirrors web-app: collapses to the top few by default, same "Show all" toggle pattern
  // TournamentDetailScreen's Top Performers lists use.
  const [showAllMvp, setShowAllMvp] = useState(false);
  // AI Insights tab's completed-match content (Powerplay/Middle/Death phase comparison) -
  // mirrors web-app's tacticalReport.
  const [tacticalReport, setTacticalReport] = useState<{
    phases: { teamId: string; teamName: string; phases: Record<'powerplay' | 'middle' | 'death', { runs: number; wickets: number; overs: number; runRate: number }> }[];
    takeaway: string | null;
  } | null>(null);
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
  // Full rosters for the "Yet to bat" list on the Full Scorecard tab - battingBowlingOrder only
  // knows who has actually faced a ball, not who's registered but hasn't batted yet. Mirrors
  // web-app's team1Roster/team2Roster.
  const [team1Roster, setTeam1Roster] = useState<RosterPlayer[]>([]);
  const [team2Roster, setTeam2Roster] = useState<RosterPlayer[]>([]);
  // Umpire appointment modal + its own busy/error state - mirrors web-app's
  // umpireToAdd/umpireBusy/umpireError.
  const [umpirePickerOpen, setUmpirePickerOpen] = useState(false);
  const [umpireBusy, setUmpireBusy] = useState(false);
  const [umpireError, setUmpireError] = useState<string | null>(null);
  // Gallery tab - upload via expo-image-picker (already a dependency, same library
  // GroupDetailScreen.tsx uses for chat attachments), plus a full-screen lightbox for viewing
  // a photo (null = closed).
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MatchPhoto | null>(null);
  // Squads - both teams' full rosters (GET /api/teams/:id per side), same populated shape as
  // TournamentDetailScreen's Teams tab (RosterTeam). One flag per team for the "Full Squad" toggle.
  const [squadTeams, setSquadTeams] = useState<{ team1: RosterTeam | null; team2: RosterTeam | null }>({ team1: null, team2: null });
  const [squadsLoading, setSquadsLoading] = useState(false);
  const [squadsExpanded, setSquadsExpanded] = useState({ team1: false, team2: false });

  // Which innings the Ball By Ball tab shows. Holds ONLY an explicit user choice - null means
  // "follow whichever innings is active", so no effect is needed to sync it once the match loads.
  //
  // Declared up here with the other hooks on purpose: this component early-returns for the
  // loading and not-found states below, so a useState placed after those returns runs on some
  // renders and not others - which is exactly the "Rendered more hooks than during the previous
  // render" crash, and how this was first written.
  const [commentaryInningsChoice, setCommentaryInningsChoice] = useState<0 | 1 | null>(null);
  // Same pattern for the scorecard: null means "follow the active innings", so it needs no effect
  // to sync once the match loads. Declared here for the same reason - a hook below the early
  // returns changes React's hook count between renders and crashes the screen.
  const [scorecardChoice, setScorecardChoice] = useState<0 | 1 | null>(null);

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

  // MVP points breakdown - also a nice-to-have, non-blocking fetch.
  useEffect(() => {
    if (!match || match.status === 'Scheduled') {
      setMvpRanking(null);
      return;
    }
    let cancelled = false;
    api.matches
      .getMvp(match._id)
      .then(({ mvp }) => {
        if (!cancelled) setMvpRanking(mvp);
      })
      .catch(() => {
        if (!cancelled) setMvpRanking(null);
      });
    return () => {
      cancelled = true;
    };
  }, [match?._id, match?.status]);

  // AI Insights tab's completed-match content - static once the match is done, so fetched
  // once on completion rather than joining any polling loop.
  useEffect(() => {
    if (!match || match.status !== 'Completed') {
      setTacticalReport(null);
      return;
    }
    let cancelled = false;
    api.matches
      .getTacticalReport(match._id)
      .then(({ report }) => {
        if (!cancelled) setTacticalReport(report);
      })
      .catch(() => {
        if (!cancelled) setTacticalReport(null);
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

  // Squads - gated on team1/team2 actually resolving to an id (a handful of old test matches
  // have orphaned team refs, see teamName's `!team` guard above) so this never fetches a roster
  // for a null team. Keyed on the resolved ids rather than `match` itself.
  const squadTeam1Id = resolveRefId(match?.team1);
  const squadTeam2Id = resolveRefId(match?.team2);
  useEffect(() => {
    if (!squadTeam1Id && !squadTeam2Id) return;
    let cancelled = false;
    setSquadsLoading(true);
    Promise.all([
      squadTeam1Id ? api.teams.getTeamById(squadTeam1Id).catch(() => null) : Promise.resolve(null),
      squadTeam2Id ? api.teams.getTeamById(squadTeam2Id).catch(() => null) : Promise.resolve(null),
    ]).then(([r1, r2]) => {
      if (cancelled) return;
      setSquadTeams({
        team1: r1?.success ? (r1.team as RosterTeam) : null,
        team2: r2?.success ? (r2.team as RosterTeam) : null,
      });
      setSquadsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [squadTeam1Id, squadTeam2Id]);

  // Team rosters for "Yet to bat" - fetched once per team id (not on every reload), same
  // scoping web-app's own team1Roster/team2Roster effect uses.
  useEffect(() => {
    const team1Id = resolveRefId(match?.team1);
    const team2Id = resolveRefId(match?.team2);
    let cancelled = false;
    if (team1Id) {
      api.teams.getTeamById(team1Id).then(({ team }) => {
        if (!cancelled) setTeam1Roster(team.players || []);
      }).catch(() => {});
    }
    if (team2Id) {
      api.teams.getTeamById(team2Id).then(({ team }) => {
        if (!cancelled) setTeam2Roster(team.players || []);
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [resolveRefId(match?.team1), resolveRefId(match?.team2)]);

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

  const handleAddUmpire = async (userId: string) => {
    if (!match || umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      await api.matches.addUmpire(match._id, userId);
      setUmpirePickerOpen(false);
      load();
    } catch (e) {
      setUmpireError(e instanceof Error ? e.message : 'Could not add umpire');
    } finally {
      setUmpireBusy(false);
    }
  };

  const handleRemoveUmpire = async (userId: string) => {
    if (!match || umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      await api.matches.removeUmpire(match._id, userId);
      load();
    } catch (e) {
      setUmpireError(e instanceof Error ? e.message : 'Could not remove umpire');
    } finally {
      setUmpireBusy(false);
    }
  };

  const pickAndUploadPhoto = async () => {
    if (!match) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to add a match photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      const type = asset.mimeType || guessImageMimeType(asset.uri);
      const name = asset.fileName || asset.uri.split('/').pop() || `photo-${Date.now()}.jpg`;
      await api.matches.uploadPhoto(match._id, { uri: asset.uri, name, type }, photoCaption.trim() || undefined);
      setPhotoCaption('');
      load();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!match) return;
    setPhotoError(null);
    try {
      await api.matches.deletePhoto(match._id, photoId);
      setLightboxPhoto((prev) => (prev?._id === photoId ? null : prev));
      load();
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : 'Failed to remove photo');
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

  const { isOwner, canScore: canManageMatch } = computeCanScore(match, user?.id, players);
  const canScore = canManageMatch && (match.status === 'Live' || match.status === 'Scheduled');
  const momName = manOfTheMatchName(match.manOfTheMatch);

  // Umpire candidates: everyone in the player directory minus already-appointed umpires and
  // the match creator - same eligibility filter as web-app's userOptions for the appoint picker.
  const appointedUmpireIds = new Set(
    (match.umpires || []).map((u) => resolveUserId(u)).filter((id): id is string => !!id)
  );
  const creatorId = resolveUserId(match.createdBy);
  const umpireOptionsMap = new Map<string, string>();
  for (const p of players) {
    const uid = resolveUserId(p.user);
    const name = typeof p.user === 'string' ? null : p.user?.name;
    if (uid && name && !appointedUmpireIds.has(uid) && uid !== creatorId) {
      umpireOptionsMap.set(uid, name);
    }
  }
  const umpireOptions = [...umpireOptionsMap.entries()]
    .map(([userId, name]) => ({ userId, name }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
  const commentaryIdx = commentaryInningsChoice ?? activeIdx;
  const scorecardIdx = scorecardChoice ?? activeIdx;

  const currentInnings = match.innings[activeIdx];
  const activeBalls = match.innings[activeIdx]?.balls ?? [];
  const recentBalls = activeBalls.slice(-12);
  const recentCommentary = [...activeBalls].slice(-8).reverse();

  const activeChart = chartInnings?.[activeIdx];
  const maxOverRuns = activeChart?.overs?.length
    ? Math.max(6, ...activeChart.overs.map((o) => o.runs))
    : 6;

  const hasChartData = !!chartInnings?.some((inn) => inn.overs.some((o) => o.runs > 0 || o.wickets > 0));
  const hasExtrasData = !!chartInnings?.some((inn) => inn.extrasBreakdown?.some((e) => e.runs > 0));
  const hasRunsTypeData = !!chartInnings?.some((inn) => inn.runsTypeBreakdown?.some((r) => r.count > 0));
  const hasBoundaryBallData = !!chartInnings?.some((inn) => inn.boundaryBallBreakdown?.some((b) => b.count > 0));

  return (
    <>
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      {/* MATCH HEADER - the operational surface.
          Reordered so the match SITUATION leads: what is the score, who is batting, what is still
          required. Format/venue metadata is subordinate to that, not above it. During a live chase
          the equation gets the largest type on the screen, because that is the number everyone at
          a ground is actually tracking. */}
      <View style={styles.matchHead}>
        <View style={styles.matchHeadTop}>
          {match.status === 'Live' ? (
            <View style={scorebook.liveTag}>
              <View style={scorebook.liveDot} />
              <Text style={scorebook.liveTagText}>LIVE</Text>
            </View>
          ) : (
            <Text style={styles.matchHeadStatus}>{match.status.toUpperCase()}</Text>
          )}
          <Text style={styles.matchHeadMeta} numberOfLines={1}>
            {match.matchType} · {match.venue}
          </Text>
        </View>

        {match.innings.map((innings, idx) => {
          const team = idx === 0 ? match.team1 : match.team2;
          const isActive = idx === activeIdx && match.status === 'Live';
          const batted = innings.balls.length > 0 || innings.runs > 0;
          return (
            <View key={idx} style={styles.inningsLine}>
              <View style={{ flex: 1 }}>
                <TeamLink
                  id={resolveRefId(team)}
                  name={teamName(team)}
                  style={[styles.inningsTeam, isActive && styles.inningsTeamActive] as any}
                  numberOfLines={1}
                />
              </View>
              {batted ? (
                <View style={styles.inningsFigures}>
                  <Text style={[styles.inningsScore, isActive && styles.inningsScoreActive]}>
                    {innings.runs}<Text style={styles.inningsSlash}>/</Text>{innings.wickets}
                  </Text>
                  <Text style={styles.inningsOvers}>{innings.overs.toFixed(1)}</Text>
                </View>
              ) : (
                <Text style={styles.inningsYetToBat}>yet to bat</Text>
              )}
            </View>
          );
        })}

        {/* The equation - the single most important number during a chase. */}
        {match.status === 'Live' && targetScore != null && activeIdx === 1 && (() => {
          const need = Math.max(0, targetScore - (currentInnings?.runs ?? 0));
          const whole = Math.floor(currentInnings?.overs ?? 0);
          const legal = whole * 6 + Math.round(((currentInnings?.overs ?? 0) - whole) * 10);
          const left = Math.max(0, (match.totalOvers ?? 20) * 6 - legal);
          return need > 0 && left > 0 ? (
            <View style={styles.equation}>
              <Text style={styles.equationText}>
                {need} <Text style={styles.equationWord}>needed from</Text> {left}
              </Text>
              <Text style={styles.equationRate}>
                RRR {((need / left) * 6).toFixed(2)}
              </Text>
            </View>
          ) : null;
        })()}

        {match.status === 'Completed' && match.result && (
          <Text style={styles.matchHeadResult}>
            {match.result.winningTeam == null
              ? 'Match tied'
              : `${teamName(resolveRefId(match.result.winningTeam) === resolveRefId(match.team1) ? match.team1 : match.team2)} won by ${match.result.marginValue} ${match.result.margin}`}
          </Text>
        )}

        {match.status === 'Live' && powerplayOvers != null && currentInnings && currentInnings.overs < powerplayOvers && (
          <Text style={styles.matchHeadPowerplay}>Powerplay · overs 1-{powerplayOvers}</Text>
        )}
        {momName && <Text style={styles.matchHeadMom}>Player of the match · {momName}</Text>}
      </View>

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

      {/* Tab bar - same in-screen segmented-tab pattern TournamentDetailScreen uses (see its
          `section` state / segment* styles), not a screen-navigation tab library. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabScroll} contentContainerStyle={styles.tabRow}>
        {([
          ['info', 'Info'],
          ['story', 'Match Story'],
          ['ballByBall', 'Ball By Ball'],
          ['scorecard', 'Full Scorecard'],
          ['overByOver', 'Over by Over'],
          ['charts', 'Charts'],
          ['mvp', 'MVP'],
          ['gallery', 'Gallery'],
          ['aiInsights', 'AI Insights'],
        ] as [TabKey, string][]).map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]}
            onPress={() => setActiveTab(key)}
          >
            <Text style={[styles.tabBtnText, activeTab === key && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {activeTab === 'info' && (
        <>
          {match.status === 'Completed' && !!match.summary && (
            <CollapsibleSection title="Match Summary" defaultOpen={true}>
              <View style={[styles.section, { marginTop: 14 }]}>
              <Text style={styles.sectionTitle}>Match Summary</Text>
              <Text style={styles.matchSummaryText}>{match.summary}</Text>
            </View>
            </CollapsibleSection>
          )}

          {match.toss?.winningTeam && (
            <Text style={[styles.tossText, styles.tossTextInTab]}>
              🪙 {teamName(match.toss.winningTeam as Match['team1'])} won the toss and elected to{' '}
              {match.toss.decision === 'bowl' ? 'bowl' : 'bat'}.
            </Text>
          )}

          {/* At the Crease - live striker/non-striker/bowler figures. Mirrors web-app's
              app/match/[id]/page.tsx "At the Crease" block. */}
          {match.status === 'Live' && currentInnings?.liveState && (
            <AtTheCrease liveState={currentInnings.liveState} />
          )}

          {/* Recommended field placements for whoever's currently batting - see FieldingPlan.tsx
              for why this is a ranked text list rather than a diagram on mobile. */}
          {match.status === 'Live' && currentInnings?.liveState && (
            <CollapsibleSection title="Recommended Field" defaultOpen={false}>
          <View style={styles.section}>
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
          </CollapsibleSection>
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

      {/* Squads - both teams' rosters side by side, mirrors TournamentDetailScreen's Teams tab
          avatar/captain-badge convention plus the Awards tab's collapse-to-a-few + toggle
          pattern. Skipped entirely for a team-less orphaned match. */}
      {(match.team1 || match.team2) && (
        <CollapsibleSection title="Squads" defaultOpen={false}>
          <View style={styles.section}>
          <View style={styles.squadColumns}>
            {([0, 1] as const).map((idx) => {
              const teamRef = idx === 0 ? match.team1 : match.team2;
              if (!teamRef) {
                return (
                  <View key={idx} style={styles.squadColumn}>
                    <Text style={styles.muted}>Team not available.</Text>
                  </View>
                );
              }
              const squad = idx === 0 ? squadTeams.team1 : squadTeams.team2;
              const expandKey = idx === 0 ? 'team1' : 'team2';
              const expanded = squadsExpanded[expandKey];
              const rosterPlayers = squad?.players || [];
              const visiblePlayers = expanded ? rosterPlayers : rosterPlayers.slice(0, SQUAD_PREVIEW_COUNT);
              return (
                <View key={resolveRefId(teamRef) ?? idx} style={styles.squadColumn}>
                  <Text style={styles.squadTeamName}>{teamName(teamRef)}</Text>
                  {squadsLoading && !squad ? (
                    <Text style={styles.muted}>Loading...</Text>
                  ) : rosterPlayers.length === 0 ? (
                    <Text style={styles.muted}>No roster available.</Text>
                  ) : (
                    <>
                      {visiblePlayers.map((p) => (
                        <View key={p._id} style={styles.squadPlayerRow}>
                          <SquadAvatar player={p} />
                          <View style={{ flex: 1 }}>
                            <View style={styles.squadNameRow}>
                              <Text style={styles.squadPlayerName} numberOfLines={1}>{squadPlayerName(p)}</Text>
                              {resolveRefId(squad?.captain) === p._id && (
                                <Text style={styles.squadCaptainBadge}>C</Text>
                              )}
                              {resolveRefId(squad?.viceCaptain) === p._id && (
                                <Text style={styles.squadViceCaptainBadge}>VC</Text>
                              )}
                            </View>
                            <Text style={styles.squadPlayerRole}>{p.specialization}</Text>
                          </View>
                        </View>
                      ))}
                      {rosterPlayers.length > SQUAD_PREVIEW_COUNT && (
                        <TouchableOpacity onPress={() => setSquadsExpanded((prev) => ({ ...prev, [expandKey]: !prev[expandKey] }))}>
                          <Text style={styles.showAllLink}>
                            {expanded ? 'Show less' : `Full Squad (${rosterPlayers.length}) ⌄`}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </>
                  )}
                </View>
              );
            })}
          </View>
        </View>
          </CollapsibleSection>
      )}

      {/* Umpires - creator-only, mirrors web-app's app/match/[id]/page.tsx Umpires block.
          Umpires get the same scoring rights as the creator without needing to be rostered. */}
      {isOwner && (
        <CollapsibleSection title="Umpires" defaultOpen={false}>
          <View style={styles.section}>
          <View style={styles.umpireCard}>
            <Text style={styles.reportsHint}>
              Umpires can score this match the same way you can, without needing to be on either team&apos;s roster.
            </Text>
            {(match.umpires || []).length > 0 && (
              <View style={styles.umpireList}>
                {(match.umpires || []).map((u) => {
                  const uid = resolveUserId(u);
                  if (!uid) return null;
                  const name = typeof u === 'string' ? uid : u.name;
                  return (
                    <View key={uid} style={styles.umpireRow}>
                      <Text style={styles.umpireName}>{name}</Text>
                      <TouchableOpacity onPress={() => handleRemoveUmpire(uid)} disabled={umpireBusy}>
                        <Text style={styles.umpireRemove}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
            <TouchableOpacity
              style={styles.umpireAddButton}
              onPress={() => setUmpirePickerOpen(true)}
              disabled={umpireBusy}
            >
              <Text style={styles.umpireAddButtonText}>+ Appoint Umpire</Text>
            </TouchableOpacity>
            {umpireError && <Text style={styles.umpireError}>{umpireError}</Text>}
          </View>
        </View>
          </CollapsibleSection>
      )}

      {match.status === 'Scheduled' && (
        <CollapsibleSection title="Predict the Winner" defaultOpen={false}>
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
        </CollapsibleSection>
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
        </>
      )}

      {activeTab === 'scorecard' && (
        <>
          {/* One innings at a time, chosen by the same switcher the commentary tab uses. Rendering
              both innings meant four stacked tables - two batting, two bowling - and you almost
              never want to read both at once.

              Laid out the way a scorecard is actually printed: batters with their dismissal, then
              extras broken down, then the total, then fall of wickets, then the bowling. The
              extras and total lines are what make it read as a scorecard rather than a table, and
              fall of wickets is the only place the SHAPE of an innings is visible. */}
          {!match.innings.some((inn) => inn.balls.length > 0) ? (
            <View style={styles.section}>
              <Text style={styles.reportsHint}>The scorecard will fill in as the match is scored.</Text>
            </View>
          ) : (
            <>
              <View style={styles.inningsSwitchRow}>
                {match.innings.map((inn, idx) => {
                  if (inn.balls.length === 0) return null;
                  const selected = idx === scorecardIdx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.inningsSwitch, selected && styles.inningsSwitchActive]}
                      onPress={() => setScorecardChoice(idx as 0 | 1)}
                    >
                      <Text style={[styles.inningsSwitchText, selected && styles.inningsSwitchTextActive]} numberOfLines={1}>
                        {teamName(inn.team)}
                      </Text>
                      <Text style={[styles.inningsSwitchScore, selected && styles.inningsSwitchTextActive]}>
                        {inn.runs}/{inn.wickets} ({inn.overs.toFixed(1)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {(() => {
                const innings = match.innings[scorecardIdx];
                if (!innings || innings.balls.length === 0) return null;
                const battingOrder: string[] = [];
                const bowlingOrder: string[] = [];
                for (const b of innings.balls) {
                  if (b.batsmanId && !battingOrder.includes(b.batsmanId)) battingOrder.push(b.batsmanId);
                  if (b.bowlerId && !bowlingOrder.includes(b.bowlerId)) bowlingOrder.push(b.bowlerId);
                }
                const roster = scorecardIdx === 0 ? team1Roster : team2Roster;
                const yetToBat = roster.filter((p) => !battingOrder.includes(p._id));
                const stillBatting = inningsInProgress(scorecardIdx as 0 | 1, innings, roster, match);
                const extras = inningsExtras(innings.balls);
                const fow = fallOfWickets(innings.balls);
                const topScore = Math.max(0, ...battingOrder.map((id) => battingStatsFor(innings.balls, id).runs));

                return (
                  <View style={styles.section}>
                    <View style={styles.cardHeadRow}>
                      <Text style={styles.cardHeadLabel}>BATTING</Text>
                      <Text style={styles.cardHeadFigures}>
                        {innings.runs}/{innings.wickets}
                        <Text style={styles.cardHeadOvers}>  {innings.overs.toFixed(1)} ov  ·  RR {inningsRunRate(innings.balls).toFixed(2)}</Text>
                      </Text>
                    </View>

                    <View style={styles.scorecardHeaderRow}>
                      <Text style={[styles.scorecardHeaderCell, styles.scorecardNameCol]}>Batter</Text>
                      <Text style={styles.scorecardHeaderCell}>R</Text>
                      <Text style={styles.scorecardHeaderCell}>B</Text>
                      <Text style={styles.scorecardHeaderCell}>4s</Text>
                      <Text style={styles.scorecardHeaderCell}>6s</Text>
                      <Text style={styles.scorecardHeaderCell}>SR</Text>
                    </View>

                    {battingOrder.map((playerId) => {
                      const st = battingStatsFor(innings.balls, playerId);
                      const dismissal = dismissalFor(innings.balls, playerId, (id) => (id ? playerDirectory.get(id) : undefined));
                      const notOut = !dismissal;
                      const milestone = st.runs >= 50;
                      return (
                        <View key={playerId} style={styles.scorecardRow}>
                          <View style={[styles.scorecardNameCol, { flexShrink: 1 }]}>
                            <View style={styles.batterNameRow}>
                              <PlayerLink id={playerId} name={playerDirectory.get(playerId)} style={styles.scorecardNameText} numberOfLines={1} />
                              {notOut && <Text style={styles.notOutMark}>*</Text>}
                              {milestone && (
                                <View style={styles.milestonePill}>
                                  <Text style={styles.milestonePillText}>{st.runs >= 100 ? '100' : '50'}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.scorecardDismissal} numberOfLines={1}>{dismissal ?? 'not out'}</Text>
                          </View>
                          <Text style={[styles.scorecardCell, styles.runsCell, st.runs === topScore && st.runs > 0 && styles.topScoreCell]}>{st.runs}</Text>
                          <Text style={styles.scorecardCell}>{st.ballsFaced}</Text>
                          <Text style={styles.scorecardCell}>{st.fours}</Text>
                          <Text style={styles.scorecardCell}>{st.sixes}</Text>
                          <Text style={styles.scorecardCell}>{st.strikeRate.toFixed(1)}</Text>
                        </View>
                      );
                    })}

                    <View style={styles.extrasRow}>
                      <Text style={styles.extrasLabel}>Extras</Text>
                      <Text style={styles.extrasDetail} numberOfLines={1}>
                        {[
                          extras.byes ? `b ${extras.byes}` : null,
                          extras.legByes ? `lb ${extras.legByes}` : null,
                          extras.wides ? `w ${extras.wides}` : null,
                          extras.noBalls ? `nb ${extras.noBalls}` : null,
                          extras.penalty ? `p ${extras.penalty}` : null,
                        ].filter(Boolean).join(', ') || 'none'}
                      </Text>
                      <Text style={styles.extrasTotal}>{extras.total}</Text>
                    </View>

                    <View style={styles.totalRow}>
                      <Text style={styles.totalLabel}>TOTAL</Text>
                      <Text style={styles.totalDetail}>
                        {innings.overs.toFixed(1)} ov{stillBatting ? '' : `  ·  ${innings.wickets} wkt`}
                      </Text>
                      <Text style={styles.totalFigure}>{innings.runs}/{innings.wickets}</Text>
                    </View>

                    {yetToBat.length > 0 && (
                      <Text style={styles.scorecardYetToBat}>
                        {stillBatting ? 'Yet to bat: ' : 'Did not bat: '}
                        {yetToBat.map((p, i) => (
                          <Text key={p._id}>
                            {i > 0 ? ', ' : ''}
                            <Text onPress={() => navigation.push('PlayerStats', { playerId: p._id })} style={styles.inlinePlayerLink}>
                              {playerDirectory.get(p._id) ?? resolveRefName(p.user, 'Player')}
                            </Text>
                          </Text>
                        ))}
                      </Text>
                    )}

                    {fow.length > 0 && (
                      <CollapsibleSection dense title="Fall of wickets" summary={`${fow.length} wkt`}>
                        <View style={styles.fowWrap}>
                          {fow.map((w) => (
                            <View key={w.wicket} style={styles.fowItem}>
                              <Text style={styles.fowScore}>{w.wicket}-{w.runs}</Text>
                              <Text style={styles.fowMeta} numberOfLines={1}>
                                {(w.playerId && playerDirectory.get(w.playerId)) ?? 'Batter'} · {w.oversLabel}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </CollapsibleSection>
                    )}

                    <View style={[styles.cardHeadRow, { marginTop: 22 }]}>
                      <Text style={styles.cardHeadLabel}>BOWLING</Text>
                    </View>
                    <View style={styles.scorecardHeaderRow}>
                      <Text style={[styles.scorecardHeaderCell, styles.scorecardNameCol]}>Bowler</Text>
                      <Text style={styles.scorecardHeaderCell}>O</Text>
                      <Text style={styles.scorecardHeaderCell}>M</Text>
                      <Text style={styles.scorecardHeaderCell}>R</Text>
                      <Text style={styles.scorecardHeaderCell}>W</Text>
                      <Text style={styles.scorecardHeaderCell}>Econ</Text>
                    </View>
                    {bowlingOrder.map((playerId) => {
                      const st = bowlingStatsFor(innings.balls, playerId);
                      const maidens = maidenOversFor(innings.balls, playerId);
                      return (
                        <View key={playerId} style={styles.scorecardRow}>
                          <View style={styles.scorecardNameCol}>
                            <PlayerLink id={playerId} name={playerDirectory.get(playerId)} style={styles.scorecardNameText} numberOfLines={1} />
                          </View>
                          <Text style={styles.scorecardCell}>{st.overs.toFixed(1)}</Text>
                          <Text style={styles.scorecardCell}>{maidens}</Text>
                          <Text style={styles.scorecardCell}>{st.runsConceded}</Text>
                          <Text style={[styles.scorecardCell, styles.runsCell, st.wickets >= 3 && styles.topScoreCell]}>{st.wickets}</Text>
                          <Text style={styles.scorecardCell}>{st.economy.toFixed(2)}</Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })()}
            </>
          )}
        </>
      )}

      {activeTab === 'overByOver' && (
        <>
          {match.innings.every((inn) => inn.balls.length === 0) ? (
            <View style={styles.section}>
              <Text style={styles.reportsHint}>Over-by-over detail will appear here once the match starts.</Text>
            </View>
          ) : (
            match.innings.map((innings, idx) => {
              if (innings.balls.length === 0) return null;
              return (
                <View key={idx} style={styles.section}>
                  <Text style={styles.sectionTitle}>
                    {teamName(innings.team)} — {innings.runs}/{innings.wickets} ({innings.overs.toFixed(1)} ov)
                  </Text>
                  <View style={styles.overByOverCard}>
                    {overByOver(innings.balls).slice().reverse().map((o) => (
                      <View key={o.over} style={styles.overRow}>
                        <View style={styles.overLabelCol}>
                          <Text style={styles.overLabelText}>Over {o.over + 1}</Text>
                          <PlayerLink
                            id={o.bowlerId}
                            name={o.bowlerId ? playerDirectory.get(o.bowlerId) : null}
                            fallback="Bowler"
                            style={styles.overBowlerName}
                            numberOfLines={1}
                          />
                        </View>
                        <View style={styles.overBallsWrap}>
                          {o.balls.map((b, i) => (
                            <View key={i} style={[styles.overBallChip, b.isWicket && styles.overBallChipWicket]}>
                              <Text style={[styles.overBallChipText, b.isWicket && styles.overBallChipTextWicket]}>{b.label}</Text>
                            </View>
                          ))}
                        </View>
                        <View style={styles.overSummaryCol}>
                          <Text style={styles.overSummaryText}>
                            {o.runs} run{o.runs === 1 ? '' : 's'}{o.wickets > 0 ? `, ${o.wickets}w` : ''}
                          </Text>
                          <Text style={styles.overSummaryTotal}>{o.runningTotal}</Text>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })
          )}
        </>
      )}

      {activeTab === 'story' && (
        <View style={styles.section}>
          {match.story && match.story.length > 0 ? (
            match.story.map((paragraph, i) => (
              <Text key={i} style={[styles.matchSummaryText, { marginTop: i === 0 ? 0 : 12 }]}>{paragraph}</Text>
            ))
          ) : (
            <Text style={styles.matchSummaryText}>
              {match.status === 'Completed'
                ? 'The story for this match is being written up.'
                : 'The full match story will be told here once the match is completed.'}
            </Text>
          )}
        </View>
      )}

      {activeTab === 'ballByBall' && (
        <>
          {/* Full-innings commentary, newest first, with an end-of-over summary above each over -
              the layout Cricinfo/CricClubs/CricHeroes use. This tab previously showed only the last
              12 balls as chips plus the last 8 commentary lines, from a single derived innings; the
              rest of the match's commentary was stored but never rendered. */}
          {match.innings.every((inn) => inn.balls.length === 0) ? (
            <View style={styles.section}>
              <Text style={styles.reportsHint}>Commentary will appear here once the match starts.</Text>
            </View>
          ) : (
            <>
              <View style={styles.inningsSwitchRow}>
                {match.innings.map((inn, idx) => {
                  if (inn.balls.length === 0) return null;
                  const selected = idx === commentaryIdx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.inningsSwitch, selected && styles.inningsSwitchActive]}
                      onPress={() => setCommentaryInningsChoice(idx as 0 | 1)}
                    >
                      <Text style={[styles.inningsSwitchText, selected && styles.inningsSwitchTextActive]} numberOfLines={1}>
                        {teamName(inn.team)}
                      </Text>
                      <Text style={[styles.inningsSwitchScore, selected && styles.inningsSwitchTextActive]}>
                        {inn.runs}/{inn.wickets} ({inn.overs.toFixed(1)})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Grouped by over, collapsed by default, most recent over open.
                  A flat feed of 120+ deliveries was a wall - and a scorebook is organised by over
                  anyway, so each over now collapses to one line carrying its own summary and opens
                  to the deliveries. */}
              <View style={styles.section}>
                {commentaryOvers(match.innings[commentaryIdx]?.balls ?? []).map((o, oi) => (
                  <CollapsibleSection
                    key={`${o.over}-${o.complete}`}
                    dense
                    defaultOpen={oi === 0}
                    title={`Over ${o.over}${o.complete ? '' : ' · in progress'}`}
                    summary={`${o.runs} run${o.runs === 1 ? '' : 's'}${o.wickets ? ` · ${o.wickets} wkt` : ''}  ·  ${o.runsAfter}/${o.wicketsAfter}`}
                  >
                    {o.balls.map((entry) => {
                      const b = entry.ball;
                      const outcome = ballOutcomeLabel(b);
                      const bowler = b.bowlerId ? playerDirectory.get(b.bowlerId) : null;
                      const batter = b.batsmanId ? playerDirectory.get(b.batsmanId) : null;
                      return (
                        <View key={entry.key} style={styles.commentaryBallRow}>
                          <Text style={styles.commentaryOverLabel}>{entry.label}</Text>
                          <View
                            style={[
                              styles.commentaryOutcome,
                              b.isWicket && styles.commentaryOutcomeWicket,
                              !b.isWicket && b.runs >= 4 && !b.isExtra && styles.commentaryOutcomeBoundary
                            ]}
                          >
                            <Text
                              style={[
                                styles.commentaryOutcomeText,
                                (b.isWicket || (b.runs >= 4 && !b.isExtra)) && styles.commentaryOutcomeTextStrong
                              ]}
                            >
                              {outcome}
                            </Text>
                          </View>
                          <View style={styles.commentaryBody}>
                            {(bowler || batter) && (
                              <View style={styles.commentaryPlayersRow}>
                                <PlayerLink id={b.bowlerId} name={bowler} fallback="Bowler" style={styles.commentaryPlayers} numberOfLines={1} />
                                <Text style={styles.commentaryPlayers}> to </Text>
                                <PlayerLink id={b.batsmanId} name={batter} fallback="Batter" style={styles.commentaryPlayers} numberOfLines={1} />
                              </View>
                            )}
                            <Text style={styles.commentaryText}>
                              {b.commentary || (b.isWicket ? 'Wicket!' : `${b.runs} run${b.runs === 1 ? '' : 's'}.`)}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </CollapsibleSection>
                ))}
              </View>
            </>
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
        </>
      )}

      {activeTab === 'mvp' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MVP Points</Text>
          {!mvpRanking || mvpRanking.length === 0 ? (
            <Text style={styles.reportsHint}>MVP points will appear here once ball-by-ball data has been recorded.</Text>
          ) : (
            <>
              {(showAllMvp ? mvpRanking : mvpRanking.slice(0, 5)).map((p, i) => (
                <View key={p.playerId} style={styles.leaderRow}>
                  <View style={styles.leaderNameWrap}>
                    <Text style={styles.leaderName}>
                      {p.playerId === resolveRefId(match.manOfTheMatch) ? '🏆 ' : ''}{i + 1}.{' '}
                    </Text>
                    <PlayerLink id={p.playerId} name={playerDirectory.get(p.playerId)} style={styles.leaderName} numberOfLines={1} />
                  </View>
                  <Text style={styles.mvpPoints}>{p.points} pts</Text>
                </View>
              ))}
              {mvpRanking.length > 5 && (
                <TouchableOpacity onPress={() => setShowAllMvp((prev) => !prev)}>
                  <Text style={styles.showAllLink}>{showAllMvp ? 'Show less' : `Show all ${mvpRanking.length} →`}</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      )}

      {activeTab === 'gallery' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Gallery</Text>

          {/* Upload gated on isOwner - mirrors web-app's isCreator gate on its Match Documents
              section (same rationale: backend's canManageMatch is broader, but a predictable
              creator-only visual gate beats a surprising one). isOwner is already null-safe
              (see computeCanScore in shared/utils/matchAuth.ts). */}
          {isOwner && (
            <View style={styles.umpireCard}>
              <TextInput
                value={photoCaption}
                onChangeText={setPhotoCaption}
                placeholder="Caption (optional)"
                placeholderTextColor={colors.inkMuted}
                style={styles.photoCaptionInput}
              />
              <TouchableOpacity
                style={[styles.umpireAddButton, uploadingPhoto && { opacity: 0.5 }]}
                onPress={pickAndUploadPhoto}
                disabled={uploadingPhoto}
              >
                <Text style={styles.umpireAddButtonText}>{uploadingPhoto ? 'Uploading...' : '+ Add Photo'}</Text>
              </TouchableOpacity>
              {photoError && <Text style={styles.umpireError}>{photoError}</Text>}
            </View>
          )}

          {(match.photos?.length ?? 0) === 0 ? (
            <Text style={styles.reportsHint}>No photos uploaded yet.</Text>
          ) : (
            <View style={styles.galleryGrid}>
              {match.photos!.map((photo) => (
                <TouchableOpacity key={photo._id} style={styles.galleryTile} onPress={() => setLightboxPhoto(photo)}>
                  <Image source={{ uri: resolveAttachmentUrl(photo.url) }} style={styles.galleryImage} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {activeTab === 'aiInsights' && (
        <>
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
      {match.status === 'Completed' && (
        tacticalReport ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Phase Report</Text>
            <Text style={styles.matchSummaryText}>How each team's innings broke down across the powerplay, middle overs, and death overs.</Text>
            {tacticalReport.takeaway && (
              <Text style={[styles.matchSummaryText, { marginTop: 8 }]}>{tacticalReport.takeaway}</Text>
            )}
            {tacticalReport.phases.map((teamPhase) => (
              <View key={teamPhase.teamId} style={{ marginTop: 14 }}>
                <Text style={styles.squadTeamName}>{teamPhase.teamName}</Text>
                <View style={styles.scorecardHeaderRow}>
                  <Text style={[styles.scorecardHeaderCell, { flex: 1.4, textAlign: 'left' }]}>Phase</Text>
                  <Text style={styles.scorecardHeaderCell}>Runs</Text>
                  <Text style={styles.scorecardHeaderCell}>Wkts</Text>
                  <Text style={styles.scorecardHeaderCell}>RR</Text>
                </View>
                {([
                  ['Powerplay', teamPhase.phases.powerplay],
                  ['Middle', teamPhase.phases.middle],
                  ['Death', teamPhase.phases.death],
                ] as const).map(([label, stats]) => (
                  <View key={label} style={styles.scorecardRow}>
                    <Text style={[styles.scorecardCell, { flex: 1.4, textAlign: 'left' }]}>{label}</Text>
                    <Text style={styles.scorecardCell}>{stats.runs}</Text>
                    <Text style={styles.scorecardCell}>{stats.wickets}</Text>
                    <Text style={styles.scorecardCell}>{stats.overs > 0 ? stats.runRate.toFixed(2) : '-'}</Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.matchSummaryText}>AI tactical insights are only generated while a match is live - see the Charts and Ball By Ball tabs for this match's full analysis.</Text>
          </View>
        )
      )}
        </>
      )}

      {activeTab === 'charts' && (
        <>
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
        <CollapsibleSection title="Manhattan Chart" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Runs scored per over</Text>
          <View style={styles.chartListCard}>
            <ManhattanChartSvg innings={chartInnings} />
          </View>
        </View>
          </CollapsibleSection>
      )}

      {hasChartData && chartInnings && (
        <CollapsibleSection title="Worm Chart" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Cumulative team total after each over</Text>
          <View style={styles.chartListCard}>
            <WormChartSvg innings={chartInnings} />
          </View>
        </View>
          </CollapsibleSection>
      )}

      {hasChartData && chartInnings && (
        <CollapsibleSection title="Run Rate" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Run rate after each over</Text>
          <View style={styles.chartListCard}>
            <RunRateChartSvg innings={chartInnings} />
          </View>
        </View>
          </CollapsibleSection>
      )}

      {hasExtrasData && chartInnings && (
        <CollapsibleSection title="Extras" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Extra runs conceded, by type</Text>
          <View style={styles.chartListCard}>
            <ExtrasChartSvg innings={chartInnings} />
          </View>
        </View>
          </CollapsibleSection>
      )}

      {hasRunsTypeData && chartInnings && (
        <CollapsibleSection title="Type of Runs" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Deliveries off the bat, by runs scored</Text>
          <View style={styles.chartListCard}>
            <RunsTypeChartSvg innings={chartInnings} />
          </View>
        </View>
          </CollapsibleSection>
      )}

      {/* Boundary Ball Percentage - one donut per innings (a combined chart would mix two
          innings' distributions together), same per-innings card treatment Partnerships below uses. */}
      {hasBoundaryBallData && chartInnings && (
        <CollapsibleSection title="Boundary Ball %" defaultOpen={false}>
          <View style={styles.section}>
          <Text style={styles.reportsHint}>Boundaries by ball-of-the-over position</Text>
          {chartInnings.map((inn, idx) => (
            inn.boundaryBallBreakdown?.some((b) => b.count > 0) && (
              <View key={idx} style={[styles.chartListCard, { marginTop: idx > 0 ? 10 : 0 }]}>
                <Text style={styles.scorecardTeamName}>{chartTeamName(inn.team, `Team ${idx + 1}`)}</Text>
                <BoundaryBallChartSvg data={inn.boundaryBallBreakdown} />
              </View>
            )
          ))}
        </View>
          </CollapsibleSection>
      )}

      {/* Partnerships - chronological, following the innings in order like the scorecard
          above rather than sorted by size. */}
      {chartInnings?.some((inn) => inn.partnerships?.length > 0) && (
        <CollapsibleSection title="Partnerships" defaultOpen={false}>
          <View style={styles.section}>
          {chartInnings.map((inn, idx) => (
            inn.partnerships?.length > 0 && (
              <View key={idx} style={styles.scorecardInnings}>
                <Text style={styles.scorecardTeamName}>{teamName(match.innings[idx]?.team)}</Text>
                {inn.partnerships.map((p, i) => {
                  const names = p.batsmen.map((id) => playerDirectory.get(id) ?? 'Unknown');
                  // ids kept alongside the names so each partner stays individually tappable
                  const partnerIds = p.batsmen;
                  return (
                    <View key={i} style={styles.partnershipRow}>
                      <View style={styles.partnershipNamesRow}>
                        <Text style={styles.partnershipNames}>{i + 1}. </Text>
                        {partnerIds.map((pid, n) => (
                          <React.Fragment key={pid}>
                            {n > 0 && <Text style={styles.partnershipNames}> & </Text>}
                            <PlayerLink id={pid} name={names[n]} style={styles.partnershipNames} numberOfLines={1} />
                          </React.Fragment>
                        ))}
                      </View>
                      <Text style={styles.partnershipFigures}>{p.runs} ({p.balls})</Text>
                    </View>
                  );
                })}
              </View>
            )
          ))}
        </View>
          </CollapsibleSection>
      )}
        </>
      )}

      <View style={{ height: 32 }} />
    </ScrollView>

    <Modal visible={umpirePickerOpen} animationType="slide" transparent onRequestClose={() => setUmpirePickerOpen(false)}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>Appoint Umpire</Text>
            <TouchableOpacity onPress={() => setUmpirePickerOpen(false)}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={umpireOptions}
            keyExtractor={(o) => o.userId}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={<Text style={styles.muted}>No eligible people to appoint.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.pickerRow}
                disabled={umpireBusy}
                onPress={() => handleAddUmpire(item.userId)}
              >
                <Text style={styles.pickerName}>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>

    {/* Gallery lightbox - full-screen photo viewer, simple overlay (no carousel library, none
        used anywhere else in this app). Delete gated the same isOwner check as the upload
        control above. */}
    <Modal visible={!!lightboxPhoto} animationType="fade" transparent onRequestClose={() => setLightboxPhoto(null)}>
      <TouchableOpacity style={styles.lightboxOverlay} activeOpacity={1} onPress={() => setLightboxPhoto(null)}>
        {lightboxPhoto && (
          <>
            <Image
              source={{ uri: resolveAttachmentUrl(lightboxPhoto.url) }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
            {!!lightboxPhoto.caption && <Text style={styles.lightboxCaption}>{lightboxPhoto.caption}</Text>}
            <View style={styles.lightboxActions}>
              {isOwner && (
                <TouchableOpacity onPress={() => handleRemovePhoto(lightboxPhoto._id)}>
                  <Text style={styles.lightboxDelete}>Delete</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setLightboxPhoto(null)}>
                <Text style={styles.lightboxClose}>Close</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </TouchableOpacity>
    </Modal>
    </>
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
  tossText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600', marginTop: 8 },
  manOfTheMatchText: { color: colors.gold500, fontSize: 13, fontWeight: '600', marginTop: 8 },
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
  matchSummaryText: { color: colors.inkSecondary, fontSize: 13, lineHeight: 19 },

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

  matchHead: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchHeadTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  matchHeadStatus: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.inkMuted,
  },
  matchHeadMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 11,
    color: colors.inkMuted,
    marginLeft: 12,
  },
  inningsLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: 7,
    gap: 12,
  },
  inningsTeam: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: colors.inkSecondary,
  },
  inningsTeamActive: {
    color: colors.ink,
  },
  inningsFigures: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  inningsScore: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  inningsScoreActive: {
    color: colors.ink,
    fontSize: 32,
  },
  inningsSlash: {
    color: colors.inkMuted,
    fontWeight: '500',
  },
  inningsOvers: {
    width: 44,
    textAlign: 'right',
    fontSize: 13,
    color: colors.inkMuted,
    fontVariant: ['tabular-nums'],
  },
  inningsYetToBat: {
    fontSize: 12,
    color: colors.inkMuted,
    fontStyle: 'italic',
  },
  equation: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  equationText: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.gold400,
    fontVariant: ['tabular-nums'],
  },
  equationWord: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.inkSecondary,
  },
  equationRate: {
    fontSize: 13,
    color: colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  matchHeadResult: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.pitch400,
    marginTop: 14,
  },
  matchHeadPowerplay: {
    fontSize: 11,
    color: colors.gold400,
    marginTop: 10,
  },
  matchHeadMom: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 8,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  cardHeadLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.inkMuted,
  },
  cardHeadFigures: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  cardHeadOvers: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inkMuted,
  },
  batterNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  notOutMark: {
    color: colors.pitch400,
    fontWeight: '800',
    fontSize: 14,
  },
  milestonePill: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: colors.gold600,
  },
  milestonePillText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#1B1200',
  },
  runsCell: {
    fontWeight: '700',
    color: colors.ink,
  },
  topScoreCell: {
    color: colors.pitch400,
  },
  extrasRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  extrasLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSecondary,
    width: 54,
  },
  extrasDetail: {
    flex: 1,
    fontSize: 12,
    color: colors.inkMuted,
  },
  extrasTotal: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
    fontVariant: ['tabular-nums'],
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderTopWidth: 2,
    borderTopColor: colors.borderStrong,
  },
  totalLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.ink,
    width: 54,
  },
  totalDetail: {
    flex: 1,
    fontSize: 12,
    color: colors.inkMuted,
  },
  totalFigure: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  fowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 10,
  },
  fowItem: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 104,
  },
  fowScore: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.ink,
    fontVariant: ['tabular-nums'],
  },
  fowMeta: {
    fontSize: 10,
    color: colors.inkMuted,
    marginTop: 2,
  },
  inningsSwitchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  inningsSwitch: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  inningsSwitchActive: {
    borderColor: colors.pitch500,
    backgroundColor: colors.pitch900,
  },
  inningsSwitchText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  inningsSwitchScore: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 2,
  },
  inningsSwitchTextActive: {
    color: colors.pitch400,
  },
  overBreakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 14,
  },
  overBreakLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  overBreakText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.inkMuted,
    letterSpacing: 0.3,
  },
  commentaryBallRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  commentaryOverLabel: {
    width: 38,
    fontSize: 12,
    fontWeight: '600',
    color: colors.inkMuted,
    paddingTop: 3,
    fontVariant: ['tabular-nums'],
  },
  commentaryOutcome: {
    minWidth: 30,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: colors.surfaceAlt,
  },
  commentaryOutcomeWicket: {
    backgroundColor: colors.wicket500,
  },
  commentaryOutcomeBoundary: {
    backgroundColor: colors.pitch500,
  },
  commentaryOutcomeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inkSecondary,
  },
  commentaryOutcomeTextStrong: {
    color: '#FFFFFF',
  },
  commentaryBody: {
    flex: 1,
  },
  commentaryPlayersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  commentaryPlayers: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inkMuted,
    marginBottom: 2,
  },
  commentaryScore: {
    fontSize: 11,
    color: colors.inkMuted,
    marginTop: 3,
    fontVariant: ['tabular-nums'],
  },
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

  // MVP tab - mirrors TournamentDetailScreen's leaderRow/showAllLink Top Performers styling.
  leaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 10 },
  leaderNameWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  inlinePlayerLink: {
    color: colors.ink,
    fontWeight: '600',
  },
  leaderName: { color: colors.ink, fontSize: 13, flexShrink: 1 },
  mvpPoints: { color: colors.gold500, fontSize: 12, fontWeight: '700' },
  showAllLink: { color: colors.pitch400, fontSize: 12, fontWeight: '600', marginTop: 6 },

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
  scorecardYetToBat: { color: colors.inkMuted, fontSize: 11, marginTop: 8, lineHeight: 16 },

  partnershipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  partnershipNamesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  partnershipNames: { flex: 1, color: colors.inkSecondary, fontSize: 12, marginRight: 8 },
  partnershipFigures: { color: colors.ink, fontSize: 12, fontWeight: '600' },

  reportsHint: { color: colors.inkMuted, fontSize: 12, marginBottom: 10 },
  reportChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reportChip: {
    backgroundColor: colors.surface, borderRadius: 999, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  reportChipText: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },

  fieldingList: { gap: 10 },

  // Card wrapper shared by ManhattanChartSvg and WormChartSvg.
  chartListCard: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 12,
  },
  chartLegendRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10, paddingTop: 10,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: colors.inkSecondary, fontSize: 11 },

  // Tab bar - same in-screen segmented-tab visual pattern as TournamentDetailScreen's
  // segmentScroll/segmentRow/segmentBtn (own `section` state there).
  tabScroll: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabRow: { flexDirection: 'row', padding: 4 },
  tabBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9, alignItems: 'center' },
  tabBtnActive: { backgroundColor: colors.pitch900 },
  tabBtnText: { color: colors.inkMuted, fontSize: 13, fontWeight: '600' },
  tabBtnTextActive: { color: colors.pitch400 },
  tossTextInTab: { marginHorizontal: 16, marginTop: 14 },

  // Over by Over tab.
  overByOverCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 4,
  },
  overRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  overLabelCol: { width: 78 },
  overLabelText: { color: colors.inkMuted, fontSize: 11 },
  overBowlerName: { color: colors.ink, fontSize: 12, fontWeight: '700', marginTop: 1 },
  overBallsWrap: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  overBallChip: {
    minWidth: 22, height: 22, borderRadius: 6, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
  },
  overBallChipWicket: { backgroundColor: 'rgba(248,113,113,0.15)', borderColor: 'rgba(248,113,113,0.4)' },
  overBallChipText: { color: colors.inkSecondary, fontSize: 11, fontWeight: '700' },
  overBallChipTextWicket: { color: colors.wicket500 },
  overSummaryCol: { width: 74, alignItems: 'flex-end' },
  overSummaryText: { color: colors.inkMuted, fontSize: 11 },
  overSummaryTotal: { color: colors.ink, fontSize: 13, fontWeight: '700', marginTop: 1 },

  // Squads section (Info tab) - two side-by-side columns, avatar/name/role rows mirror
  // TournamentDetailScreen's roster* styles; showAllLink matches its Awards-tab toggle style.
  squadColumns: { flexDirection: 'row', gap: 16 },
  squadColumn: { flex: 1, minWidth: 0 },
  squadTeamName: { color: colors.ink, fontSize: 13, fontWeight: '700', marginBottom: 8 },
  squadPlayerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  squadNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  squadPlayerName: { color: colors.ink, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  squadPlayerRole: { color: colors.inkMuted, fontSize: 11, marginTop: 1 },
  squadCaptainBadge: { color: colors.gold500, fontSize: 9, fontWeight: '700' },
  squadViceCaptainBadge: { color: colors.pitch400, fontSize: 9, fontWeight: '700' },
  rosterAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  rosterAvatarFallbackText: { color: colors.inkMuted, fontSize: 11, fontWeight: '700' },
  rosterAvatarImg: { width: 32, height: 32, borderRadius: 16 },

  // Umpires section (Info tab) - card + appoint modal, same modal/picker visual pattern as
  // TournamentDetailScreen's register-team picker.
  umpireCard: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14,
  },
  umpireList: { marginTop: 4, marginBottom: 10 },
  umpireRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 },
  umpireName: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600' },
  umpireRemove: { color: colors.wicket400, fontSize: 12, fontWeight: '700' },
  umpireAddButton: {
    marginTop: 4, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border,
    borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  umpireAddButtonText: { color: colors.pitch400, fontSize: 13, fontWeight: '700' },
  umpireError: { color: colors.wicket400, fontSize: 12, marginTop: 8 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderColor: colors.border, paddingBottom: 24, maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },

  photoCaptionInput: {
    color: colors.ink,
    fontSize: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  galleryTile: { width: '33.33%', aspectRatio: 1, padding: 4 },
  galleryImage: { width: '100%', height: '100%', borderRadius: 8, backgroundColor: colors.surfaceAlt },
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  lightboxImage: { width: '100%', height: '70%' },
  lightboxCaption: { color: colors.ink, fontSize: 14, marginTop: 14, textAlign: 'center' },
  lightboxActions: { flexDirection: 'row', gap: 24, marginTop: 18, alignItems: 'center' },
  lightboxDelete: { color: colors.wicket400, fontSize: 14, fontWeight: '700' },
  lightboxClose: { color: colors.ink, fontSize: 14, fontWeight: '700' },
});
