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

export interface Innings {
  team: Team | string;
  runs: number;
  wickets: number;
  overs: number;
  balls: BallEvent[];
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
  innings: Innings[];
  toss?: { winningTeam: string; decision: string };
  result?: { winningTeam: string | null; margin: string; marginValue: number };
  manOfTheMatch?: Player | string | null;
  createdBy: User | string;
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

export interface Tournament {
  _id: string;
  name: string;
  description?: string;
  organizer: User | string;
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
