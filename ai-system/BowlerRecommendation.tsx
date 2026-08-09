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
  LinearProgress,
  Rating,
  Tooltip,
  IconButton,
  Avatar
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  SportsCricket as SportsCricketIcon,
  Speed as SpeedIcon,
  Bolt as BoltIcon
} from '@mui/icons-material';

// Import types from PlayerMatchDataCollection
import { PlayerStats, MatchData, MatchConditions } from '../data/types';

// Algorithm weights for different factors
const ALGORITHM_WEIGHTS = {
  matchupVsBatsmen: 0.25,
  phaseEffectiveness: 0.20,
  pitchConditionSuitability: 0.15,
  recentForm: 0.15,
  bowlerFreshness: 0.15,
  tacticalVariation: 0.10
};

// Interface for recommendation result
interface BowlerRecommendation {
  playerId: string;
  overallScore: number;
  confidenceLevel: 'very high' | 'high' | 'medium' | 'low';
  reasonScores: {
    matchupVsBatsmen: number;
    phaseEffectiveness: number;
    pitchConditionSuitability: number;
    recentForm: number;
    bowlerFreshness: number;
    tacticalVariation: number;
  };
  explanations: {
    matchupVsBatsmen: string;
    phaseEffectiveness: string;
    pitchConditionSuitability: string;
    recentForm: string;
    bowlerFreshness: string;
    tacticalVariation: string;
  };
}

// Mock data for testing
const mockPlayers: PlayerStats[] = [
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
  }
];

// Mock data for current batsmen
const mockCurrentBatsmen: PlayerStats[] = [
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
  }
];

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
    currentBowler: 'p9',
    lastBowlers: ['p7', 'p8'],
    phase: 'middle'
  }
};

// Track bowler workload in the match
interface BowlerWorkload {
  playerId: string;
  oversBowled: number;
  lastOverNumber: number | null;
  wicketsTaken: number;
  runsConceded: number;
}

const mockBowlerWorkloads: BowlerWorkload[] = [
  {
    playerId: 'p7',
    oversBowled: 3,
    lastOverNumber: 8,
    wicketsTaken: 1,
    runsConceded: 24
  },
  {
    playerId: 'p8',
    oversBowled: 2,
    lastOverNumber: 7,
    wicketsTaken: 0,
    runsConceded: 18
  },
  {
    playerId: 'p9',
    oversBowled: 2.4,
    lastOverNumber: 10, // Current over
    wicketsTaken: 1,
    runsConceded: 22
  },
  {
    playerId: 'p10',
    oversBowled: 1,
    lastOverNumber: 3,
    wicketsTaken: 0,
    runsConceded: 12
  },
  {
    playerId: 'p11',
    oversBowled: 1,
    lastOverNumber: 5,
    wicketsTaken: 0,
    runsConceded: 9
  }
];

