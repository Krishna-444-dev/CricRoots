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
  IconButton
} from '@mui/material';
import { 
  Refresh as RefreshIcon,
  Info as InfoIcon,
  Check as CheckIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon
} from '@mui/icons-material';

// Import types from PlayerMatchDataCollection
import { PlayerStats, MatchData, MatchConditions } from '../data/types';

// Algorithm weights for different factors
const ALGORITHM_WEIGHTS = {
  recentForm: 0.25,
  matchupVsBowlers: 0.20,
  pitchConditionSuitability: 0.15,
  phasePerformance: 0.15,
  situationalRequirement: 0.15,
  partnershipHistory: 0.10
};

// Interface for recommendation result
interface BatsmanRecommendation {
  playerId: string;
  overallScore: number;
  confidenceLevel: 'very high' | 'high' | 'medium' | 'low';
  reasonScores: {
    recentForm: number;
    matchupVsBowlers: number;
    pitchConditionSuitability: number;
    phasePerformance: number;
    situationalRequirement: number;
    partnershipHistory: number;
  };
  explanations: {
    recentForm: string;
    matchupVsBowlers: string;
    pitchConditionSuitability: string;
    phasePerformance: string;
    situationalRequirement: string;
    partnershipHistory: string;
  };
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
    currentScore: 45,
    wicketsLost: 2,
    oversCompleted: 5.2,
    currentRunRate: 8.44,
    requiredRunRate: undefined,
    currentBatsmen: ['p3', 'p4'],
    currentBowler: 'p7',
    lastBowlers: ['p8', 'p9'],
    phase: 'powerplay'
  }
};

// Batsman recommendation algorithm
const calculateBatsmanRecommendations = (
  availablePlayers: PlayerStats[],
  currentMatch: MatchData,
  currentBatsmen: PlayerStats[]
): BatsmanRecommendation[] => {
  // Filter out players who are already batting
  const currentBatsmenIds = currentBatsmen.map(player => player.id);
  const eligiblePlayers = availablePlayers.filter(
    player => !currentBatsmenIds.includes(player.id) && 
              (player.role === 'batsman' || player.role === 'all-rounder' || player.role === 'wicket-keeper')
  );
  
  // Calculate recommendations for each eligible player
  const recommendations: BatsmanRecommendation[] = eligiblePlayers.map(player => {
    // Calculate recent form score (0-1)
    const recentFormScore = calculateRecentFormScore(player);
    
    // Calculate matchup score against current and likely bowlers (0-1)
    const matchupScore = calculateMatchupScore(player, currentMatch);
    
    // Calculate pitch condition suitability score (0-1)
    const pitchConditionScore = calculatePitchConditionScore(player, currentMatch.conditions);
    
    // Calculate phase performance score (0-1)
    const phaseScore = calculatePhasePerformanceScore(player, currentMatch.matchSituation.phase);
    
    // Calculate situational requirement score (0-1)
    const situationalScore = calculateSituationalScore(player, currentMatch);
    
    // Calculate partnership history score (0-1)
    const partnershipScore = calculatePartnershipScore(player, currentBatsmen);
    
    // Calculate weighted overall score
    const overallScore = 
      recentFormScore * ALGORITHM_WEIGHTS.recentForm +
      matchupScore * ALGORITHM_WEIGHTS.matchupVsBowlers +
      pitchConditionScore * ALGORITHM_WEIGHTS.pitchConditionSuitability +
      phaseScore * ALGORITHM_WEIGHTS.phasePerformance +
      situationalScore * ALGORITHM_WEIGHTS.situationalRequirement +
      partnershipScore * ALGORITHM_WEIGHTS.partnershipHistory;
    
    // Determine confidence level
    let confidenceLevel: 'very high' | 'high' | 'medium' | 'low';
    if (overallScore >= 0.85) confidenceLevel = 'very high';
    else if (overallScore >= 0.7) confidenceLevel = 'high';
    else if (overallScore >= 0.5) confidenceLevel = 'medium';
    else confidenceLevel = 'low';
    
    // Generate explanations
    const explanations = {
      recentForm: generateRecentFormExplanation(player, recentFormScore),
      matchupVsBowlers: generateMatchupExplanation(player, matchupScore, currentMatch),
      pitchConditionSuitability: generatePitchConditionExplanation(player, pitchConditionScore, currentMatch.conditions),
      phasePerformance: generatePhaseExplanation(player, phaseScore, currentMatch.matchSituation.phase),
      situationalRequirement: generateSituationalExplanation(player, situationalScore, currentMatch),
      partnershipHistory: generatePartnershipExplanation(player, partnershipScore, currentBatsmen)
    };
    
    return {
      playerId: player.id,
      overallScore,
      confidenceLevel,
      reasonScores: {
        recentForm: recentFormScore,
        matchupVsBowlers: matchupScore,
        pitchConditionSuitability: pitchConditionScore,
        phasePerformance: phaseScore,
        situationalRequirement: situationalScore,
        partnershipHistory: partnershipScore
      },
      explanations
    };
  });
  
  // Sort recommendations by overall score (descending)
  return recommendations.sort((a, b) => b.overallScore - a.overallScore);
};

