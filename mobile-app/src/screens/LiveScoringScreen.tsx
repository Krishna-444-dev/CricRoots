import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match, Player, BallEvent } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';
import LiveMatchupPanel from '../components/LiveMatchupPanel';

type Props = NativeStackScreenProps<MatchesStackParamList, 'LiveScoring'>;

// --- Delivery tagging taxonomy - mirrors backend/src/models/Match.js's ball subdocument enums
// (also mirrored in web-app/lib/ballTaxonomy.ts). Duplicated here rather than imported since
// mobile-app and web-app are separate packages with no shared lib between them. ---
const LINES = ['wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg'] as const;
const LENGTHS = ['full-toss', 'yorker', 'full', 'good-length', 'short-of-good-length', 'short', 'bouncer'] as const;
const SHOT_TYPES = ['defensive', 'drive', 'cut', 'pull-hook', 'sweep', 'flick-glance', 'loft', 'reverse-scoop', 'edge', 'other'] as const;
const SHOT_ZONES = ['third-man', 'point', 'cover', 'mid-off', 'mid-on', 'mid-wicket', 'square-leg', 'fine-leg'] as const;
const FIELDER_POSITIONS = [...SHOT_ZONES, 'wicket-keeper', 'bowler', 'not-applicable'] as const;
const WICKET_TYPES = ['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired hurt', 'retired out'] as const;
const EXTRA_TYPES: { id: BallEvent['extraType']; label: string }[] = [
  { id: 'wide', label: 'Wide' },
  { id: 'no-ball', label: 'No Ball' },
  { id: 'bye', label: 'Bye' },
  { id: 'leg-bye', label: 'Leg Bye' },
  { id: 'penalty', label: 'Penalty' },
];