// Bowler recommendation algorithm
const calculateBowlerRecommendations = (
  availablePlayers: PlayerStats[],
  currentMatch: MatchData,
  currentBatsmen: PlayerStats[],
  bowlerWorkloads: BowlerWorkload[]
): BowlerRecommendation[] => {
  // Filter out players who can bowl (bowlers and all-rounders)
  const eligiblePlayers = availablePlayers.filter(
    player => player.bowlingStats && (player.role === 'bowler' || player.role === 'all-rounder')
  );
  
  // Calculate recommendations for each eligible player
  const recommendations: BowlerRecommendation[] = eligiblePlayers.map(player => {
    // Calculate matchup score against current batsmen (0-1)
    const matchupScore = calculateMatchupScore(player, currentBatsmen);
    
    // Calculate phase effectiveness score (0-1)
    const phaseScore = calculatePhaseEffectivenessScore(player, currentMatch.matchSituation.phase);
    
    // Calculate pitch condition suitability score (0-1)
    const pitchConditionScore = calculatePitchConditionScore(player, currentMatch.conditions);
    
    // Calculate recent form score (0-1)
    const recentFormScore = calculateRecentFormScore(player);
    
    // Calculate bowler freshness score (0-1)
    const freshnessScore = calculateBowlerFreshnessScore(player, bowlerWorkloads, currentMatch);
    
    // Calculate tactical variation score (0-1)
    const tacticalVariationScore = calculateTacticalVariationScore(player, currentMatch, bowlerWorkloads);
    
    // Calculate weighted overall score
    const overallScore = 
      matchupScore * ALGORITHM_WEIGHTS.matchupVsBatsmen +
      phaseScore * ALGORITHM_WEIGHTS.phaseEffectiveness +
      pitchConditionScore * ALGORITHM_WEIGHTS.pitchConditionSuitability +
      recentFormScore * ALGORITHM_WEIGHTS.recentForm +
      freshnessScore * ALGORITHM_WEIGHTS.bowlerFreshness +
      tacticalVariationScore * ALGORITHM_WEIGHTS.tacticalVariation;
    
    // Determine confidence level
    let confidenceLevel: 'very high' | 'high' | 'medium' | 'low';
    if (overallScore >= 0.85) confidenceLevel = 'very high';
    else if (overallScore >= 0.7) confidenceLevel = 'high';
    else if (overallScore >= 0.5) confidenceLevel = 'medium';
    else confidenceLevel = 'low';
    
    // Generate explanations
    const explanations = {
      matchupVsBatsmen: generateMatchupExplanation(player, matchupScore, currentBatsmen),
      phaseEffectiveness: generatePhaseExplanation(player, phaseScore, currentMatch.matchSituation.phase),
      pitchConditionSuitability: generatePitchConditionExplanation(player, pitchConditionScore, currentMatch.conditions),
      recentForm: generateRecentFormExplanation(player, recentFormScore),
      bowlerFreshness: generateFreshnessExplanation(player, freshnessScore, bowlerWorkloads),
      tacticalVariation: generateTacticalVariationExplanation(player, tacticalVariationScore, currentMatch, bowlerWorkloads)
    };
    
    return {
      playerId: player.id,
      overallScore,
      confidenceLevel,
      reasonScores: {
        matchupVsBatsmen: matchupScore,
        phaseEffectiveness: phaseScore,
        pitchConditionSuitability: pitchConditionScore,
        recentForm: recentFormScore,
        bowlerFreshness: freshnessScore,
        tacticalVariation: tacticalVariationScore
      },
      explanations
    };
  });
  
  // Sort recommendations by overall score (descending)
  return recommendations.sort((a, b) => b.overallScore - a.overallScore);
};

// Helper functions for calculating individual scores

const calculateMatchupScore = (player: PlayerStats, currentBatsmen: PlayerStats[]): number => {
  let score = 0.5; // Neutral starting point
  let matchupCount = 0;
  
  // Check if player has strong/weak matchups against current batsmen
  for (const batsman of currentBatsmen) {
    if (player.matchupData.strongAgainstPlayers && player.matchupData.strongAgainstPlayers.includes(batsman.id)) {
      score += 0.25;
      matchupCount++;
    } else if (player.matchupData.weakAgainstPlayers && player.matchupData.weakAgainstPlayers.includes(batsman.id)) {
      score -= 0.25;
      matchupCount++;
    }
    
    // Check if batsman has strong/weak matchups against this bowler
    if (batsman.matchupData.weakAgainstPlayers && batsman.matchupData.weakAgainstPlayers.includes(player.id)) {
      score += 0.25;
      matchupCount++;
    } else if (batsman.matchupData.strongAgainstPlayers && batsman.matchupData.strongAgainstPlayers.includes(player.id)) {
      score -= 0.25;
      matchupCount++;
    }
  }
  
  // If we have matchup data, normalize the score
  if (matchupCount > 0) {
    // Ensure score is between 0 and 1
    return Math.max(0, Math.min(1, score));
  }
  
  // If no specific matchup data, use general bowling stats
  if (player.bowlingStats) {
    // Normalize bowling average (lower is better)
    const normalizedAvg = Math.max(0, Math.min(1, 1 - (player.bowlingStats.average - 15) / 15));
    // Normalize economy rate (lower is better)
    const normalizedEconomy = Math.max(0, Math.min(1, 1 - (player.bowlingStats.economy - 6) / 6));
    // Normalize strike rate (lower is better)
    const normalizedSR = Math.max(0, Math.min(1, 1 - (player.bowlingStats.strikeRate - 15) / 15));
    
    // Combine metrics
    return (normalizedAvg + normalizedEconomy + normalizedSR) / 3;
  }
  
  return score;
};

