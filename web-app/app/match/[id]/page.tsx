'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Badge from '@/components/ui/Badge';
import AITacticalAdvisor from '@/components/AITacticalAdvisor';
import ManhattanChart from '@/components/insights/ManhattanChart';
import WormChart from '@/components/insights/WormChart';
import ExtrasChart from '@/components/insights/ExtrasChart';
import RunsTypeChart from '@/components/insights/RunsTypeChart';
import FieldingPlan from '@/components/insights/FieldingPlan';
import PredictionWidget from '@/components/match/PredictionWidget';
import { battingStatsFor, bowlingStatsFor, dismissalFor, maidenOversFor, battingBowlingOrder, overByOver } from '@/lib/matchStats';
import styles from './page.module.css';

interface Partnership {
  batsmen: string[];
  runs: number;
  balls: number;
  outBatsmanId: string | null;
}

interface ChartInnings {
  team: { _id: string; name: string } | string | null;
  overs: { over: number; runs: number; wickets: number }[];
  cumulative: { over: number; total: number }[];
  extrasBreakdown: { type: string; runs: number }[];
  runsTypeBreakdown: { runs: string; count: number }[];
  partnerships: Partnership[];
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

interface Ball {
  ballNumber: number;
  batsmanId?: string;
  bowlerId?: string;
  fielderId?: string;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: string;
  commentary?: string;
}

interface ScoreboardPlayer {
  id: string;
  name: string;
  role: string;
}

interface BatsmanScorecardEntry {
  player: ScoreboardPlayer;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  status: string;
}

interface BowlerScorecardEntry {
  player: ScoreboardPlayer;
  overs: number;
  balls: number;
  runs: number;
  wickets: number;
  economy: number;
}

// Snapshot of who's currently batting/bowling and their live figures - saved by the scorer's
// client on every ball (see innings.liveState in the backend Match model) so this can be
// shown here without a separate endpoint. Absent on older matches scored before this existed,
// or if the current innings hasn't started yet - the Full Scorecard tab below doesn't depend on
// this at all, it's computed fresh from balls (see lib/matchStats.ts) so it works regardless.
interface LiveState {
  currentBatsmen: [ScoreboardPlayer | null, ScoreboardPlayer | null];
  currentBowler: ScoreboardPlayer | null;
  battingScorecard: BatsmanScorecardEntry[];
  bowlingScorecard: BowlerScorecardEntry[];
}

interface Interruption {
  revisedOvers: number;
  oversBowledAtInterruption: number;
  wicketsLostAtInterruption: number;
  resourcePercentRemaining: number;
  parScore: number;
  target: number;
  appliedAt: string;
}

interface Match {
  _id: string;
  title: string;
  // Nullable - a small number of old test matches have orphaned team refs (a Team document
  // that no longer exists); every usage below must fall back gracefully rather than crash.
  team1: { _id: string; name: string } | null;
  team2: { _id: string; name: string } | null;
  status: string;
  venue: string;
  matchType: string;
  totalOvers?: number;
  interruption?: Interruption | null;
  innings: Array<{
    team: string;
    runs: number;
    wickets: number;
    overs: number;
    balls: Ball[];
    liveState?: LiveState | null;
  }>;
  manOfTheMatch?: { _id: string; user?: { name?: string } } | null;
  toss?: { winningTeam: { _id: string; name: string } | null; decision: string | null } | null;
  summary?: string;
  createdBy?: { _id: string; name: string };
  umpires?: ({ _id: string; name: string } | string)[];
  documents?: { _id: string; url: string; fileName: string; category: string; uploadedAt: string }[];
  photos?: { _id: string; url: string; caption: string; uploadedBy?: { _id: string; name: string } | string; uploadedAt: string }[];
}

// Shape returned by GET /api/teams/:id (see TEAM_POPULATE_FIELDS in teamController.js) - a
// fully populated roster for the Squads section below, distinct from Match['team1']/team2'
// above which only carry _id/name.
interface SquadPlayer {
  _id: string;
  user?: { name?: string };
  specialization: string;
  profilePicture?: string;
}

interface SquadTeam {
  _id: string;
  name: string;
  captain?: SquadPlayer | null;
  viceCaptain?: SquadPlayer | null;
  players: SquadPlayer[];
}

interface PlayerDirectoryEntry {
  _id: string;
  user?: { _id: string; name?: string } | string;
}

interface UserOption {
  userId: string;
  name: string;
}

/** All players in this match's directory that appear as a batsman or bowler on any ball -
 * the roster for the "Player Performance Reports" links below. Derived from ball data rather
 * than team.players (which isn't reliably populated with real rosters in this codebase yet)
 * so every player who actually appeared in the match gets a link, not just whoever was added
 * to the team via the separate add-player flow. */
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

/** Over.ball notation, derived the same filtered-legal-balls way the backend computes overs -
 * wides/no-balls don't advance the over count, so this can't be derived from array index alone. */
function overBallLabel(balls: Ball[], index: number): string {
  let legalCount = 0;
  for (let i = 0; i <= index; i++) {
    const b = balls[i];
    const isLegal = !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType));
    if (i === index) {
      const over = Math.floor(legalCount / 6);
      const ballInOver = isLegal ? (legalCount % 6) + 1 : (legalCount % 6);
      return `${over}.${Math.max(ballInOver, 1)}`;
    }
    if (isLegal) legalCount += 1;
  }
  return '';
}

type TabKey = 'info' | 'ball-by-ball' | 'scorecard' | 'over-by-over' | 'charts' | 'mvp' | 'gallery' | 'ai-insights';

interface MVPEntry {
  playerId: string;
  points: number;
}

type MatchPhoto = NonNullable<Match['photos']>[number];

