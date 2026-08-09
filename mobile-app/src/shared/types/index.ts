// shared/types/index.ts
// Common type definitions shared between web and mobile applications

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  teams: string[];
  profileImage?: string | null;
}

export interface Team {
  id: string;
  name: string;
  members: number;
  matches: number;
  wins: number;
  losses: number;
  captain: string;
  logo: string;
}

export interface Match {
  id: string;
  teamA: string;
  teamB: string;
  scoreA: string;
  scoreB: string;
  result: string;
  date: string;
  venue?: string;
  tournament?: string;
}

export interface Player {
  id: string;
  name: string;
  teams: string[];
  role: 'Batsman' | 'Bowler' | 'All-rounder' | 'Wicket-keeper';
  stats: PlayerStats;
}

export interface PlayerStats {
  matches: number;
  runs: number;
  wickets: number;
  highestScore?: number;
  bestBowling?: string;
  average?: number;
  strikeRate?: number;
  economy?: number;
}

export interface Product {
  id: string;
  name: string;
  price: number;
  rating: number;
  image: string;
  category: string;
  inStock: boolean;
  description?: string;
  features?: string[];
}

export interface CartItem {
  productId: string;
  quantity: number;
  price: number;
  name: string;
  image?: string;
}

export interface Cart {
  items: CartItem[];
  total: number;
}

export interface Tournament {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  teams: string[];
  matches: string[];
  status: 'Upcoming' | 'Ongoing' | 'Completed';
  format: 'T20' | 'ODI' | 'Test' | 'Custom';
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  timestamp: string;
  isRead: boolean;
  attachments?: string[];
}

export interface ChatGroup {
  id: string;
  name: string;
  members: string[];
  createdBy: string;
  createdAt: string;
  isTeamGroup: boolean;
  teamId?: string;
}

export interface ScoringData {
  matchId: string;
  inningsNumber: number;
  battingTeam: string;
  bowlingTeam: string;
  runs: number;
  wickets: number;
  overs: number;
  balls: number;
  currentBatsmen: {
    striker: {
      id: string;
      name: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
    };
    nonStriker: {
      id: string;
      name: string;
      runs: number;
      balls: number;
      fours: number;
      sixes: number;
    };
  };
  currentBowler: {
    id: string;
    name: string;
    overs: number;
    maidens: number;
    runs: number;
    wickets: number;
  };
  thisOver: string[];
}
