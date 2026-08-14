// shared/types/index.ts
// Types matching the REAL backend Mongoose document shapes (backend/src/models/*), not an
// idealized/simplified API. Populated relations are typed loosely (any / optional nested
// shape) since whether a field arrives populated depends on the specific endpoint called -
// screens should treat unpopulated relations as bare id strings.

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface Player {
  _id: string;
  user: User | string;
  specialization: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';
  battingStyle: 'Right-hand' | 'Left-hand';
  bowlingStyle: string;
  teams?: string[];
}

export interface Team {
  _id: string;
  name: string;
  description?: string;
  city: string;
  captain: Player | string;
  viceCaptain?: Player | string | null;
  coaches?: (Player | string)[];
  players: (Player | string)[];
  logo?: string;
}

export interface BallEvent {
  ballNumber: number;
  batsmanId: string;
  bowlerId: string;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: 'none' | 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty';
  line: string;
  length: string;
  shotType: string | null;
  shotZone: string | null;
  fielderId: string | null;
  fielderPosition: string | null;
  commentary?: string;
  // Display names for auto-generated commentary - sourced from already-in-state player
  // objects rather than a server-side lookup, see backend/src/services/commentaryGenerator.js.
  batsmanName?: string;
  bowlerName?: string;
  fielderName?: string;
}

// Who's currently at the crease / bowling, plus their live figures - saved by the scorer's
// client on every ball (see backend's innings.liveState). Absent on older matches scored
// before this existed, or if the current innings hasn't started yet. Mirrors web-app's
// app/match/[id]/page.tsx LiveState/ScoreboardPlayer/BatsmanScorecardEntry/BowlerScorecardEntry.
export interface LiveStatePlayer {
  id: string;
  name: string;
  role: string;
}

export interface BatsmanScorecardEntry {
  player: LiveStatePlayer;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  status: string;
  outMethod: string | null;
  // Matches the web scorer's InningsData shape (BallByBallScoring.tsx): these are set from
  // the bowler/fielder Player objects at dismissal time, not just an id/name string.
  outBowler: LiveStatePlayer | null;
  outFielder: LiveStatePlayer | null;
}

