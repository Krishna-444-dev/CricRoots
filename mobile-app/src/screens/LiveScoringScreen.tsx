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
import { api, scoringLockAPI } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Match, Player, BallEvent, LiveState } from '../shared/types';
import type { MatchesStackParamList } from '../navigation/stacks/MatchesStack';
import LiveMatchupPanel from '../components/LiveMatchupPanel';
import { resolveRefName } from '../shared/utils/resolveRef';
import { computeCanScore, resolveUserId, rosterIds } from '../shared/utils/matchAuth';
import { isLegalDelivery, battingStatsFor, bowlingStatsFor, maidenOversFor } from '../shared/utils/matchStats';

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

// isLegalDelivery/battingStatsFor/bowlingStatsFor/maidenOversFor moved to
// shared/utils/matchStats.ts so MatchDetailScreen's read-only scorecard can reuse the exact
// same figures instead of a second copy.

// Full cross-platform liveState shape - matches web-app's InningsData (BallByBallScoring.tsx)
// and what MatchDetailScreen/AtTheCrease/FieldingPlan already expect to read from
// match.innings[i].liveState (see shared/types/index.ts's LiveState/BatsmanScorecardEntry/
// BowlerScorecardEntry). Built fresh from the ball log on every record-ball call using the
// stats helpers above, rather than tracked as running state, since this screen already
// re-derives everything from match.innings[idx].balls after every ball anyway - merged
// alongside ScoringSnapshot's lighter picks-only fields (this screen's own resume-read only
// looks at those specific keys, so the extra fields here are additive, not a breaking change).
function buildFullLiveState(
  balls: BallEvent[],
  snapshot: ScoringSnapshot,
  battingRoster: UiPlayer[],
  bowlingRoster: UiPlayer[],
  playersById: Map<string, Player>
) {
  const roleFor = (playerId: string): string => playersById.get(playerId)?.specialization ?? 'Batsman';
  const toLiveStatePlayer = (p: UiPlayer) => ({ id: p.id, name: p.name, role: roleFor(p.id) });
  const facedIds = new Set(balls.map((b) => b.batsmanId));
  const outSet = new Set(snapshot.outPlayerIds);

  const battingScorecard = battingRoster.map((p) => {
    const stats = battingStatsFor(balls, p.id);
    const isOut = outSet.has(p.id);
    const wicketBall = isOut ? balls.find((b) => b.isWicket && b.batsmanId === p.id) : undefined;
    return {
      player: toLiveStatePlayer(p),
      runs: stats.runs,
      balls: stats.ballsFaced,
      fours: stats.fours,
      sixes: stats.sixes,
      strikeRate: stats.strikeRate,
      status: isOut ? 'out' : facedIds.has(p.id) ? 'not out' : 'yet to bat',
      outMethod: wicketBall?.wicketType ?? null,
      outBowler: wicketBall ? { id: wicketBall.bowlerId, name: wicketBall.bowlerName ?? 'Bowler', role: roleFor(wicketBall.bowlerId) } : null,
      outFielder: wicketBall?.fielderId ? { id: wicketBall.fielderId, name: wicketBall.fielderName ?? 'Fielder', role: 'Fielder' } : null,
    };
  });

  const bowlingScorecard = bowlingRoster.map((p) => {
    const stats = bowlingStatsFor(balls, p.id);
    const legalInCurrentOver = stats.legalBalls % 6;
    return {
      player: toLiveStatePlayer(p),
      overs: Math.floor(stats.legalBalls / 6),
      balls: legalInCurrentOver,
      maidens: maidenOversFor(balls, p.id),
      runs: stats.runsConceded,
      wickets: stats.wickets,
      economy: stats.economy,
    };
  });

  const strikerPlayer = battingRoster.find((p) => p.id === snapshot.strikerId);
  const nonStrikerPlayer = battingRoster.find((p) => p.id === snapshot.nonStrikerId);
  const bowlerPlayer = bowlingRoster.find((p) => p.id === snapshot.bowlerId);

  return {
    currentBatsmen: [
      strikerPlayer ? toLiveStatePlayer(strikerPlayer) : null,
      nonStrikerPlayer ? toLiveStatePlayer(nonStrikerPlayer) : null,
    ],
    currentBowler: bowlerPlayer ? toLiveStatePlayer(bowlerPlayer) : null,
    battingScorecard,
    bowlingScorecard,
  };
}

