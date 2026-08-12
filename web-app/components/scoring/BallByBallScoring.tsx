'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Line, Length, ShotType, ShotZone, FielderPosition,
  LINES, LENGTHS, SHOT_TYPES, SHOT_ZONES, labelize,
} from '@/lib/ballTaxonomy';
import VoiceBallInput from './VoiceBallInput';
import { ParsedBall } from '@/lib/voiceBallParser';
import LiveMatchupPanel from './LiveMatchupPanel';

interface Player {
  id: string;
  name: string;
  role: string;
}

export type { Line, Length, ShotType, ShotZone, FielderPosition };

export interface BallEvent {
  ballNumber: number;
  batsmanId: string;
  bowlerId: string;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: 'none' | 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty';
  line: Line;
  length: Length;
  shotType: ShotType | null;
  shotZone: ShotZone | null;
  fielderId: string | null;
  fielderPosition: FielderPosition | null;
  // Display names for auto-generated commentary - sourced from already-in-state player
  // objects rather than a server-side lookup, see commentaryGenerator.js.
  batsmanName?: string;
  bowlerName?: string;
  fielderName?: string;
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

export interface InningsData {
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
  onBallRecorded: (updatedInningsData: InningsData, ballEvent: BallEvent) => void;
}

const EXTRA_TYPE_TO_BACKEND: Record<'wides' | 'noBalls' | 'byes' | 'legByes' | 'penalty', BallEvent['extraType']> = {
  wides: 'wide',
  noBalls: 'no-ball',
  byes: 'bye',
  legByes: 'leg-bye',
  penalty: 'penalty',
};

const BallByBallScoring: React.FC<BallByBallScoringProps> = ({ 
  matchId, 
  inningsData, 
  onBallRecorded 
}) => {
  const [ballType, setBallType] = useState<'normal' | 'extra' | 'wicket'>('normal');
  const [runsScored, setRunsScored] = useState<number>(0);
  const [extraType, setExtraType] = useState<'wides' | 'noBalls' | 'byes' | 'legByes' | 'penalty'>('wides');
  const [extraRuns, setExtraRuns] = useState<number>(1);
  const [wicketType, setWicketType] = useState<string>('bowled');
  const [fielder, setFielder] = useState<Player | null>(null);
  const [newBatsman, setNewBatsman] = useState<Player | null>(null);
  const [showWicketModal, setShowWicketModal] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Optional delivery/shot tagging (progressive disclosure)
  const [detailExpanded, setDetailExpanded] = useState<boolean>(false);
  const [line, setLine] = useState<Line>('unknown');
  const [length, setLength] = useState<Length>('unknown');
  const [shotType, setShotType] = useState<ShotType | null>(null);
  const [shotZone, setShotZone] = useState<ShotZone | null>(null);
  const [fielderPosition, setFielderPosition] = useState<FielderPosition | null>(null);

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
    if (runs === 4 || runs === 6) {
      setDetailExpanded(true);
    }
  };

  // Handle extra button click
  const handleExtraClick = (type: 'wides' | 'noBalls' | 'byes' | 'legByes' | 'penalty') => {
    setBallType('extra');
    setExtraType(type);
    
    // Set default extra runs based on type
    if (type === 'wides' || type === 'noBalls') {
      setExtraRuns(1);
    } else {
      setExtraRuns(0);
    }
  };

  // Handle wicket button click
  const handleWicketClick = () => {
    setBallType('wicket');
    setShowWicketModal(true);
    setDetailExpanded(true);
  };