function labelize(v: string): string {
  return v
    .split(/[-\s]/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}

interface UiPlayer {
  id: string;
  name: string;
}

function toUiPlayer(p: Player): UiPlayer {
  const name = typeof p.user === 'string' ? 'Player' : p.user?.name || 'Player';
  return { id: p._id, name };
}

function teamIdOf(team: Match['team1'] | undefined): string | null {
  if (!team) return null;
  return typeof team === 'string' ? team : team._id;
}

function teamNameOf(team: Match['team1'] | undefined): string {
  if (!team) return 'Team';
  return typeof team === 'string' ? 'Team' : team.name;
}

function rosterIds(team: Match['team1'] | undefined): string[] {
  if (!team || typeof team === 'string') return [];
  return (team.players || []).map((p) => (typeof p === 'string' ? p : p._id));
}

function resolveUserId(u: Match['createdBy'] | undefined | null): string | null {
  if (!u) return null;
  if (typeof u === 'string') return u;
  const any = u as any;
  return any._id ?? any.id ?? null;
}

function isLegalDelivery(b: Pick<BallEvent, 'isExtra' | 'extraType'>): boolean {
  return !(b.isExtra && (b.extraType === 'wide' || b.extraType === 'no-ball'));
}

function battingStatsFor(balls: BallEvent[], playerId: string) {
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  for (const b of balls) {
    if (b.batsmanId !== playerId) continue;
    if (!(b.isExtra && b.extraType === 'wide')) ballsFaced += 1;
    if (!b.isExtra) {
      runs += b.runs;
      if (b.runs === 4) fours += 1;
      if (b.runs === 6) sixes += 1;
    }
  }
  const strikeRate = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  return { runs, ballsFaced, fours, sixes, strikeRate };
}

function bowlingStatsFor(balls: BallEvent[], playerId: string) {
  let legalBalls = 0;
  let runsConceded = 0;
  let wickets = 0;
  for (const b of balls) {
    if (b.bowlerId !== playerId) continue;
    if (isLegalDelivery(b)) legalBalls += 1;
    if (!(b.isExtra && (b.extraType === 'bye' || b.extraType === 'leg-bye'))) runsConceded += b.runs;
    if (b.isWicket && !['run out', 'retired hurt', 'retired out'].includes(b.wicketType || '')) wickets += 1;
  }
  const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
  const economy = legalBalls > 0 ? runsConceded / (legalBalls / 6) : 0;
  return { legalBalls, runsConceded, wickets, overs, economy };
}

// Generic tap-to-select chip group, reused for every selection surface in this screen (teams,
// players, wicket type, delivery tagging) instead of building a native <select> equivalent per
// field - keeps the whole scoring flow to one visual language.
function ChipGroup({
  label,
  required,
  options,
  value,
  onChange,
  emptyLabel,
}: {
  label?: string;
  required?: boolean;
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string) => void;
  emptyLabel?: string;
}) {
  return (
    <View style={styles.chipGroup}>
      {label && (
        <Text style={styles.chipGroupLabel}>
          {label}
          {required && <Text style={styles.requiredMark}> *</Text>}
        </Text>
      )}
      {options.length === 0 ? (
        <Text style={styles.mutedSmall}>{emptyLabel || 'No options available'}</Text>
      ) : (
        <View style={styles.chipWrap}>
          {options.map((opt) => {
            const selected = opt.id === value;
            return (
              <TouchableOpacity
                key={opt.id}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => onChange(opt.id)}
              >
                <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{opt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function LiveScoringScreen({ route, navigation }: Props) {
  const { matchId } = route.params;
  const { user } = useAuth();

  // --- Load ---
  const [match, setMatch] = useState<Match | null>(null);
  const [playersById, setPlayersById] = useState<Map<string, Player>>(new Map());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([api.matches.getMatchById(matchId), api.players.getPlayers()])
      .then(([matchRes, playersRes]) => {
        setMatch(matchRes.match);
        const map = new Map<string, Player>();
        (playersRes.players as Player[]).forEach((p) => map.set(p._id, p));
        setPlayersById(map);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : 'Failed to load match'))
      .finally(() => setLoading(false));
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // --- Innings setup ---
  const [inningsStarted, setInningsStarted] = useState(false);
  const [inningsIndex, setInningsIndex] = useState<0 | 1>(0);
  const [battingTeamId, setBattingTeamId] = useState<string | null>(null);
  const [strikerId, setStrikerId] = useState<string | null>(null);
  const [nonStrikerId, setNonStrikerId] = useState<string | null>(null);
  const [bowlerId, setBowlerId] = useState<string | null>(null);
  const [outPlayerIds, setOutPlayerIds] = useState<Set<string>>(new Set());
  const [bowlerPickerOpen, setBowlerPickerOpen] = useState(false);

  // --- Pending ball being built ---
  const [pendingType, setPendingType] = useState<'normal' | 'extra' | 'wicket'>('normal');
  const [pendingRuns, setPendingRuns] = useState(0);
  const [pendingExtraType, setPendingExtraType] = useState<BallEvent['extraType']>('wide');
  const [pendingExtraRuns, setPendingExtraRuns] = useState(1);
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [line, setLine] = useState<string>('unknown');
  const [length, setLength] = useState<string>('unknown');
  const [shotType, setShotType] = useState<string | null>(null);
  const [shotZone, setShotZone] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ballError, setBallError] = useState<string | null>(null);

  // --- Wicket modal ---
  const [wicketModalVisible, setWicketModalVisible] = useState(false);
  const [wicketType, setWicketType] = useState<string>('bowled');
  const [fielderId, setFielderId] = useState<string | null>(null);
  const [fielderPosition, setFielderPosition] = useState<string | null>(null);
  const [newBatsmanId, setNewBatsmanId] = useState<string | null>(null);

  const [finishing, setFinishing] = useState(false);

  // --- Rain-rule interruption (rare-use, collapsed by default - see RainRuleControl below) ---
  const [rainRuleOpen, setRainRuleOpen] = useState(false);
  const [revisedOversInput, setRevisedOversInput] = useState('');
  const [rainRuleLoading, setRainRuleLoading] = useState(false);
  const [rainRuleError, setRainRuleError] = useState<string | null>(null);
  const [rainRuleResult, setRainRuleResult] = useState<{ target: number; parScore: number } | null>(null);

  async function handleApplyInterruption() {
    if (!match) return;
    const overs = parseFloat(revisedOversInput);
    if (!overs || overs <= 0) {
      setRainRuleError('Enter a valid number of overs');
      return;
    }
    setRainRuleLoading(true);
    setRainRuleError(null);
    try {
      const res = await api.matches.applyInterruption(match._id, overs);
      setRainRuleResult({ target: res.interruption.target, parScore: res.interruption.parScore });
      setMatch(res.match);
    } catch (e) {
      setRainRuleError(e instanceof Error ? e.message : 'Could not apply interruption');
    } finally {
      setRainRuleLoading(false);
    }
  }

  const team1Roster = useMemo(
    () =>
      rosterIds(match?.team1)
        .map((id) => playersById.get(id))
        .filter((p): p is Player => !!p)
        .map(toUiPlayer),
    [match, playersById]
  );
  const team2Roster = useMemo(
    () =>
      rosterIds(match?.team2)
        .map((id) => playersById.get(id))
        .filter((p): p is Player => !!p)
        .map(toUiPlayer),
    [match, playersById]
  );

  const team1Id = teamIdOf(match?.team1);
  const battingRoster = battingTeamId === team1Id ? team1Roster : team2Roster;
  const bowlingRoster = battingTeamId === team1Id ? team2Roster : team1Roster;

  const nameFor = useCallback(
    (id: string | null | undefined): string | undefined => {
      if (!id) return undefined;
      const p = playersById.get(id);
      return p ? toUiPlayer(p).name : undefined;
    },
    [playersById]
  );

  const canStart =
    !!battingTeamId && !!strikerId && !!nonStrikerId && !!bowlerId && strikerId !== nonStrikerId;

  function handleStartInnings() {
    if (!match || !canStart) return;
    setInningsIndex(battingTeamId === team1Id ? 0 : 1);
    setOutPlayerIds(new Set());
    setInningsStarted(true);
  }

  function resetPendingState() {
    setPendingType('normal');
    setPendingRuns(0);
    setPendingExtraType('wide');
    setPendingExtraRuns(1);
    setWicketType('bowled');
    setFielderId(null);
    setFielderPosition(null);
    setDetailExpanded(false);
    setLine('unknown');
    setLength('unknown');
    setShotType(null);
    setShotZone(null);
    setBallError(null);
  }

  const currentBalls = match?.innings[inningsIndex]?.balls ?? [];

  function rotateStrikeIfNeeded(overCompletes: boolean, runs: number, isWideExtra: boolean) {
    if (overCompletes || (!isWideExtra && runs % 2 === 1)) {
      setStrikerId((prevStriker) => {
        setNonStrikerId(prevStriker);
        return nonStrikerId;
      });
    }
  }

  async function handleRecordNormalOrExtra() {
    if (!match || !strikerId || !nonStrikerId || !bowlerId || submitting) return;
    setSubmitting(true);
    setBallError(null);

    const isExtra = pendingType === 'extra';
    const extraType: BallEvent['extraType'] = isExtra ? pendingExtraType : 'none';
    const runs = pendingType === 'normal' ? pendingRuns : pendingExtraRuns;
    const legalBefore = currentBalls.filter(isLegalDelivery).length;
    const thisLegal = isLegalDelivery({ isExtra, extraType });
    const overCompletes = thisLegal && (legalBefore + 1) % 6 === 0;
    const isWideExtra = isExtra && extraType === 'wide';

    const ballEvent: BallEvent = {
      ballNumber: currentBalls.length + 1,
      batsmanId: strikerId,
      bowlerId,
      runs,
      isWicket: false,
      wicketType: null,
      isExtra,
      extraType,
      line,
      length,
      shotType,
      shotZone,
      fielderId: null,
      fielderPosition: null,
      batsmanName: nameFor(strikerId),
      bowlerName: nameFor(bowlerId),
    };

    try {
      const res = await api.matches.recordBall(matchId, { inningsIndex, ...ballEvent });
      setMatch(res.match);
      if (overCompletes) {
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      } else if (!isWideExtra && runs % 2 === 1) {
        setStrikerId(nonStrikerId);
        setNonStrikerId(strikerId);
      }
      resetPendingState();
    } catch (e) {
      setBallError(e instanceof Error ? e.message : 'Failed to record ball');
    } finally {
      setSubmitting(false);
    }
  }

  function openWicketModal() {
    setPendingType('wicket');
    setDetailExpanded(true);
    setWicketModalVisible(true);
  }

  function closeWicketModal() {
    setWicketModalVisible(false);
    setPendingType('normal');
  }

  const needsFielder = ['caught', 'run out', 'stumped'].includes(wicketType);
  const availableNewBatsmen = battingRoster.filter(
    (p) => !outPlayerIds.has(p.id) && p.id !== strikerId && p.id !== nonStrikerId
  );
  const canConfirmWicket =
    line !== 'unknown' && length !== 'unknown' && (availableNewBatsmen.length === 0 || !!newBatsmanId);

  async function handleConfirmWicket() {
    if (!match || !strikerId || !nonStrikerId || !bowlerId || submitting) return;
    if (!canConfirmWicket) {
      setBallError('Select line, length, and a new batsman before confirming.');
      return;
    }
    setSubmitting(true);
    setBallError(null);

    const legalBefore = currentBalls.filter(isLegalDelivery).length;
    const overCompletes = (legalBefore + 1) % 6 === 0;

    const ballEvent: BallEvent = {
      ballNumber: currentBalls.length + 1,
      batsmanId: strikerId,
      bowlerId,
      runs: 0,
      isWicket: true,
      wicketType,
      isExtra: false,
      extraType: 'none',
      line,
      length,
      shotType,
      shotZone,
      fielderId: needsFielder ? fielderId : null,
      fielderPosition: needsFielder ? fielderPosition : null,
      batsmanName: nameFor(strikerId),
      bowlerName: nameFor(bowlerId),
      fielderName: needsFielder ? nameFor(fielderId) : undefined,
    };

    try {
      const res = await api.matches.recordBall(matchId, { inningsIndex, ...ballEvent });
      setMatch(res.match);
      setOutPlayerIds((prev) => new Set(prev).add(strikerId));

      if (newBatsmanId) {
        if (overCompletes) {
          setStrikerId(nonStrikerId);
          setNonStrikerId(newBatsmanId);
        } else {
          setStrikerId(newBatsmanId);
        }
      }
      setNewBatsmanId(null);
      setWicketModalVisible(false);
      resetPendingState();
    } catch (e) {
      setBallError(e instanceof Error ? e.message : 'Failed to record wicket');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSwapStrike() {
    setStrikerId(nonStrikerId);
    setNonStrikerId(strikerId);
  }

  function handleEndInnings() {
    setInningsStarted(false);
    setBattingTeamId(null);
    setStrikerId(null);
    setNonStrikerId(null);
    setBowlerId(null);
    setOutPlayerIds(new Set());
    resetPendingState();
  }

  async function handleFinishMatch() {
    if (!match || finishing) return;
    setFinishing(true);
    try {
      await api.matches.updateMatch(match._id, { status: 'Completed' });
      navigation.navigate('MatchDetail', { matchId: match._id });
    } catch (e) {
      Alert.alert('Could not finish match', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setFinishing(false);
    }
  }

  // --- Render states ---

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
        <Text style={styles.muted}>{loadError || 'It may have been removed.'}</Text>
      </View>
    );
  }

  const ownerId = resolveUserId(match.createdBy);
  const isOwner = !!user && !!ownerId && ownerId === user.id;

  if (!isOwner) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Not authorized</Text>
        <Text style={styles.muted}>
          Only the user who created this match can score it.
        </Text>
      </View>
    );
  }

  if (match.status === 'Completed' || match.status === 'Cancelled') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Match {match.status.toLowerCase()}</Text>
        <Text style={styles.muted}>This match is no longer live and can&apos;t be scored.</Text>
      </View>
    );
  }

  // --- Setup phase ---
  if (!inningsStarted) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.setupContent}>
        <Text style={styles.sectionTitle}>Start Innings</Text>
        <ChipGroup
          label="Batting first"
          required
          options={[
            { id: team1Id || 'team1', label: teamNameOf(match.team1) },
            { id: teamIdOf(match.team2) || 'team2', label: teamNameOf(match.team2) },
          ]}
          value={battingTeamId}
          onChange={(id) => {
            setBattingTeamId(id);
            setStrikerId(null);
            setNonStrikerId(null);
            setBowlerId(null);
          }}
        />

        {battingTeamId && (
          <>
            <ChipGroup
              label="Striker"
              required
              emptyLabel="This team has no players registered yet."
              options={battingRoster.map((p) => ({ id: p.id, label: p.name }))}
              value={strikerId}
              onChange={setStrikerId}
            />
            <ChipGroup
              label="Non-striker"
              required
              options={battingRoster.filter((p) => p.id !== strikerId).map((p) => ({ id: p.id, label: p.name }))}
              value={nonStrikerId}
              onChange={setNonStrikerId}
            />
            <ChipGroup
              label="Opening bowler"
              required
              emptyLabel="This team has no players registered yet."
              options={bowlingRoster.map((p) => ({ id: p.id, label: p.name }))}
              value={bowlerId}
              onChange={setBowlerId}
            />
          </>
        )}

        <TouchableOpacity
          style={[styles.primaryButton, !canStart && styles.buttonDisabled]}
          disabled={!canStart}
          onPress={handleStartInnings}
        >
          <Text style={styles.primaryButtonText}>Start Scoring</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // --- Live scoring phase ---
  const innings = match.innings[inningsIndex];
  const strikerStats = strikerId ? battingStatsFor(currentBalls, strikerId) : null;
  const nonStrikerStats = nonStrikerId ? battingStatsFor(currentBalls, nonStrikerId) : null;
  const bowlerStats = bowlerId ? bowlingStatsFor(currentBalls, bowlerId) : null;
  const extrasTotal = currentBalls.filter((b) => b.isExtra).reduce((sum, b) => sum + b.runs, 0);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.scoreSummary}>
        <Text style={styles.scoreSummaryTeam}>{teamNameOf(battingTeamId === team1Id ? match.team1 : match.team2)}</Text>
        <Text style={styles.scoreSummaryValue}>
          {innings?.runs ?? 0}/{innings?.wickets ?? 0}
          <Text style={styles.scoreSummaryOvers}>  ({(innings?.overs ?? 0).toFixed(1)} ov)</Text>
        </Text>
        <Text style={styles.mutedSmall}>Extras: {extrasTotal}</Text>
      </View>

      {/* Rain-rule interruption - rare-use, collapsed by default. See
          backend/src/services/rainRuleCalculator.js for the calculation and its real
          accuracy/scope caveats (an approximation inspired by Duckworth-Lewis-Stern, not the
          official licensed DLS algorithm). Mirrors web-app's RainRuleControl.tsx. */}
      <View style={styles.rainRuleWrap}>
        {!rainRuleOpen ? (
          <TouchableOpacity style={styles.rainRuleToggle} onPress={() => setRainRuleOpen(true)}>
            <Text style={styles.rainRuleToggleText}>⛈ Report rain delay / reduce overs</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.rainRuleBox}>
            <View style={styles.rainRuleHeaderRow}>
              <Text style={styles.rainRuleTitle}>Report a stoppage</Text>
              <TouchableOpacity onPress={() => setRainRuleOpen(false)}>
                <Text style={styles.linkButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.rainRuleDisclaimer}>
              Approximate rain-rule estimate (inspired by Duckworth-Lewis-Stern, not the official
              licensed calculation) — enter the new total overs for this chase.
            </Text>

            {rainRuleResult ? (
              <View>
                <Text style={styles.rainRuleResultTitle}>Revised target: {rainRuleResult.target} runs</Text>
                <Text style={styles.mutedSmall}>Par score {rainRuleResult.parScore}.</Text>
              </View>
            ) : (
              <View style={styles.rainRuleInputRow}>
                <TextInput
                  style={styles.rainRuleInput}
                  keyboardType="decimal-pad"
                  value={revisedOversInput}
                  onChangeText={setRevisedOversInput}
                  placeholder="e.g. 40"
                  placeholderTextColor={colors.inkMuted}
                />
                <TouchableOpacity
                  style={[styles.rainRuleApplyButton, rainRuleLoading && styles.buttonDisabled]}
                  disabled={rainRuleLoading}
                  onPress={handleApplyInterruption}
                >
                  <Text style={styles.rainRuleApplyButtonText}>{rainRuleLoading ? 'Applying...' : 'Apply'}</Text>
                </TouchableOpacity>
              </View>
            )}
            {rainRuleError && <Text style={styles.rainRuleErrorText}>{rainRuleError}</Text>}
          </View>
        )}
      </View>

      <View style={styles.playersCard}>
        <View style={styles.playerRow}>
          <Text style={styles.playerName}>{nameFor(strikerId)} *</Text>
          <Text style={styles.playerStat}>
            {strikerStats?.runs ?? 0} ({strikerStats?.ballsFaced ?? 0})
          </Text>
        </View>
        <View style={styles.playerRow}>
          <Text style={styles.playerNameSecondary}>{nameFor(nonStrikerId)}</Text>
          <Text style={styles.playerStat}>
            {nonStrikerStats?.runs ?? 0} ({nonStrikerStats?.ballsFaced ?? 0})
          </Text>
        </View>
        <TouchableOpacity style={styles.linkButton} onPress={handleSwapStrike}>
          <Text style={styles.linkButtonText}>Swap strike</Text>
        </TouchableOpacity>

        <View style={[styles.playerRow, styles.bowlerRow]}>
          <Text style={styles.playerNameSecondary}>Bowling: {nameFor(bowlerId)}</Text>
          <Text style={styles.playerStat}>
            {bowlerStats?.wickets ?? 0}/{bowlerStats?.runsConceded ?? 0} ({(bowlerStats?.overs ?? 0).toFixed(1)})
          </Text>
        </View>
        <TouchableOpacity style={styles.linkButton} onPress={() => setBowlerPickerOpen((v) => !v)}>
          <Text style={styles.linkButtonText}>{bowlerPickerOpen ? 'Cancel change' : 'Change bowler'}</Text>
        </TouchableOpacity>
        {bowlerPickerOpen && (
          <ChipGroup
            options={bowlingRoster.map((p) => ({ id: p.id, label: p.name }))}
            value={bowlerId}
            onChange={(id) => {
              setBowlerId(id);
              setBowlerPickerOpen(false);
            }}
          />
        )}
      </View>

      {/* Live hierarchical-shrinkage tactical read for the current striker vs. current bowler -
          see LiveMatchupPanel. Keyed on ball count so it refetches after every ball recorded. */}
      <LiveMatchupPanel
        matchId={matchId}
        batsmanId={strikerId}
        bowlerId={bowlerId}
        refreshKey={currentBalls.length}
      />

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Runs</Text>
        <View style={styles.runsRow}>
          {[0, 1, 2, 3, 4, 5, 6].map((r) => {
            const selected = pendingType === 'normal' && pendingRuns === r;
            return (
              <TouchableOpacity
                key={r}
                style={[styles.runButton, selected && styles.runButtonSelected]}
                onPress={() => {
                  setPendingType('normal');
                  setPendingRuns(r);
                  if (r === 4 || r === 6) setDetailExpanded(true);
                }}
              >
                <Text style={[styles.runButtonText, selected && styles.runButtonTextSelected]}>{r}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Extras</Text>
        <View style={styles.chipWrap}>
          {EXTRA_TYPES.map((et) => {
            const selected = pendingType === 'extra' && pendingExtraType === et.id;
            return (
              <TouchableOpacity
                key={et.id}
                style={[styles.chip, styles.extraChip, selected && styles.extraChipSelected]}
                onPress={() => {
                  setPendingType('extra');
                  setPendingExtraType(et.id);
                  setPendingExtraRuns(et.id === 'wide' || et.id === 'no-ball' ? 1 : 0);
                }}
              >
                <Text style={[styles.chipLabel, selected && styles.extraChipLabelSelected]}>{et.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {pendingType === 'extra' && (
          <ChipGroup
            label="Total runs on this delivery"
            options={[0, 1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) }))}
            value={String(pendingExtraRuns)}
            onChange={(v) => setPendingExtraRuns(Number(v))}
          />
        )}
      </View>

      <View style={styles.section}>
        <TouchableOpacity onPress={() => setDetailExpanded((v) => !v)}>
          <Text style={styles.linkButtonText}>{detailExpanded ? '- Hide shot detail' : '+ Add shot detail'}</Text>
        </TouchableOpacity>
        {detailExpanded && (
          <View style={styles.detailBox}>
            <ChipGroup
              label="Line"
              options={LINES.map((l) => ({ id: l, label: labelize(l) }))}
              value={line === 'unknown' ? null : line}
              onChange={setLine}
            />
            <ChipGroup
              label="Length"
              options={LENGTHS.map((l) => ({ id: l, label: labelize(l) }))}
              value={length === 'unknown' ? null : length}
              onChange={setLength}
            />
            <ChipGroup
              label="Shot zone"
              options={SHOT_ZONES.map((z) => ({ id: z, label: labelize(z) }))}
              value={shotZone}
              onChange={(v) => setShotZone((prev) => (prev === v ? null : v))}
            />
            <ChipGroup
              label="Shot type"
              options={SHOT_TYPES.map((s) => ({ id: s, label: labelize(s) }))}
              value={shotType}
              onChange={(v) => setShotType((prev) => (prev === v ? null : v))}
            />
          </View>
        )}
      </View>

      {ballError && <Text style={styles.errorTextInline}>{ballError}</Text>}

      <View style={styles.section}>
        <TouchableOpacity style={styles.wicketButton} onPress={openWicketModal}>
          <Text style={styles.wicketButtonText}>Wicket</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.primaryButton, (submitting || pendingType === 'wicket') && styles.buttonDisabled]}
          disabled={submitting || pendingType === 'wicket'}
          onPress={handleRecordNormalOrExtra}
        >
          <Text style={styles.primaryButtonText}>{submitting ? 'Recording...' : 'Record Ball'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={handleEndInnings}>
          <Text style={styles.secondaryButtonText}>End Innings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.dangerOutlineButton, finishing && styles.buttonDisabled]}
          disabled={finishing}
          onPress={handleFinishMatch}
        >
          <Text style={styles.dangerOutlineButtonText}>{finishing ? 'Finishing...' : 'Finish Match'}</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={wicketModalVisible} animationType="slide" transparent onRequestClose={closeWicketModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <Text style={styles.sectionTitle}>Record Wicket</Text>
              <ChipGroup
                label="How out?"
                options={WICKET_TYPES.map((w) => ({ id: w, label: labelize(w) }))}
                value={wicketType}
                onChange={setWicketType}
              />
              <ChipGroup
                label="Line"
                required
                options={LINES.map((l) => ({ id: l, label: labelize(l) }))}
                value={line === 'unknown' ? null : line}
                onChange={setLine}
              />
              <ChipGroup
                label="Length"
                required
                options={LENGTHS.map((l) => ({ id: l, label: labelize(l) }))}
                value={length === 'unknown' ? null : length}
                onChange={setLength}
              />
              {needsFielder && (
                <>
                  <ChipGroup
                    label="Fielder"
                    options={bowlingRoster.map((p) => ({ id: p.id, label: p.name }))}
                    value={fielderId}
                    onChange={setFielderId}
                  />
                  <ChipGroup
                    label="Fielder position"
                    options={FIELDER_POSITIONS.map((z) => ({ id: z, label: labelize(z) }))}
                    value={fielderPosition}
                    onChange={setFielderPosition}
                  />
                </>
              )}
              {availableNewBatsmen.length > 0 ? (
                <ChipGroup
                  label="New batsman"
                  required
                  options={availableNewBatsmen.map((p) => ({ id: p.id, label: p.name }))}
                  value={newBatsmanId}
                  onChange={setNewBatsmanId}
                />
              ) : (
                <Text style={styles.mutedSmall}>
                  No more batsmen available - this will end the innings.
                </Text>
              )}

              {ballError && <Text style={styles.errorTextInline}>{ballError}</Text>}

              <View style={styles.footerRow}>
                <TouchableOpacity style={styles.secondaryButton} onPress={closeWicketModal}>
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.wicketButton, styles.confirmWicketButton, (!canConfirmWicket || submitting) && styles.buttonDisabled]}
                  disabled={!canConfirmWicket || submitting}
                  onPress={handleConfirmWicket}
                >
                  <Text style={styles.wicketButtonText}>{submitting ? 'Recording...' : 'Confirm Wicket'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  muted: { color: colors.inkMuted, textAlign: 'center', fontSize: 13 },
  mutedSmall: { color: colors.inkMuted, fontSize: 12 },
  errorTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 6 },
  errorTextInline: { color: colors.wicket400, fontSize: 13, marginTop: 8, paddingHorizontal: 16 },

  setupContent: { padding: 16, paddingBottom: 48 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginBottom: 10 },
  section: { marginTop: 20, paddingHorizontal: 16 },

  chipGroup: { marginBottom: 16 },
  chipGroupLabel: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 8 },
  requiredMark: { color: colors.wicket400 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.pitch500, borderColor: colors.pitch500 },
  chipLabel: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600' },
  chipLabelSelected: { color: colors.background },
  extraChip: { backgroundColor: colors.surfaceAlt },
  extraChipSelected: { backgroundColor: colors.gold500, borderColor: colors.gold500 },
  extraChipLabelSelected: { color: colors.background },

  primaryButton: {
    backgroundColor: colors.pitch500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: { color: colors.background, fontWeight: '800', fontSize: 15 },
  buttonDisabled: { opacity: 0.4 },

  scoreSummary: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    alignItems: 'center',
  },
  scoreSummaryTeam: { color: colors.inkSecondary, fontSize: 13, fontWeight: '700', marginBottom: 4 },
  scoreSummaryValue: { color: colors.ink, fontSize: 28, fontWeight: '800' },
  scoreSummaryOvers: { color: colors.inkMuted, fontSize: 14, fontWeight: '500' },

  rainRuleWrap: { marginHorizontal: 16, marginBottom: 12 },
  rainRuleToggle: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  rainRuleToggleText: { color: colors.gold400, fontSize: 12, fontWeight: '700' },
  rainRuleBox: {
    backgroundColor: 'rgba(245,166,35,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 12,
    padding: 12,
  },
  rainRuleHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  rainRuleTitle: { color: colors.gold400, fontSize: 13, fontWeight: '700' },
  rainRuleDisclaimer: { color: colors.inkSecondary, fontSize: 11, marginBottom: 8, lineHeight: 15 },
  rainRuleResultTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  rainRuleInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rainRuleInput: {
    width: 90,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
    fontSize: 14,
  },
  rainRuleApplyButton: {
    backgroundColor: colors.gold500,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  rainRuleApplyButtonText: { color: colors.background, fontSize: 12, fontWeight: '700' },
  rainRuleErrorText: { color: colors.wicket400, fontSize: 12, marginTop: 6 },

  playersCard: {
    marginHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
  },
  playerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 4 },
  bowlerRow: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  playerName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  playerNameSecondary: { color: colors.inkSecondary, fontSize: 14, fontWeight: '600' },
  playerStat: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  linkButton: { paddingVertical: 6 },
  linkButtonText: { color: colors.pitch400, fontSize: 12, fontWeight: '700' },

  runsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  runButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runButtonSelected: { backgroundColor: colors.pitch500, borderColor: colors.pitch500 },
  runButtonText: { color: colors.ink, fontSize: 16, fontWeight: '800' },
  runButtonTextSelected: { color: colors.background },

  detailBox: {
    marginTop: 12,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },

  wicketButton: {
    backgroundColor: colors.wicket500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  wicketButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },

  footerRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, marginTop: 16 },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: colors.inkSecondary, fontWeight: '700', fontSize: 13 },
  dangerOutlineButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.wicket500,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)',
  },
  dangerOutlineButtonText: { color: colors.wicket400, fontWeight: '700', fontSize: 13 },
  confirmWicketButton: { flex: 1, marginBottom: 0 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 16,
    maxHeight: '90%',
  },
});