const calculatePhaseEffectivenessScore = (player: PlayerStats, phase: 'powerplay' | 'middle' | 'death'): number => {
  // Check if player has a preferred bowling phase
  if (player.matchupData.preferredBowlingPhase === phase) {
    return 0.9; // High score for preferred phase
  }
  
  // Check phase-specific economy rates
  if (phase === 'powerplay' && player.advancedStats.bowlingPowerplayEconomy) {
    // Normalize powerplay economy (lower is better)
    const normalizedEconomy = Math.max(0, Math.min(1, 1 - (player.advancedStats.bowlingPowerplayEconomy - 6) / 6));
    return normalizedEconomy;
  } else if (phase === 'death' && player.advancedStats.bowlingDeathEconomy) {
    // Normalize death economy (lower is better)
    const normalizedEconomy = Math.max(0, Math.min(1, 1 - (player.advancedStats.bowlingDeathEconomy - 7) / 7));
    return normalizedEconomy;
  }
  
  // For middle overs or if no specific data
  if (player.bowlingStats) {
    // Use overall economy as a proxy
    const normalizedEconomy = Math.max(0, Math.min(1, 1 - (player.bowlingStats.economy - 6) / 6));
    return normalizedEconomy;
  }
  
  return 0.5; // Neutral score if no data
};

const calculatePitchConditionScore = (player: PlayerStats, conditions: MatchConditions): number => {
  let score = 0.5; // Neutral starting point
  
  // Adjust based on pitch type and bowling style
  if (conditions.pitchType === 'spin-friendly' && player.bowlingStyle && 
      (player.bowlingStyle.includes('spin') || 
       player.bowlingStyle.includes('break') || 
       player.bowlingStyle.includes('orthodox') || 
       player.bowlingStyle.includes('chinaman'))) {
    score += 0.3;
  } else if (conditions.pitchType === 'pace-friendly' && player.bowlingStyle && 
             (player.bowlingStyle.includes('fast') || 
              player.bowlingStyle.includes('medium'))) {
    score += 0.3;
  } else if (conditions.pitchType === 'batting-friendly') {
    // On batting-friendly pitches, favor bowlers with good economy
    if (player.bowlingStats && player.bowlingStats.economy < 7.5) {
      score += 0.2;
    }
  }
  
  // Adjust for weather conditions
  if (conditions.weather === 'cloudy' && player.bowlingStyle && 
      (player.bowlingStyle.includes('fast') || player.bowlingStyle.includes('medium'))) {
    score += 0.1;
  } else if (conditions.weather === 'sunny' && player.bowlingStyle && 
             (player.bowlingStyle.includes('spin') || player.bowlingStyle.includes('break'))) {
    score += 0.1;
  }
  
  // Adjust for ground size
  if (conditions.groundSize === 'small' && player.bowlingStyle && 
      (player.bowlingStyle.includes('fast') || player.bowlingStyle.includes('yorker'))) {
    score += 0.1;
  } else if (conditions.groundSize === 'large' && player.bowlingStyle && 
             (player.bowlingStyle.includes('spin') || player.bowlingStyle.includes('break'))) {
    score += 0.1;
  }
  
  return Math.max(0, Math.min(1, score));
};

