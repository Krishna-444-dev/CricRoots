import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  Divider, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  CircularProgress,
  Button,
  Alert,
  Tooltip,
  IconButton,
  Slider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  SportsCricket as SportsCricketIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';

// Import types from PlayerMatchDataCollection
import { PlayerStats, MatchData, MatchConditions } from '../data/types';

// Field positions
const FIELD_POSITIONS = [
  { id: 'slip1', name: 'First Slip', zone: 'slip cordon', importance: 'high' },
  { id: 'slip2', name: 'Second Slip', zone: 'slip cordon', importance: 'high' },
  { id: 'slip3', name: 'Third Slip', zone: 'slip cordon', importance: 'medium' },
  { id: 'gully', name: 'Gully', zone: 'slip cordon', importance: 'medium' },
  { id: 'point', name: 'Point', zone: 'off side', importance: 'high' },
  { id: 'cover', name: 'Cover', zone: 'off side', importance: 'high' },
  { id: 'extraCover', name: 'Extra Cover', zone: 'off side', importance: 'medium' },
  { id: 'mid-off', name: 'Mid Off', zone: 'off side', importance: 'medium' },
  { id: 'mid-on', name: 'Mid On', zone: 'on side', importance: 'medium' },
  { id: 'midwicket', name: 'Midwicket', zone: 'on side', importance: 'high' },
  { id: 'squareLeg', name: 'Square Leg', zone: 'on side', importance: 'high' },
  { id: 'fineLeg', name: 'Fine Leg', zone: 'on side', importance: 'medium' },
  { id: 'thirdMan', name: 'Third Man', zone: 'off side', importance: 'medium' },
  { id: 'longOff', name: 'Long Off', zone: 'off side', importance: 'low' },
  { id: 'longOn', name: 'Long On', zone: 'on side', importance: 'low' },
  { id: 'deepMidwicket', name: 'Deep Midwicket', zone: 'on side', importance: 'medium' },
  { id: 'deepSquareLeg', name: 'Deep Square Leg', zone: 'on side', importance: 'medium' },
  { id: 'deepPoint', name: 'Deep Point', zone: 'off side', importance: 'medium' },
  { id: 'deepCover', name: 'Deep Cover', zone: 'off side', importance: 'medium' },
  { id: 'shortLeg', name: 'Short Leg', zone: 'on side', importance: 'special' },
  { id: 'sillPoint', name: 'Silly Point', zone: 'off side', importance: 'special' },
  { id: 'shortMidwicket', name: 'Short Midwicket', zone: 'on side', importance: 'special' }
];

// Interface for fielding recommendation
interface FieldingRecommendation {
  positionId: string;
  playerId: string;
  score: number;
  reasons: string[];
}

// Interface for field setting
interface FieldSetting {
  positionId: string;
  playerId: string;
  score: number;
}