// Helper functions for calculating individual scores

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
  if (player.recentForm.lastFiveInningsRuns) {
    const recentRuns = player.recentForm.lastFiveInningsRuns;
    const avgRecentRuns = recentRuns.reduce((sum, runs) => sum + runs, 0) / recentRuns.length;
    
    // Normalize average runs (assuming 50+ is excellent in T20)
    const normalizedAvg = Math.min(avgRecentRuns / 50, 1);
    
    // Combine base form with recent performance
    return (formBaseScore * 0.6) + (normalizedAvg * 0.4);
  }
  
  return formBaseScore;
};

const calculateMatchupScore = (player: PlayerStats, match: MatchData): number => {
  // Get current and likely bowlers
  const currentBowlerId = match.matchSituation.currentBowler;
  const recentBowlerIds = match.matchSituation.lastBowlers;
  const relevantBowlerIds = [currentBowlerId, ...recentBowlerIds];
  
  // Check if player has strong/weak matchups against these bowlers
  let strongMatchups = 0;
  let weakMatchups = 0;
  
  if (player.matchupData.strongAgainstPlayers) {
    for (const bowlerId of relevantBowlerIds) {
      if (player.matchupData.strongAgainstPlayers.includes(bowlerId)) {
        strongMatchups++;
      }
    }
  }
  
  if (player.matchupData.weakAgainstPlayers) {
    for (const bowlerId of relevantBowlerIds) {
      if (player.matchupData.weakAgainstPlayers.includes(bowlerId)) {
        weakMatchups++;
      }
    }
  }
  
  // Calculate score based on matchups
  const totalRelevantBowlers = relevantBowlerIds.length;
  if (totalRelevantBowlers === 0) return 0.5; // Neutral if no data
  
  const matchupScore = 0.5 + 
    (strongMatchups / totalRelevantBowlers * 0.5) - 
    (weakMatchups / totalRelevantBowlers * 0.5);
  
  return Math.max(0, Math.min(1, matchupScore));
};

const calculatePitchConditionScore = (player: PlayerStats, conditions: MatchConditions): number => {
  let score = 0.5; // Neutral starting point
  
  // Adjust based on pitch type and player's strengths
  if (conditions.pitchType === 'spin-friendly' && player.advancedStats.vsSpinBowlingAvg) {
    // Normalize average (assuming 40+ is good)
    const normalizedAvg = Math.min(player.advancedStats.vsSpinBowlingAvg / 40, 1.25);
    score += normalizedAvg * 0.3;
  } else if (conditions.pitchType === 'pace-friendly' && player.advancedStats.vsPaceBowlingAvg) {
    // Normalize average (assuming 40+ is good)
    const normalizedAvg = Math.min(player.advancedStats.vsPaceBowlingAvg / 40, 1.25);
    score += normalizedAvg * 0.3;
  } else if (conditions.pitchType === 'batting-friendly') {
    // Favor players with high strike rates
    const normalizedSR = Math.min(player.battingStats.strikeRate / 150, 1.25);
    score += normalizedSR * 0.3;
  } else if (conditions.pitchType === 'bowling-friendly') {
    // Favor players with good technique (approximated by average)
    const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
    score += normalizedAvg * 0.3;
  }
  
  // Adjust for ground size
  if (conditions.groundSize === 'small' && player.battingStats.sixes > 0) {
    // Favor six hitters on small grounds
    const sixRate = player.battingStats.sixes / player.battingStats.ballsFaced;
    const normalizedSixRate = Math.min(sixRate * 100, 1.25); // Normalize (assuming 1.25% is high)
    score += normalizedSixRate * 0.2;
  }
  
  return Math.max(0, Math.min(1, score));
};

