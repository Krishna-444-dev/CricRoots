import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  TextField, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Button, 
  Divider, 
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Tooltip,
  CircularProgress
} from '@mui/material';
import { 
  Add as AddIcon, 
  Delete as DeleteIcon, 
  Save as SaveIcon, 
  CloudUpload as CloudUploadIcon,
  Edit as EditIcon
} from '@mui/icons-material';

// Types for player data
interface PlayerStats {
  id: string;
  name: string;
  role: 'batsman' | 'bowler' | 'all-rounder' | 'wicket-keeper';
  battingStyle: 'right-handed' | 'left-handed';
  bowlingStyle?: string;
  battingStats: {
    matches: number;
    innings: number;
    runs: number;
    average: number;
    strikeRate: number;
    fifties: number;
    hundreds: number;
    highestScore: number;
    ballsFaced: number;
    fours: number;
    sixes: number;
  };
  bowlingStats?: {
    matches: number;
    innings: number;
    overs: number;
    wickets: number;
    economy: number;
    average: number;
    bestFigures: string;
    strikeRate: number;
  };
  fieldingStats: {
    catches: number;
    runOuts: number;
    stumpings?: number;
  };
  advancedStats: {
    vsSpinBowlingAvg?: number;
    vsPaceBowlingAvg?: number;
    powerplayStrikeRate?: number;
    deathOversStrikeRate?: number;
    bowlingPowerplayEconomy?: number;
    bowlingDeathEconomy?: number;
    fieldingPositionStrengths?: string[];
  };
  recentForm: {
    lastFiveInningsRuns?: number[];
    lastFiveInningsWickets?: number[];
    lastFiveMatchesAverage?: number;
    currentForm: 'excellent' | 'good' | 'average' | 'poor';
  };
  matchupData: {
    strongAgainstPlayers?: string[];
    weakAgainstPlayers?: string[];
    preferredBattingPosition?: number;
    preferredBowlingPhase?: 'powerplay' | 'middle' | 'death';
  };
}

interface MatchConditions {
  venue: string;
  pitchType: 'batting-friendly' | 'bowling-friendly' | 'balanced' | 'spin-friendly' | 'pace-friendly';
  weather: 'sunny' | 'cloudy' | 'rainy' | 'windy' | 'humid';
  temperature: number;
  humidity: number;
  windSpeed: number;
  groundSize: 'small' | 'medium' | 'large';
  outfield: 'fast' | 'medium' | 'slow';
  previousMatchScores?: {
    firstInningsScore: number;
    secondInningsScore: number;
    date: string;
  }[];
}

interface MatchData {
  id: string;
  date: string;
  teams: {
    teamA: string;
    teamB: string;
  };
  format: 'T20' | 'ODI' | 'Test' | 'T10';
  overs: number;
  conditions: MatchConditions;
  playerPerformances: {
    playerId: string;
    battingStats?: {
      position: number;
      runs: number;
      ballsFaced: number;
      fours: number;
      sixes: number;
      dismissalType?: string;
      bowlerFaced: string[];
      runsPerBowler: Record<string, number>;
      phaseScoring: {
        powerplay?: number;
        middle?: number;
        death?: number;
      };
    };
    bowlingStats?: {
      overs: number;
      maidens: number;
      runs: number;
      wickets: number;
      economy: number;
      batsmenDismissed: string[];
      phaseWickets: {
        powerplay?: number;
        middle?: number;
        death?: number;
      };
      phaseEconomy: {
        powerplay?: number;
        middle?: number;
        death?: number;
      };
    };
    fieldingStats?: {
      catches: number;
      runOuts: number;
      stumpings?: number;
      fieldingPositions: string[];
    };
  }[];
  matchSituation: {
    currentInnings: 1 | 2;
    currentScore: number;
    wicketsLost: number;
    oversCompleted: number;
    currentRunRate: number;
    requiredRunRate?: number;
    currentBatsmen: string[];
    currentBowler: string;
    lastBowlers: string[];
    phase: 'powerplay' | 'middle' | 'death';
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
  }
];