// Mock data for testing
const mockPlayers: PlayerStats[] = [
  {
    id: 'p1',
    name: 'Virat Kohli',
    role: 'batsman',
    battingStyle: 'right-handed',
    battingStats: {
      matches: 120,
      innings: 115,
      runs: 5800,
      average: 52.7,
      strikeRate: 138.5,
      fifties: 40,
      hundreds: 5,
      highestScore: 122,
      ballsFaced: 4187,
      fours: 520,
      sixes: 201
    },
    fieldingStats: {
      catches: 78,
      runOuts: 32
    },
    advancedStats: {
      vsSpinBowlingAvg: 58.3,
      vsPaceBowlingAvg: 48.2,
      powerplayStrikeRate: 125.7,
      deathOversStrikeRate: 192.3,
      fieldingPositionStrengths: ['cover', 'long-off']
    },
    recentForm: {
      lastFiveInningsRuns: [82, 43, 67, 12, 91],
      lastFiveMatchesAverage: 59.0,
      currentForm: 'excellent'
    },
    matchupData: {
      strongAgainstPlayers: ['p7', 'p9'],
      weakAgainstPlayers: ['p8'],
      preferredBattingPosition: 3
    }
  },
  {
    id: 'p2',
    name: 'Rohit Sharma',
    role: 'batsman',
    battingStyle: 'right-handed',
    battingStats: {
      matches: 125,
      innings: 123,
      runs: 5400,
      average: 45.0,
      strikeRate: 140.2,
      fifties: 28,
      hundreds: 4,
      highestScore: 118,
      ballsFaced: 3851,
      fours: 498,
      sixes: 264
    },
    fieldingStats: {
      catches: 65,
      runOuts: 22
    },
    advancedStats: {
      vsSpinBowlingAvg: 52.1,
      vsPaceBowlingAvg: 42.3,
      powerplayStrikeRate: 145.8,
      deathOversStrikeRate: 182.5,
      fieldingPositionStrengths: ['slip', 'mid-wicket']
    },
    recentForm: {
      lastFiveInningsRuns: [45, 76, 12, 34, 55],
      lastFiveMatchesAverage: 44.4,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p10', 'p11'],
      weakAgainstPlayers: ['p12'],
      preferredBattingPosition: 1
    }
  },
  {
    id: 'p3',
    name: 'KL Rahul',
    role: 'batsman',
    battingStyle: 'right-handed',
    battingStats: {
      matches: 110,
      innings: 108,
      runs: 4200,
      average: 40.8,
      strikeRate: 132.5,
      fifties: 32,
      hundreds: 3,
      highestScore: 110,
      ballsFaced: 3169,
      fours: 410,
      sixes: 180
    },
    fieldingStats: {
      catches: 55,
      runOuts: 18
    },
    advancedStats: {
      vsSpinBowlingAvg: 45.2,
      vsPaceBowlingAvg: 38.7,
      powerplayStrikeRate: 138.2,
      deathOversStrikeRate: 165.8,
      fieldingPositionStrengths: ['point', 'long-on']
    },
    recentForm: {
      lastFiveInningsRuns: [23, 56, 78, 34, 12],
      lastFiveMatchesAverage: 40.6,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p8', 'p12'],
      weakAgainstPlayers: ['p7'],
      preferredBattingPosition: 2
    }
  },
  {
    id: 'p4',
    name: 'Rishabh Pant',
    role: 'wicket-keeper',
    battingStyle: 'left-handed',
    battingStats: {
      matches: 95,
      innings: 90,
      runs: 3800,
      average: 44.2,
      strikeRate: 150.8,
      fifties: 25,
      hundreds: 2,
      highestScore: 128,
      ballsFaced: 2520,
      fours: 380,
      sixes: 210
    },
    fieldingStats: {
      catches: 120,
      runOuts: 25,
      stumpings: 45
    },
    advancedStats: {
      vsSpinBowlingAvg: 60.5,
      vsPaceBowlingAvg: 35.8,
      powerplayStrikeRate: 135.2,
      deathOversStrikeRate: 195.6,
      fieldingPositionStrengths: ['wicket-keeper']
    },
    recentForm: {
      lastFiveInningsRuns: [65, 12, 89, 34, 56],
      lastFiveMatchesAverage: 51.2,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p9', 'p10'],
      weakAgainstPlayers: ['p11'],
      preferredBattingPosition: 5
    }
  },
  {
    id: 'p5',
    name: 'Hardik Pandya',
    role: 'all-rounder',
    battingStyle: 'right-handed',
    bowlingStyle: 'right-arm medium-fast',
    battingStats: {
      matches: 105,
      innings: 95,
      runs: 2800,
      average: 32.6,
      strikeRate: 155.2,
      fifties: 18,
      hundreds: 0,
      highestScore: 92,
      ballsFaced: 1804,
      fours: 220,
      sixes: 185
    },
    bowlingStats: {
      matches: 105,
      innings: 100,
      overs: 320.5,
      wickets: 110,
      economy: 8.2,
      average: 24.5,
      bestFigures: '4/16',
      strikeRate: 17.5
    },
    fieldingStats: {
      catches: 60,
      runOuts: 28
    },
    advancedStats: {
      vsSpinBowlingAvg: 38.2,
      vsPaceBowlingAvg: 30.1,
      powerplayStrikeRate: 140.5,
      deathOversStrikeRate: 198.2,
      bowlingPowerplayEconomy: 8.8,
      bowlingDeathEconomy: 9.5,
      fieldingPositionStrengths: ['long-on', 'long-off']
    },
    recentForm: {
      lastFiveInningsRuns: [45, 32, 67, 12, 38],
      lastFiveInningsWickets: [2, 1, 3, 0, 2],
      lastFiveMatchesAverage: 38.8,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p8', 'p11'],
      weakAgainstPlayers: ['p9'],
      preferredBattingPosition: 6,
      preferredBowlingPhase: 'middle'
    }
  },
  {
    id: 'p6',
    name: 'Ravindra Jadeja',
    role: 'all-rounder',
    battingStyle: 'left-handed',
    bowlingStyle: 'left-arm orthodox',
    battingStats: {
      matches: 115,
      innings: 90,
      runs: 2200,
      average: 30.1,
      strikeRate: 135.8,
      fifties: 12,
      hundreds: 0,
      highestScore: 85,
      ballsFaced: 1620,
      fours: 180,
      sixes: 95
    },
    bowlingStats: {
      matches: 115,
      innings: 112,
      overs: 410.2,
      wickets: 140,
      economy: 7.1,
      average: 22.8,
      bestFigures: '5/21',
      strikeRate: 17.6
    },
    fieldingStats: {
      catches: 85,
      runOuts: 45
    },
    advancedStats: {
      vsSpinBowlingAvg: 32.5,
      vsPaceBowlingAvg: 28.6,
      powerplayStrikeRate: 125.2,
      deathOversStrikeRate: 165.8,
      bowlingPowerplayEconomy: 7.8,
      bowlingDeathEconomy: 8.2,
      fieldingPositionStrengths: ['point', 'cover', 'mid-wicket']
    },
    recentForm: {
      lastFiveInningsRuns: [35, 42, 18, 56, 22],
      lastFiveInningsWickets: [3, 2, 1, 4, 2],
      lastFiveMatchesAverage: 34.6,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p12', 'p10'],
      weakAgainstPlayers: ['p7'],
      preferredBattingPosition: 7,
      preferredBowlingPhase: 'middle'
    }
  },
  {
    id: 'p7',
    name: 'Jasprit Bumrah',
    role: 'bowler',
    battingStyle: 'right-handed',
    bowlingStyle: 'right-arm fast',
    battingStats: {
      matches: 95,
      innings: 35,
      runs: 120,
      average: 8.5,
      strikeRate: 85.7,
      fifties: 0,
      hundreds: 0,
      highestScore: 16,
      ballsFaced: 140,
      fours: 10,
      sixes: 4
    },
    bowlingStats: {
      matches: 95,
      innings: 94,
      overs: 370.4,
      wickets: 130,
      economy: 6.7,
      average: 19.2,
      bestFigures: '5/27',
      strikeRate: 17.2
    },
    fieldingStats: {
      catches: 25,
      runOuts: 8
    },
    advancedStats: {
      bowlingPowerplayEconomy: 7.2,
      bowlingDeathEconomy: 6.1,
      fieldingPositionStrengths: ['fine-leg', 'third-man']
    },
    recentForm: {
      lastFiveInningsWickets: [3, 2, 1, 4, 2],
      lastFiveMatchesAverage: 16.8,
      currentForm: 'excellent'
    },
    matchupData: {
      strongAgainstPlayers: ['p2', 'p4'],
      weakAgainstPlayers: ['p1'],
      preferredBowlingPhase: 'death'
    }
  },
  {
    id: 'p8',
    name: 'Yuzvendra Chahal',
    role: 'bowler',
    battingStyle: 'right-handed',
    bowlingStyle: 'leg-break',
    battingStats: {
      matches: 85,
      innings: 20,
      runs: 45,
      average: 5.6,
      strikeRate: 70.3,
      fifties: 0,
      hundreds: 0,
      highestScore: 8,
      ballsFaced: 64,
      fours: 4,
      sixes: 1
    },
    bowlingStats: {
      matches: 85,
      innings: 84,
      overs: 325.3,
      wickets: 120,
      economy: 7.8,
      average: 21.5,
      bestFigures: '4/17',
      strikeRate: 16.3
    },
    fieldingStats: {
      catches: 18,
      runOuts: 5
    },
    advancedStats: {
      bowlingPowerplayEconomy: 8.5,
      bowlingDeathEconomy: 9.2,
      fieldingPositionStrengths: ['point', 'short fine-leg']
    },
    recentForm: {
      lastFiveInningsWickets: [2, 3, 1, 0, 4],
      lastFiveMatchesAverage: 18.2,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p1', 'p5'],
      weakAgainstPlayers: ['p4'],
      preferredBowlingPhase: 'middle'
    }
  },
  {
    id: 'p9',
    name: 'Ravichandran Ashwin',
    role: 'bowler',
    battingStyle: 'right-handed',
    bowlingStyle: 'off-break',
    battingStats: {
      matches: 110,
      innings: 60,
      runs: 420,
      average: 12.4,
      strikeRate: 95.5,
      fifties: 0,
      hundreds: 0,
      highestScore: 32,
      ballsFaced: 440,
      fours: 35,
      sixes: 12
    },
    bowlingStats: {
      matches: 110,
      innings: 108,
      overs: 415.2,
      wickets: 145,
      economy: 7.2,
      average: 22.8,
      bestFigures: '4/8',
      strikeRate: 17.2
    },
    fieldingStats: {
      catches: 30,
      runOuts: 12
    },
    advancedStats: {
      bowlingPowerplayEconomy: 7.5,
      bowlingDeathEconomy: 8.8,
      fieldingPositionStrengths: ['mid-on', 'mid-off']
    },
    recentForm: {
      lastFiveInningsWickets: [1, 2, 3, 1, 2],
      lastFiveMatchesAverage: 20.5,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p3', 'p6'],
      weakAgainstPlayers: ['p2'],
      preferredBowlingPhase: 'middle'
    }
  },
  {
    id: 'p10',
    name: 'Mohammed Shami',
    role: 'bowler',
    battingStyle: 'right-handed',
    bowlingStyle: 'right-arm fast',
    battingStats: {
      matches: 90,
      innings: 30,
      runs: 85,
      average: 6.5,
      strikeRate: 80.2,
      fifties: 0,
      hundreds: 0,
      highestScore: 12,
      ballsFaced: 106,
      fours: 8,
      sixes: 2
    },
    bowlingStats: {
      matches: 90,
      innings: 89,
      overs: 345.1,
      wickets: 125,
      economy: 7.5,
      average: 20.8,
      bestFigures: '5/25',
      strikeRate: 16.6
    },
    fieldingStats: {
      catches: 15,
      runOuts: 6
    },
    advancedStats: {
      bowlingPowerplayEconomy: 6.8,
      bowlingDeathEconomy: 8.5,
      fieldingPositionStrengths: ['third-man', 'fine-leg']
    },
    recentForm: {
      lastFiveInningsWickets: [2, 1, 3, 2, 0],
      lastFiveMatchesAverage: 22.4,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p3', 'p5'],
      weakAgainstPlayers: ['p1'],
      preferredBowlingPhase: 'powerplay'
    }
  },
  {
    id: 'p11',
    name: 'Kuldeep Yadav',
    role: 'bowler',
    battingStyle: 'left-handed',
    bowlingStyle: 'left-arm chinaman',
    battingStats: {
      matches: 75,
      innings: 25,
      runs: 65,
      average: 5.9,
      strikeRate: 75.6,
      fifties: 0,
      hundreds: 0,
      highestScore: 10,
      ballsFaced: 86,
      fours: 6,
      sixes: 1
    },
    bowlingStats: {
      matches: 75,
      innings: 74,
      overs: 280.4,
      wickets: 105,
      economy: 7.9,
      average: 22.5,
      bestFigures: '4/20',
      strikeRate: 16.0
    },
    fieldingStats: {
      catches: 20,
      runOuts: 7
    },
    advancedStats: {
      bowlingPowerplayEconomy: 8.2,
      bowlingDeathEconomy: 9.5,
      fieldingPositionStrengths: ['deep square leg', 'deep mid-wicket']
    },
    recentForm: {
      lastFiveInningsWickets: [3, 1, 2, 2, 1],
      lastFiveMatchesAverage: 21.8,
      currentForm: 'good'
    },
    matchupData: {
      strongAgainstPlayers: ['p2', 'p6'],
      weakAgainstPlayers: ['p4'],
      preferredBowlingPhase: 'middle'
    }
  }
];