// Player.profilePicture defaults to the literal string 'no-photo.jpg' (see
// backend/src/models/Player.js), not a real URL - mirrors TournamentManager.tsx's PlayerAvatar
// fallback-to-initials pattern for the Squads section below.
function SquadAvatar({ player }: { player: SquadPlayer }) {
  const name = player.user?.name || '';
  const hasRealPhoto = !!player.profilePicture && player.profilePicture !== 'no-photo.jpg';
  const initials = name.split(' ').map((p) => p.charAt(0)).join('').toUpperCase().slice(0, 2) || '?';
  if (hasRealPhoto) {
    return <img src={player.profilePicture} alt={name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />;
  }
  return (
    <div className="w-9 h-9 rounded-full bg-surface-alt border border-border-strong text-ink-secondary flex items-center justify-center text-xs font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

const SQUAD_PREVIEW_COUNT = 5;

export default function MatchPage() {
  const params = useParams();
  const router = useRouter();
  const matchId = params.id as string;
  const { user, token } = useAuth();

  const [match, setMatch] = useState<Match | null>(null);
  const [powerplayOvers, setPowerplayOvers] = useState<number | null>(null);
  const [chartsInnings, setChartsInnings] = useState<ChartInnings[]>([]);
  const [keyMoments, setKeyMoments] = useState<KeyMoment[]>([]);
  const [mvpRanking, setMvpRanking] = useState<MVPEntry[]>([]);
  // MVP list collapses to the top few by default, same "Show all" toggle pattern the Tournament
  // Manager's Awards tab uses for its Top Performers lists (see TournamentManager.tsx).
  const [showAllMvp, setShowAllMvp] = useState(false);
  const [playerDirectory, setPlayerDirectory] = useState<Map<string, string>>(new Map());
  const [userOptions, setUserOptions] = useState<UserOption[]>([]);
  const [umpireToAdd, setUmpireToAdd] = useState('');
  const [umpireBusy, setUmpireBusy] = useState(false);
  const [umpireError, setUmpireError] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState('');
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');
  const docFileInputRef = React.useRef<HTMLInputElement>(null);
  // Gallery tab - same upload pattern as Match Documents above (multipart POST, refetch on
  // success), plus a lightbox for viewing a photo full-size (null = closed).
  const [photoCaption, setPhotoCaption] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState('');
  const photoFileInputRef = React.useRef<HTMLInputElement>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<MatchPhoto | null>(null);
  // Squads - both teams' full rosters, fetched once the Info tab (default tab) has real team
  // ids to fetch. Not part of the fetchMatch poll loop - a roster doesn't change on the same
  // 10s cadence live scoring does.
  const [squadTeams, setSquadTeams] = useState<{ team1: SquadTeam | null; team2: SquadTeam | null }>({ team1: null, team2: null });
  const [squadsLoading, setSquadsLoading] = useState(false);
  const [squadsExpanded, setSquadsExpanded] = useState({ team1: false, team2: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // CricClubs-style tabbed match center - Info / Ball By Ball / Full Scorecard / Over by Over /
  // Charts, plus our own AI Insights tab (not something CricClubs has). Defaults to Info so a
  // freshly-opened match leads with context (toss, MVP, live snapshot) rather than dumping
  // straight into a wall of ball-by-ball detail.
  const [activeTab, setActiveTab] = useState<TabKey>('info');
  // Which innings' commentary/scorecard/over-by-over is showing. Auto-follows whichever innings
  // is currently being bowled across every poll, until the viewer manually picks a side - then
  // it stops following, the same way a chat view stops auto-scrolling once you scroll up
  // yourself. Commentary is stored per-ball in the DB and never deleted, so both innings' full
  // detail stays viewable forever, not just while live.
  const [selectedInningsIdx, setSelectedInningsIdx] = useState<0 | 1>(0);
  const [followCurrentInnings, setFollowCurrentInnings] = useState(true);
  useEffect(() => {
    if (!match || !followCurrentInnings) return;
    setSelectedInningsIdx((match.innings[1]?.balls?.length ?? 0) > 0 ? 1 : 0);
  }, [match, followCurrentInnings]);

  useEffect(() => {
    fetchMatch();
    fetchCharts();
    fetchKeyMoments();
    fetchMvp();
    fetchPlayerDirectory();
    const interval = setInterval(() => {
      fetchMatch();
      fetchCharts();
      fetchKeyMoments();
      fetchMvp();
    }, 10000);
    return () => clearInterval(interval);
  }, [matchId]);

  // Squads section - GET /api/teams/:id per side, gated on team1/team2 actually being present
  // (a handful of old test matches have orphaned team refs, see the Match interface above) so
  // this never fetches a roster for a null team id. Keyed on the team ids rather than `match`
  // itself so the 10s match poll above doesn't re-fetch both rosters every cycle.
  const team1Id = match?.team1?._id;
  const team2Id = match?.team2?._id;
  useEffect(() => {
    if (!team1Id && !team2Id) return;
    setSquadsLoading(true);
    Promise.all([
      team1Id ? fetch(`/api/teams/${team1Id}`).then((r) => r.json()) : Promise.resolve(null),
      team2Id ? fetch(`/api/teams/${team2Id}`).then((r) => r.json()) : Promise.resolve(null),
    ])
      .then(([d1, d2]) => {
        setSquadTeams({
          team1: d1?.success ? d1.team : null,
          team2: d2?.success ? d2.team : null,
        });
      })
      .catch((err) => console.error(err))
      .finally(() => setSquadsLoading(false));
  }, [team1Id, team2Id]);

  // Names for the batsman/bowler IDs recorded on each ball - GET /api/players is the one
  // endpoint that populates the player -> user name relationship, unlike the team roster
  // endpoints (see playersWhoAppeared above), so it's fetched once here for the "Player
  // Performance Reports" links below.
  const fetchPlayerDirectory = async () => {
    try {
      const response = await fetch('/api/players');
      const data = await response.json();
      if (data.success) {
        const entries: PlayerDirectoryEntry[] = data.players;
        const map = new Map<string, string>();
        const userMap = new Map<string, string>();
        for (const p of entries) {
          if (typeof p.user === 'string' || !p.user) continue;
          if (p.user.name) map.set(p._id, p.user.name);
          if (p.user.name) userMap.set(p.user._id, p.user.name);
        }
        setPlayerDirectory(map);
        setUserOptions([...userMap.entries()].map(([userId, name]) => ({ userId, name })).sort((a, b) => a.name.localeCompare(b.name)));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();

      if (data.success) {
        setMatch(data.match);
        setPowerplayOvers(data.powerplayOvers ?? null);
        setError(null);
      } else {
        setError('Failed to fetch match');
      }
    } catch (err) {
      setError('Error fetching match data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCharts = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/charts`);
      const data = await response.json();
      if (data.success) {
        setChartsInnings(data.innings);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMvp = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/mvp`);
      const data = await response.json();
      if (data.success) {
        setMvpRanking(data.mvp);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchKeyMoments = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}/key-moments`);
      const data = await response.json();
      // Not every match has enough of a chase yet (or is a Test match) - a failure response
      // here just means "nothing to show", not an error worth surfacing to the user.
      setKeyMoments(data.success ? data.keyMoments : []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddUmpire = async () => {
    if (!umpireToAdd || umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      const res = await apiFetch(`/api/matches/${matchId}/umpires`, {
        method: 'POST',
        body: JSON.stringify({ userId: umpireToAdd }),
      });
      const data = await res.json();
      if (data.success) {
        setUmpireToAdd('');
        fetchMatch();
      } else {
        setUmpireError(data.message || 'Could not add umpire');
      }
    } finally {
      setUmpireBusy(false);
    }
  };

  const handleRemoveUmpire = async (userId: string) => {
    if (umpireBusy) return;
    setUmpireBusy(true);
    setUmpireError(null);
    try {
      const res = await apiFetch(`/api/matches/${matchId}/umpires/${userId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchMatch();
      } else {
        setUmpireError(data.message || 'Could not remove umpire');
      }
    } finally {
      setUmpireBusy(false);
    }
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    setDocUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('category', uploadCategory.trim() || 'General');
      const res = await fetch(`/api/matches/${matchId}/documents`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchMatch();
        setUploadCategory('');
      } else {
        setDocUploadError(data.message || 'Upload failed');
      }
    } catch {
      setDocUploadError('Could not reach the CricRoots server');
    } finally {
      setUploadingDoc(false);
      if (docFileInputRef.current) docFileInputRef.current.value = '';
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    setDocUploadError('');
    try {
      const res = await apiFetch(`/api/matches/${matchId}/documents/${documentId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchMatch();
      } else {
        setDocUploadError(data.message || 'Could not remove document');
      }
    } catch {
      setDocUploadError('Could not reach the CricRoots server');
    }
  };

  const handleUploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoUploadError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caption', photoCaption.trim());
      const res = await fetch(`/api/matches/${matchId}/photos`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        fetchMatch();
        setPhotoCaption('');
      } else {
        setPhotoUploadError(data.message || 'Upload failed');
      }
    } catch {
      setPhotoUploadError('Could not reach the CricRoots server');
    } finally {
      setUploadingPhoto(false);
      if (photoFileInputRef.current) photoFileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    setPhotoUploadError('');
    try {
      const res = await apiFetch(`/api/matches/${matchId}/photos/${photoId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setLightboxPhoto((prev) => (prev?._id === photoId ? null : prev));
        fetchMatch();
      } else {
        setPhotoUploadError(data.message || 'Could not remove photo');
      }
    } catch {
      setPhotoUploadError('Could not reach the CricRoots server');
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingSpinner}>
          <div className={styles.spinner}></div>
          <p>Loading match details...</p>
        </div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <p className={styles.errorText}>{error || 'Match not found'}</p>
        </div>
      </div>
    );
  }

  // A Live match sits in its first innings until the second one actually has balls -
  // match.status alone can't tell those apart.
  const currentInnings = match.innings[(match.innings[1]?.balls?.length ?? 0) > 0 ? 1 : 0];
  const targetScore = match.interruption ? match.interruption.target : (match.innings[0]?.runs || 0);
  const nameFor = (id: string | null | undefined) => (id ? playerDirectory.get(id) : undefined);
  const inningsWithBalls = ([0, 1] as const).filter((idx) => match.innings[idx]?.balls?.length > 0);
  const teamNameFor = (idx: 0 | 1) => (idx === 0 ? match.team1?.name : match.team2?.name) ?? 'Team';
  // Both sides must be real, present values - a bare `user?.id === match.createdBy?._id` reads
  // as true for a logged-out viewer (undefined) on a match with no createdBy set (undefined),
  // spuriously granting organizer-only controls to any anonymous visitor. Found live: this
  // match's createdBy is genuinely null, and the old unguarded check showed Umpires/Documents
  // upload controls to a signed-out browser.
  const isCreator = Boolean(user?.id) && Boolean(match.createdBy?._id) && user!.id === match.createdBy!._id;

  return (
    <div className={styles.container}>
      {/* Header - persistent across every tab, matching CricClubs' match center: title/status
          up top, then the score summary always visible regardless of which tab is open. */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <button
            onClick={() => router.back()}
            className="inline-flex items-center gap-1 text-sm font-medium text-ink-secondary hover:text-ink transition-colors mb-3"
          >
            &larr; Back
          </button>
          <h1 className={styles.matchTitle}>{match.title}</h1>
          <p className={styles.matchInfo}>
            {match.matchType} • {match.venue}
          </p>
          <span className={`${styles.status} ${styles[match.status.toLowerCase()]}`}>
            {match.status}
          </span>
          {match.status === 'Live' && powerplayOvers != null && currentInnings.overs < powerplayOvers && (
            <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gold-500/15 text-gold-400 border border-gold-500/30">
              ⚡ Powerplay (overs 1-{powerplayOvers})
            </span>
          )}
          {match.manOfTheMatch?.user?.name && (
            <p className="mt-2 text-sm font-medium text-gold-500">
              🏆 Man of the Match: {match.manOfTheMatch.user.name}
            </p>
          )}
        </div>
      </div>

      {/* Team Scores - moved out of a tab so it's visible no matter which tab is open. */}
      <div className="max-w-[1200px] mx-auto px-5 mt-4">
        <div className={styles.scoreBoard}>
          <div className={styles.teamScoreContainer}>
            <div className={styles.teamScore}>
              <h2 className={styles.teamName}>{match.team1?.name ?? 'Team 1'}</h2>
              <div className={styles.score}>
                <span className={styles.runs}>{match.innings[0]?.runs || 0}</span>
                <span className={styles.wickets}>/{match.innings[0]?.wickets || 0}</span>
              </div>
              <p className={styles.overs}>
                ({(match.innings[0]?.overs || 0).toFixed(1)} overs)
              </p>
            </div>

            <div className={styles.vsContainer}>
              <span className={styles.vs}>VS</span>
            </div>

            <div className={styles.teamScore}>
              <h2 className={styles.teamName}>{match.team2?.name ?? 'Team 2'}</h2>
              <div className={styles.score}>
                <span className={styles.runs}>{match.innings[1]?.runs || 0}</span>
                <span className={styles.wickets}>/{match.innings[1]?.wickets || 0}</span>
              </div>
              <p className={styles.overs}>
                ({(match.innings[1]?.overs || 0).toFixed(1)} overs)
              </p>
            </div>
          </div>

          <div className={styles.targetContainer}>
            <p className={styles.targetLabel}>{match.interruption ? 'Revised Target' : 'Target Score'}</p>
            <p className={styles.targetValue}>{targetScore} runs</p>
          </div>
        </div>

        {match.interruption && (
          <div className="mt-3 bg-gold-500/10 border border-gold-500/30 rounded-lg p-3 text-xs text-ink-secondary">
            <p className="font-semibold text-gold-400 mb-1">
              Rain rule applied — revised to {match.interruption.revisedOvers} overs
            </p>
            <p>
              Par score {match.interruption.parScore} ({match.interruption.resourcePercentRemaining}% resources
              remaining at the point of interruption, {match.interruption.wicketsLostAtInterruption} wicket(s) down).
              This is an approximate rain-rule estimate inspired by the Duckworth-Lewis-Stern method, not the
              official licensed calculation — treat it as a guide, not a binding result.
            </p>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className={styles.tabContainer}>
        <button className={`${styles.tab} ${activeTab === 'info' ? styles.activeTab : ''}`} onClick={() => setActiveTab('info')}>
          ℹ️ Info
        </button>
        <button className={`${styles.tab} ${activeTab === 'ball-by-ball' ? styles.activeTab : ''}`} onClick={() => setActiveTab('ball-by-ball')}>
          🏏 Ball By Ball
        </button>
        <button className={`${styles.tab} ${activeTab === 'scorecard' ? styles.activeTab : ''}`} onClick={() => setActiveTab('scorecard')}>
          📊 Full Scorecard
        </button>
        <button className={`${styles.tab} ${activeTab === 'over-by-over' ? styles.activeTab : ''}`} onClick={() => setActiveTab('over-by-over')}>
          🔢 Over by Over
        </button>
        <button className={`${styles.tab} ${activeTab === 'charts' ? styles.activeTab : ''}`} onClick={() => setActiveTab('charts')}>
          📈 Charts
        </button>
        <button className={`${styles.tab} ${activeTab === 'mvp' ? styles.activeTab : ''}`} onClick={() => setActiveTab('mvp')}>
          🥇 MVP
        </button>
        <button className={`${styles.tab} ${activeTab === 'gallery' ? styles.activeTab : ''}`} onClick={() => setActiveTab('gallery')}>
          🖼️ Gallery
        </button>
        <button className={`${styles.tab} ${activeTab === 'ai-insights' ? styles.activeTab : ''}`} onClick={() => setActiveTab('ai-insights')}>
          🤖 AI Insights
        </button>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {activeTab === 'info' && (
          <>
            {match.status === 'Completed' && match.summary && (
              <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-ink mb-2">Match Summary</h3>
                <p className="text-sm text-ink-secondary leading-relaxed">{match.summary}</p>
              </div>
            )}

            {match.toss?.winningTeam && (
              <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                <p className="text-sm text-ink-secondary">
                  🪙 {match.toss.winningTeam.name} won the toss and elected to {match.toss.decision === 'bowl' ? 'bowl' : 'bat'}.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 mb-4">
              <Link href={`/match/${matchId}/scouting`} className="text-sm font-medium text-gold-500 hover:text-gold-400 transition-colors">
                📋 Scouting Report &rarr;
              </Link>
              {(match.status === 'Scheduled' || match.status === 'Live') && user && (
                <Link href={`/match/${matchId}/score`} className="text-sm font-medium text-pitch-400 hover:text-pitch-300 transition-colors">
                  🏏 Score this match &rarr;
                </Link>
              )}
            </div>

            {/* Squads - both teams' rosters side by side, CricClubs' Info-tab pattern. Avatar
                fallback and captain/vice-captain badges mirror TournamentManager.tsx's Teams tab
                (same GET /api/teams/:id shape); collapse-to-a-few-plus-toggle mirrors the Awards
                tab's Top Performers pattern. Skipped entirely for a team-less orphaned match. */}
            {(match.team1 || match.team2) && (
              <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-ink mb-3">Squads</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {([0, 1] as const).map((idx) => {
                    const teamRef = idx === 0 ? match.team1 : match.team2;
                    if (!teamRef) {
                      return <p key={idx} className="text-xs text-ink-muted">Team not available.</p>;
                    }
                    const squad = idx === 0 ? squadTeams.team1 : squadTeams.team2;
                    const expandKey = idx === 0 ? 'team1' : 'team2';
                    const expanded = squadsExpanded[expandKey];
                    const players = squad?.players || [];
                    const visiblePlayers = expanded ? players : players.slice(0, SQUAD_PREVIEW_COUNT);
                    return (
                      <div key={teamRef._id}>
                        <h4 className="text-sm font-semibold text-ink mb-2">{teamRef.name}</h4>
                        {squadsLoading && !squad ? (
                          <p className="text-xs text-ink-muted">Loading squad...</p>
                        ) : players.length === 0 ? (
                          <p className="text-xs text-ink-muted">No roster available.</p>
                        ) : (
                          <>
                            {visiblePlayers.map((p) => (
                              <div key={p._id} className="flex items-center gap-2.5 py-1.5">
                                <SquadAvatar player={p} />
                                <div className="min-w-0">
                                  <p className="text-sm text-ink truncate">
                                    {p.user?.name || 'Player'}
                                    {squad?.captain?._id === p._id && <Badge variant="gold" className="ml-1.5">C</Badge>}
                                    {squad?.viceCaptain?._id === p._id && <Badge variant="info" className="ml-1.5">VC</Badge>}
                                  </p>
                                  <p className="text-xs text-ink-muted">{p.specialization}</p>
                                </div>
                              </div>
                            ))}
                            {players.length > SQUAD_PREVIEW_COUNT && (
                              <button
                                onClick={() => setSquadsExpanded((prev) => ({ ...prev, [expandKey]: !prev[expandKey] }))}
                                className="text-xs font-medium text-pitch-400 hover:text-pitch-300 mt-2"
                              >
                                {expanded ? 'Show less' : `Full Squad (${players.length}) ⌄`}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {isCreator && (
              <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-ink mb-1">Umpires</h3>
                <p className="text-xs text-ink-muted mb-3">
                  Umpires can score this match the same way you can, without needing to be on either team's roster.
                </p>
                {(match.umpires || []).length > 0 && (
                  <ul className="mb-3 space-y-1.5">
                    {(match.umpires || []).map((u) => {
                      const uid = typeof u === 'string' ? u : u._id;
                      const name = typeof u === 'string' ? uid : u.name;
                      return (
                        <li key={uid} className="flex items-center justify-between text-sm">
                          <span className="text-ink-secondary">{name}</span>
                          <button
                            onClick={() => handleRemoveUmpire(uid)}
                            disabled={umpireBusy}
                            className="text-xs text-wicket-400 hover:underline disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                <div className="flex gap-2">
                  <select
                    value={umpireToAdd}
                    onChange={(e) => setUmpireToAdd(e.target.value)}
                    className="flex-1 min-w-0 text-sm bg-surface-alt border border-border-strong rounded-lg px-3 py-1.5 text-ink"
                  >
                    <option value="">Select a person...</option>
                    {userOptions
                      .filter((o) => !(match.umpires || []).some((u) => (typeof u === 'string' ? u : u._id) === o.userId))
                      .filter((o) => o.userId !== match.createdBy?._id)
                      .map((o) => (
                        <option key={o.userId} value={o.userId}>{o.name}</option>
                      ))}
                  </select>
                  <button
                    onClick={handleAddUmpire}
                    disabled={!umpireToAdd || umpireBusy}
                    className="text-sm px-3 py-1.5 bg-pitch-500 text-[#06170D] font-medium rounded-lg disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                {umpireError && <p className="mt-2 text-xs text-wicket-400">{umpireError}</p>}
              </div>
            )}

            {/* Match Documents - team sheets, dispute reports, etc. Reference material scoped
                to this one match, distinct from a tournament's own document library. Upload
                gated the same simple way the Umpires section above is (match creator only) -
                the backend's canManageMatch is actually broader (also allows umpires/rostered
                players), but matching the creator-only visual gate already established for
                Umpires keeps this section's behavior predictable rather than surprising. */}
            {((match.documents?.length ?? 0) > 0 || isCreator) && (
              <div className="bg-surface border border-border rounded-xl p-4 mb-4">
                <h3 className="text-sm font-bold text-ink mb-3">Match Documents</h3>
                {(match.documents?.length ?? 0) > 0 ? (
                  <ul className="mb-3 space-y-1.5">
                    {match.documents!.map((doc) => (
                      <li key={doc._id} className="flex items-center justify-between text-sm gap-2">
                        <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-pitch-400 hover:text-pitch-300 truncate">
                          📄 {doc.fileName} <span className="text-ink-muted">({doc.category})</span>
                        </a>
                        {isCreator && (
                          <button
                            onClick={() => handleRemoveDocument(doc._id)}
                            className="text-xs text-wicket-400 hover:underline shrink-0"
                          >
                            Remove
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-ink-muted mb-3">No documents uploaded yet.</p>
                )}
                {isCreator && (
                  <div className="flex gap-2">
                    <input
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      placeholder="Category (e.g. Team Sheet)"
                      className="flex-1 min-w-0 text-sm bg-surface-alt border border-border-strong rounded-lg px-3 py-1.5 text-ink"
                    />
                    <button
                      onClick={() => docFileInputRef.current?.click()}
                      disabled={uploadingDoc}
                      className="text-sm px-3 py-1.5 bg-pitch-500 text-[#06170D] font-medium rounded-lg disabled:opacity-50 shrink-0"
                    >
                      {uploadingDoc ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                      ref={docFileInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleUploadDocument}
                    />
                  </div>
                )}
                {docUploadError && <p className="mt-2 text-xs text-wicket-400">{docUploadError}</p>}
              </div>
            )}

            {match.team1 && match.team2 && (
              <div className="mb-4">
                <PredictionWidget
                  matchId={matchId}
                  matchStatus={match.status}
                  team1={match.team1}
                  team2={match.team2}
                />
              </div>
            )}

            {/* At the Crease - live striker/non-striker/bowler figures, Cricbuzz-style */}
            {match.status === 'Live' && currentInnings.liveState && (
              <div className="mb-4 bg-surface border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-ink mb-3 uppercase tracking-wide text-ink-muted">At the Crease</h3>
                <div className="space-y-2">
                  {currentInnings.liveState.currentBatsmen.map((batsman, i) => {
                    if (!batsman) return null;
                    const stats = currentInnings.liveState!.battingScorecard.find((e) => e.player.id === batsman.id);
                    const isStriker = i === 0;
                    return (
                      <div key={batsman.id} className="flex items-center justify-between text-sm">
                        <span className={isStriker ? 'font-semibold text-ink' : 'text-ink-secondary'}>
                          {batsman.name}{isStriker ? ' *' : ''}
                        </span>
                        <span className="font-mono tabular-nums text-ink-secondary">
                          {stats ? `${stats.runs} (${stats.balls})` : '0 (0)'}
                          {stats && stats.balls > 0 && (
                            <span className="text-ink-muted ml-2 text-xs">SR {stats.strikeRate.toFixed(1)}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {currentInnings.liveState.currentBowler && (() => {
                  const bowler = currentInnings.liveState!.currentBowler!;
                  const stats = currentInnings.liveState!.bowlingScorecard.find((e) => e.player.id === bowler.id);
                  return (
                    <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-sm">
                      <span className="text-ink-secondary">{bowler.name}</span>
                      <span className="font-mono tabular-nums text-ink-secondary">
                        {stats ? `${stats.wickets}-${stats.runs} (${stats.overs}.${stats.balls})` : '0-0 (0.0)'}
                        {stats && (
                          <span className="text-ink-muted ml-2 text-xs">Econ {stats.economy.toFixed(2)}</span>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Recommended field placements for whoever's currently batting - grounded in
            where each of them has actually scored their runs (or, with too little data on
            them individually, similar batsmen pooled together). See FieldingPlan.tsx. */}
            {match.status === 'Live' && currentInnings.liveState && (
              <div className="mb-4 bg-surface border border-border rounded-xl p-4">
                <h3 className="text-sm font-bold text-ink mb-3 uppercase tracking-wide text-ink-muted">Recommended Field</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                </div>
              </div>
            )}

            {!match.toss?.winningTeam && match.status === 'Scheduled' && !currentInnings.liveState && (
              <p className="text-sm text-ink-muted">More match context (toss, live snapshot) will appear here once scoring begins.</p>
            )}
          </>
        )}

        {activeTab === 'ball-by-ball' && (
          <>
            {/* Recent Balls - compact at-a-glance strip for whichever innings is currently selected. */}
            <div className={styles.ballsSection}>
              <h3 className={styles.ballsTitle}>Recent Deliveries</h3>
              <div className={styles.ballsGrid}>
                {currentInnings?.balls?.slice(-12).map((ball, index) => (
                  <div key={index} className={styles.ballBox}>
                    <span className={styles.ballRuns}>{ball.runs}</span>
                    {ball.isWicket && <span className={styles.wicketBadge}>W</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Commentary - full ball-by-ball for whichever innings is selected, preserved and
                scrollable for the entire match, not just a recent-deliveries snippet. */}
            {inningsWithBalls.length > 0 && (() => {
              const selectedInnings = match.innings[selectedInningsIdx];
              const inningsTeamName = teamNameFor(selectedInningsIdx);
              return (
                <div className="mt-6">
                  <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                    <h3 className="text-base font-bold text-ink">Commentary</h3>
                    <div className="flex gap-1">
                      {inningsWithBalls.map((idx) => (
                        <button
                          key={idx}
                          onClick={() => { setSelectedInningsIdx(idx); setFollowCurrentInnings(false); }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            selectedInningsIdx === idx ? 'bg-pitch-500/15 text-pitch-400' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                          }`}
                        >
                          {teamNameFor(idx)}
                        </button>
                      ))}
                    </div>
                  </div>
                  {selectedInnings?.balls?.length ? (
                    <div className="bg-surface border border-border rounded-xl divide-y divide-border max-h-96 overflow-y-auto">
                      {selectedInnings.balls.slice().reverse().map((ball, i) => {
                        const originalIndex = selectedInnings.balls.length - 1 - i;
                        return (
                          <div key={originalIndex} className="p-3 flex gap-3 items-start">
                            <span className="text-xs font-mono text-ink-muted mt-0.5 shrink-0 w-10">
                              {overBallLabel(selectedInnings.balls, originalIndex)}
                            </span>
                            <p className={`text-sm ${ball.isWicket ? 'text-wicket-400 font-medium' : ball.runs === 4 || ball.runs === 6 ? 'text-pitch-400 font-medium' : 'text-ink-secondary'}`}>
                              {ball.commentary || `${ball.runs} run${ball.runs === 1 ? '' : 's'}.`}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-ink-muted">{inningsTeamName} haven't batted yet.</p>
                  )}
                </div>
              );
            })()}

            {/* Key Moments */}
            {keyMoments.length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-3">🔑 Key Moments</h3>
                <p className="text-xs text-ink-muted mb-3">
                  The deliveries that swung the win probability the most, biggest swing first.
                </p>
                <div className="bg-surface border border-border rounded-xl divide-y divide-border">
                  {keyMoments.map((moment) => {
                    const swungTowardsChasers = moment.winProbabilityAfter > moment.winProbabilityBefore;
                    return (
                      <div key={moment.ballIndex} className="p-3 flex gap-3 items-start">
                        <span className="text-xs font-mono text-ink-muted mt-0.5 shrink-0 w-10">
                          {overBallLabel(match.innings[1].balls, moment.ballIndex)}
                        </span>
                        <div className="flex-1">
                          <p className={`text-sm ${moment.isWicket ? 'text-wicket-400 font-medium' : moment.runs === 4 || moment.runs === 6 ? 'text-pitch-400 font-medium' : 'text-ink-secondary'}`}>
                            {moment.commentary || `${moment.runs} run${moment.runs === 1 ? '' : 's'}.`}
                          </p>
                          <p className="text-xs text-ink-muted mt-1">
                            Win probability {swungTowardsChasers ? '+' : '-'}{(moment.delta * 100).toFixed(1)}%
                            {' '}({(moment.winProbabilityBefore * 100).toFixed(0)}% → {(moment.winProbabilityAfter * 100).toFixed(0)}%)
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'scorecard' && (
          <>
            {/* Full Scorecard - computed fresh from ball data (lib/matchStats.ts), not the
                client-only liveState snapshot, so it works for every match regardless of status
                or how it was scored (liveState is absent on any match not scored through the
                live-scoring UI - e.g. every match this app's simulation scripts created). */}
            {inningsWithBalls.length === 0 ? (
              <p className="text-sm text-ink-muted">Scorecard will appear here once the match starts.</p>
            ) : (
              match.innings.map((innings, idx) => {
                if (innings.balls.length === 0) return null;
                const { battingOrder, bowlingOrder } = battingBowlingOrder(innings.balls);
                return (
                  <div key={idx} className={styles.scorecardInnings}>
                    <h3 className={styles.scorecardInningsTitle}>
                      {teamNameFor(idx as 0 | 1)} — {innings.runs}/{innings.wickets} ({innings.overs.toFixed(1)} ov)
                    </h3>

                    <p className={styles.scorecardSectionLabel}>Batting</p>
                    <div className={styles.scorecardHeaderRow}>
                      <span className={styles.scorecardHeaderCell}>Batsman</span>
                      <span className={styles.scorecardHeaderCell}>R</span>
                      <span className={styles.scorecardHeaderCell}>B</span>
                      <span className={styles.scorecardHeaderCell}>4s</span>
                      <span className={styles.scorecardHeaderCell}>6s</span>
                      <span className={styles.scorecardHeaderCell}>SR</span>
                    </div>
                    {battingOrder.map((playerId) => {
                      const stats = battingStatsFor(innings.balls, playerId);
                      const dismissal = dismissalFor(innings.balls, playerId, nameFor);
                      return (
                        <div key={playerId} className={styles.scorecardRow}>
                          <div>
                            <p className={styles.scorecardPlayerName}>{playerDirectory.get(playerId) ?? 'Player'}</p>
                            <p className={styles.scorecardDismissal}>{dismissal ?? 'not out'}</p>
                          </div>
                          <span className={styles.scorecardCell}>{stats.runs}</span>
                          <span className={styles.scorecardCell}>{stats.ballsFaced}</span>
                          <span className={styles.scorecardCell}>{stats.fours}</span>
                          <span className={styles.scorecardCell}>{stats.sixes}</span>
                          <span className={styles.scorecardCell}>{stats.strikeRate.toFixed(1)}</span>
                        </div>
                      );
                    })}

                    <p className={styles.scorecardSectionLabel}>Bowling</p>
                    <div className={styles.scorecardHeaderRow}>
                      <span className={styles.scorecardHeaderCell}>Bowler</span>
                      <span className={styles.scorecardHeaderCell}>O</span>
                      <span className={styles.scorecardHeaderCell}>M</span>
                      <span className={styles.scorecardHeaderCell}>R</span>
                      <span className={styles.scorecardHeaderCell}>W</span>
                      <span className={styles.scorecardHeaderCell}>Econ</span>
                    </div>
                    {bowlingOrder.map((playerId) => {
                      const stats = bowlingStatsFor(innings.balls, playerId);
                      const maidens = maidenOversFor(innings.balls, playerId);
                      return (
                        <div key={playerId} className={styles.scorecardRow}>
                          <span className={styles.scorecardPlayerName}>{playerDirectory.get(playerId) ?? 'Player'}</span>
                          <span className={styles.scorecardCell}>{stats.overs.toFixed(1)}</span>
                          <span className={styles.scorecardCell}>{maidens}</span>
                          <span className={styles.scorecardCell}>{stats.runsConceded}</span>
                          <span className={styles.scorecardCell}>{stats.wickets}</span>
                          <span className={styles.scorecardCell}>{stats.economy.toFixed(2)}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })
            )}

            {/* Player Performance Reports */}
            {playersWhoAppeared(match.innings).length > 0 && (
              <div className="mt-6">
                <h3 className="text-base font-bold text-ink mb-1">Player Performance Reports</h3>
                <p className="text-xs text-ink-muted mb-3">
                  This match&apos;s numbers vs. career average, recent form, and a tactical read on every dismissal.
                </p>
                <div className="flex flex-wrap gap-2">
                  {playersWhoAppeared(match.innings).map((playerId) => (
                    <Link
                      key={playerId}
                      href={`/match/${matchId}/report/${playerId}`}
                      className="text-sm px-3 py-1.5 bg-surface border border-border rounded-full text-ink-secondary hover:text-pitch-400 hover:border-pitch-500/40 transition-colors"
                    >
                      {playerDirectory.get(playerId) ?? 'View report'} &rarr;
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'over-by-over' && (
          <>
            {inningsWithBalls.length === 0 ? (
              <p className="text-sm text-ink-muted">Over-by-over detail will appear here once the match starts.</p>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-base font-bold text-ink">Over by Over Score</h3>
                  <div className="flex gap-1">
                    {inningsWithBalls.map((idx) => (
                      <button
                        key={idx}
                        onClick={() => { setSelectedInningsIdx(idx); setFollowCurrentInnings(false); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                          selectedInningsIdx === idx ? 'bg-pitch-500/15 text-pitch-400' : 'text-ink-secondary hover:text-ink hover:bg-surface-hover'
                        }`}
                      >
                        {teamNameFor(idx)}
                      </button>
                    ))}
                  </div>
                </div>
                {match.innings[selectedInningsIdx]?.balls?.length ? (
                  <div className="bg-surface border border-border rounded-xl divide-y divide-border p-2">
                    {overByOver(match.innings[selectedInningsIdx].balls).slice().reverse().map((o) => (
                      <div key={o.over} className={styles.overRow}>
                        <div className={styles.overLabel}>
                          Over {o.over + 1}
                          <span className={styles.overBowlerName}>{nameFor(o.bowlerId) ?? 'Bowler'}</span>
                        </div>
                        <div className={styles.overBalls}>
                          {o.balls.map((b, i) => (
                            <span key={i} className={`${styles.overBallChip} ${b.isWicket ? styles.overBallChipWicket : ''}`}>
                              {b.label}
                            </span>
                          ))}
                        </div>
                        <div className={styles.overSummary}>
                          {o.runs} run{o.runs === 1 ? '' : 's'}{o.wickets > 0 ? `, ${o.wickets}w` : ''}
                          <span className={styles.overSummaryTotal}>{o.runningTotal}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-ink-muted">{teamNameFor(selectedInningsIdx)} haven't batted yet.</p>
                )}
              </>
            )}
          </>
        )}

        {activeTab === 'charts' && (
          <>
            {chartsInnings.some((inn) => inn.overs.length > 0) ? (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Manhattan Chart</h4>
                    <ManhattanChart innings={chartsInnings} />
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Worm Chart</h4>
                    <WormChart innings={chartsInnings} />
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Extras</h4>
                    <ExtrasChart innings={chartsInnings} />
                  </div>
                  <div className="bg-surface border border-border rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-ink-secondary mb-2">Type of Runs</h4>
                    <RunsTypeChart innings={chartsInnings} />
                  </div>
                </div>

                {/* Partnerships - chronological (not sorted by size), since the natural way to
                    read a partnership breakdown is following the innings in order. */}
                {chartsInnings.some((inn) => inn.partnerships?.length > 0) && (
                  <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {chartsInnings.map((inn, idx) => (
                      inn.partnerships?.length > 0 && (
                        <div key={idx} className="bg-surface border border-border rounded-xl p-4">
                          <h4 className="text-sm font-semibold text-ink-secondary mb-2">
                            Partnerships &mdash; {teamNameFor(idx as 0 | 1)}
                          </h4>
                          <div className="space-y-1.5">
                            {inn.partnerships.map((p, i) => {
                              const names = p.batsmen.map((id) => playerDirectory.get(id) ?? 'Unknown');
                              const label = names.length === 2 ? `${names[0]} & ${names[1]}` : (names[0] ?? 'Unknown');
                              return (
                                <div key={i} className="flex items-center justify-between text-sm">
                                  <span className="text-ink-secondary">
                                    {i + 1}. {label}
                                  </span>
                                  <span className="font-mono tabular-nums text-ink">{p.runs} ({p.balls})</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-ink-muted">Charts will appear here once the match starts.</p>
            )}
          </>
        )}

        {activeTab === 'mvp' && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <h4 className="text-sm font-semibold text-ink-secondary mb-2">MVP Points</h4>
            {mvpRanking.length === 0 ? (
              <p className="text-sm text-ink-muted">MVP points will appear here once ball-by-ball data has been recorded.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  {(showAllMvp ? mvpRanking : mvpRanking.slice(0, 5)).map((p, i) => (
                    <div key={p.playerId} className="flex items-center justify-between py-2 border-b border-border text-sm">
                      <span className="text-ink">
                        {p.playerId === match.manOfTheMatch?._id && '🏆 '}
                        {i + 1}. {playerDirectory.get(p.playerId) ?? 'Player'}
                      </span>
                      <span className="text-gold-500 font-mono font-semibold">{p.points} pts</span>
                    </div>
                  ))}
                </div>
                {mvpRanking.length > 5 && (
                  <button
                    onClick={() => setShowAllMvp((prev) => !prev)}
                    className="text-xs font-medium text-pitch-400 hover:text-pitch-300 mt-2"
                  >
                    {showAllMvp ? 'Show less' : `Show all ${mvpRanking.length} →`}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'gallery' && (
          <div className="bg-surface border border-border rounded-xl p-4">
            <h3 className="text-sm font-bold text-ink mb-3">Gallery</h3>

            {/* Upload gated the same simple way the Match Documents section is (match creator
                only) - reusing isCreator rather than a separate check, consistent with that
                section's rationale (backend's canManageMatch is broader, but a predictable
                creator-only visual gate beats a surprising one). */}
            {isCreator && (
              <div className="flex gap-2 mb-3 flex-wrap">
                <input
                  value={photoCaption}
                  onChange={(e) => setPhotoCaption(e.target.value)}
                  placeholder="Caption (optional)"
                  className="flex-1 min-w-[140px] text-sm bg-surface-alt border border-border-strong rounded-lg px-3 py-1.5 text-ink"
                />
                <button
                  onClick={() => photoFileInputRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="text-sm px-3 py-1.5 bg-pitch-500 text-[#06170D] font-medium rounded-lg disabled:opacity-50 shrink-0"
                >
                  {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                </button>
                <input
                  ref={photoFileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleUploadPhoto}
                />
              </div>
            )}
            {photoUploadError && <p className="mb-3 text-xs text-wicket-400">{photoUploadError}</p>}

            {(match.photos?.length ?? 0) === 0 ? (
              <p className="text-sm text-ink-muted">No photos uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {match.photos!.map((photo) => (
                  <div key={photo._id} className="relative group">
                    <button
                      onClick={() => setLightboxPhoto(photo)}
                      className="block w-full aspect-square rounded-lg overflow-hidden bg-surface-alt border border-border"
                    >
                      {/* Plain <img>, not next/image - relative /uploads/... URLs are proxied
                          straight through (see next.config.js), no remote-pattern config needed
                          for a self-hosted upload the same way group-attachment images already work. */}
                      <img src={photo.url} alt={photo.caption || 'Match photo'} className="w-full h-full object-cover" />
                    </button>
                    {photo.caption && <p className="mt-1 text-xs text-ink-muted truncate">{photo.caption}</p>}
                    {isCreator && (
                      <button
                        onClick={() => handleRemovePhoto(photo._id)}
                        aria-label="Remove photo"
                        className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white text-xs leading-none hover:bg-wicket-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'ai-insights' && (
          match.status === 'Live' ? (
            <AITacticalAdvisor
              matchId={matchId}
              userId={user?.id || ''}
              token={token || ''}
              isLive
            />
          ) : (
            <p className="text-sm text-ink-muted">
              {match.status === 'Scheduled'
                ? 'Live win probability and tactical advice will appear here once this match starts.'
                : 'AI tactical insights are only generated while a match is live - see the Charts and Ball By Ball tabs for this match’s full analysis.'}
            </p>
          )
        )}
      </div>

      {/* Gallery lightbox - simple full-screen overlay, no carousel library (none used
          anywhere else in this app). Click the backdrop or Close to dismiss. */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="max-w-3xl w-full" onClick={(e) => e.stopPropagation()}>
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || 'Match photo'}
              className="max-w-full max-h-[80vh] rounded-lg object-contain mx-auto"
            />
            {lightboxPhoto.caption && (
              <p className="mt-3 text-center text-sm text-white">{lightboxPhoto.caption}</p>
            )}
            <button
              onClick={() => setLightboxPhoto(null)}
              className="mt-3 mx-auto block text-sm text-white/80 hover:text-white"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