export interface BowlerScorecardEntry {
  player: LiveStatePlayer;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface LiveState {
  currentBatsmen: [LiveStatePlayer | null, LiveStatePlayer | null];
  currentBowler: LiveStatePlayer | null;
  battingScorecard: BatsmanScorecardEntry[];
  bowlingScorecard: BowlerScorecardEntry[];
}

export interface Innings {
  team: Team | string;
  runs: number;
  wickets: number;
  overs: number;
  balls: BallEvent[];
  liveState?: LiveState | null;
}

// Set when the second innings' overs get reduced mid-match (rain/other stoppage) - see
// backend/src/services/rainRuleCalculator.js for the calculation and its real scope/accuracy
// caveats. An approximation inspired by Duckworth-Lewis-Stern, not the official licensed DLS
// algorithm - deliberately only covers the single most common club-cricket case (team 2's
// innings shortened, team 1 completed their full original allocation).
export interface Interruption {
  revisedOvers: number;
  oversBowledAtInterruption: number;
  wicketsLostAtInterruption: number;
  resourcePercentRemaining: number;
  parScore: number;
  target: number;
  appliedAt: string;
}

export interface Match {
  _id: string;
  title: string;
  team1: Team | string;
  team2: Team | string;
  matchType: 'T20' | 'ODI' | 'Test' | 'Friendly';
  status: 'Scheduled' | 'Live' | 'Completed' | 'Cancelled';
  venue: string;
  pitchType?: string;
  scheduledDate: string;
  tournament?: string | null;
  // Which of the tournament's groups this belongs to (group-stage matches only) and which
  // stage of the tournament it's part of - see backend/src/models/Match.js. Every match
  // defaults to round: 'Group', including every match in a tournament with no groups at all.
  group?: string | null;
  round?: 'Group' | 'Quarterfinal' | 'Semifinal' | 'Final';
  // The match's original overs-per-side allocation - see backend/src/models/Match.js.
  totalOvers?: number;
  interruption?: Interruption | null;
  innings: Innings[];
  toss?: { winningTeam: string; decision: string };
  result?: { winningTeam: string | null; margin: string; marginValue: number };
  manOfTheMatch?: Player | string | null;
  createdBy: User | string;
  // Appointed umpires - full scoring rights alongside the creator and rostered players. Creator-
  // only to appoint/remove (POST/DELETE /matches/:id/umpires). Populated as {_id,name} objects
  // from GET /matches/:id.
  umpires?: (User | string)[];
}

export interface TournamentStanding {
  team: Team | string;
  played: number;
  won: number;
  lost: number;
  tied: number;
  noResult: number;
  points: number;
  netRunRate: number;
  runsFor: number;
  runsAgainst: number;
}

// Organizing body that runs multiple Tournaments (seasons/editions) over time - see
// backend/src/models/League.js. Deliberately minimal: no venue/dates/teams of its own.
export interface League {
  _id: string;
  name: string;
  description?: string;
  organizer: User | string;
  logo?: string;
  isPublic: boolean;
}

export interface Tournament {
  _id: string;
  name: string;
  description?: string;
  organizer: User | string;
  // Optional parent League this tournament belongs to (null for standalone tournaments).
  league?: League | string | null;
  format: 'League' | 'Knockout' | 'Group' | 'Round-Robin';
  matchType: string;
  status: 'Draft' | 'Registration' | 'Ongoing' | 'Completed' | 'Cancelled';
  venue: string;
  startDate: string;
  endDate: string;
  registrationDeadline: string;
  teams: (Team | string)[];
  maxTeams: number;
  matches?: (Match | string)[];
  standings: TournamentStanding[];
  // Group-stage assignment (see assign-groups) - empty for tournaments with no group stage.
  groups?: { name: string; teams: (Team | string)[] }[];
  houseRules?: string;
  awards?: {
    winner?: Team | string | null;
    runnerUp?: Team | string | null;
    thirdPlace?: Team | string | null;
    manOfTheTournament?: Player | string | null;
    bestBatsman?: Player | string | null;
    bestBowler?: Player | string | null;
  };
}

export interface PlayerCareerStats {
  player: { _id: string; name: string; specialization: string };
  batting: {
    matches: number; innings: number; runs: number; balls: number; highestScore: number;
    average: number; strikeRate: number; centuries: number; halfCenturies: number;
    fours: number; sixes: number; ducks: number; notOuts: number;
  };
  bowling: { matches: number; innings: number; balls: number; runs: number; wickets: number; average: number; economyRate: number };
  fielding: { catches: number; runOuts: number; stumpings: number };
  overall: { matches: number; wins: number; losses: number; winPercentage: number; manOfTheMatch: number };
  wagonWheel: Array<{ zone: string; balls: number; runs: number; runsPercent: number }>;
  achievements: Array<{ key: string; label: string; description: string; earned: boolean; count: number }>;
}

// Rankings leaderboard entries (backend/src/controllers/playerStatsController.js
// getTopBatsmen/getTopBowlers) - a different, slimmer shape than PlayerCareerStats since these
// come from tendencyAnalytics' leaderboard aggregation, not the full per-player stats query.
export interface BattingRankingEntry {
  player: { _id: string; name: string; specialization: string };
  batting: { matches: number; runs: number; highestScore: number; average: number; strikeRate: number; centuries: number };
}

export interface BowlingRankingEntry {
  player: { _id: string; name: string; specialization: string };
  bowling: { matches: number; wickets: number; average: number; economyRate: number };
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  category: 'equipment' | 'apparel' | 'accessories' | 'other';
  price: number;
  stock: number;
  seller: User | string;
  images?: string[];
}

export interface Order {
  _id: string;
  buyer: User | string;
  items: Array<{ product: string; name: string; price: number; quantity: number; seller: string }>;
  totalAmount: number;
  status: 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';
  paymentMethod: string;
  createdAt: string;
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  sellerId: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface Lesson {
  _id: string;
  title: string;
  category: string;
  difficulty: string;
  // Present on GET /lessons/:id (full lesson); omitted (.select('-content')) on list-style
  // endpoints like GET /lessons and GET /lessons/for-me.
  content?: string;
  tags?: string[];
  author: User | string;
  createdAt: string;
}

// The standout player an auto-generated match-report article is about (century-maker,
// five-wicket hero, etc.) - populated with the full Player doc plus a name-only user.
export interface NewsHeroPlayer extends Omit<Player, 'user'> {
  user: { _id: string; name: string };
}

export interface NewsPost {
  _id: string;
  title: string;
  category: 'general' | 'tournament-update' | 'match-report' | 'club-news' | 'tips' | 'international';
  body: string;
  author: User | string;
  // Set for tournament-linked auto-generated articles (see matchArticleGenerator); null for
  // general/global news.
  tournament: { _id: string; name: string } | null;
  // Bare Match id, NOT populated, when set.
  match: string | null;
  heroPlayer: NewsHeroPlayer | null;
  isAutoGenerated: boolean;
  createdAt: string;
}

// Points-based match prediction game (backend/src/models/Prediction.js) - NOT real-money
// betting, just a free predict-and-earn-points leaderboard. `match` and `predictedWinner`
// arrive as bare id strings from most endpoints (e.g. GET /predictions/match/:matchId), but
// GET /predictions/me populates both with a partial shape - typed loosely to match whichever
// endpoint returned the doc, same convention as the rest of this file.
export interface Prediction {
  _id: string;
  user: User | string;
  match:
    | string
    | {
        _id: string;
        title: string;
        matchType: Match['matchType'];
        status: Match['status'];
        venue: string;
        scheduledDate: string;
        team1: { name: string };
        team2: { name: string };
        result?: Match['result'];
      };
  predictedWinner: string | { _id: string; name: string };
  predictedMotm: string | null;
  status: 'pending' | 'settled';
  points: number;
  wonOnWinner: boolean;
  wonOnMotm: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
}

// Direct 1:1 player messaging (backend/src/models/DirectMessage.js via
// backend/src/controllers/directMessageController.js, mounted at /api/messages). Note this is
// a separate feature from Team/Tournament group chat (teamsAPI.getMessages / tournamentsAPI.getMessages).
export interface DirectMessage {
  _id: string;
  sender: { _id: string; name: string };
  recipient: { _id: string; name: string };
  text: string;
  read: boolean;
  createdAt: string;
}

// One row in the inbox (GET /messages/conversations) - one per person messaged, not the
// messages themselves.
export interface Conversation {
  user: { _id: string; name: string };
  lastMessage: { text: string; createdAt: string; fromMe: boolean };
  unreadCount: number;
}

// WhatsApp-style team group chat (backend/src/models/Group.js via
// backend/src/controllers/groupController.js, mounted at /api/groups). `members` arrives as
// bare id strings from GET /groups (the list endpoint) but populated {_id,name} from
// GET /groups/:id (the detail endpoint) - same for `createdBy` - typed loosely to match
// whichever endpoint returned the doc, same convention as Prediction/DirectMessage above.
export interface Group {
  _id: string;
  name: string;
  team: { _id: string; name: string } | null;
  members: (string | { _id: string; name: string })[];
  createdBy: string | { _id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export interface GroupPollOption {
  _id: string;
  text: string;
  // Votes ARE populated with names on every endpoint that returns poll messages.
  votes: { _id: string; name: string }[];
}

// One message in a group's feed, discriminated by `type`. All three variants share the base
// fields; the type-specific payload (`text` / `poll` / `attachment`) is only present for its
// matching type.
// Post-match performance report for a single player in a single match
// (backend/src/services/tendencyAnalytics.js's getMatchPerformanceReport, via
// GET /matches/:matchId/performance-report/:playerId). Mirrors the shape web-app's
// app/match/[id]/report/[playerId]/page.tsx types against - see that file for the
// authoritative field-by-field source.
export interface PerformanceReportBatting {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  strikeRate: number;
}

export interface PerformanceReportBowling {
  balls: number;
  overs: string;
  runs: number;
  wickets: number;
  economy: number;
}

export interface PerformanceCareerComparisonBatting {
  careerAverage: number;
  careerStrikeRate: number;
  runsDelta: number;
  strikeRateDelta: number;
  hasEnoughHistory: boolean;
  message: string;
}

export interface PerformanceCareerComparisonBowling {
  careerAverageWicketsPerMatch: number;
  careerEconomyRate: number;
  wicketsDelta: number;
  economyDelta: number;
  hasEnoughHistory: boolean;
  message: string;
}

export interface PerformanceRecentFormEntry {
  matchId: string;
  scheduledDate: string;
  isThisMatch: boolean;
  runs: number | null;
  wickets: number | null;
}

export interface PerformanceBadgeDef {
  key: string;
  label: string;
  description: string;
}

export interface PerformanceAchievement extends PerformanceBadgeDef {
  earned: boolean;
  count: number;
}

export interface PerformanceMilestones {
  isCareerBestBatting: boolean;
  priorHighestScore: number | null;
  battingMessage: string | null;
  isCareerBestBowling: boolean;
  priorBestBowlingFigures: string | null;
  bowlingMessage: string | null;
  badgesThisMatch: PerformanceBadgeDef[];
  careerAchievements: PerformanceAchievement[];
}

export interface PerformanceRiskBucket {
  line: string;
  length: string;
  blendedDismissalRate: number | null;
  confidence: string;
  basedOn: string;
}

export interface PerformanceDismissalDetail {
  bowlerId: string | null;
  wicketType: string;
  line: string;
  length: string;
  matchedRiskZone?: boolean;
  topRiskBuckets?: PerformanceRiskBucket[];
  note: string;
}

export interface PerformanceTacticalTieBack {
  dismissals: PerformanceDismissalDetail[];
  message?: string;
}

export interface PerformanceReport {
  success: boolean;
  matchId: string;
  player: { _id: string; name: string; specialization: string };
  participated: boolean;
  message?: string;
  thisMatch?: { batting: PerformanceReportBatting | null; bowling: PerformanceReportBowling | null };
  careerComparison?: { batting?: PerformanceCareerComparisonBatting; bowling?: PerformanceCareerComparisonBowling };
  recentForm?: PerformanceRecentFormEntry[];
  milestones?: PerformanceMilestones;
  tacticalTieBack?: PerformanceTacticalTieBack;
}

export interface GroupMessage {
  _id: string;
  group: string;
  sender: { _id: string; name: string };
  type: 'text' | 'poll' | 'image' | 'video';
  createdAt: string;
  // type: 'text'
  text?: string;
  // type: 'poll'
  poll?: {
    question: string;
    allowMultiple: boolean;
    options: GroupPollOption[];
  };
  // type: 'image' | 'video' - url is a RELATIVE path (e.g. /uploads/group-attachments/xyz.png);
  // must be resolved against the backend's origin (not the /api-suffixed API_BASE_URL) before
  // it can be loaded - see apiClient.ts's resolveAttachmentUrl.
  attachment?: {
    url: string;
    mimeType: string;
    fileName: string;
    sizeBytes: number;
  };
}