// Mock data for current batsman
const mockCurrentBatsman: PlayerStats = {
  id: 'p1',
  name: 'Virat Kohli',
  role: 'batsman',
  battingStyle: 'right-handed',
  battingStats: {
    matches: 120,
    innings: 115,
    runs: 5800,
    average: 52.7,
    strikeRate: 138.5,
    fifties: 40,
    hundreds: 5,
    highestScore: 122,
    ballsFaced: 4187,
    fours: 520,
    sixes: 201
  },
  fieldingStats: {
    catches: 78,
    runOuts: 32
  },
  advancedStats: {
    vsSpinBowlingAvg: 58.3,
    vsPaceBowlingAvg: 48.2,
    powerplayStrikeRate: 125.7,
    deathOversStrikeRate: 192.3,
    fieldingPositionStrengths: ['cover', 'long-off']
  },
  recentForm: {
    lastFiveInningsRuns: [82, 43, 67, 12, 91],
    lastFiveMatchesAverage: 59.0,
    currentForm: 'excellent'
  },
  matchupData: {
    strongAgainstPlayers: ['p7', 'p9'],
    weakAgainstPlayers: ['p8'],
    preferredBattingPosition: 3
  },
  // Mock shot distribution data
  shotDistribution: {
    cover: 25,
    point: 15,
    thirdMan: 10,
    fineLeg: 5,
    midwicket: 20,
    longOn: 15,
    longOff: 10
  }
};