// Broadened scoring authorization now lives in shared/utils/matchAuth.ts (computeCanScore) -
// MatchDetailScreen.tsx needs the identical check for its "Score this match" button, and having
// each screen keep its own independent copy is exactly what let that button stay creator-only
// after this screen's own check was broadened.

// Persisted verbatim to match.innings[i].liveState on every record-ball call (see
// api.matches.recordBall's comment) so a resumed session - this device later, or a different
// scorer/umpire after a dropped session - can rehydrate instead of restarting the innings setup
// from scratch. Deliberately lighter than web's InningsData snapshot: mobile always re-fetches
// `match` (and therefore match.innings[idx].balls) after every ball, so batting/bowling figures
// are already derived fresh from the server rather than tracked twice - only the picks that
// live purely in local state need to round-trip.
interface ScoringSnapshot {
  battingTeamId: string;
  strikerId: string;
  nonStrikerId: string;
  bowlerId: string;
  outPlayerIds: string[];
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
  // GET /matches/:id's `powerplayOvers` is a top-level sibling of `match`, not part of the
  // match document itself - see matchesAPI.getMatchById's comment.
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    Promise.all([api.matches.getMatchById(matchId), api.players.getPlayers()])
      .then(([matchRes, playersRes]) => {
        const m: Match = matchRes.match;
        setMatch(m);
        setPowerplayOvers(matchRes.powerplayOvers ?? null);
        const map = new Map<string, Player>();
        (playersRes.players as Player[]).forEach((p) => map.set(p._id, p));
        setPlayersById(map);

        // Resume scoring in progress instead of always restarting from "Start Innings" - a
        // previous scorer's session may have ended abruptly (phone died, app closed) without
        // finishing the innings, and re-picking striker/non-striker/bowler from scratch would
        // both lose who's actually on strike right now and risk duplicate/conflicting ball
        // numbers once new balls are recorded. Mirrors web-app/app/match/[id]/score/page.tsx.
        const idx: 0 | 1 = (m.innings[1]?.balls?.length ?? 0) > 0 ? 1 : 0;
        // The persisted object is ScoringSnapshot's fields merged with the full cross-platform
        // LiveState shape (see buildFullLiveState) - only the ScoringSnapshot fields matter here.
        // Cast through unknown since Innings.liveState's static type (LiveState) and
        // ScoringSnapshot don't share required fields, even though the real object has both.
        const saved = m.innings[idx]?.liveState as unknown as (ScoringSnapshot & Partial<LiveState>) | null | undefined;
        if (saved) {
          setInningsIndex(idx);
          setBattingTeamId(saved.battingTeamId);
          setStrikerId(saved.strikerId);
          setNonStrikerId(saved.nonStrikerId);
          setBowlerId(saved.bowlerId);
          setOutPlayerIds(new Set(saved.outPlayerIds));
          setInningsStarted(true);
        }
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

  // --- "Who bowls next over" prompt - nothing previously let the scorer change bowler after
  // an over completed; currentBowler just stayed whoever was picked at Start Innings for the
  // whole match. The just-completed ball is recorded immediately with its correct (outgoing)
  // bowler; only the FOLLOWING ball needs the newly-picked one, so scoring stays blocked until
  // this modal is confirmed. Mirrors web-app/components/scoring/BallByBallScoring.tsx's
  // showBowlerModal/pendingOverChange/handleConfirmNextBowler. ---
  const [overCompleteModalVisible, setOverCompleteModalVisible] = useState(false);
  const [justFinishedBowlerId, setJustFinishedBowlerId] = useState<string | null>(null);
  const [nextBowlerId, setNextBowlerId] = useState<string | null>(null);

  // --- Full scorecard (all players' batting/bowling figures for this innings, not just the
  // two current batsmen and current bowler) - toggled inline rather than a separate screen. ---
  const [scorecardOpen, setScorecardOpen] = useState(false);

  // --- Umpire management (match creator only) ---
  const [umpirePickerOpen, setUmpirePickerOpen] = useState(false);
  const [umpireActionLoading, setUmpireActionLoading] = useState(false);
  const [umpireError, setUmpireError] = useState<string | null>(null);

  // --- Pending ball being built ---
  const [pendingType, setPendingType] = useState<'normal' | 'extra' | 'wicket'>('normal');
  const [pendingRuns, setPendingRuns] = useState(0);
  const [pendingExtraType, setPendingExtraType] = useState<BallEvent['extraType']>('wide');
  // Always "additional runs beyond the automatic 1" for wide/no-ball (see handleRecordNormalOrExtra),
  // and the plain total for bye/leg-bye/penalty - defaulting to 0 for both cases.
  const [pendingExtraRuns, setPendingExtraRuns] = useState(0);
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

  // Computed fresh every render (not a hook) so it's safe to use both above and below this
  // screen's early-return guards further down.
  const { isOwner, canScore } = computeCanScore(match, user?.id, Array.from(playersById.values()));

  // --- Single active scorer lock - opening scoring up to every rostered player plus umpires
  // means two people could otherwise submit conflicting balls simultaneously. Claim the lock as
  // soon as this user is known to be allowed to score, renew it periodically while this screen
  // stays open, and release it on the way out. A held-but-abandoned lock expires server-side on
  // its own, so a dropped session can't block the match indefinitely - that's what makes this
  // safe to combine with the resume-scoring feature above. Depends on match._id/status rather
  // than the whole `match` object because `match` is replaced after every single ball recorded
  // (see handleRecordNormalOrExtra/handleConfirmWicket) - depending on the object itself would
  // re-claim the lock, and briefly flash the "checking scoring status" screen, after every ball. ---
  const [lockState, setLockState] = useState<'idle' | 'acquiring' | 'held' | 'locked'>('idle');
  const [lockedByName, setLockedByName] = useState<string | null>(null);

  useEffect(() => {
    if (!match || !canScore || match.status === 'Completed' || match.status === 'Cancelled') return;
    const currentMatchId = match._id;
    let cancelled = false;

    const claim = async () => {
      setLockState((prev) => (prev === 'held' ? prev : 'acquiring'));
      try {
        const res = await scoringLockAPI.acquire(currentMatchId);
        if (cancelled) return;
        if (res.success) {
          setLockState('held');
          setLockedByName(null);
        } else {
          setLockState('locked');
          setLockedByName(res.activeScorer?.name ?? null);
        }
      } catch {
        if (!cancelled) setLockState('locked');
      }
    };

    claim();
    // Renew while held, and keep retrying while locked-by-someone-else in case they finish.
    const interval = setInterval(claim, 30000);

    return () => {
      cancelled = true;
      clearInterval(interval);
      scoringLockAPI.release(currentMatchId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?._id, match?.status, canScore]);

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

  // Candidate list for umpire appointment - every distinct user behind a registered Player,
  // minus whoever's already an umpire. There's no general "list all users" endpoint, so this
  // reuses the same players registry (api.players.getPlayers()) this screen already loads for
  // roster lookups, same as how striker/bowler pickers are built from it.
  const umpireCandidates = useMemo(() => {
    const existing = new Set((match?.umpires || []).map((u) => resolveUserId(u)).filter((id): id is string => !!id));
    const seen = new Set<string>();
    const list: { id: string; label: string }[] = [];
    playersById.forEach((p) => {
      const uid = resolveUserId(p.user);
      if (!uid || seen.has(uid) || existing.has(uid)) return;
      seen.add(uid);
      list.push({ id: uid, label: resolveRefName(p.user, 'Player') });
    });
    return list;
  }, [match, playersById]);

  async function handleAddUmpire(userId: string) {
    if (!match || umpireActionLoading) return;
    setUmpireActionLoading(true);
    setUmpireError(null);
    try {
      const res = await api.matches.addUmpire(match._id, userId);
      if (res.match) setMatch(res.match);
      else load();
      setUmpirePickerOpen(false);
    } catch (e) {
      setUmpireError(e instanceof Error ? e.message : 'Could not appoint umpire');
    } finally {
      setUmpireActionLoading(false);
    }
  }

  async function handleRemoveUmpire(userId: string) {
    if (!match || umpireActionLoading) return;
    setUmpireActionLoading(true);
    setUmpireError(null);
    try {
      const res = await api.matches.removeUmpire(match._id, userId);
      if (res.match) setMatch(res.match);
      else load();
    } catch (e) {
      setUmpireError(e instanceof Error ? e.message : 'Could not remove umpire');
    } finally {
      setUmpireActionLoading(false);
    }
  }

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
    setPendingExtraRuns(0);
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

  async function handleRecordNormalOrExtra() {
    if (!match || !strikerId || !nonStrikerId || !bowlerId || submitting) return;
    setSubmitting(true);
    setBallError(null);

    const isExtra = pendingType === 'extra';
    const extraType: BallEvent['extraType'] = isExtra ? pendingExtraType : 'none';
    const isWideOrNoBall = isExtra && (extraType === 'wide' || extraType === 'no-ball');
    // A wide/no-ball always carries its automatic 1-run penalty even when nothing else happened
    // on the delivery - pendingExtraRuns is "additional runs beyond that 1" for those two extra
    // types (see the extras ChipGroup below), so it must never be used as the total by itself.
    const runs = pendingType === 'normal' ? pendingRuns : isWideOrNoBall ? 1 + pendingExtraRuns : pendingExtraRuns;
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

    const rotates = overCompletes || (!isWideExtra && runs % 2 === 1);
    const nextStrikerId = rotates ? nonStrikerId : strikerId;
    const nextNonStrikerId = rotates ? strikerId : nonStrikerId;
    // liveState rides along so another scorer/device can resume this exact innings if this
    // session drops - see ScoringSnapshot's comment and api.matches.recordBall's. Built from
    // currentBalls + this ballEvent (not just currentBalls) so the persisted scorecards already
    // reflect this delivery, matching the innings.runs/overs the backend computes by appending
    // the same ball server-side.
    const snapshot: ScoringSnapshot = {
      battingTeamId: battingTeamId!,
      strikerId: nextStrikerId,
      nonStrikerId: nextNonStrikerId,
      bowlerId,
      outPlayerIds: Array.from(outPlayerIds),
    };
    const liveState = {
      ...snapshot,
      ...buildFullLiveState([...currentBalls, ballEvent], snapshot, battingRoster, bowlingRoster, playersById),
    };

    try {
      const res = await api.matches.recordBall(matchId, { inningsIndex, ...ballEvent, liveState });
      setMatch(res.match);
      setStrikerId(nextStrikerId);
      setNonStrikerId(nextNonStrikerId);
      if (overCompletes) {
        setJustFinishedBowlerId(bowlerId);
        setNextBowlerId(null);
        setOverCompleteModalVisible(true);
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

    const nextOutPlayerIds = new Set(outPlayerIds).add(strikerId);
    let nextStrikerId = strikerId;
    let nextNonStrikerId = nonStrikerId;
    if (newBatsmanId) {
      if (overCompletes) {
        nextStrikerId = nonStrikerId;
        nextNonStrikerId = newBatsmanId;
      } else {
        nextStrikerId = newBatsmanId;
      }
    }
    const snapshot: ScoringSnapshot = {
      battingTeamId: battingTeamId!,
      strikerId: nextStrikerId,
      nonStrikerId: nextNonStrikerId,
      bowlerId,
      outPlayerIds: Array.from(nextOutPlayerIds),
    };
    const liveState = {
      ...snapshot,
      ...buildFullLiveState([...currentBalls, ballEvent], snapshot, battingRoster, bowlingRoster, playersById),
    };

    try {
      const res = await api.matches.recordBall(matchId, { inningsIndex, ...ballEvent, liveState });
      setMatch(res.match);
      setOutPlayerIds(nextOutPlayerIds);
      setStrikerId(nextStrikerId);
      setNonStrikerId(nextNonStrikerId);

      // Only prompt for a next bowler if the innings is actually continuing - if this wicket
      // left no batsmen available, availableNewBatsmen.length was already 0 and newBatsmanId
      // stayed null (canConfirmWicket allows confirming without one in that case), so there's
      // no next over to bowl.
      if (overCompletes && newBatsmanId) {
        setJustFinishedBowlerId(bowlerId);
        setNextBowlerId(null);
        setOverCompleteModalVisible(true);
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

  if (!canScore) {
    const creatorName = resolveRefName(match.createdBy, 'its creator');
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Not authorized</Text>
        <Text style={styles.muted}>
          Only players from {teamNameOf(match.team1)} or {teamNameOf(match.team2)}, an appointed
          umpire, or {creatorName} (who created this match) can score it.
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

  if (lockState === 'idle' || lockState === 'acquiring') {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} />
        <Text style={[styles.muted, { marginTop: 10 }]}>Checking scoring status...</Text>
      </View>
    );
  }

  if (lockState === 'locked') {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorTitle}>Match is being scored</Text>
        <Text style={styles.muted}>
          {lockedByName ?? 'Someone'} is currently scoring this match. Only one person can score at
          a time - this will unlock automatically if their session goes idle, or check back once
          they&apos;re done.
        </Text>
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
        {powerplayOvers != null && (innings?.overs ?? 0) < powerplayOvers && (
          <View style={styles.powerplayBadge}>
            <Text style={styles.powerplayBadgeText}>⚡ Powerplay - overs 1-{powerplayOvers}</Text>
          </View>
        )}
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
                  // Always 0 here - for wide/no-ball this means "no additional runs beyond the
                  // automatic 1" (added in handleRecordNormalOrExtra), not "0 runs total".
                  setPendingExtraRuns(0);
                }}
              >
                <Text style={[styles.chipLabel, selected && styles.extraChipLabelSelected]}>{et.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {pendingType === 'extra' && (
          <>
            <ChipGroup
              label={
                pendingExtraType === 'wide' || pendingExtraType === 'no-ball'
                  ? 'Additional runs (plus automatic 1)'
                  : 'Total runs on this delivery'
              }
              options={[0, 1, 2, 3, 4].map((n) => ({ id: String(n), label: String(n) }))}
              value={String(pendingExtraRuns)}
              onChange={(v) => setPendingExtraRuns(Number(v))}
            />
            {(pendingExtraType === 'wide' || pendingExtraType === 'no-ball') && (
              <Text style={styles.mutedSmall}>
                = {1 + pendingExtraRuns} run{1 + pendingExtraRuns === 1 ? '' : 's'} total
              </Text>
            )}
          </>
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
        <TouchableOpacity
          style={[styles.wicketButton, overCompleteModalVisible && styles.buttonDisabled]}
          disabled={overCompleteModalVisible}
          onPress={openWicketModal}
        >
          <Text style={styles.wicketButtonText}>Wicket</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.primaryButton,
            (submitting || pendingType === 'wicket' || overCompleteModalVisible) && styles.buttonDisabled,
          ]}
          disabled={submitting || pendingType === 'wicket' || overCompleteModalVisible}
          onPress={handleRecordNormalOrExtra}
        >
          <Text style={styles.primaryButtonText}>{submitting ? 'Recording...' : 'Record Ball'}</Text>
        </TouchableOpacity>
      </View>

      {/* Full batting/bowling scorecard for this innings - everyone's figures, not just the two
          current batsmen and current bowler. Pure display over data already derived from
          match.innings[idx].balls, no extra API call. Mirrors web-app's ScorecardView.tsx. */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.scorecardToggle} onPress={() => setScorecardOpen((v) => !v)}>
          <Text style={styles.scorecardToggleText}>{scorecardOpen ? '▼' : '▶'} Full Scorecard</Text>
        </TouchableOpacity>
        {scorecardOpen && (
          <View style={styles.scorecardBox}>
            <Text style={styles.scorecardSectionTitle}>Batting</Text>
            {battingRoster.map((p) => {
              const stats = battingStatsFor(currentBalls, p.id);
              const isBatting = p.id === strikerId || p.id === nonStrikerId;
              const isOut = outPlayerIds.has(p.id);
              const yetToBat = !isBatting && !isOut && stats.ballsFaced === 0;
              return (
                <View key={p.id} style={styles.scorecardRow}>
                  <Text style={[styles.scorecardName, isBatting && styles.scorecardNameCurrent]}>
                    {p.name}
                    {p.id === strikerId ? ' *' : ''}
                  </Text>
                  <Text style={styles.scorecardStat}>
                    {yetToBat
                      ? 'yet to bat'
                      : `${stats.runs} (${stats.ballsFaced}) 4s:${stats.fours} 6s:${stats.sixes} SR:${stats.strikeRate.toFixed(1)}`}
                  </Text>
                </View>
              );
            })}
            <Text style={[styles.scorecardSectionTitle, { marginTop: 12 }]}>Bowling</Text>
            {bowlingRoster
              .filter((p) => currentBalls.some((b) => b.bowlerId === p.id))
              .map((p) => {
                const stats = bowlingStatsFor(currentBalls, p.id);
                const maidens = maidenOversFor(currentBalls, p.id);
                return (
                  <View key={p.id} style={styles.scorecardRow}>
                    <Text style={[styles.scorecardName, p.id === bowlerId && styles.scorecardNameCurrent]}>
                      {p.name}
                    </Text>
                    <Text style={styles.scorecardStat}>
                      {stats.overs.toFixed(1)}-{maidens}-{stats.runsConceded}-{stats.wickets} (Econ{' '}
                      {stats.economy.toFixed(2)})
                    </Text>
                  </View>
                );
              })}
          </View>
        )}
      </View>

      {/* Umpire appointment - creator-only. Umpires get full scoring rights (see canScore)
          without needing to be on either team's roster. */}
      {isOwner && (
        <View style={styles.section}>
          <View style={styles.umpireHeaderRow}>
            <Text style={styles.sectionTitle}>Umpires</Text>
            <TouchableOpacity onPress={() => setUmpirePickerOpen((v) => !v)}>
              <Text style={styles.linkButtonText}>{umpirePickerOpen ? 'Cancel' : '+ Add umpire'}</Text>
            </TouchableOpacity>
          </View>
          {match.umpires && match.umpires.length > 0 ? (
            match.umpires.map((u) => {
              const uid = resolveUserId(u);
              const uname = resolveRefName(u, 'Umpire');
              return (
                <View key={uid ?? uname} style={styles.playerRow}>
                  <Text style={styles.playerNameSecondary}>{uname}</Text>
                  <TouchableOpacity disabled={umpireActionLoading || !uid} onPress={() => uid && handleRemoveUmpire(uid)}>
                    <Text style={styles.linkButtonText}>Remove</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          ) : (
            <Text style={styles.mutedSmall}>No umpires appointed.</Text>
          )}
          {umpirePickerOpen && (
            <ChipGroup
              options={umpireCandidates}
              value={null}
              onChange={handleAddUmpire}
              emptyLabel="No other registered users available to appoint."
            />
          )}
          {umpireError && <Text style={styles.errorTextInline}>{umpireError}</Text>}
        </View>
      )}

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

      <Modal visible={overCompleteModalVisible} animationType="slide" transparent onRequestClose={() => {}}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.sectionTitle}>Over complete</Text>
            <Text style={styles.mutedSmall}>Who&apos;s bowling the next over?</Text>
            <ChipGroup
              options={bowlingRoster
                .filter((p) => p.id !== justFinishedBowlerId)
                .map((p) => ({ id: p.id, label: p.name }))}
              value={nextBowlerId}
              onChange={setNextBowlerId}
            />
            <TouchableOpacity
              style={[styles.primaryButton, !nextBowlerId && styles.buttonDisabled]}
              disabled={!nextBowlerId}
              onPress={() => {
                if (!nextBowlerId) return;
                setBowlerId(nextBowlerId);
                setOverCompleteModalVisible(false);
                setJustFinishedBowlerId(null);
                setNextBowlerId(null);
              }}
            >
              <Text style={styles.primaryButtonText}>Confirm Bowler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

  powerplayBadge: {
    marginTop: 8,
    alignSelf: 'center',
    backgroundColor: 'rgba(245,166,35,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,166,35,0.3)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  powerplayBadgeText: { color: colors.gold400, fontSize: 11, fontWeight: '700' },

  scorecardToggle: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  scorecardToggleText: { color: colors.pitch400, fontSize: 13, fontWeight: '700' },
  scorecardBox: {
    marginTop: 8,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
  },
  scorecardSectionTitle: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 6,
  },
  scorecardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    gap: 8,
  },
  scorecardName: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  scorecardNameCurrent: { color: colors.ink, fontWeight: '800' },
  scorecardStat: { color: colors.inkSecondary, fontSize: 12, fontWeight: '600' },

  umpireHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
});