const calculatePhasePerformanceScore = (player: PlayerStats, phase: 'powerplay' | 'middle' | 'death'): number => {
  let score = 0.5; // Neutral starting point
  
  // Adjust based on phase and player's phase-specific stats
  if (phase === 'powerplay' && player.advancedStats.powerplayStrikeRate) {
    // Normalize powerplay strike rate (assuming 140+ is good)
    const normalizedSR = Math.min(player.advancedStats.powerplayStrikeRate / 140, 1.25);
    score = normalizedSR;
  } else if (phase === 'death' && player.advancedStats.deathOversStrikeRate) {
    // Normalize death overs strike rate (assuming 180+ is good)
    const normalizedSR = Math.min(player.advancedStats.deathOversStrikeRate / 180, 1.25);
    score = normalizedSR;
  } else if (phase === 'middle') {
    // For middle overs, use overall average as proxy
    const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
    score = normalizedAvg;
  }
  
  return Math.max(0, Math.min(1, score));
};

const calculateSituationalScore = (player: PlayerStats, match: MatchData): number => {
  const situation = match.matchSituation;
  let score = 0.5; // Neutral starting point
  
  // Adjust based on match situation
  if (situation.currentInnings === 1) {
    // First innings
    if (situation.oversCompleted < 6) {
      // Powerplay - favor aggressive players
      if (player.advancedStats.powerplayStrikeRate) {
        const normalizedSR = Math.min(player.advancedStats.powerplayStrikeRate / 140, 1.25);
        score = normalizedSR;
      } else {
        // Use overall strike rate as fallback
        const normalizedSR = Math.min(player.battingStats.strikeRate / 140, 1.25);
        score = normalizedSR;
      }
    } else if (situation.oversCompleted >= 15) {
      // Death overs - favor finishers
      if (player.advancedStats.deathOversStrikeRate) {
        const normalizedSR = Math.min(player.advancedStats.deathOversStrikeRate / 180, 1.25);
        score = normalizedSR;
      } else {
        // Use overall strike rate as fallback
        const normalizedSR = Math.min(player.battingStats.strikeRate / 150, 1.25);
        score = normalizedSR;
      }
    } else {
      // Middle overs - favor consistent scorers
      const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
      score = normalizedAvg;
    }
  } else {
    // Second innings (chasing)
    if (situation.requiredRunRate) {
      if (situation.requiredRunRate > 12) {
        // High required rate - favor big hitters
        const sixRate = player.battingStats.sixes / player.battingStats.ballsFaced;
        const normalizedSixRate = Math.min(sixRate * 100, 1.25);
        score = normalizedSixRate;
      } else if (situation.requiredRunRate < 7) {
        // Low required rate - favor consistent players
        const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
        score = normalizedAvg;
      } else {
        // Moderate required rate - balance of strike rate and average
        const normalizedSR = Math.min(player.battingStats.strikeRate / 140, 1.25);
        const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
        score = (normalizedSR + normalizedAvg) / 2;
      }
    }
  }
  
  // Adjust for wickets lost
  if (situation.wicketsLost >= 4) {
    // Crisis situation - favor reliable batsmen
    const normalizedAvg = Math.min(player.battingStats.average / 40, 1.25);
    score = (score + normalizedAvg) / 2;
  }
  
  return Math.max(0, Math.min(1, score));
};

const calculatePartnershipScore = (player: PlayerStats, currentBatsmen: PlayerStats[]): number => {
  // This would ideally use historical partnership data
  // For this implementation, we'll use a simplified approach
  
  // Check if player's batting style complements current batsmen
  const complementaryStyles = currentBatsmen.some(batsman => 
    batsman.battingStyle !== player.battingStyle
  );
  
  // Check if player's preferred position is appropriate
  const appropriatePosition = player.matchupData.preferredBattingPosition ? 
    player.matchupData.preferredBattingPosition >= 3 : true;
  
  let score = 0.5; // Neutral starting point
  if (complementaryStyles) score += 0.25;
  if (appropriatePosition) score += 0.25;
  
  return Math.max(0, Math.min(1, score));
};

// Explanation generation functions