// Mock data for current bowler
const mockCurrentBowler: PlayerStats = {
  id: 'p7',
  name: 'Jasprit Bumrah',
  role: 'bowler',
  battingStyle: 'right-handed',
  bowlingStyle: 'right-arm fast',
  battingStats: {
    matches: 95,
    innings: 35,
    runs: 120,
    average: 8.5,
    strikeRate: 85.7,
    fifties: 0,
    hundreds: 0,
    highestScore: 16,
    ballsFaced: 140,
    fours: 10,
    sixes: 4
  },
  bowlingStats: {
    matches: 95,
    innings: 94,
    overs: 370.4,
    wickets: 130,
    economy: 6.7,
    average: 19.2,
    bestFigures: '5/27',
    strikeRate: 17.2
  },
  fieldingStats: {
    catches: 25,
    runOuts: 8
  },
  advancedStats: {
    bowlingPowerplayEconomy: 7.2,
    bowlingDeathEconomy: 6.1,
    fieldingPositionStrengths: ['fine-leg', 'third-man']
  },
  recentForm: {
    lastFiveInningsWickets: [3, 2, 1, 4, 2],
    lastFiveMatchesAverage: 16.8,
    currentForm: 'excellent'
  },
  matchupData: {
    strongAgainstPlayers: ['p2', 'p4'],
    weakAgainstPlayers: ['p1'],
    preferredBowlingPhase: 'death'
  }
};

const mockCurrentMatch: MatchData = {
  id: 'm1',
  date: '2025-03-27',
  teams: {
    teamA: 'Royal Challengers',
    teamB: 'Mumbai Indians'
  },
  format: 'T20',
  overs: 20,
  conditions: {
    venue: 'M. Chinnaswamy Stadium',
    pitchType: 'batting-friendly',
    weather: 'sunny',
    temperature: 32,
    humidity: 65,
    windSpeed: 8,
    groundSize: 'small',
    outfield: 'fast',
    previousMatchScores: [
      {
        firstInningsScore: 205,
        secondInningsScore: 198,
        date: '2025-03-10'
      }
    ]
  },
  playerPerformances: [],
  matchSituation: {
    currentInnings: 1,
    currentScore: 85,
    wicketsLost: 2,
    oversCompleted: 9.4,
    currentRunRate: 8.79,
    requiredRunRate: undefined,
    currentBatsmen: ['p1', 'p4'],
    currentBowler: 'p7',
    lastBowlers: ['p8', 'p9'],
    phase: 'middle'
  }
};

// Function to calculate fielding recommendations
const calculateFieldingRecommendations = (
  availablePlayers: PlayerStats[],
  currentBatsman: PlayerStats,
  currentBowler: PlayerStats,
  match: MatchData
): FieldingRecommendation[] => {
  const recommendations: FieldingRecommendation[] = [];
  
  // Exclude wicketkeeper from general fielding positions
  const wicketkeeper = availablePlayers.find(player => player.role === 'wicket-keeper');
  const fieldingPlayers = availablePlayers.filter(player => player.id !== wicketkeeper?.id && player.id !== currentBowler.id);
  
  // For each field position, find the best player
  for (const position of FIELD_POSITIONS) {
    const positionRecommendations: FieldingRecommendation[] = [];
    
    for (const player of fieldingPlayers) {
      // Calculate score for this player in this position
      const score = calculatePlayerPositionScore(player, position, currentBatsman, currentBowler, match);
      const reasons = generateReasons(player, position, currentBatsman, currentBowler, match);
      
      positionRecommendations.push({
        positionId: position.id,
        playerId: player.id,
        score,
        reasons
      });
    }
    
    // Sort by score (descending) and take the best recommendation
    positionRecommendations.sort((a, b) => b.score - a.score);
    if (positionRecommendations.length > 0) {
      recommendations.push(positionRecommendations[0]);
    }
  }
  
  return recommendations;
};

