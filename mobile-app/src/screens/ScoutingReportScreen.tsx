// Pre-match scouting report: each team's bowler threat ranking (already-wired
// api.insights.getBowlerScouting) plus a "Matchup Finder" that lets a captain pick any batter
// from one side and any bowler from the other and see the hierarchical-shrinkage bowling plan
// for that exact matchup - see backend/src/services/tendencyAnalytics.js#getMatchupPlan and
// documentation/hierarchical-matchup-shrinkage-research.md for the algorithm this surfaces.
// Mirrors web-app/app/match/[id]/scouting/page.tsx.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Modal, FlatList } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { PlayerLink } from '../components/IdentityLink';
import { api } from '../shared/api/apiClient';
import { Match } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';

type Props = NativeStackScreenProps<MatchesStackParamList, 'ScoutingReport'>;

function teamIdOf(team: Match['team1'] | undefined): string {
  if (!team) return '';
  return typeof team === 'string' ? team : team._id;
}

function teamNameOf(team: Match['team1'] | undefined): string {
  if (!team) return 'Team';
  return typeof team === 'string' ? 'Team' : team.name;
}

// Kebab-case tag -> "Title Case" - same transform as LiveScoringScreen's local `labelize`
// (mirrors web-app/lib/ballTaxonomy.ts#labelize). Duplicated rather than shared since there's
// no shared lib between mobile screens for this.
function labelize(v: string): string {
  return v
    .split(/[-\s]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

// Roster player as returned by GET /teams/:id - `user` may arrive as a bare ObjectId string or
// a populated { _id, name } object depending on the endpoint, same defensive pattern as
// NewMessageScreen/CreateGroupScreen's getUserName helper.
interface RosterPlayer {
  _id: string;
  user: { _id: string; name: string } | string | null;
  specialization: string;
}

function playerName(p: RosterPlayer): string {
  if (!p.user) return 'Player';
  if (typeof p.user === 'string') return 'Player';
  return p.user.name || 'Player';
}

const CONFIDENCE_COLOR: Record<string, string> = {
  high: colors.pitch400,
  medium: colors.gold400,
  low: colors.wicket400,
  pool: colors.inkMuted,
  none: colors.inkMuted,
};

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const color = CONFIDENCE_COLOR[confidence] ?? colors.inkMuted;
  return (
    <View style={[styles.badge, { borderColor: color }]}>
      <Text style={[styles.badgeText, { color }]}>{confidence}</Text>
    </View>
  );
}

// Reusable roster picker sheet - same slide-up Modal + FlatList pattern used by
// TeamDetailScreen's "Add Player" picker and CreateGroupScreen's team picker.
function PlayerPickerModal({
  visible,
  title,
  players,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  players: RosterPlayer[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeaderRow}>
            <Text style={styles.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.modalClose}>Close</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={players}
            keyExtractor={(p) => p._id}
            style={{ maxHeight: 420 }}
            ListEmptyComponent={<Text style={styles.muted}>No players on this roster yet.</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.modalPickerRow} onPress={() => onSelect(item._id)}>
                <Text style={styles.modalPickerName}>{playerName(item)}</Text>
                <Text style={styles.modalPickerMeta}>{item.specialization}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

interface MatchupBucket {
  line: string;
  length: string;
  blendedDismissalRate: number | null;
  confidence: string;
  basedOn: string;
}

interface MatchupPlan {
  success: boolean;
  source?: string;
  directMatchupBalls?: number;
  targetBuckets?: MatchupBucket[];
  message: string;
}

function MatchupFinder({
  team1Name,
  team2Name,
  roster1,
  roster2,
}: {
  team1Name: string;
  team2Name: string;
  roster1: RosterPlayer[];
  roster2: RosterPlayer[];
}) {
  const [battingTeam, setBattingTeam] = useState<'team1' | 'team2'>('team1');
  const [batsmanId, setBatsmanId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [batsmanPickerOpen, setBatsmanPickerOpen] = useState(false);
  const [bowlerPickerOpen, setBowlerPickerOpen] = useState(false);
  const [plan, setPlan] = useState<MatchupPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const battingRoster = battingTeam === 'team1' ? roster1 : roster2;
  const bowlingRoster = battingTeam === 'team1' ? roster2 : roster1;
  const battingTeamName = battingTeam === 'team1' ? team1Name : team2Name;
  const bowlingTeamName = battingTeam === 'team1' ? team2Name : team1Name;

  // Swapping which side is batting flips which roster feeds the batter picker vs. the bowler
  // picker - mirrors web's exact behavior - and clears any in-progress selection since the old
  // ids may no longer belong to the correct side.
  useEffect(() => {
    setBatsmanId(null);
    setBowlerId(null);
    setPlan(null);
  }, [battingTeam]);

  useEffect(() => {
    if (!batsmanId || !bowlerId) {
      setPlan(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.insights
      .getMatchupPlan(batsmanId, bowlerId)
      .then((data) => {
        if (!cancelled) setPlan(data as MatchupPlan);
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
  }, [batsmanId, bowlerId]);

  const selectedBatsman = battingRoster.find((p) => p._id === batsmanId);
  const selectedBowler = bowlingRoster.find((p) => p._id === bowlerId);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Matchup Finder</Text>
      <Text style={styles.helperText}>
        Pick a batter and bowler to see a bowling plan blended across this exact matchup, similar
        bowlers, similar batters, and the wider pool - not just one side's tendencies alone.
      </Text>

      <TouchableOpacity onPress={() => setBattingTeam((t) => (t === 'team1' ? 'team2' : 'team1'))}>
        <Text style={styles.swapText}>
          ⇄ Swap: {battingTeamName} batting vs {bowlingTeamName} bowling
        </Text>
      </TouchableOpacity>

      <View style={styles.pickerRow}>
        <TouchableOpacity style={styles.pickerBox} onPress={() => setBatsmanPickerOpen(true)}>
          <Text style={styles.pickerBoxLabel}>{battingTeamName} batter</Text>
          <Text style={selectedBatsman ? styles.pickerBoxValue : styles.pickerBoxPlaceholder}>
            {selectedBatsman ? playerName(selectedBatsman) : 'Select...'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.pickerBox} onPress={() => setBowlerPickerOpen(true)}>
          <Text style={styles.pickerBoxLabel}>{bowlingTeamName} bowler</Text>
          <Text style={selectedBowler ? styles.pickerBoxValue : styles.pickerBoxPlaceholder}>
            {selectedBowler ? playerName(selectedBowler) : 'Select...'}
          </Text>
        </TouchableOpacity>
      </View>

      {loading && <Text style={styles.mutedSmall}>Computing plan...</Text>}

      {!loading && plan && (
        <View style={styles.planBox}>
          <Text style={styles.planMessage}>{plan.message}</Text>
          {plan.targetBuckets && plan.targetBuckets.length > 0 && (
            <View style={styles.bucketList}>
              {plan.targetBuckets.map((b, i) => (
                <View key={i} style={styles.bucketRow}>
                  <Text style={styles.bucketLabel}>
                    {labelize(b.length)}, {labelize(b.line)}
                  </Text>
                  <View style={styles.bucketRight}>
                    {b.blendedDismissalRate !== null && (
                      <Text style={styles.bucketRate}>{b.blendedDismissalRate}% dismissal</Text>
                    )}
                    <ConfidenceBadge confidence={b.confidence} />
                  </View>
                </View>
              ))}
            </View>
          )}
          {typeof plan.directMatchupBalls === 'number' && (
            <Text style={styles.planNote}>
              {plan.directMatchupBalls > 0
                ? `Based on ${plan.directMatchupBalls} balls of direct history between these two players, blended with wider pools where that's thin.`
                : "No direct history between these two players yet - based entirely on similar-player pools."}
            </Text>
          )}
        </View>
      )}

      <PlayerPickerModal
        visible={batsmanPickerOpen}
        title={`Select ${battingTeamName} batter`}
        players={battingRoster}
        onSelect={(id) => {
          setBatsmanId(id);
          setBatsmanPickerOpen(false);
        }}
        onClose={() => setBatsmanPickerOpen(false)}
      />
      <PlayerPickerModal
        visible={bowlerPickerOpen}
        title={`Select ${bowlingTeamName} bowler`}
        players={bowlingRoster}
        onSelect={(id) => {
          setBowlerId(id);
          setBowlerPickerOpen(false);
        }}
        onClose={() => setBowlerPickerOpen(false)}
      />
    </View>
  );
}

interface BowlerReport {
  playerId: string;
  name: string;
  specialization: string;
  bowlingStyle: string;
  hasData: boolean;
  stats: {
    economy: number;
    strikeRate: number | null;
    wickets: number;
    balls: number;
    blendedEconomy: number | null;
    confidence: string;
  } | null;
  note: string;
}

function BowlerCard({ bowler, rank }: { bowler: BowlerReport; rank: number }) {
  return (
    <View style={styles.bowlerCard}>
      <View style={styles.bowlerCardHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.bowlerNameRow}>
            <Text style={styles.bowlerRank}>#{rank} </Text>
            <PlayerLink id={bowler.playerId} name={bowler.name} style={styles.bowlerName} numberOfLines={1} />
          </View>
          <Text style={styles.bowlerMeta}>
            {bowler.specialization} · {bowler.bowlingStyle}
          </Text>
        </View>
        {bowler.hasData && bowler.stats && (
          <View style={styles.econBadge}>
            <Text style={styles.econBadgeText}>Econ {bowler.stats.economy}</Text>
          </View>
        )}
      </View>
      <Text style={styles.bowlerNote}>{bowler.note}</Text>
    </View>
  );
}

export default function ScoutingReportScreen({ route }: Props) {
  const { matchId } = route.params;

  const [match, setMatch] = useState<Match | null>(null);
  const [team1Bowlers, setTeam1Bowlers] = useState<BowlerReport[]>([]);
  const [team2Bowlers, setTeam2Bowlers] = useState<BowlerReport[]>([]);
  const [roster1, setRoster1] = useState<RosterPlayer[]>([]);
  const [roster2, setRoster2] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.matches
      .getMatchById(matchId)
      .then(async ({ match }) => {
        if (cancelled) return;
        setMatch(match);
        const team1Id = teamIdOf(match.team1);
        const team2Id = teamIdOf(match.team2);
        const [r1, r2, t1, t2] = await Promise.all([
          api.insights.getBowlerScouting(team1Id).catch(() => ({ bowlers: [] as BowlerReport[] })),
          api.insights.getBowlerScouting(team2Id).catch(() => ({ bowlers: [] as BowlerReport[] })),
          api.teams.getTeamById(team1Id).catch(() => ({ team: null })),
          api.teams.getTeamById(team2Id).catch(() => ({ team: null })),
        ]);
        if (cancelled) return;
        setTeam1Bowlers((r1 as any).bowlers || []);
        setTeam2Bowlers((r2 as any).bowlers || []);
        setRoster1(((t1 as any).team?.players as RosterPlayer[]) || []);
        setRoster2(((t2 as any).team?.players as RosterPlayer[]) || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load match'))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  const team1Name = useMemo(() => teamNameOf(match?.team1), [match]);
  const team2Name = useMemo(() => teamNameOf(match?.team2), [match]);

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

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.header}>
        <Text style={styles.title}>{match.title}</Text>
        <Text style={styles.subtitle}>
          {match.venue}
          {match.pitchType && match.pitchType !== 'unknown' ? ` · ${labelize(match.pitchType)} pitch` : ' · pitch type unknown'}
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{team1Name} bowlers</Text>
        {team1Bowlers.length === 0 ? (
          <Text style={styles.muted}>No roster data yet.</Text>
        ) : (
          team1Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{team2Name} bowlers</Text>
        {team2Bowlers.length === 0 ? (
          <Text style={styles.muted}>No roster data yet.</Text>
        ) : (
          team2Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
        )}
      </View>

      <MatchupFinder team1Name={team1Name} team2Name={team2Name} roster1={roster1} roster2={roster2} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', padding: 16 },
  mutedSmall: { color: colors.inkMuted, fontSize: 12 },
  errorTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 },

  header: { padding: 16, paddingBottom: 4 },
  title: { color: colors.ink, fontSize: 20, fontWeight: '800' },
  subtitle: { color: colors.inkSecondary, fontSize: 13, marginTop: 4 },

  section: { marginTop: 20, paddingHorizontal: 16 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  helperText: { color: colors.inkSecondary, fontSize: 12, lineHeight: 17, marginBottom: 10 },

  bowlerCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  bowlerCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bowlerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bowlerName: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  bowlerRank: { color: colors.inkMuted, fontWeight: '400' },
  bowlerMeta: { color: colors.inkSecondary, fontSize: 12, marginTop: 2 },
  bowlerNote: { color: colors.inkSecondary, fontSize: 12, marginTop: 8, lineHeight: 17 },
  econBadge: { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  econBadgeText: { color: colors.wicket400, fontSize: 11, fontWeight: '700' },

  swapText: { color: colors.pitch400, fontSize: 12, fontWeight: '600', marginBottom: 12 },

  pickerRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  pickerBox: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerBoxLabel: { color: colors.inkMuted, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.3 },
  pickerBoxValue: { color: colors.ink, fontSize: 14, fontWeight: '600', marginTop: 4 },
  pickerBoxPlaceholder: { color: colors.inkMuted, fontSize: 14, marginTop: 4 },

  planBox: { backgroundColor: colors.surfaceAlt, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14 },
  planMessage: { color: colors.ink, fontSize: 13, lineHeight: 19 },
  planNote: { color: colors.inkMuted, fontSize: 11, marginTop: 10, lineHeight: 16 },
  bucketList: { marginTop: 10, gap: 8 },
  bucketRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  bucketLabel: { color: colors.inkSecondary, fontSize: 13, flex: 1, marginRight: 8 },
  bucketRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bucketRate: { color: colors.inkMuted, fontSize: 11 },

  badge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'capitalize' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  modalPickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalPickerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  modalPickerMeta: { color: colors.inkMuted, fontSize: 12 },
});
