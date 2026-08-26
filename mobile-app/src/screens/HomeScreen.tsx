import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { scorebook, NUM } from '../theme/scorebook';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match } from '../shared/types';
import { resolveRefId, resolveRefName } from '../shared/utils/resolveRef';

// Home answers "what does this user need to do today?", not "what features exist?".
//
// It is CONTEXT-driven, not role-driven. A single User.role cannot describe someone who is a
// player in one team, captain of another and the scorer of tonight's match - and in practice every
// account in the database is 'player' anyway, because nothing ever sets it. So the priority ladder
// below is derived from RELATIONSHIPS that already exist (which teams am I in, who created this
// match), which is both truer and buildable without a schema change:
//
//   1. a live match involving my teams   -> everything else gets out of the way
//   2. my next fixture                   -> the fixture board
//   3. my season so far                  -> the scorebook summary line
//   4. the rest of CricRoots             -> quiet, at the bottom, where a directory belongs

const SECONDARY = [
  { label: 'Calendar', screen: 'Calendar' },
  { label: 'Network', screen: 'Network' },
  { label: 'Learn', screen: 'Learn' },
  { label: 'News', screen: 'News' },
  { label: 'Community', screen: 'Community' },
  { label: 'Market', screen: 'Marketplace' },
];

const teamName = (t: Match['team1']) => resolveRefName(t, 'Team');
const teamId = (t: Match['team1']) => resolveRefId(t);

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function whenLabel(iso?: string): string {
  if (!iso) return 'Date TBC';
  const d = new Date(iso);
  const today = new Date();
  const days = Math.round((d.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / 86400000);
  const time = new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (days === 0) return `Today · ${time}`;
  if (days === 1) return `Tomorrow · ${time}`;
  if (days > 1 && days < 7) return `${new Date(iso).toLocaleDateString([], { weekday: 'long' })} · ${time}`;
  return `${new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short' })} · ${time}`;
}

// Runs/wickets/overs for whichever innings is in progress.
//
// NOTE the list endpoint (GET /api/matches) omits innings[].balls and leaves innings[].team as a
// raw id - only the detail endpoint populates those. So this derives everything from the summary
// fields, and resolves the batting side by comparing ids against team1/team2.
//
// `innings.overs` is CRICKET NOTATION: 16.2 means 16 overs and 2 balls, NOT 16.2 overs. Converting
// it as a decimal is the exact defect that shipped in the win-probability serving path (see
// backend/src/services/matchStateFeatures.js), so the ball count is reconstructed explicitly here.
function legalBallsFromOvers(overs: number): number {
  const whole = Math.floor(overs);
  const balls = Math.round((overs - whole) * 10);
  return whole * 6 + balls;
}

function liveState(match: Match) {
  const second = match.innings?.[1];
  const idx = (second?.runs ?? 0) > 0 || (second?.overs ?? 0) > 0 ? 1 : 0;
  const inn = match.innings?.[idx];
  const target = idx === 1 ? (match.innings?.[0]?.runs ?? 0) + 1 : null;
  const battingIsTeam1 = resolveRefId(inn?.team as any) === teamId(match.team1);
  const ballsLeft = (match.totalOvers ?? 20) * 6 - legalBallsFromOvers(inn?.overs ?? 0);
  return {
    battingTeam: battingIsTeam1 ? teamName(match.team1) : teamName(match.team2),
    runs: inn?.runs ?? 0,
    wickets: inn?.wickets ?? 0,
    overs: inn?.overs ?? 0,
    need: target != null ? Math.max(0, target - (inn?.runs ?? 0)) : null,
    ballsLeft: Math.max(0, ballsLeft),
  };
}

export default function HomeScreen({ navigation }: any) {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [myTeamIds, setMyTeamIds] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.matches.getMatches().then((r) => r.matches).catch(() => []),
      api.players.getMyProfile().then((r) => r.player).catch(() => null),
    ])
      .then(([all, player]) => {
        setMatches(all ?? []);
        setMyTeamIds(((player?.teams ?? []) as any[]).map((t) => resolveRefId(t)).filter(Boolean) as string[]);
      })
      .finally(() => setRefreshing(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const mine = useMemo(() => {
    const isMine = (m: Match) =>
      myTeamIds.includes(teamId(m.team1) ?? '') || myTeamIds.includes(teamId(m.team2) ?? '');
    const mineOnly = matches.filter(isMine);

    const live = mineOnly.find((m) => m.status === 'Live') ?? matches.find((m) => m.status === 'Live');
    const upcoming = mineOnly
      .filter((m) => m.status === 'Scheduled')
      .sort((a, b) => +new Date(a.scheduledDate ?? 0) - +new Date(b.scheduledDate ?? 0));
    const played = mineOnly.filter((m) => m.status === 'Completed');
    const won = played.filter((m) => myTeamIds.includes(resolveRefId(m.result?.winningTeam as any) ?? '')).length;

    return { live, upcoming, played, won, hasIdentity: myTeamIds.length > 0 };
  }, [matches, myTeamIds]);

  // Whoever created a match can score it (mirrors the backend's canManageMatch, minus the
  // umpire/roster lookups the client cannot do without extra requests).
  const canScore = (m?: Match) =>
    !!m && !!user && resolveRefId((m as any).createdBy) === (user as any)._id;

  const openMatch = (m: Match) => navigation.navigate('Matches', { screen: 'MatchDetail', params: { matchId: m._id } });

  return (
    <ScrollView
      style={scorebook.screen}
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.pitch400} />}
    >
      <View style={s.masthead}>
        <Text style={s.greeting}>{greeting()},</Text>
        <Text style={s.name}>{user?.name?.split(' ')[0] ?? 'Cricketer'}</Text>
      </View>

      {/* 1. LIVE - the only elevated surface on the screen. */}
      {mine.live && (() => {
        const l = liveState(mine.live!);
        return (
          <View style={scorebook.hero}>
            <View style={scorebook.heroInner}>
              <View style={scorebook.liveTag}>
                <View style={scorebook.liveDot} />
                <Text style={scorebook.liveTagText}>LIVE NOW</Text>
              </View>
              <Text style={s.heroTeams} numberOfLines={1}>
                {teamName(mine.live!.team1)} v {teamName(mine.live!.team2)}
              </Text>
              <View style={s.heroScoreRow}>
                <Text style={s.heroScore}>{l.runs}<Text style={s.heroScoreSlash}>/</Text>{l.wickets}</Text>
                <Text style={s.heroOvers}>{l.overs.toFixed(1)} ov</Text>
              </View>
              <Text style={s.heroBatting} numberOfLines={1}>{l.battingTeam} batting</Text>
              {l.need != null && l.need > 0 && (
                <Text style={s.heroEquation}>
                  {l.need} needed from {l.ballsLeft}
                </Text>
              )}
            </View>
            <TouchableOpacity style={scorebook.actionBar} onPress={() => openMatch(mine.live!)}>
              <Ionicons name={canScore(mine.live) ? 'create' : 'play'} size={15} color="#04140A" />
              <Text style={scorebook.actionBarText}>
                {canScore(mine.live) ? 'CONTINUE SCORING' : 'OPEN MATCH'}
              </Text>
            </TouchableOpacity>
          </View>
        );
      })()}

      {/* 2. NEXT UP - the fixture board. */}
      {mine.upcoming.length > 0 && (
        <>
          <View style={scorebook.headingRow}>
            <Text style={scorebook.heading}>Next up</Text>
            <View style={scorebook.headingRule} />
          </View>
          {mine.upcoming.slice(0, 2).map((m, i, arr) => (
            <TouchableOpacity
              key={m._id}
              style={[scorebook.row, i === arr.length - 1 && scorebook.rowLast]}
              onPress={() => openMatch(m)}
            >
              <View style={s.dateBlock}>
                <Text style={s.dateDay}>{new Date(m.scheduledDate ?? 0).toLocaleDateString([], { day: 'numeric' })}</Text>
                <Text style={s.dateMon}>{new Date(m.scheduledDate ?? 0).toLocaleDateString([], { month: 'short' }).toUpperCase()}</Text>
              </View>
              <View style={scorebook.rowBody}>
                <Text style={scorebook.rowTitle} numberOfLines={1}>
                  {teamName(m.team1)} v {teamName(m.team2)}
                </Text>
                <Text style={scorebook.rowMeta} numberOfLines={1}>
                  {whenLabel(m.scheduledDate)} · {m.venue}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
            </TouchableOpacity>
          ))}
        </>
      )}

      {/* 3. YOUR SEASON - the scorebook summary line. */}
      {mine.hasIdentity && (
        <>
          <View style={scorebook.headingRow}>
            <Text style={scorebook.heading}>Your season</Text>
            <View style={scorebook.headingRule} />
          </View>
          {mine.played.length === 0 ? (
            <Text style={scorebook.empty}>No completed matches yet. Your season record will build here.</Text>
          ) : (
            <View style={scorebook.figureStrip}>
              <View style={scorebook.figure}>
                <Text style={scorebook.figureValue}>{mine.played.length}</Text>
                <Text style={scorebook.figureLabel}>Played</Text>
              </View>
              <View style={scorebook.figureDivider} />
              <View style={[scorebook.figure, { paddingLeft: 18 }]}>
                <Text style={[scorebook.figureValue, { color: colors.pitch400 }]}>{mine.won}</Text>
                <Text style={scorebook.figureLabel}>Won</Text>
              </View>
              <View style={scorebook.figureDivider} />
              <View style={[scorebook.figure, { paddingLeft: 18 }]}>
                <Text style={scorebook.figureValue}>
                  {Math.round((mine.won / mine.played.length) * 100)}<Text style={s.pct}>%</Text>
                </Text>
                <Text style={scorebook.figureLabel}>Win rate</Text>
              </View>
            </View>
          )}
        </>
      )}

      {/* Nothing of your own on today - say so plainly instead of showing an empty dashboard. */}
      {!mine.live && mine.upcoming.length === 0 && (
        <>
          <View style={scorebook.headingRow}>
            <Text style={scorebook.heading}>{mine.hasIdentity ? 'Nothing on today' : 'Get started'}</Text>
            <View style={scorebook.headingRule} />
          </View>
          <Text style={scorebook.empty}>
            {mine.hasIdentity
              ? 'No live or upcoming matches for your teams. Recent results are below.'
              : 'Join or create a team to see your fixtures, season record and live matches here.'}
          </Text>
        </>
      )}

      {/* 4. AROUND THE CLUB - other people's cricket, deliberately after yours. */}
      <View style={scorebook.headingRow}>
        <Text style={scorebook.heading}>Around the club</Text>
        <View style={scorebook.headingRule} />
      </View>
      {matches.filter((m) => m.status === 'Completed').slice(0, 3).map((m, i, arr) => (
        <TouchableOpacity
          key={m._id}
          style={[scorebook.row, i === arr.length - 1 && scorebook.rowLast]}
          onPress={() => openMatch(m)}
        >
          <View style={scorebook.rowBody}>
            <Text style={scorebook.rowTitle} numberOfLines={1}>
              {teamName(m.team1)} v {teamName(m.team2)}
            </Text>
            <Text style={scorebook.rowMeta} numberOfLines={1}>
              {m.innings?.[0]?.runs ?? 0}/{m.innings?.[0]?.wickets ?? 0}
              {'  ·  '}{m.innings?.[1]?.runs ?? 0}/{m.innings?.[1]?.wickets ?? 0}
              {m.result?.margin ? `  ·  won by ${m.result.marginValue} ${m.result.margin}` : ''}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.inkMuted} />
        </TouchableOpacity>
      ))}

      {/* 5. Everything else. A directory is fine - once it is no longer the whole screen. */}
      <View style={scorebook.headingRow}>
        <Text style={scorebook.heading}>Explore</Text>
        <View style={scorebook.headingRule} />
      </View>
      <View style={scorebook.chipWrap}>
        {SECONDARY.map((link) => (
          <TouchableOpacity key={link.screen} style={scorebook.chip} onPress={() => navigation.navigate(link.screen)}>
            <Text style={scorebook.chipText}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  masthead: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 22 },
  greeting: { fontSize: 14, color: colors.inkMuted },
  name: { fontSize: 28, fontWeight: '800', color: colors.ink, marginTop: 2, letterSpacing: -0.4 },

  heroTeams: { fontSize: 14, fontWeight: '600', color: colors.pitch400, marginBottom: 8 },
  heroScoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  heroScore: { fontSize: 44, fontWeight: '800', color: colors.ink, letterSpacing: -1, ...NUM },
  heroScoreSlash: { fontSize: 30, color: colors.inkMuted, fontWeight: '600' },
  heroOvers: { fontSize: 15, color: colors.inkSecondary, ...NUM },
  heroBatting: { fontSize: 12, color: colors.inkSecondary, marginTop: 4 },
  heroEquation: { fontSize: 16, fontWeight: '700', color: colors.gold400, marginTop: 12, ...NUM },

  dateBlock: { width: 40, alignItems: 'center' },
  dateDay: { fontSize: 20, fontWeight: '800', color: colors.ink, ...NUM },
  dateMon: { fontSize: 10, fontWeight: '700', color: colors.inkMuted, letterSpacing: 0.8 },

  pct: { fontSize: 18, color: colors.inkMuted, fontWeight: '700' },
});