// Function to calculate player-position score
const calculatePlayerPositionScore = (
  player: PlayerStats,
  position: typeof FIELD_POSITIONS[0],
  batsman: PlayerStats,
  bowler: PlayerStats,
  match: MatchData
): number => {
  let score = 0.5; // Neutral starting point
  
  // Check if player has specific strength in this position
  if (player.advancedStats.fieldingPositionStrengths && 
      player.advancedStats.fieldingPositionStrengths.some(pos => 
        pos.toLowerCase() === position.id.toLowerCase() || 
        pos.toLowerCase().replace('-', '') === position.id.toLowerCase().replace('-', '')
      )) {
    score += 0.3;
  }
  
  // Check if position is in batsman's high-scoring zone
  if (batsman.shotDistribution && batsman.shotDistribution[position.id as keyof typeof batsman.shotDistribution]) {
    const shotPercentage = batsman.shotDistribution[position.id as keyof typeof batsman.shotDistribution];
    if (shotPercentage > 20) {
      // High-scoring zone, prioritize good fielders here
      score += 0.2 * (player.fieldingStats.catches / 50); // Normalize catches (assuming 50+ is excellent)
    }
  }
  
  // Adjust for fielding stats
  if (player.fieldingStats) {
    // Normalize catches (assuming 50+ is excellent)
    const normalizedCatches = Math.min(player.fieldingStats.catches / 50, 1);
    // Normalize run outs (assuming 25+ is excellent)
    const normalizedRunOuts = Math.min(player.fieldingStats.runOuts / 25, 1);
    
    // Weight based on position importance
    if (position.importance === 'high') {
      score += 0.2 * normalizedCatches + 0.1 * normalizedRunOuts;
    } else if (position.importance === 'medium') {
      score += 0.15 * normalizedCatches + 0.05 * normalizedRunOuts;
    } else {
      score += 0.1 * normalizedCatches + 0.05 * normalizedRunOuts;
    }
  }
  
  // Adjust for bowler type
  if (bowler.bowlingStyle) {
    if (bowler.bowlingStyle.includes('fast') || bowler.bowlingStyle.includes('medium')) {
      // For pace bowlers, prioritize slip cordon and backward positions
      if (position.zone === 'slip cordon') {
        score += 0.15;
      }
    } else if (bowler.bowlingStyle.includes('spin') || 
               bowler.bowlingStyle.includes('break') || 
               bowler.bowlingStyle.includes('orthodox')) {
      // For spin bowlers, prioritize close-in fielders
      if (position.importance === 'special') {
        score += 0.15;
      }
    }
  }
  
  // Adjust for match phase
  if (match.matchSituation.phase === 'powerplay') {
    // In powerplay, prioritize boundary riders and slip cordon
    if (position.zone === 'slip cordon' || position.id.startsWith('deep')) {
      score += 0.1;
    }
  } else if (match.matchSituation.phase === 'death') {
    // In death overs, prioritize boundary fielders
    if (position.id.startsWith('deep') || position.id.startsWith('long')) {
      score += 0.1;
    }
  }
  
  return Math.max(0, Math.min(1, score));
};

// Function to generate reasons for recommendation
const generateReasons = (
  player: PlayerStats,
  position: typeof FIELD_POSITIONS[0],
  batsman: PlayerStats,
  bowler: PlayerStats,
  match: MatchData
): string[] => {
  const reasons: string[] = [];
  
  // Check for position strength
  if (player.advancedStats.fieldingPositionStrengths && 
      player.advancedStats.fieldingPositionStrengths.some(pos => 
        pos.toLowerCase() === position.id.toLowerCase() || 
        pos.toLowerCase().replace('-', '') === position.id.toLowerCase().replace('-', '')
      )) {
    reasons.push(`${player.name} specializes in fielding at ${position.name} position`);
  }
  
  // Check for batsman shot distribution
  if (batsman.shotDistribution && batsman.shotDistribution[position.id as keyof typeof batsman.shotDistribution]) {
    const shotPercentage = batsman.shotDistribution[position.id as keyof typeof batsman.shotDistribution];
    if (shotPercentage > 20) {
      reasons.push(`${batsman.name} plays ${shotPercentage}% of shots in this area`);
    }
  }
  
  // Check for fielding stats
  if (player.fieldingStats && player.fieldingStats.catches > 40) {
    reasons.push(`${player.name} has taken ${player.fieldingStats.catches} catches in career`);
  }
  
  if (player.fieldingStats && player.fieldingStats.runOuts > 20) {
    reasons.push(`${player.name} has executed ${player.fieldingStats.runOuts} run outs in career`);
  }
  
  // Check for bowler type compatibility
  if (bowler.bowlingStyle) {
    if (bowler.bowlingStyle.includes('fast') || bowler.bowlingStyle.includes('medium')) {
      if (position.zone === 'slip cordon') {
        reasons.push(`Good slip fielder for ${bowler.name}'s pace bowling`);
      }
    } else if (bowler.bowlingStyle.includes('spin') || 
               bowler.bowlingStyle.includes('break') || 
               bowler.bowlingStyle.includes('orthodox')) {
      if (position.importance === 'special') {
        reasons.push(`Good close-in fielder for ${bowler.name}'s spin bowling`);
      }
    }
  }
  
  // If no specific reasons, add a generic one
  if (reasons.length === 0) {
    reasons.push(`${player.name} is a solid option for ${position.name} position`);
  }
  
  return reasons;
};