const calculateRecentFormScore = (player: PlayerStats): number => {
  // Convert form rating to numeric score
  let formBaseScore = 0;
  switch (player.recentForm.currentForm) {
    case 'excellent': formBaseScore = 1.0; break;
    case 'good': formBaseScore = 0.75; break;
    case 'average': formBaseScore = 0.5; break;
    case 'poor': formBaseScore = 0.25; break;
    default: formBaseScore = 0.5;
  }
  
  // Adjust based on last five innings if available
  if (player.recentForm.lastFiveInningsWickets) {
    const recentWickets = player.recentForm.lastFiveInningsWickets;
    const avgRecentWickets = recentWickets.reduce((sum, wickets) => sum + wickets, 0) / recentWickets.length;
    
    // Normalize average wickets (assuming 2+ is good in T20)
    const normalizedAvg = Math.min(avgRecentWickets / 2, 1);
    
    // Combine base form with recent performance
    return (formBaseScore * 0.6) + (normalizedAvg * 0.4);
  }
  
  return formBaseScore;
};

const calculateBowlerFreshnessScore = (
  player: PlayerStats, 
  bowlerWorkloads: BowlerWorkload[], 
  match: MatchData
): number => {
  // Find this bowler's workload
  const workload = bowlerWorkloads.find(w => w.playerId === player.id);
  if (!workload) return 1.0; // Fully fresh if no workload data
  
  // Calculate freshness based on overs bowled and time since last over
  const maxOvers = match.format === 'T20' ? 4 : match.format === 'ODI' ? 10 : 10;
  const oversRemaining = maxOvers - workload.oversBowled;
  const oversRemainingScore = oversRemaining / maxOvers;
  
  // Calculate rest period score
  let restPeriodScore = 1.0;
  if (workload.lastOverNumber !== null) {
    const currentOver = Math.floor(match.matchSituation.oversCompleted) + 1;
    const oversSinceLastBowled = currentOver - workload.lastOverNumber;
    // Normalize rest period (assuming 3+ overs rest is good)
    restPeriodScore = Math.min(oversSinceLastBowled / 3, 1);
  }
  
  // Combine scores (weighted more towards overs remaining)
  return (oversRemainingScore * 0.7) + (restPeriodScore * 0.3);
};

const calculateTacticalVariationScore = (
  player: PlayerStats, 
  match: MatchData, 
  bowlerWorkloads: BowlerWorkload[]
): number => {
  let score = 0.5; // Neutral starting point
  
  // Get current bowler style
  const currentBowlerId = match.matchSituation.currentBowler;
  const currentBowler = mockPlayers.find(p => p.id === currentBowlerId);
  
  // Check if this bowler provides variation from current bowler
  if (currentBowler && currentBowler.bowlingStyle && player.bowlingStyle) {
    // Pace vs spin variation
    const currentIsPace = currentBowler.bowlingStyle.includes('fast') || currentBowler.bowlingStyle.includes('medium');
    const playerIsPace = player.bowlingStyle.includes('fast') || player.bowlingStyle.includes('medium');
    
    if (currentIsPace !== playerIsPace) {
      score += 0.25; // Good variation between pace and spin
    }
    
    // Left-arm vs right-arm variation
    const currentIsLeftArm = currentBowler.bowlingStyle.includes('left-arm');
    const playerIsLeftArm = player.bowlingStyle.includes('left-arm');
    
    if (currentIsLeftArm !== playerIsLeftArm) {
      score += 0.15; // Good variation in bowling arm
    }
  }
  
  // Check if this bowler provides variation from recent bowlers
  const recentBowlerIds = match.matchSituation.lastBowlers;
  let variationFromRecentBowlers = 0;
  let recentBowlersCount = 0;
  
  for (const recentBowlerId of recentBowlerIds) {
    const recentBowler = mockPlayers.find(p => p.id === recentBowlerId);
    if (recentBowler && recentBowler.bowlingStyle && player.bowlingStyle) {
      recentBowlersCount++;
      
      // Pace vs spin variation
      const recentIsPace = recentBowler.bowlingStyle.includes('fast') || recentBowler.bowlingStyle.includes('medium');
      const playerIsPace = player.bowlingStyle.includes('fast') || player.bowlingStyle.includes('medium');
      
      if (recentIsPace !== playerIsPace) {
        variationFromRecentBowlers += 0.15;
      }
      
      // Left-arm vs right-arm variation
      const recentIsLeftArm = recentBowler.bowlingStyle.includes('left-arm');
      const playerIsLeftArm = player.bowlingStyle.includes('left-arm');
      
      if (recentIsLeftArm !== playerIsLeftArm) {
        variationFromRecentBowlers += 0.1;
      }
    }
  }
  
  // Normalize variation from recent bowlers
  if (recentBowlersCount > 0) {
    score += variationFromRecentBowlers / recentBowlersCount;
  }
  
  return Math.max(0, Math.min(1, score));
};

