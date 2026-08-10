'use client';

import { useState } from 'react';
import BallByBallScoring from '@/components/scoring/BallByBallScoring';

interface Player {
  id: number;
  name: string;
  role: string;
}

const battingPlayers: Player[] = [
  { id: 1, name: 'Aarav Sharma', role: 'Opener' },
  { id: 2, name: 'Vikram Rao', role: 'Opener' },
  { id: 3, name: 'Rohan Iyer', role: 'Batsman' },
  { id: 4, name: 'Karan Mehta', role: 'Batsman' },
  { id: 5, name: 'Suresh Nair', role: 'All-rounder' },
  { id: 6, name: 'Arjun Verma', role: 'Wicket-keeper' },
  { id: 7, name: 'Dev Patel', role: 'All-rounder' },
  { id: 8, name: 'Ishaan Gupta', role: 'Bowler' },
  { id: 9, name: 'Nikhil Joshi', role: 'Bowler' },
  { id: 10, name: 'Rahul Singh', role: 'Bowler' },
  { id: 11, name: 'Amit Kumar', role: 'Bowler' },
];

const bowlingPlayers: Player[] = [
  { id: 101, name: 'Zaid Khan', role: 'Bowler' },
  { id: 102, name: 'Farhan Ali', role: 'Opener' },
  { id: 103, name: 'Yusuf Sheikh', role: 'Batsman' },
  { id: 104, name: 'Imran Malik', role: 'Batsman' },
  { id: 105, name: 'Sameer Shah', role: 'All-rounder' },
  { id: 106, name: 'Kabir Khanna', role: 'Wicket-keeper' },
  { id: 107, name: 'Aditya Bose', role: 'All-rounder' },
  { id: 108, name: 'Manav Chopra', role: 'Bowler' },
  { id: 109, name: 'Tariq Ahmed', role: 'Bowler' },
  { id: 110, name: 'Omar Farooq', role: 'Bowler' },
  { id: 111, name: 'Salman Reza', role: 'Bowler' },
];

function buildInitialInnings() {
  return {
    battingTeam: { name: 'Team A' },
    bowlingTeam: { name: 'Team B' },
    totalRuns: 0,
    wickets: 0,
    overs: 0,
    balls: 0,
    extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalty: 0 },
    currentBatsmen: [battingPlayers[0], battingPlayers[1]] as [Player | null, Player | null],
    currentBowler: bowlingPlayers[0],
    partnerships: [],
    fallOfWickets: [],
    battingScorecard: battingPlayers.map((player, idx) => ({
      player,
      runs: 0,
      balls: 0,
      fours: 0,
      sixes: 0,
      strikeRate: 0,
      status: idx < 2 ? 'not out' : 'yet to bat',
      outBowler: null,
      outFielder: null,
      outMethod: null,
    })),
    bowlingScorecard: bowlingPlayers.map(player => ({
      player,
      overs: 0,
      balls: 0,
      maidens: 0,
      runs: 0,
      wickets: 0,
      economy: 0,
      wides: 0,
      noBalls: 0,
    })),
  };
}

export default function LiveScoringPage({ params }: { params: { id: string } }) {
  const [inningsData, setInningsData] = useState(buildInitialInnings());

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Live Scoring</h1>
        <p className="text-sm text-gray-500 mb-4">
          Match {params.id} · demo data, not yet persisted to the backend
        </p>
        <BallByBallScoring
          matchId={params.id}
          inningsData={inningsData}
          onBallRecorded={setInningsData}
        />
      </div>
    </main>
  );
}