// Function to optimize field setting
const optimizeFieldSetting = (
  recommendations: FieldingRecommendation[],
  availablePlayers: PlayerStats[]
): FieldSetting[] => {
  const fieldSetting: FieldSetting[] = [];
  const assignedPlayers = new Set<string>();
  
  // First, sort all recommendations by score (descending)
  const allRecommendations = [...recommendations].sort((a, b) => b.score - a.score);
  
  // Assign players to positions, starting with highest scores
  for (const recommendation of allRecommendations) {
    // Skip if this position already has a player assigned
    if (fieldSetting.some(setting => setting.positionId === recommendation.positionId)) {
      continue;
    }
    
    // Skip if this player is already assigned to another position
    if (assignedPlayers.has(recommendation.playerId)) {
      // Try to find next best player for this position
      const nextBestPlayer = recommendations
        .filter(rec => 
          rec.positionId === recommendation.positionId && 
          !assignedPlayers.has(rec.playerId)
        )
        .sort((a, b) => b.score - a.score)[0];
      
      if (nextBestPlayer) {
        fieldSetting.push({
          positionId: nextBestPlayer.positionId,
          playerId: nextBestPlayer.playerId,
          score: nextBestPlayer.score
        });
        assignedPlayers.add(nextBestPlayer.playerId);
      }
    } else {
      // Assign this player to this position
      fieldSetting.push({
        positionId: recommendation.positionId,
        playerId: recommendation.playerId,
        score: recommendation.score
      });
      assignedPlayers.add(recommendation.playerId);
    }
  }
  
  // Fill any remaining positions with unassigned players
  const remainingPositions = FIELD_POSITIONS.filter(
    position => !fieldSetting.some(setting => setting.positionId === position.id)
  );
  
  const remainingPlayers = availablePlayers.filter(
    player => !assignedPlayers.has(player.id) && player.role !== 'wicket-keeper'
  );
  
  for (let i = 0; i < Math.min(remainingPositions.length, remainingPlayers.length); i++) {
    fieldSetting.push({
      positionId: remainingPositions[i].id,
      playerId: remainingPlayers[i].id,
      score: 0.5 // Neutral score for default assignments
    });
  }
  
  return fieldSetting;
};

// Component for field visualization
const FieldVisualization: React.FC<{
  fieldSetting: FieldSetting[];
  players: PlayerStats[];
}> = ({ fieldSetting, players }) => {
  // Field dimensions
  const fieldWidth = 600;
  const fieldHeight = 600;
  const centerX = fieldWidth / 2;
  const centerY = fieldHeight / 2;
  const boundaryRadius = fieldWidth * 0.45;
  const pitchLength = fieldWidth * 0.15;
  const pitchWidth = fieldWidth * 0.03;
  
  // Position coordinates (relative to center, normalized to -1 to 1)
  const positionCoordinates: Record<string, [number, number]> = {
    'slip1': [0.2, -0.15],
    'slip2': [0.25, -0.2],
    'slip3': [0.3, -0.25],
    'gully': [0.35, -0.3],
    'point': [0.5, -0.5],
    'cover': [0.3, -0.7],
    'extraCover': [0.15, -0.8],
    'mid-off': [0, -0.85],
    'mid-on': [0, 0.85],
    'midwicket': [0.3, 0.7],
    'squareLeg': [0.5, 0.5],
    'fineLeg': [0.35, 0.3],
    'thirdMan': [0.8, -0.6],
    'longOff': [0, -1],
    'longOn': [0, 1],
    'deepMidwicket': [0.7, 0.7],
    'deepSquareLeg': [0.9, 0.4],
    'deepPoint': [0.9, -0.4],
    'deepCover': [0.7, -0.7],
    'shortLeg': [0.1, 0.1],
    'sillPoint': [0.1, -0.1],
    'shortMidwicket': [0.1, 0.3]
  };
  
  // Function to get player by ID
  const getPlayerById = (playerId: string): PlayerStats | undefined => {
    return players.find(player => player.id === playerId);
  };
  
  // Function to get position name by ID
  const getPositionNameById = (positionId: string): string => {
    const position = FIELD_POSITIONS.find(pos => pos.id === positionId);
    return position ? position.name : positionId;
  };
  
  // Function to get color based on score
  const getScoreColor = (score: number): string => {
    if (score >= 0.8) return '#4caf50'; // Green
    if (score >= 0.6) return '#8bc34a'; // Light green
    if (score >= 0.4) return '#ffc107'; // Amber
    return '#ff9800'; // Orange
  };
  
  return (
    <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center', mt: 2 }}>
      <Box
        sx={{
          width: fieldWidth,
          height: fieldHeight,
          position: 'relative',
          borderRadius: '50%',
          border: '2px solid #4caf50',
          backgroundColor: '#e8f5e9',
          overflow: 'hidden'
        }}
      >
        {/* Boundary circle */}
        <Box
          sx={{
            position: 'absolute',
            top: centerY - boundaryRadius,
            left: centerX - boundaryRadius,
            width: boundaryRadius * 2,
            height: boundaryRadius * 2,
            borderRadius: '50%',
            border: '2px dashed #388e3c'
          }}
        />
        
        {/* Pitch */}
        <Box
          sx={{
            position: 'absolute',
            top: centerY - pitchLength / 2,
            left: centerX - pitchWidth / 2,
            width: pitchWidth,
            height: pitchLength,
            backgroundColor: '#d7ccc8',
            border: '1px solid #8d6e63'
          }}
        />
        
        {/* Fielders */}
        {fieldSetting.map((setting) => {
          const player = getPlayerById(setting.playerId);
          const position = positionCoordinates[setting.positionId];
          
          if (!position) return null;
          
          // Convert normalized coordinates to actual position
          const x = centerX + position[0] * boundaryRadius;
          const y = centerY + position[1] * boundaryRadius;
          
          return (
            <Tooltip
              key={setting.positionId}
              title={`${player?.name || setting.playerId} at ${getPositionNameById(setting.positionId)}`}
            >
              <Box
                sx={{
                  position: 'absolute',
                  top: y - 15,
                  left: x - 15,
                  width: 30,
                  height: 30,
                  borderRadius: '50%',
                  backgroundColor: getScoreColor(setting.score),
                  border: '2px solid white',
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 12,
                  cursor: 'pointer',
                  zIndex: 10
                }}
              >
                {player?.name.substring(0, 2) || '??'}
              </Box>
            </Tooltip>
          );
        })}
        
        {/* Batsmen */}
        <Box
          sx={{
            position: 'absolute',
            top: centerY - 10,
            left: centerX - 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#f44336',
            border: '2px solid white',
            zIndex: 5
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: centerY - 10,
            left: centerX - 10 + pitchWidth,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#f44336',
            border: '2px solid white',
            zIndex: 5
          }}
        />
        
        {/* Bowler */}
        <Box
          sx={{
            position: 'absolute',
            top: centerY - pitchLength / 2 - 20,
            left: centerX - 10,
            width: 20,
            height: 20,
            borderRadius: '50%',
            backgroundColor: '#2196f3',
            border: '2px solid white',
            zIndex: 5
          }}
        />
      </Box>
    </Box>
  );
};