const mockMatches: MatchData[] = [
  {
    id: 'm1',
    date: '2025-03-15',
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
    playerPerformances: [
      {
        playerId: 'p1',
        battingStats: {
          position: 3,
          runs: 82,
          ballsFaced: 49,
          fours: 8,
          sixes: 4,
          dismissalType: 'caught',
          bowlerFaced: ['p7', 'p8', 'p9'],
          runsPerBowler: {
            'p7': 12,
            'p8': 35,
            'p9': 35
          },
          phaseScoring: {
            powerplay: 22,
            middle: 35,
            death: 25
          }
        },
        fieldingStats: {
          catches: 1,
          runOuts: 0,
          fieldingPositions: ['cover', 'long-off']
        }
      },
      {
        playerId: 'p7',
        bowlingStats: {
          overs: 4,
          maidens: 0,
          runs: 32,
          wickets: 3,
          economy: 8.0,
          batsmenDismissed: ['p3', 'p4', 'p6'],
          phaseWickets: {
            powerplay: 1,
            middle: 0,
            death: 2
          },
          phaseEconomy: {
            powerplay: 9.0,
            middle: 0,
            death: 7.5
          }
        },
        fieldingStats: {
          catches: 0,
          runOuts: 1,
          fieldingPositions: ['fine-leg', 'third-man']
        }
      }
    ],
    matchSituation: {
      currentInnings: 2,
      currentScore: 120,
      wicketsLost: 3,
      oversCompleted: 12.4,
      currentRunRate: 9.47,
      requiredRunRate: 11.68,
      currentBatsmen: ['p1', 'p4'],
      currentBowler: 'p7',
      lastBowlers: ['p8', 'p9'],
      phase: 'middle'
    }
  }
];