// Explanation generation functions

const generateMatchupExplanation = (player: PlayerStats, score: number, currentBatsmen: PlayerStats[]): string => {
  const batsmanNames = currentBatsmen.map(b => b.name).join(' and ');
  
  if (score >= 0.8) {
    return `${player.name} has excellent matchups against ${batsmanNames} with a strong record of dismissing similar batsmen.`;
  } else if (score >= 0.6) {
    return `${player.name} has favorable matchups against the current batsmen at the crease.`;
  } else if (score >= 0.4) {
    return `${player.name} has neutral matchups against ${batsmanNames}.`;
  } else {
    return `${player.name} has struggled against batsmen like ${batsmanNames} in the past.`;
  }
};

const generatePhaseExplanation = (player: PlayerStats, score: number, phase: 'powerplay' | 'middle' | 'death'): string => {
  if (player.matchupData.preferredBowlingPhase === phase) {
    return `${player.name} specializes in bowling during the ${phase} phase of the game.`;
  }
  
  if (score >= 0.8) {
    return `${player.name} is excellent during the ${phase} phase with an economy rate of ${
      phase === 'powerplay' ? player.advancedStats.bowlingPowerplayEconomy : 
      phase === 'death' ? player.advancedStats.bowlingDeathEconomy : 
      player.bowlingStats?.economy
    }.`;
  } else if (score >= 0.6) {
    return `${player.name} performs well during the ${phase} phase of the game.`;
  } else if (score >= 0.4) {
    return `${player.name} has average statistics during the ${phase} phase.`;
  } else {
    return `${player.name} has not been particularly effective during the ${phase} phase.`;
  }
};

const generatePitchConditionExplanation = (player: PlayerStats, score: number, conditions: MatchConditions): string => {
  if (score >= 0.8) {
    return `${player.name}'s ${player.bowlingStyle} bowling is ideal for these ${conditions.pitchType} conditions.`;
  } else if (score >= 0.6) {
    return `${player.name} should be effective on this ${conditions.pitchType} pitch.`;
  } else if (score >= 0.4) {
    return `${player.name} has an average record on ${conditions.pitchType} pitches.`;
  } else {
    return `${player.name} may struggle on this ${conditions.pitchType} pitch.`;
  }
};

const generateRecentFormExplanation = (player: PlayerStats, score: number): string => {
  if (score >= 0.8) {
    return `${player.name} is in excellent form with ${player.recentForm.lastFiveInningsWickets?.reduce((a, b) => a + b, 0)} wickets in the last 5 matches.`;
  } else if (score >= 0.6) {
    return `${player.name} is in good form recently with consistent wicket-taking.`;
  } else if (score >= 0.4) {
    return `${player.name} has shown average form in recent matches.`;
  } else {
    return `${player.name} has been struggling for form recently.`;
  }
};