const FieldingPositionOptimizationComponent: React.FC = () => {
  const [players, setPlayers] = useState<PlayerStats[]>(mockPlayers);
  const [currentBatsman, setCurrentBatsman] = useState<PlayerStats>(mockCurrentBatsman);
  const [currentBowler, setCurrentBowler] = useState<PlayerStats>(mockCurrentBowler);
  const [currentMatch, setCurrentMatch] = useState<MatchData>(mockCurrentMatch);
  const [recommendations, setRecommendations] = useState<FieldingRecommendation[]>([]);
  const [fieldSetting, setFieldSetting] = useState<FieldSetting[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedPosition, setSelectedPosition] = useState<string | null>(null);
  const [showVisualization, setShowVisualization] = useState<boolean>(true);
  const [showRecommendations, setShowRecommendations] = useState<boolean>(true);
  
  // Calculate recommendations on component mount or when dependencies change
  useEffect(() => {
    generateRecommendations();
  }, [players, currentBatsman, currentBowler, currentMatch]);
  
  // Function to generate recommendations
  const generateRecommendations = () => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const newRecommendations = calculateFieldingRecommendations(
        players,
        currentBatsman,
        currentBowler,
        currentMatch
      );
      
      setRecommendations(newRecommendations);
      
      // Optimize field setting
      const newFieldSetting = optimizeFieldSetting(newRecommendations, players);
      setFieldSetting(newFieldSetting);
      
      setIsLoading(false);
    }, 1000);
  };
  
  // Function to handle position selection
  const handlePositionSelect = (positionId: string) => {
    setSelectedPosition(positionId === selectedPosition ? null : positionId);
  };
  
  // Function to get player by ID
  const getPlayerById = (playerId: string): PlayerStats | undefined => {
    return players.find(player => player.id === playerId);
  };
  
  // Function to get position by ID
  const getPositionById = (positionId: string): typeof FIELD_POSITIONS[0] | undefined => {
    return FIELD_POSITIONS.find(position => position.id === positionId);
  };
  
  // Function to get recommendations for a specific position
  const getRecommendationsForPosition = (positionId: string): FieldingRecommendation[] => {
    return recommendations
      .filter(rec => rec.positionId === positionId)
      .sort((a, b) => b.score - a.score);
  };
  
  // Function to format score as percentage
  const formatScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Fielding Position Optimization
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          AI-powered fielding position recommendations based on batsman tendencies and match conditions
        </Typography>
        
        <Grid container spacing={3} sx={{ mt: 2 }}>
          {/* Match Situation Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Current Match Situation</Typography>
                  <Button 
                    startIcon={<RefreshIcon />} 
                    variant="outlined" 
                    size="small"
                    onClick={generateRecommendations}
                  >
                    Refresh
                  </Button>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle1">
                      {currentMatch.teams.teamA} vs {currentMatch.teams.teamB}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {currentMatch.format} • {currentMatch.overs} overs • {currentMatch.conditions.venue}
                    </Typography>
                    
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body2">
                        <strong>Score:</strong> {currentMatch.matchSituation.currentScore}/{currentMatch.matchSituation.wicketsLost}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Overs:</strong> {currentMatch.matchSituation.oversCompleted}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Run Rate:</strong> {currentMatch.matchSituation.currentRunRate}
                      </Typography>
                      <Typography variant="body2">
                        <strong>Phase:</strong> {currentMatch.matchSituation.phase}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Current Batsman</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={currentBatsman.name}
                        color="primary"
                        variant="outlined"
                      />
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ mt: 2 }}>Current Bowler</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={currentBowler.name}
                        color="secondary"
                        variant="outlined"
                      />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {currentBowler.bowlingStyle}
                      </Typography>
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ mt: 2 }}>Conditions</Typography>
                    <Box sx={{ mt: 1 }}>
                      <Chip 
                        label={currentMatch.conditions.pitchType}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                      <Chip 
                        label={currentMatch.conditions.weather}
                        size="small"
                        sx={{ mr: 1, mb: 1 }}
                      />
                      <Chip 
                        label={`${currentMatch.conditions.groundSize} ground`}
                        size="small"
                        sx={{ mb: 1 }}
                      />
                    </Box>
                  </Grid>
                </Grid>
                
                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Batsman Shot Distribution</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Zone</TableCell>
                        <TableCell align="center">Percentage</TableCell>
                        <TableCell align="center">Strength</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(currentBatsman.shotDistribution || {}).map(([zone, percentage]) => (
                        <TableRow key={zone}>
                          <TableCell>{zone}</TableCell>
                          <TableCell align="center">{percentage}%</TableCell>
                          <TableCell align="center">
                            <Chip 
                              label={percentage > 20 ? 'Strong' : percentage > 10 ? 'Medium' : 'Weak'}
                              size="small"
                              color={percentage > 20 ? 'error' : percentage > 10 ? 'warning' : 'success'}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Field Visualization Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="h6">Optimized Field Setting</Typography>
                  <Box>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={showVisualization}
                          onChange={(e) => setShowVisualization(e.target.checked)}
                        />
                      }
                      label="Show Visualization"
                    />
                  </Box>
                </Box>
                <Divider sx={{ mb: 2 }} />
                
                {isLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing batsman tendencies and optimizing field placement...
                    </Typography>
                  </Box>
                ) : (
                  <>
                    {showVisualization && (
                      <FieldVisualization 
                        fieldSetting={fieldSetting}
                        players={players}
                      />
                    )}
                    
                    <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Field Setting Summary</Typography>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Position</TableCell>
                            <TableCell>Player</TableCell>
                            <TableCell align="center">Suitability</TableCell>
                            <TableCell align="center">Actions</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {fieldSetting.map((setting) => {
                            const player = getPlayerById(setting.playerId);
                            const position = getPositionById(setting.positionId);
                            return (
                              <TableRow 
                                key={setting.positionId}
                                sx={{ 
                                  bgcolor: selectedPosition === setting.positionId ? 'action.selected' : 'inherit'
                                }}
                              >
                                <TableCell>{position?.name || setting.positionId}</TableCell>
                                <TableCell>{player?.name || setting.playerId}</TableCell>
                                <TableCell align="center">{formatScore(setting.score)}</TableCell>
                                <TableCell align="center">
                                  <Button
                                    size="small"
                                    onClick={() => handlePositionSelect(setting.positionId)}
                                  >
                                    Details
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Position Recommendations */}
          {selectedPosition && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    {getPositionById(selectedPosition)?.name || selectedPosition} - Player Recommendations
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Position Details
                      </Typography>
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2">
                          <strong>Zone:</strong> {getPositionById(selectedPosition)?.zone}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Importance:</strong> {getPositionById(selectedPosition)?.importance}
                        </Typography>
                        <Typography variant="body2">
                          <strong>Batsman Shot Percentage:</strong> {
                            currentBatsman.shotDistribution && 
                            currentBatsman.shotDistribution[selectedPosition as keyof typeof currentBatsman.shotDistribution] ?
                            `${currentBatsman.shotDistribution[selectedPosition as keyof typeof currentBatsman.shotDistribution]}%` :
                            'N/A'
                          }
                        </Typography>
                      </Box>
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Recommended Players
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Player</TableCell>
                              <TableCell align="center">Score</TableCell>
                              <TableCell align="center">Catches</TableCell>
                              <TableCell align="center">Run Outs</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {recommendations
                              .filter(rec => rec.positionId === selectedPosition)
                              .sort((a, b) => b.score - a.score)
                              .slice(0, 5)
                              .map((rec) => {
                                const player = getPlayerById(rec.playerId);
                                return (
                                  <TableRow key={rec.playerId}>
                                    <TableCell>{player?.name || rec.playerId}</TableCell>
                                    <TableCell align="center">{formatScore(rec.score)}</TableCell>
                                    <TableCell align="center">{player?.fieldingStats?.catches || 'N/A'}</TableCell>
                                    <TableCell align="center">{player?.fieldingStats?.runOuts || 'N/A'}</TableCell>
                                  </TableRow>
                                );
                              })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" gutterBottom>
                        Recommendation Reasoning
                      </Typography>
                      
                      {recommendations
                        .filter(rec => rec.positionId === selectedPosition)
                        .sort((a, b) => b.score - a.score)
                        .slice(0, 1)
                        .map((rec) => {
                          const player = getPlayerById(rec.playerId);
                          return (
                            <Box key={rec.playerId} sx={{ mb: 3 }}>
                              <Typography variant="body1" fontWeight="medium" gutterBottom>
                                {player?.name || rec.playerId} - {formatScore(rec.score)} match
                              </Typography>
                              
                              <Box sx={{ mt: 2 }}>
                                {rec.reasons.map((reason, index) => (
                                  <Box key={index} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <IconButton size="small" sx={{ mr: 1 }}>
                                      <InfoIcon fontSize="small" color="primary" />
                                    </IconButton>
                                    <Typography variant="body2">
                                      {reason}
                                    </Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Box>
                          );
                        })}
                      
                      <Typography variant="subtitle2" gutterBottom sx={{ mt: 3 }}>
                        Position Importance
                      </Typography>
                      <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        <Typography variant="body2" paragraph>
                          {getPositionById(selectedPosition)?.importance === 'high' ? (
                            <>This is a <strong>high importance</strong> position based on the current match situation and batsman tendencies.</>
                          ) : getPositionById(selectedPosition)?.importance === 'medium' ? (
                            <>This is a <strong>medium importance</strong> position in the current field setting.</>
                          ) : getPositionById(selectedPosition)?.importance === 'special' ? (
                            <>This is a <strong>special</strong> position that requires specific skills and is particularly important for the current bowling strategy.</>
                          ) : (
                            <>This is a <strong>standard</strong> position in the current field setting.</>
                          )}
                        </Typography>
                        
                        <Typography variant="body2">
                          {currentBatsman.shotDistribution && 
                           currentBatsman.shotDistribution[selectedPosition as keyof typeof currentBatsman.shotDistribution] &&
                           currentBatsman.shotDistribution[selectedPosition as keyof typeof currentBatsman.shotDistribution] > 20 ? (
                            <>This position covers a <strong>high-frequency scoring zone</strong> for {currentBatsman.name}, who plays {
                              currentBatsman.shotDistribution[selectedPosition as keyof typeof currentBatsman.shotDistribution]
                            }% of shots in this area.</>
                          ) : (
                            <>This position is aligned with the current bowling plan and field strategy.</>
                          )}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </Container>
  );
};

export default FieldingPositionOptimizationComponent;