const PlayerMatchDataCollection: React.FC = () => {
  const [players, setPlayers] = useState<PlayerStats[]>(mockPlayers);
  const [matches, setMatches] = useState<MatchData[]>(mockMatches);
  const [activeTab, setActiveTab] = useState<'players' | 'matches' | 'import'>('players');
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerStats | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<MatchData | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [importData, setImportData] = useState<string>('');

  // Function to handle player selection
  const handlePlayerSelect = (player: PlayerStats) => {
    setSelectedPlayer(player);
    setIsEditing(false);
  };

  // Function to handle match selection
  const handleMatchSelect = (match: MatchData) => {
    setSelectedMatch(match);
    setIsEditing(false);
  };

  // Function to save player data
  const handleSavePlayer = (updatedPlayer: PlayerStats) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      if (selectedPlayer) {
        // Update existing player
        setPlayers(players.map(p => p.id === updatedPlayer.id ? updatedPlayer : p));
      } else {
        // Add new player
        setPlayers([...players, { ...updatedPlayer, id: `p${players.length + 1}` }]);
      }
      setSelectedPlayer(null);
      setIsEditing(false);
      setIsLoading(false);
    }, 1000);
  };

  // Function to save match data
  const handleSaveMatch = (updatedMatch: MatchData) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      if (selectedMatch) {
        // Update existing match
        setMatches(matches.map(m => m.id === updatedMatch.id ? updatedMatch : m));
      } else {
        // Add new match
        setMatches([...matches, { ...updatedMatch, id: `m${matches.length + 1}` }]);
      }
      setSelectedMatch(null);
      setIsEditing(false);
      setIsLoading(false);
    }, 1000);
  };

  // Function to handle data import
  const handleImportData = () => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      try {
        const importedData = JSON.parse(importData);
        if (importedData.players) {
          setPlayers([...players, ...importedData.players]);
        }
        if (importedData.matches) {
          setMatches([...matches, ...importedData.matches]);
        }
        setImportData('');
        setActiveTab('players');
      } catch (error) {
        console.error('Invalid import data format', error);
        // In a real app, show error message to user
      }
      setIsLoading(false);
    }, 1000);
  };

  // Function to delete player
  const handleDeletePlayer = (playerId: string) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setPlayers(players.filter(p => p.id !== playerId));
      if (selectedPlayer && selectedPlayer.id === playerId) {
        setSelectedPlayer(null);
      }
      setIsLoading(false);
    }, 1000);
  };

  // Function to delete match
  const handleDeleteMatch = (matchId: string) => {
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setMatches(matches.filter(m => m.id !== matchId));
      if (selectedMatch && selectedMatch.id === matchId) {
        setSelectedMatch(null);
      }
      setIsLoading(false);
    }, 1000);
  };

  return (
    <Container maxWidth="xl">
      <Box sx={{ my: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Player & Match Data Collection
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" gutterBottom>
          Collect and manage player statistics and match data for AI tactical recommendations
        </Typography>
        
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item>
              <Button 
                variant={activeTab === 'players' ? 'contained' : 'outlined'} 
                onClick={() => setActiveTab('players')}
              >
                Players
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant={activeTab === 'matches' ? 'contained' : 'outlined'} 
                onClick={() => setActiveTab('matches')}
              >
                Matches
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant={activeTab === 'import' ? 'contained' : 'outlined'} 
                onClick={() => setActiveTab('import')}
              >
                Import Data
              </Button>
            </Grid>
          </Grid>
        </Box>
        
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        )}
        
        {!isLoading && activeTab === 'players' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Player List</Typography>
                    <Button 
                      startIcon={<AddIcon />} 
                      variant="contained" 
                      size="small"
                      onClick={() => {
                        setSelectedPlayer(null);
                        setIsEditing(true);
                      }}
                    >
                      Add Player
                    </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
                    {players.map((player) => (
                      <Box 
                        key={player.id}
                        sx={{ 
                          p: 1, 
                          mb: 1, 
                          borderRadius: 1,
                          cursor: 'pointer',
                          bgcolor: selectedPlayer?.id === player.id ? 'primary.light' : 'background.paper',
                          '&:hover': {
                            bgcolor: selectedPlayer?.id === player.id ? 'primary.light' : 'action.hover',
                          }
                        }}
                        onClick={() => handlePlayerSelect(player)}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle1">{player.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {player.role.charAt(0).toUpperCase() + player.role.slice(1)} • {player.battingStyle}
                            </Typography>
                          </Box>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlayer(player.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              {selectedPlayer && !isEditing ? (
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Player Details</Typography>
                      <Button 
                        startIcon={<EditIcon />} 
                        variant="outlined" 
                        size="small"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="h5">{selectedPlayer.name}</Typography>
                        <Box sx={{ display: 'flex', gap: 1, mt: 1, mb: 2 }}>
                          <Chip label={selectedPlayer.role} color="primary" size="small" />
                          <Chip label={selectedPlayer.battingStyle} size="small" />
                          {selectedPlayer.bowlingStyle && (
                            <Chip label={selectedPlayer.bowlingStyle} size="small" />
                          )}
                        </Box>
                        
                        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Batting Statistics</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell component="th" scope="row">Matches</TableCell>
                                <TableCell align="right">{selectedPlayer.battingStats.matches}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Runs</TableCell>
                                <TableCell align="right">{selectedPlayer.battingStats.runs}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Average</TableCell>
                                <TableCell align="right">{selectedPlayer.battingStats.average}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Strike Rate</TableCell>
                                <TableCell align="right">{selectedPlayer.battingStats.strikeRate}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Highest Score</TableCell>
                                <TableCell align="right">{selectedPlayer.battingStats.highestScore}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        {selectedPlayer.bowlingStats && (
                          <>
                            <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Bowling Statistics</Typography>
                            <TableContainer component={Paper} variant="outlined">
                              <Table size="small">
                                <TableBody>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Wickets</TableCell>
                                    <TableCell align="right">{selectedPlayer.bowlingStats.wickets}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Economy</TableCell>
                                    <TableCell align="right">{selectedPlayer.bowlingStats.economy}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Average</TableCell>
                                    <TableCell align="right">{selectedPlayer.bowlingStats.average}</TableCell>
                                  </TableRow>
                                  <TableRow>
                                    <TableCell component="th" scope="row">Best Figures</TableCell>
                                    <TableCell align="right">{selectedPlayer.bowlingStats.bestFigures}</TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </>
                        )}
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Advanced Statistics</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              {selectedPlayer.advancedStats.vsSpinBowlingAvg && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Avg vs Spin</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.vsSpinBowlingAvg}</TableCell>
                                </TableRow>
                              )}
                              {selectedPlayer.advancedStats.vsPaceBowlingAvg && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Avg vs Pace</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.vsPaceBowlingAvg}</TableCell>
                                </TableRow>
                              )}
                              {selectedPlayer.advancedStats.powerplayStrikeRate && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Powerplay SR</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.powerplayStrikeRate}</TableCell>
                                </TableRow>
                              )}
                              {selectedPlayer.advancedStats.deathOversStrikeRate && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Death Overs SR</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.deathOversStrikeRate}</TableCell>
                                </TableRow>
                              )}
                              {selectedPlayer.advancedStats.bowlingPowerplayEconomy && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Powerplay Economy</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.bowlingPowerplayEconomy}</TableCell>
                                </TableRow>
                              )}
                              {selectedPlayer.advancedStats.bowlingDeathEconomy && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Death Overs Economy</TableCell>
                                  <TableCell align="right">{selectedPlayer.advancedStats.bowlingDeathEconomy}</TableCell>
                                </TableRow>
                              )}
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Recent Form</Typography>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary">Current Form: 
                            <Chip 
                              label={selectedPlayer.recentForm.currentForm} 
                              size="small" 
                              color={
                                selectedPlayer.recentForm.currentForm === 'excellent' ? 'success' :
                                selectedPlayer.recentForm.currentForm === 'good' ? 'primary' :
                                selectedPlayer.recentForm.currentForm === 'average' ? 'warning' : 'error'
                              }
                              sx={{ ml: 1 }}
                            />
                          </Typography>
                        </Box>
                        
                        {selectedPlayer.recentForm.lastFiveInningsRuns && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2">Last 5 innings (runs):</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              {selectedPlayer.recentForm.lastFiveInningsRuns.map((runs, index) => (
                                <Chip 
                                  key={index} 
                                  label={runs} 
                                  size="small" 
                                  color={runs >= 50 ? 'success' : 'default'}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        
                        {selectedPlayer.recentForm.lastFiveInningsWickets && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2">Last 5 innings (wickets):</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                              {selectedPlayer.recentForm.lastFiveInningsWickets.map((wickets, index) => (
                                <Chip 
                                  key={index} 
                                  label={wickets} 
                                  size="small" 
                                  color={wickets >= 3 ? 'success' : 'default'}
                                />
                              ))}
                            </Box>
                          </Box>
                        )}
                        
                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Matchup Data</Typography>
                        {selectedPlayer.matchupData.strongAgainstPlayers && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2">Strong against:</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                              {selectedPlayer.matchupData.strongAgainstPlayers.map((playerId) => {
                                const player = players.find(p => p.id === playerId);
                                return (
                                  <Chip 
                                    key={playerId} 
                                    label={player ? player.name : playerId} 
                                    size="small" 
                                    color="success"
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                        
                        {selectedPlayer.matchupData.weakAgainstPlayers && (
                          <Box sx={{ mb: 2 }}>
                            <Typography variant="body2">Weak against:</Typography>
                            <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                              {selectedPlayer.matchupData.weakAgainstPlayers.map((playerId) => {
                                const player = players.find(p => p.id === playerId);
                                return (
                                  <Chip 
                                    key={playerId} 
                                    label={player ? player.name : playerId} 
                                    size="small" 
                                    color="error"
                                  />
                                );
                              })}
                            </Box>
                          </Box>
                        )}
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ) : isEditing ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {selectedPlayer ? 'Edit Player' : 'Add New Player'}
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    {/* Player edit form would go here */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This would be a comprehensive form for editing player data including all statistics, 
                      advanced metrics, and matchup information.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
                      <Button 
                        variant="outlined" 
                        onClick={() => {
                          setIsEditing(false);
                          if (!selectedPlayer) {
                            setSelectedPlayer(null);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="contained" 
                        startIcon={<SaveIcon />}
                        onClick={() => {
                          // In a real app, would save form data
                          handleSavePlayer(selectedPlayer || mockPlayers[0]);
                        }}
                      >
                        Save Player
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Player Details</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Select a player from the list to view details or add a new player.
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        )}
        
        {!isLoading && activeTab === 'matches' && (
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Match List</Typography>
                    <Button 
                      startIcon={<AddIcon />} 
                      variant="contained" 
                      size="small"
                      onClick={() => {
                        setSelectedMatch(null);
                        setIsEditing(true);
                      }}
                    >
                      Add Match
                    </Button>
                  </Box>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ maxHeight: '500px', overflow: 'auto' }}>
                    {matches.map((match) => (
                      <Box 
                        key={match.id}
                        sx={{ 
                          p: 1, 
                          mb: 1, 
                          borderRadius: 1,
                          cursor: 'pointer',
                          bgcolor: selectedMatch?.id === match.id ? 'primary.light' : 'background.paper',
                          '&:hover': {
                            bgcolor: selectedMatch?.id === match.id ? 'primary.light' : 'action.hover',
                          }
                        }}
                        onClick={() => handleMatchSelect(match)}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="subtitle1">{match.teams.teamA} vs {match.teams.teamB}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {match.date} • {match.format} • {match.conditions.venue}
                            </Typography>
                          </Box>
                          <IconButton 
                            size="small" 
                            color="error"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMatch(match.id);
                            }}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={8}>
              {selectedMatch && !isEditing ? (
                <Card>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Match Details</Typography>
                      <Button 
                        startIcon={<EditIcon />} 
                        variant="outlined" 
                        size="small"
                        onClick={() => setIsEditing(true)}
                      >
                        Edit
                      </Button>
                    </Box>
                    <Divider sx={{ mb: 3 }} />
                    
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="h5">{selectedMatch.teams.teamA} vs {selectedMatch.teams.teamB}</Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                          {selectedMatch.date} • {selectedMatch.format} • {selectedMatch.overs} overs
                        </Typography>
                        <Typography variant="body2" sx={{ mt: 1 }}>
                          Venue: {selectedMatch.conditions.venue}
                        </Typography>
                        
                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Match Conditions</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell component="th" scope="row">Pitch Type</TableCell>
                                <TableCell align="right">{selectedMatch.conditions.pitchType}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Weather</TableCell>
                                <TableCell align="right">{selectedMatch.conditions.weather}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Temperature</TableCell>
                                <TableCell align="right">{selectedMatch.conditions.temperature}°C</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Ground Size</TableCell>
                                <TableCell align="right">{selectedMatch.conditions.groundSize}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Outfield</TableCell>
                                <TableCell align="right">{selectedMatch.conditions.outfield}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                      
                      <Grid item xs={12} sm={6}>
                        <Typography variant="subtitle1" sx={{ mb: 1 }}>Current Match Situation</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableBody>
                              <TableRow>
                                <TableCell component="th" scope="row">Innings</TableCell>
                                <TableCell align="right">{selectedMatch.matchSituation.currentInnings}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Score</TableCell>
                                <TableCell align="right">{selectedMatch.matchSituation.currentScore}/{selectedMatch.matchSituation.wicketsLost}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Overs</TableCell>
                                <TableCell align="right">{selectedMatch.matchSituation.oversCompleted}</TableCell>
                              </TableRow>
                              <TableRow>
                                <TableCell component="th" scope="row">Current RR</TableCell>
                                <TableCell align="right">{selectedMatch.matchSituation.currentRunRate}</TableCell>
                              </TableRow>
                              {selectedMatch.matchSituation.requiredRunRate && (
                                <TableRow>
                                  <TableCell component="th" scope="row">Required RR</TableCell>
                                  <TableCell align="right">{selectedMatch.matchSituation.requiredRunRate}</TableCell>
                                </TableRow>
                              )}
                              <TableRow>
                                <TableCell component="th" scope="row">Phase</TableCell>
                                <TableCell align="right">{selectedMatch.matchSituation.phase}</TableCell>
                              </TableRow>
                            </TableBody>
                          </Table>
                        </TableContainer>
                        
                        <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>Current Players</Typography>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">Batsmen:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {selectedMatch.matchSituation.currentBatsmen.map((batsmanId) => {
                              const player = players.find(p => p.id === batsmanId);
                              return (
                                <Chip 
                                  key={batsmanId} 
                                  label={player ? player.name : batsmanId} 
                                  size="small" 
                                  color="primary"
                                />
                              );
                            })}
                          </Box>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">Current Bowler:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                            {(() => {
                              const player = players.find(p => p.id === selectedMatch.matchSituation.currentBowler);
                              return (
                                <Chip 
                                  label={player ? player.name : selectedMatch.matchSituation.currentBowler} 
                                  size="small" 
                                  color="secondary"
                                />
                              );
                            })()}
                          </Box>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2">Previous Bowlers:</Typography>
                          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                            {selectedMatch.matchSituation.lastBowlers.map((bowlerId) => {
                              const player = players.find(p => p.id === bowlerId);
                              return (
                                <Chip 
                                  key={bowlerId} 
                                  label={player ? player.name : bowlerId} 
                                  size="small" 
                                  variant="outlined"
                                />
                              );
                            })}
                          </Box>
                        </Box>
                      </Grid>
                      
                      <Grid item xs={12}>
                        <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Player Performances</Typography>
                        <TableContainer component={Paper} variant="outlined">
                          <Table size="small">
                            <TableHead>
                              <TableRow>
                                <TableCell>Player</TableCell>
                                <TableCell align="right">Batting</TableCell>
                                <TableCell align="right">Bowling</TableCell>
                                <TableCell align="right">Fielding</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {selectedMatch.playerPerformances.map((performance) => {
                                const player = players.find(p => p.id === performance.playerId);
                                return (
                                  <TableRow key={performance.playerId}>
                                    <TableCell component="th" scope="row">
                                      {player ? player.name : performance.playerId}
                                    </TableCell>
                                    <TableCell align="right">
                                      {performance.battingStats ? 
                                        `${performance.battingStats.runs} (${performance.battingStats.ballsFaced})` : 
                                        '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                      {performance.bowlingStats ? 
                                        `${performance.bowlingStats.wickets}/${performance.bowlingStats.runs} (${performance.bowlingStats.overs})` : 
                                        '-'}
                                    </TableCell>
                                    <TableCell align="right">
                                      {performance.fieldingStats ? 
                                        `${performance.fieldingStats.catches} ct, ${performance.fieldingStats.runOuts} ro` : 
                                        '-'}
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              ) : isEditing ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                      {selectedMatch ? 'Edit Match' : 'Add New Match'}
                    </Typography>
                    <Divider sx={{ mb: 3 }} />
                    
                    {/* Match edit form would go here */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This would be a comprehensive form for editing match data including teams, conditions, 
                      player performances, and match situation.
                    </Typography>
                    
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, gap: 2 }}>
                      <Button 
                        variant="outlined" 
                        onClick={() => {
                          setIsEditing(false);
                          if (!selectedMatch) {
                            setSelectedMatch(null);
                          }
                        }}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="contained" 
                        startIcon={<SaveIcon />}
                        onClick={() => {
                          // In a real app, would save form data
                          handleSaveMatch(selectedMatch || mockMatches[0]);
                        }}
                      >
                        Save Match
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2 }}>Match Details</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Select a match from the list to view details or add a new match.
                    </Typography>
                  </CardContent>
                </Card>
              )}
            </Grid>
          </Grid>
        )}
        
        {!isLoading && activeTab === 'import' && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2 }}>Import Data</Typography>
              <Divider sx={{ mb: 3 }} />
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Import player and match data from external sources. Paste JSON data in the format shown below.
              </Typography>
              
              <TextField
                label="JSON Data"
                multiline
                rows={10}
                fullWidth
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder={`{
  "players": [
    {
      "name": "Player Name",
      "role": "batsman",
      "battingStyle": "right-handed",
      ...
    }
  ],
  "matches": [
    {
      "date": "2025-03-20",
      "teams": {
        "teamA": "Team Name",
        "teamB": "Opponent Name"
      },
      ...
    }
  ]
}`}
                variant="outlined"
                sx={{ mb: 3 }}
              />
              
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button 
                  variant="contained" 
                  startIcon={<CloudUploadIcon />}
                  onClick={handleImportData}
                  disabled={!importData}
                >
                  Import Data
                </Button>
              </Box>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
};

export default PlayerMatchDataCollection;
