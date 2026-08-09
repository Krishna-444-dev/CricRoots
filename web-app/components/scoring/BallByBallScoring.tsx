'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Player {
  id: number;
  name: string;
  role: string;
}

interface BatsmanScorecard {
  player: Player;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: number;
  status: string;
  outBowler: Player | null;
  outFielder: Player | null;
  outMethod: string | null;
}

interface BowlerScorecard {
  player: Player;
  overs: number;
  balls: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  wides: number;
  noBalls: number;
}

interface Partnership {
  player1: Player;
  player2: Player;
  runs: number;
  balls: number;
}

interface FallOfWicket {
  player: Player;
  runs: number;
  overs: number;
  balls: number;
  wicketNumber: number;
}

interface Extras {
  wides: number;
  noBalls: number;
  byes: number;
  legByes: number;
  penalty: number;
}

interface InningsData {
  battingTeam: any;
  bowlingTeam: any;
  totalRuns: number;
  wickets: number;
  overs: number;
  balls: number;
  extras: Extras;
  currentBatsmen: [Player | null, Player | null];
  currentBowler: Player | null;
  partnerships: Partnership[];
  fallOfWickets: FallOfWicket[];
  battingScorecard: BatsmanScorecard[];
  bowlingScorecard: BowlerScorecard[];
}

interface BallByBallScoringProps {
  matchId: string;
  inningsData: InningsData;
  onBallRecorded: (updatedInningsData: InningsData) => void;
}