const generateFreshnessExplanation = (player: PlayerStats, score: number, bowlerWorkloads: BowlerWorkload[]): string => {
  const workload = bowlerWorkloads.find(w => w.playerId === player.id);
  
  if (!workload) {
    return `${player.name} has not bowled yet in this match and is completely fresh.`;
  }
  
  if (score >= 0.8) {
    return `${player.name} is well-rested and has ${4 - workload.oversBowled} overs remaining.`;
  } else if (score >= 0.6) {
    return `${player.name} has bowled ${workload.oversBowled} overs but has had sufficient rest.`;
  } else if (score >= 0.4) {
    return `${player.name} has bowled ${workload.oversBowled} overs and may be tiring.`;
  } else {
    return `${player.name} has already bowled ${workload.oversBowled} overs and may be fatigued.`;
  }
};

const generateTacticalVariationExplanation = (
  player: PlayerStats, 
  score: number, 
  match: MatchData, 
  bowlerWorkloads: BowlerWorkload[]
): string => {
  const currentBowlerId = match.matchSituation.currentBowler;
  const currentBowler = mockPlayers.find(p => p.id === currentBowlerId);
  const currentBowlerStyle = currentBowler?.bowlingStyle || 'unknown style';
  
  if (score >= 0.8) {
    return `${player.name}'s ${player.bowlingStyle} bowling provides excellent tactical variation from the ${currentBowlerStyle} of the current bowler.`;
  } else if (score >= 0.6) {
    return `${player.name} offers good variation from the current bowling attack.`;
  } else if (score >= 0.4) {
    return `${player.name} provides some tactical variation from recent bowlers.`;
  } else {
    return `${player.name}'s bowling style is similar to bowlers already used, offering limited tactical variation.`;
  }
};