  // Applies a voice-parsed partial result onto the same state the tap buttons already control,
  // reusing the existing handlers so nothing about validation/submission changes. Never
  // auto-submits - the scorer still taps Record Ball (or confirms the wicket modal) themselves.
  const handleVoiceParsed = (parsed: ParsedBall) => {
    if (parsed.isWicket) {
      if (parsed.wicketType) setWicketType(parsed.wicketType);
      handleWicketClick();
    } else if (parsed.isExtra && parsed.extraType) {
      const frontendType = (Object.keys(EXTRA_TYPE_TO_BACKEND) as Array<keyof typeof EXTRA_TYPE_TO_BACKEND>)
        .find(key => EXTRA_TYPE_TO_BACKEND[key] === parsed.extraType);
      if (frontendType) handleExtraClick(frontendType);
    } else if (typeof parsed.runs === 'number') {
      handleRunsClick(parsed.runs);
    }

    if (parsed.line) setLine(parsed.line);
    if (parsed.length) setLength(parsed.length);
    if (parsed.shotType) setShotType(parsed.shotType);
    if (parsed.shotZone) setShotZone(parsed.shotZone);
    if (parsed.fielderPosition) setFielderPosition(parsed.fielderPosition);
    if (parsed.line || parsed.length || parsed.shotType || parsed.shotZone) {
      setDetailExpanded(true);
    }
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
    if (ballType === 'wicket' && (line === 'unknown' || length === 'unknown')) {
      alert('Please tag line and length before confirming a wicket');
      return;
    }
    setIsProcessing(true);

    let updatedInningsData = { ...inningsData };
    const ballNumber = inningsData.overs * 6 + inningsData.balls + 1;
    
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
      if (extraType === 'wides' || extraType === 'noBalls') {
        runsToAdd = extraRuns;
        
        // Update extras
        updatedInningsData.extras[extraType] += runsToAdd;
        
        // Update bowler stats
        updatedInningsData.bowlingScorecard[bowlerIndex].runs += runsToAdd;
        
        if (extraType === 'wides') {
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
      if (extraType !== 'wides' && runsToAdd % 2 === 1) {
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
        player: striker!,
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
    
    // Build the raw ball event for the parent to persist via the record-ball API
    const ballEvent: BallEvent = {
      ballNumber,
      batsmanId: striker?.id ?? '',
      bowlerId: bowler?.id ?? '',
      runs: ballType === 'normal' ? runsScored : ballType === 'extra' ? extraRuns : 0,
      isWicket: ballType === 'wicket',
      wicketType: ballType === 'wicket' ? wicketType : null,
      isExtra: ballType === 'extra',
      extraType: ballType === 'extra' ? EXTRA_TYPE_TO_BACKEND[extraType] : 'none',
      line,
      length,
      shotType,
      shotZone,
      fielderId: ballType === 'wicket' ? fielder?.id ?? null : null,
      fielderPosition: ballType === 'wicket' ? fielderPosition : null,
      batsmanName: striker?.name,
      bowlerName: bowler?.name,
      fielderName: ballType === 'wicket' ? fielder?.name : undefined
    };

    // Call the callback with updated innings data and the raw event to persist
    onBallRecorded(updatedInningsData, ballEvent);

    // Reset state
    setBallType('normal');
    setRunsScored(0);
    setExtraType('wides');
    setExtraRuns(1);
    setWicketType('bowled');
    setFielder(null);
    setNewBatsman(null);
    setDetailExpanded(false);
    setLine('unknown');
    setLength('unknown');
    setShotType(null);
    setShotZone(null);
    setFielderPosition(null);
    setIsProcessing(false);
  };

  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-4 max-w-full">
      <VoiceBallInput onParsed={handleVoiceParsed} />

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-ink mb-2">Current Batsmen</h3>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div className="flex items-center w-full sm:w-auto">
            <div className="w-10 h-10 bg-pitch-500/20 rounded-full flex items-center justify-center mr-2">
              <span className="font-bold text-pitch-400">{striker?.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-ink">{striker?.name} *</p>
              <p className="text-sm text-ink-secondary">
                {striker && inningsData.battingScorecard.find(b => b.player.id === striker.id)?.runs || 0}
                ({striker && inningsData.battingScorecard.find(b => b.player.id === striker.id)?.balls || 0})
              </p>
            </div>
          </div>

          <div className="flex items-center w-full sm:w-auto">
            <div className="w-10 h-10 bg-pitch-500/20 rounded-full flex items-center justify-center mr-2">
              <span className="font-bold text-pitch-400">{nonStriker?.name.charAt(0)}</span>
            </div>
            <div>
              <p className="font-medium text-ink">{nonStriker?.name}</p>
              <p className="text-sm text-ink-secondary">
                {nonStriker && inningsData.battingScorecard.find(b => b.player.id === nonStriker.id)?.runs || 0}
                ({nonStriker && inningsData.battingScorecard.find(b => b.player.id === nonStriker.id)?.balls || 0})
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-lg font-semibold text-ink mb-2">Current Bowler</h3>
        <div className="flex items-center">
          <div className="w-10 h-10 bg-gold-500/20 rounded-full flex items-center justify-center mr-2">
            <span className="font-bold text-gold-400">{bowler?.name.charAt(0)}</span>
          </div>
          <div>
            <p className="font-medium text-ink">{bowler?.name}</p>
            <p className="text-sm text-ink-secondary">
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.wickets || 0}/
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.runs || 0}
              ({bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.overs || 0}.
              {bowler && inningsData.bowlingScorecard.find(b => b.player.id === bowler.id)?.balls || 0})
            </p>
          </div>
        </div>
      </div>

      <LiveMatchupPanel
        matchId={matchId}
        batsmanId={striker?.id}
        bowlerId={bowler?.id}
        refreshKey={`${inningsData.overs}.${inningsData.balls}`}
      />

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ink mb-2">Match Status</h3>
        <div className="bg-surface-alt border border-border p-3 rounded-lg">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <p className="text-xl font-bold text-ink">
              {inningsData.totalRuns}/{inningsData.wickets}
            </p>
            <p className="text-md text-ink">
              {inningsData.overs}.{inningsData.balls} overs
            </p>
          </div>
          <div className="mt-2 text-sm text-ink-secondary">
            <p>Extras: {Object.values(inningsData.extras).reduce((sum, val) => sum + val, 0)}</p>
            <p>Required Rate: 8.5</p>
          </div>
        </div>
      </div>
      
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ink mb-2">Runs</h3>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
          {[0, 1, 2, 3, 4, 5, 6].map(runs => (
            <button
              key={runs}
              onClick={() => handleRunsClick(runs)}
              className={`py-3 rounded-lg font-semibold text-lg touch-manipulation border ${
                ballType === 'normal' && runsScored === runs
                  ? 'bg-pitch-500 text-background border-pitch-500'
                  : 'bg-surface-alt text-ink border-border hover:bg-surface-hover'
              }`}
            >
              {runs}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-ink mb-2">Extras</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {(['wides', 'noBalls', 'byes', 'legByes', 'penalty'] as const).map(type => (
            <button
              key={type}
              onClick={() => handleExtraClick(type)}
              className={`py-3 rounded-lg font-medium text-sm touch-manipulation border ${
                ballType === 'extra' && extraType === type
                  ? 'bg-gold-500 text-background border-gold-500'
                  : 'bg-surface-alt text-ink border-border hover:bg-surface-hover'
              }`}
            >
              {type === 'noBalls' ? 'No Ball' : type === 'legByes' ? 'Leg Bye' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
        {ballType === 'extra' && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-sm font-medium text-ink-secondary">Additional runs</label>
            <select
              value={extraRuns}
              onChange={(e) => setExtraRuns(parseInt(e.target.value, 10))}
              className="border border-border bg-surface-alt text-ink rounded-lg px-3 py-2"
            >
              {[0, 1, 2, 3, 4].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="mb-6">
        <button
          type="button"
          onClick={() => setDetailExpanded(prev => !prev)}
          className="text-sm font-medium text-pitch-400 hover:text-pitch-300 hover:underline mb-3"
        >
          {detailExpanded ? '− Hide shot detail' : '+ Add shot detail'}
        </button>

        {detailExpanded && (
          <div className="space-y-4 bg-surface-alt border border-border rounded-lg p-3">
            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Line</p>
              <div className="flex flex-wrap gap-1">
                {LINES.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLine(l)}
                    className={`px-2 py-1 rounded text-xs border touch-manipulation ${
                      line === l ? 'bg-pitch-500 text-background border-pitch-500' : 'bg-surface text-ink-secondary border-border'
                    }`}
                  >
                    {labelize(l)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Length</p>
              <div className="flex flex-wrap gap-1">
                {LENGTHS.map(l => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLength(l)}
                    className={`px-2 py-1 rounded text-xs border touch-manipulation ${
                      length === l ? 'bg-pitch-500 text-background border-pitch-500' : 'bg-surface text-ink-secondary border-border'
                    }`}
                  >
                    {labelize(l)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Shot Zone (where it went)</p>
              <div className="flex flex-wrap gap-1">
                {SHOT_ZONES.map(z => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => setShotZone(prev => (prev === z ? null : z))}
                    className={`px-2 py-1 rounded text-xs border touch-manipulation ${
                      shotZone === z ? 'bg-gold-500 text-background border-gold-500' : 'bg-surface text-ink-secondary border-border'
                    }`}
                  >
                    {labelize(z)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-ink-muted mb-1">Shot Type</p>
              <div className="flex flex-wrap gap-1">
                {SHOT_TYPES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setShotType(prev => (prev === s ? null : s))}
                    className={`px-2 py-1 rounded text-xs border touch-manipulation ${
                      shotType === s ? 'bg-purple-500 text-background border-purple-500' : 'bg-surface text-ink-secondary border-border'
                    }`}
                  >
                    {labelize(s)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mb-6">
        <button
          onClick={handleWicketClick}
          className="w-full py-3 rounded-lg font-semibold text-white bg-wicket-500 hover:bg-wicket-600 touch-manipulation"
        >
          Wicket
        </button>
      </div>

      <button
        onClick={handleRecordBall}
        disabled={isProcessing || ballType === 'wicket'}
        className="w-full py-4 rounded-lg font-bold text-background bg-pitch-500 hover:bg-pitch-600 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
      >
        {isProcessing ? 'Recording...' : 'Record Ball'}
      </button>

      {showWicketModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface border border-border-strong rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-card-hover">
            <h3 className="text-lg font-bold text-ink mb-4">Record Wicket</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-secondary mb-1">How out?</label>
              <select
                value={wicketType}
                onChange={(e) => setWicketType(e.target.value)}
                className="w-full border border-border bg-surface-alt text-ink rounded-lg px-3 py-2"
              >
                {['bowled', 'caught', 'lbw', 'run out', 'stumped', 'hit wicket', 'retired hurt', 'retired out'].map(w => (
                  <option key={w} value={w}>{w.charAt(0).toUpperCase() + w.slice(1)}</option>
                ))}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Line <span className="text-wicket-400">*</span>
              </label>
              <select
                value={line}
                onChange={(e) => setLine(e.target.value as Line)}
                className={`w-full border bg-surface-alt text-ink rounded-lg px-3 py-2 ${line === 'unknown' ? 'border-wicket-400' : 'border-border'}`}
              >
                <option value="unknown">Select line</option>
                {LINES.map(l => <option key={l} value={l}>{labelize(l)}</option>)}
              </select>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-ink-secondary mb-1">
                Length <span className="text-wicket-400">*</span>
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value as Length)}
                className={`w-full border bg-surface-alt text-ink rounded-lg px-3 py-2 ${length === 'unknown' ? 'border-wicket-400' : 'border-border'}`}
              >
                <option value="unknown">Select length</option>
                {LENGTHS.map(l => <option key={l} value={l}>{labelize(l)}</option>)}
              </select>
            </div>

            {['caught', 'run out', 'stumped'].includes(wicketType) && (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Fielder</label>
                  <select
                    value={fielder?.id ?? ''}
                    onChange={(e) => {
                      const selected = inningsData.bowlingScorecard.find(
                        b => b.player.id === e.target.value
                      );
                      setFielder(selected ? selected.player : null);
                    }}
                    className="w-full border border-border bg-surface-alt text-ink rounded-lg px-3 py-2"
                  >
                    <option value="">Select fielder</option>
                    {inningsData.bowlingScorecard.map(entry => (
                      <option key={entry.player.id} value={entry.player.id}>{entry.player.name}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-ink-secondary mb-1">Fielder Position</label>
                  <select
                    value={fielderPosition ?? ''}
                    onChange={(e) => setFielderPosition((e.target.value || null) as FielderPosition | null)}
                    className="w-full border border-border bg-surface-alt text-ink rounded-lg px-3 py-2"
                  >
                    <option value="">Select position</option>
                    {SHOT_ZONES.map(z => <option key={z} value={z}>{labelize(z)}</option>)}
                    <option value="wicket-keeper">Wicket-keeper</option>
                    <option value="bowler">Bowler</option>
                  </select>
                </div>
              </>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-ink-secondary mb-1">New Batsman</label>
              <select
                value={newBatsman?.id ?? ''}
                onChange={(e) => {
                  const selected = availableBatsmen.find(p => p.id === e.target.value);
                  setNewBatsman(selected ?? null);
                }}
                className="w-full border border-border bg-surface-alt text-ink rounded-lg px-3 py-2"
              >
                <option value="">Select new batsman</option>
                {availableBatsmen.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowWicketModal(false);
                  setBallType('normal');
                }}
                className="flex-1 py-3 rounded-lg font-medium border border-border text-ink-secondary hover:bg-surface-hover touch-manipulation"
              >
                Cancel
              </button>
              <button
                onClick={handleRecordBall}
                disabled={isProcessing || !newBatsman || line === 'unknown' || length === 'unknown'}
                className="flex-1 py-3 rounded-lg font-medium text-white bg-wicket-500 hover:bg-wicket-600 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
              >
                Confirm Wicket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BallByBallScoring;