const generateRecentFormExplanation = (player: PlayerStats, score: number): string => {
  if (score >= 0.8) {
    return `${player.name} is in excellent form with an average of ${player.recentForm.lastFiveMatchesAverage} in recent matches.`;
  } else if (score >= 0.6) {
    return `${player.name} is in good form recently with consistent performances.`;
  } else if (score >= 0.4) {
    return `${player.name} has shown average form in recent matches.`;
  } else {
    return `${player.name} has been struggling for form recently.`;
  }
};

const generateMatchupExplanation = (player: PlayerStats, score: number, match: MatchData): string => {
  const currentBowlerId = match.matchSituation.currentBowler;
  const currentBowler = mockPlayers.find(p => p.id === currentBowlerId);
  const currentBowlerName = currentBowler ? currentBowler.name : 'current bowler';
  
  if (score >= 0.8) {
    return `${player.name} has excellent matchups against ${currentBowlerName} and other likely bowlers.`;
  } else if (score >= 0.6) {
    return `${player.name} has favorable matchups against the current bowling attack.`;
  } else if (score >= 0.4) {
    return `${player.name} has neutral matchups against the current bowlers.`;
  } else {
    return `${player.name} has struggled against ${currentBowlerName} and similar bowlers in the past.`;
  }
};

const generatePitchConditionExplanation = (player: PlayerStats, score: number, conditions: MatchConditions): string => {
  if (score >= 0.8) {
    return `${player.name} excels in ${conditions.pitchType} conditions with a strong record at similar venues.`;
  } else if (score >= 0.6) {
    return `${player.name} performs well on ${conditions.pitchType} pitches like the current one.`;
  } else if (score >= 0.4) {
    return `${player.name} has an average record on ${conditions.pitchType} pitches.`;
  } else {
    return `${player.name} has historically struggled on ${conditions.pitchType} pitches.`;
  }
};

const generatePhaseExplanation = (player: PlayerStats, score: number, phase: 'powerplay' | 'middle' | 'death'): string => {
  if (score >= 0.8) {
    return `${player.name} is excellent during the ${phase} phase with a strike rate of ${
      phase === 'powerplay' ? player.advancedStats.powerplayStrikeRate : 
      phase === 'death' ? player.advancedStats.deathOversStrikeRate : 
      player.battingStats.strikeRate
    }.`;
  } else if (score >= 0.6) {
    return `${player.name} performs well during the ${phase} phase of the game.`;
  } else if (score >= 0.4) {
    return `${player.name} has average statistics during the ${phase} phase.`;
  } else {
    return `${player.name} has not been particularly effective during the ${phase} phase.`;
  }
};

const generateSituationalExplanation = (player: PlayerStats, score: number, match: MatchData): string => {
  const situation = match.matchSituation;
  
  if (situation.currentInnings === 1) {
    if (situation.oversCompleted < 6) {
      if (score >= 0.7) {
        return `${player.name} is well-suited for powerplay batting with an aggressive approach.`;
      } else {
        return `${player.name} is not ideal for powerplay acceleration.`;
      }
    } else if (situation.oversCompleted >= 15) {
      if (score >= 0.7) {
        return `${player.name} is an excellent finisher for the death overs.`;
      } else {
        return `${player.name} may struggle to accelerate in the death overs.`;
      }
    } else {
      if (score >= 0.7) {
        return `${player.name} is well-suited for building the innings in the middle overs.`;
      } else {
        return `${player.name} may struggle to maintain momentum in the middle overs.`;
      }
    }
  } else {
    if (situation.requiredRunRate && situation.requiredRunRate > 12) {
      if (score >= 0.7) {
        return `${player.name} is ideal for the high required run rate of ${situation.requiredRunRate}.`;
      } else {
        return `${player.name} may struggle with the high required run rate of ${situation.requiredRunRate}.`;
      }
    } else if (situation.requiredRunRate && situation.requiredRunRate < 7) {
      if (score >= 0.7) {
        return `${player.name} is perfect for the steady chase with a required rate of ${situation.requiredRunRate}.`;
      } else {
        return `${player.name} may not be the best choice for this comfortable chase situation.`;
      }
    } else {
      if (score >= 0.7) {
        return `${player.name} has the right balance of aggression and stability for this chase.`;
      } else {
        return `${player.name} may not provide the optimal balance for this chase situation.`;
      }
    }
  }
  
  return `${player.name}'s style is moderately suited to the current match situation.`;
};