const BallByBallScoring: React.FC<BallByBallScoringProps> = ({ 
  matchId, 
  inningsData, 
  onBallRecorded 
}) => {
  const [ballType, setBallType] = useState<'normal' | 'extra' | 'wicket'>('normal');
  const [runsScored, setRunsScored] = useState<number>(0);
  const [extraType, setExtraType] = useState<'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty'>('wide');
  const [extraRuns, setExtraRuns] = useState<number>(1);
  const [wicketType, setWicketType] = useState<string>('bowled');
  const [fielder, setFielder] = useState<Player | null>(null);
  const [newBatsman, setNewBatsman] = useState<Player | null>(null);
  const [showWicketModal, setShowWicketModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Get current batsman (striker)
  const striker = inningsData.currentBatsmen[0];
  const nonStriker = inningsData.currentBatsmen[1];
  
  // Get current bowler
  const bowler = inningsData.currentBowler;

  // Get available batsmen (not out yet)
  const availableBatsmen = inningsData.battingScorecard
    .filter(entry => entry.status === 'yet to bat')
    .map(entry => entry.player);

  // Handle runs button click
  const handleRunsClick = (runs: number) => {
    setRunsScored(runs);
    setBallType('normal');
  };

  // Handle extra button click
  const handleExtraClick = (type: 'wide' | 'noBall' | 'bye' | 'legBye' | 'penalty') => {
    setBallType('extra');
    setExtraType(type);
    
    // Set default extra runs based on type
    if (type === 'wide' || type === 'noBall') {
      setExtraRuns(1);
    } else {
      setExtraRuns(0);
    }
  };

  // Handle wicket button click
  const handleWicketClick = () => {
    setBallType('wicket');
    setShowWicketModal(true);
  };

  // Calculate strike rate
  const calculateStrikeRate = (runs: number, balls: number): number => {
    if (balls === 0) return 0;
    return parseFloat(((runs / balls) * 100).toFixed(2));
  };

  // Calculate economy rate
  const calculateEconomy = (runs: number, overs: number, balls: number): number => {
    const totalOvers = overs + (balls / 6);
    if (totalOvers === 0) return 0;
    return parseFloat((runs / totalOvers).toFixed(2));
  };

  // Handle recording a ball
  const handleRecordBall = () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    let updatedInningsData = { ...inningsData };
    
    // Find striker and bowler in scorecards
    const strikerIndex = updatedInningsData.battingScorecard.findIndex(
      entry => striker && entry.player.id === striker.id
    );
    
    const bowlerIndex = updatedInningsData.bowlingScorecard.findIndex(
      entry => bowler && entry.player.id === bowler.id
    );
    
    if (strikerIndex === -1 || bowlerIndex === -1) {
      console.error('Striker or bowler not found in scorecard');
      setIsProcessing(false);
      return;
    }
    
    // Handle different ball types
    if (ballType === 'normal') {
      // Update batsman stats
      updatedInningsData.battingScorecard[strikerIndex].runs += runsScored;
      updatedInningsData.battingScorecard[strikerIndex].balls += 1;
      
      if (runsScored === 4) {
        updatedInningsData.battingScorecard[strikerIndex].fours += 1;
      } else if (runsScored === 6) {
        updatedInningsData.battingScorecard[strikerIndex].sixes += 1;
      }
      
      // Update bowler stats
      updatedInningsData.bowlingScorecard[bowlerIndex].runs += runsScored;
      updatedInningsData.bowlingScorecard[bowlerIndex].balls += 1;
      
      // Update innings stats
      updatedInningsData.totalRuns += runsScored;
      updatedInningsData.balls += 1;
      
      // Check if over is complete
      if (updatedInningsData.balls === 6) {
        updatedInningsData.overs += 1;
        updatedInningsData.balls = 0;
        
        // Update bowler overs
        updatedInningsData.bowlingScorecard[bowlerIndex].overs += 1;
        
        // Check if maiden over
        if (updatedInningsData.bowlingScorecard[bowlerIndex].runs === 0) {
          updatedInningsData.bowlingScorecard[bowlerIndex].maidens += 1;
        }
        
        // Reset bowler runs for next over
        updatedInningsData.bowlingScorecard[bowlerIndex].runs = 0;
        
        // Swap batsmen at end of over
        updatedInningsData.currentBatsmen = [
          updatedInningsData.currentBatsmen[1],
          updatedInningsData.currentBatsmen[0]
        ];
      } else {
        // Swap batsmen if odd number of runs
        if (runsScored % 2 === 1) {
          updatedInningsData.currentBatsmen = [
            updatedInningsData.currentBatsmen[1],
            updatedInningsData.currentBatsmen[0]
          ];
        }
      }
      
      // Update strike rate
      updatedInningsData.battingScorecard[strikerIndex].strikeRate = 
        calculateStrikeRate(
          updatedInningsData.battingScorecard[strikerIndex].runs,
          updatedInningsData.battingScorecard[strikerIndex].balls
        );
      
      // Update economy rate
      updatedInningsData.bowlingScorecard[bowlerIndex].economy = 
        calculateEconomy(
          updatedInningsData.bowlingScorecard[bowlerIndex].runs,
          updatedInningsData.bowlingScorecard[bowlerIndex].overs,
          updatedInningsData.bowlingScorecard[bowlerIndex].balls
        );
    } else if (ballType === 'extra') {
      let runsToAdd = extraRuns;
      
      // For wides and no balls, add 1 extra run plus any additional runs
      if (extraType === 'wide' || extraType === 'noBall') {
        runsToAdd = extraRuns;
        
        // Update extras
        updatedInningsData.extras[extraType] += runsToAdd;
        
        // Update bowler stats
        updatedInningsData.bowlingScorecard[bowlerIndex].runs += runsToAdd;
        
        if (extraType === 'wide') {
          updatedInningsData.bowlingScorecard[bowlerIndex].wides += runsToAdd;
        } else {
          updatedInningsData.bowlingScorecard[bowlerIndex].noBalls += 1;
          
          // For no balls, batsman faces the ball
          updatedInningsData.battingScorecard[strikerIndex].balls += 1;
        }
      } else {
        // For byes and leg byes, count as a ball faced
        updatedInningsData.battingScorecard[strikerIndex].balls += 1;
        updatedInningsData.bowlingScorecard[bowlerIndex].balls += 1;
        updatedInningsData.balls += 1;
        
        // Update extras
        updatedInningsData.extras[extraType] += extraRuns;
        
        // Check if over is complete
        if (updatedInningsData.balls === 6) {
          updatedInningsData.overs += 1;
          updatedInningsData.balls = 0;
          
          // Update bowler overs
          updatedInningsData.bowlingScorecard[bowlerIndex].overs += 1;
          
          // Swap batsmen at end of over
          updatedInningsData.currentBatsmen = [
            updatedInningsData.currentBatsmen[1],
            updatedInningsData.currentBatsmen[0]
          ];
        }
      }
      
      // Update innings total
      updatedInningsData.totalRuns += runsToAdd;
      
      // Swap batsmen if odd number of runs (except for wides)
      if (extraType !== 'wide' && runsToAdd % 2 === 1) {
        updatedInningsData.currentBatsmen = [
          updatedInningsData.currentBatsmen[1],
          updatedInningsData.currentBatsmen[0]
        ];
      }
      
      // Update economy rate
      updatedInningsData.bowlingScorecard[bowlerIndex].economy = 
        calculateEconomy(
          updatedInningsData.bowlingScorecard[bowlerIndex].runs,
          updatedInningsData.bowlingScorecard[bowlerIndex].overs,
          updatedInningsData.bowlingScorecard[bowlerIndex].balls
        );
    } else if (ballType === 'wicket') {
      // Close wicket modal
      setShowWicketModal(false);
      
      if (!newBatsman) {
        alert('Please select a new batsman');
        setIsProcessing(false);
        return;
      }
      
      // Update batsman stats
      updatedInningsData.battingScorecard[strikerIndex].balls += 1;
      updatedInningsData.battingScorecard[strikerIndex].status = 'out';
      updatedInningsData.battingScorecard[strikerIndex].outMethod = wicketType;
      
      if (wicketType !== 'run out' && wicketType !== 'retired hurt' && wicketType !== 'retired out') {
        updatedInningsData.battingScorecard[strikerIndex].outBowler = bowler;
      }
      
      if (['caught', 'run out', 'stumped'].includes(wicketType) && fielder) {
        updatedInningsData.battingScorecard[strikerIndex].outFielder = fielder;
      }
      
      // Update bowler stats
      updatedInningsData.bowlingScorecard[bowlerIndex].balls += 1;
      
      if (wicketType !== 'run out' && wicketType !== 'retired hurt' && wicketType !== 'retired out') {
        updatedInningsData.bowlingScorecard[bowlerIndex].wickets += 1;
      }
      
      // Update innings stats
      updatedInningsData.balls += 1;
      updatedInningsData.wickets += 1;
      
      // Add fall of wicket
      updatedInningsData.fallOfWickets.push({
        player: striker,
        runs: updatedInningsData.totalRuns,
        overs: updatedInningsData.overs,
        balls: updatedInningsData.balls,
        wicketNumber: updatedInningsData.wickets
      });
      
      // Check if over is complete
      if (updatedInningsData.balls === 6) {
        updatedInningsData.overs += 1;
        updatedInningsData.balls = 0;
        
        // Update bowler overs
        updatedInningsData.bowlingScorecard[bowlerIndex].overs += 1;
        
        // Swap non-striker to strike
        updatedInningsData.currentBatsmen = [
          updatedInningsData.currentBatsmen[1],
          newBatsman
        ];
      } else {
        // New batsman comes in at striker's end
        updatedInningsData.currentBatsmen = [
          newBatsman,
          updatedInningsData.currentBatsmen[1]
        ];
      }
      
      // Update strike rate
      updatedInningsData.battingScorecard[strikerIndex].strikeRate = 
        calculateStrikeRate(
          updatedInningsData.battingScorecard[strikerIndex].runs,
          updatedInningsData.battingScorecard[strikerIndex].balls
        );
      
      // Update economy rate
      updatedInningsData.bowlingScorecard[bowlerIndex].economy = 
        calculateEconomy(
          updatedInningsData.bowlingScorecard[bowlerIndex].runs,
          updatedInningsData.bowlingScorecard[bowlerIndex].overs,
          updatedInningsData.bowlingScorecard[bowlerIndex].balls
        );
    }
    
    // Call the callback with updated innings data
    onBallRecorded(updatedInningsData);
    
    // Reset state
    setBallType('normal');
    setRunsScored(0);
    setExtraType('wide');
    setExtraRuns(1);
    setWicketType('bowled');
    setFielder(null);
    setNewBatsman(null);
    setIsProcessing(false);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 max-w-full">
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Current Batsmen</h3>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div className="flex items-center w-full sm:w-auto">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-2">
              <span className="font-bold">{striker?.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium">{striker?.name} *</p>
              <p className="text-sm text-gray-600">
                {striker && inningsData.battingScorecard.find(b => b.player.id === striker.id)?.runs || 0}
                ({striker && inningsData.battingScorecard.find(b => b.player.id === striker.id)?.balls || 0})
              </p>
            </div>
          </div>
          
          <div className="flex items-center w-full sm:w-auto">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-2">
              <span className="font-bold">{nonStriker?.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium">{nonStriker?.name}</p>
              <p className="text-sm text-gray-600">
                {nonStriker && inningsData.battingScorecard.find(b => b.player.id === nonStriker.id)?.runs || 0}
                ({nonStriker && inningsData.battingScorecard.find(b => b.player.id === nonStriker.id)?.balls || 0})
              </p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Current Bowler</h3>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-2">
            <span className="font-bold">{bowler?.name.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium">{bowler?.name}</p>
            <p className="text-sm text-gray-600">
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.wickets || 0}/
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.runs || 0}
              ({bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.overs || 0}.
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.balls || 0})
            </p>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Match Status</h3>
        <div className="bg-gray-50 p-3 rounded-md">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <p className="text-xl font-bold">
              {inningsData.totalRuns}/{inningsData.wickets}
            </p>
            <p className="text-md">
              {inningsData.overs}.{inningsData.balls} overs
            </p>
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <p>Extras: {Object.values(inningsData.extras).reduce((sum, val) => sum + val, 0)}</p>
            <p>Required Rate: 8.5</p>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Runs</h3>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map(runs => (
            <button
              key<response clipped><NOTE>To save on context only part of this file has been shown to you. You should retry this tool after you have searched inside the file with `grep -n` in order to find the line numbers of what you are looking for.</NOTE>