const BowlerRecommendationComponent: React.FC = () => {
  const [players, setPlayers] = useState<PlayerStats[]>(mockPlayers);
  const [currentMatch, setCurrentMatch] = useState<MatchData>(mockCurrentMatch);
  const [currentBatsmen, setCurrentBatsmen] = useState<PlayerStats[]>(mockCurrentBatsmen);
  const [bowlerWorkloads, setBowlerWorkloads] = useState<BowlerWorkload[]>(mockBowlerWorkloads);
  const [recommendations, setRecommendations] = useState<BowlerRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<BowlerRecommendation | null>(null);
  const [showExplanations, setShowExplanations] = useState<boolean>(false);
  
  // Calculate recommendations on component mount or when dependencies change
  useEffect(() => {
    generateRecommendations();
  }, [players, currentMatch, currentBatsmen, bowlerWorkloads]);
  
  // Function to generate recommendations
  const generateRecommendations = () => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const newRecommendations = calculateBowlerRecommendations(
        players,
        currentMatch,
        currentBatsmen,
        bowlerWorkloads
      );
      
      setRecommendations(newRecommendations);
      if (newRecommendations.length > 0) {
        setSelectedRecommendation(newRecommendations[0]);
      }
      
      setIsLoading(false);
    }, 1000);
  };
  
  // Function to handle recommendation selection
  const handleRecommendationSelect = (recommendation: BowlerRecommendation) => {
    setSelectedRecommendation(recommendation);
  };
  
  // Function to get player by ID
  const getPlayerById = (playerId: string): PlayerStats | undefined => {
    return players.find(player => player.id === playerId);
  };
  
  // Function to get confidence color
  const getConfidenceColor = (level: 'very high' | 'high' | 'medium' | 'low'): string => {
    switch (level) {
      case 'very high': return 'success.main';
      case 'high': return 'success.light';
      case 'medium': return 'warning.main';
      case 'low': return 'error.light';
      default: return 'text.secondary';
    }
  };
  
  // Function to format score as percentage
  const formatScore = (score: number): string => {
    return `${Math.round(score * 100)}%`;
  };
  
  // Function to get bowling style icon
  const getBowlingStyleIcon = (style: string | undefined) => {
    if (!style) return <SportsCricketIcon />;
    
    if (style.includes('fast')) {
      return <BoltIcon />;
    } else if (style.includes('medium')) {
      return <SpeedIcon />;
    } else {
      return <SportsCricketIcon />;
    }
  };
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Bowler Recommendation Engine
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          AI-powered next bowler recommendations based on match situation and player data
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
                      {currentMatch.matchSituation.requiredRunRate && (
                        <Typography variant="body2">
                          <strong>Required RR:</strong> {currentMatch.matchSituation.requiredRunRate}
                        </Typography>
                      )}
                      <Typography variant="body2">
                        <strong>Phase:</strong> {currentMatch.matchSituation.phase}
                      </Typography>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} sm={6}>
                    <Typography variant="subtitle2">Current Batsmen</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1 }}>
                      {currentBatsmen.map(batsman => (
                        <Chip 
                          key={batsman.id}
                          label={batsman.name}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </Box>
                    
                    <Typography variant="subtitle2" sx={{ mt: 2 }}>Current Bowler</Typography>
                    <Box sx={{ mt: 1 }}>
                      {(() => {
                        const bowler = getPlayerById(currentMatch.matchSituation.currentBowler);
                        return (
                          <Chip 
                            label={bowler ? bowler.name : currentMatch.matchSituation.currentBowler}
                            color="secondary"
                            variant="outlined"
                          />
                        );
                      })()}
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
                
                <Typography variant="subtitle2" sx={{ mt: 3, mb: 1 }}>Bowler Workloads</Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Bowler</TableCell>
                        <TableCell align="center">Overs</TableCell>
                        <TableCell align="center">Wickets</TableCell>
                        <TableCell align="center">Runs</TableCell>
                        <TableCell align="center">Economy</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bowlerWorkloads.map((workload) => {
                        const bowler = getPlayerById(workload.playerId);
                        return (
                          <TableRow key={workload.playerId}>
                            <TableCell>{bowler ? bowler.name : workload.playerId}</TableCell>
                            <TableCell align="center">{workload.oversBowled}</TableCell>
                            <TableCell align="center">{workload.wicketsTaken}</TableCell>
                            <TableCell align="center">{workload.runsConceded}</TableCell>
                            <TableCell align="center">
                              {(workload.oversBowled > 0 ? (workload.runsConceded / workload.oversBowled) : 0).toFixed(1)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
          
          {/* Recommendations Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Next Bowler Recommendations
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                {isLoading ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                    <CircularProgress sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Analyzing match situation and player data...
                    </Typography>
                  </Box>
                ) : recommendations.length === 0 ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    No eligible bowlers available for recommendation.
                  </Alert>
                ) : (
                  <Box>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Rank</TableCell>
                            <TableCell>Bowler</TableCell>
                            <TableCell align="center">Style</TableCell>
                            <TableCell align="center">Score</TableCell>
                            <TableCell align="center">Confidence</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {recommendations.map((recommendation, index) => {
                            const player = getPlayerById(recommendation.playerId);
                            return (
                              <TableRow 
                                key={recommendation.playerId}
                                sx={{ 
                                  cursor: 'pointer',
                                  bgcolor: selectedRecommendation?.playerId === recommendation.playerId ? 
                                    'action.selected' : 'inherit',
                                  '&:hover': {
                                    bgcolor: 'action.hover',
                                  }
                                }}
                                onClick={() => handleRecommendationSelect(recommendation)}
                              >
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{player ? player.name : recommendation.playerId}</TableCell>
                                <TableCell align="center">
                                  <Tooltip title={player?.bowlingStyle || 'Unknown'}>
                                    <Avatar sx={{ width: 24, height: 24, bgcolor: 'primary.light', mx: 'auto' }}>
                                      {getBowlingStyleIcon(player?.bowlingStyle)}
                                    </Avatar>
                                  </Tooltip>
                                </TableCell>
                                <TableCell align="center">{formatScore(recommendation.overallScore)}</TableCell>
                                <TableCell align="center">
                                  <Chip 
                                    label={recommendation.confidenceLevel}
                                    size="small"
                                    sx={{ 
                                      bgcolor: getConfidenceColor(recommendation.confidenceLevel),
                                      color: 'white'
                                    }}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      <Button 
                        size="small" 
                        onClick={() => setShowExplanations(!showExplanations)}
                      >
                        {showExplanations ? 'Hide Explanations' : 'Show Explanations'}
                      </Button>
                    </Box>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>
          
          {/* Selected Recommendation Details */}
          {selectedRecommendation && (
            <Grid item xs={12}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">
                      Recommendation Details
                    </Typography>
                    <Chip 
                      label={`${formatScore(selectedRecommendation.overallScore)} confidence`}
                      color="primary"
                    />
                  </Box>
                  <Divider sx={{ mb: 3 }} />
                  
                  <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Typography variant="subtitle1" sx={{ mr: 1 }}>
                          {(() => {
                            const player = getPlayerById(selectedRecommendation.playerId);
                            return player ? player.name : selectedRecommendation.playerId;
                          })()}
                        </Typography>
                        <Chip 
                          label={(() => {
                            const player = getPlayerById(selectedRecommendation.playerId);
                            return player?.bowlingStyle || 'Unknown';
                          })()}
                          size="small"
                          variant="outlined"
                        />
                      </Box>
                      
                      <Box sx={{ mb: 3 }}>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Overall recommendation score
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={selectedRecommendation.overallScore * 100} 
                          sx={{ height: 10, borderRadius: 5, mb: 1 }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">0%</Typography>
                          <Typography variant="caption" color="text.secondary">100%</Typography>
                        </Box>
                      </Box>
                      
                      <Typography variant="subtitle2" gutterBottom>
                        Factor Scores
                      </Typography>
                      
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableBody>
                            <TableRow>
                              <TableCell component="th" scope="row">Matchup vs Batsmen</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.matchupVsBatsmen * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Phase Effectiveness</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.phaseEffectiveness * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Pitch Condition Suitability</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.pitchConditionSuitability * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Recent Form</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.recentForm * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Bowler Freshness</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.bowlerFreshness * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Tactical Variation</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.tacticalVariation * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                    
                    <Grid item xs={12} md={6}>
                      {showExplanations && (
                        <Box>
                          <Typography variant="subtitle2" gutterBottom>
                            Recommendation Reasoning
                          </Typography>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="Analysis of matchups against current batsmen">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Matchup vs Batsmen
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.matchupVsBatsmen}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="Performance during the current match phase (powerplay/middle/death)">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Phase Effectiveness
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.phaseEffectiveness}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="How well the bowler's style suits current pitch and conditions">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Pitch Condition Suitability
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.pitchConditionSuitability}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="Recent bowling performance and form">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Recent Form
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.recentForm}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="Bowler's workload and rest in the current match">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Bowler Freshness
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.bowlerFreshness}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="How this bowler provides tactical variation from current/recent bowlers">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Tactical Variation
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.tacticalVariation}
                            </Typography>
                          </Box>
                        </Box>
                      )}
                      
                      {!showExplanations && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                          <Typography variant="body2" color="text.secondary" align="center">
                            Click "Show Explanations" to view detailed reasoning for this recommendation.
                          </Typography>
                          <Button 
                            variant="outlined" 
                            sx={{ mt: 2 }}
                            onClick={() => setShowExplanations(true)}
                          >
                            Show Explanations
                          </Button>
                        </Box>
                      )}
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

export default BowlerRecommendationComponent;