const generatePartnershipExplanation = (player: PlayerStats, score: number, currentBatsmen: PlayerStats[]): string => {
  const currentBatsmanName = currentBatsmen[0] ? currentBatsmen[0].name : 'current batsman';
  
  if (score >= 0.8) {
    return `${player.name} forms an excellent partnership with ${currentBatsmanName} with complementary batting styles.`;
  } else if (score >= 0.6) {
    return `${player.name} should partner well with ${currentBatsmanName} based on their styles.`;
  } else if (score >= 0.4) {
    return `${player.name} has a neutral partnership potential with ${currentBatsmanName}.`;
  } else {
    return `${player.name} may not form an ideal partnership with ${currentBatsmanName}.`;
  }
};

const BatsmanRecommendationComponent: React.FC = () => {
  const [players, setPlayers] = useState<PlayerStats[]>(mockPlayers);
  const [currentMatch, setCurrentMatch] = useState<MatchData>(mockCurrentMatch);
  const [recommendations, setRecommendations] = useState<BatsmanRecommendation[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedRecommendation, setSelectedRecommendation] = useState<BatsmanRecommendation | null>(null);
  const [showExplanations, setShowExplanations] = useState<boolean>(false);
  
  // Get current batsmen
  const currentBatsmen = players.filter(player => 
    currentMatch.matchSituation.currentBatsmen.includes(player.id)
  );
  
  // Calculate recommendations on component mount or when dependencies change
  useEffect(() => {
    generateRecommendations();
  }, [players, currentMatch]);
  
  // Function to generate recommendations
  const generateRecommendations = () => {
    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const newRecommendations = calculateBatsmanRecommendations(
        players,
        currentMatch,
        currentBatsmen
      );
      
      setRecommendations(newRecommendations);
      if (newRecommendations.length > 0) {
        setSelectedRecommendation(newRecommendations[0]);
      }
      
      setIsLoading(false);
    }, 1000);
  };
  
  // Function to handle recommendation selection
  const handleRecommendationSelect = (recommendation: BatsmanRecommendation) => {
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
  
  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Batsman Recommendation Engine
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          AI-powered next batsman recommendations based on match situation and player data
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
              </CardContent>
            </Card>
          </Grid>
          
          {/* Recommendations Card */}
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Next Batsman Recommendations
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
                    No eligible batsmen available for recommendation.
                  </Alert>
                ) : (
                  <Box>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Rank</TableCell>
                            <TableCell>Batsman</TableCell>
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
                      <Typography variant="subtitle1" gutterBottom>
                        {(() => {
                          const player = getPlayerById(selectedRecommendation.playerId);
                          return player ? player.name : selectedRecommendation.playerId;
                        })()}
                      </Typography>
                      
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
                              <TableCell component="th" scope="row">Matchup vs Bowlers</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.matchupVsBowlers * 5} 
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
                              <TableCell component="th" scope="row">Phase Performance</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.phasePerformance * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Situational Requirement</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.situationalRequirement * 5} 
                                  readOnly 
                                  precision={0.5}
                                  size="small"
                                />
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell component="th" scope="row">Partnership History</TableCell>
                              <TableCell align="right">
                                <Rating 
                                  value={selectedRecommendation.reasonScores.partnershipHistory * 5} 
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
                              <Tooltip title="Recent form analysis">
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
                              <Tooltip title="Analysis of matchups against current and likely bowlers">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Matchup vs Bowlers
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.matchupVsBowlers}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="How well the player's style suits current pitch and conditions">
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
                              <Tooltip title="Performance during the current match phase (powerplay/middle/death)">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Phase Performance
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.phasePerformance}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="How well the player's style matches current match situation">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Situational Requirement
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.situationalRequirement}
                            </Typography>
                          </Box>
                          
                          <Box sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                              <Tooltip title="How well the player partners with current batsman">
                                <IconButton size="small" sx={{ mr: 1 }}>
                                  <InfoIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Typography variant="body2" fontWeight="medium">
                                Partnership History
                              </Typography>
                            </Box>
                            <Typography variant="body2" color="text.secondary">
                              {selectedRecommendation.explanations.partnershipHistory}
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

export default BatsmanRecommendationComponent;
