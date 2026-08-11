'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface LeaderboardRow {
  rank: number;
  userId: string;
  name: string;
  totalPoints: number;
  correctPredictions: number;
  totalPredictions: number;
}

interface MyPrediction {
  _id: string;
  status: 'pending' | 'settled';
  points: number;
  wonOnWinner: boolean;
  wonOnMotm: boolean;
  predictedWinner: { _id: string; name: string } | null;
  match: {
    _id: string;
    title: string;
    matchType: string;
    status: string;
    venue: string;
    scheduledDate: string;
    team1: { name: string };
    team2: { name: string };
    result?: string;
  } | null;
}

type Tab = 'leaderboard' | 'mine';

export default function LeaderboardPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [tab, setTab] = useState<Tab>('leaderboard');

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(true);
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null);

  const [myPredictions, setMyPredictions] = useState<MyPrediction[]>([]);
  const [totalPoints, setTotalPoints] = useState(0);
  const [mineLoading, setMineLoading] = useState(false);
  const [mineLoaded, setMineLoaded] = useState(false);
  const [mineError, setMineError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLeaderboardLoading(true);
    try {
      const res = await fetch('/api/predictions/leaderboard?limit=50');
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard);
        setLeaderboardError(null);
      } else {
        setLeaderboardError('Could not load the leaderboard');
      }
    } catch (err) {
      setLeaderboardError('Could not reach the CricSync server');
    } finally {
      setLeaderboardLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const fetchMyPredictions = useCallback(async () => {
    if (!user) return;
    setMineLoading(true);
    try {
      const res = await apiFetch('/api/predictions/me');
      const data = await res.json();
      if (data.success) {
        setMyPredictions(data.predictions);
        setTotalPoints(data.totalPoints);
        setMineError(null);
      } else {
        setMineError('Could not load your predictions');
      }
    } catch (err) {
      setMineError('Could not reach the CricSync server');
    } finally {
      setMineLoading(false);
      setMineLoaded(true);
    }
  }, [user]);

  useEffect(() => {
    if (tab === 'mine' && user && !mineLoaded) {
      fetchMyPredictions();
    }
  }, [tab, user, mineLoaded, fetchMyPredictions]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-background">
      <div className="max-w-[1200px] mx-auto px-5 py-8">
        <h1 className="text-2xl font-bold text-ink mb-1">🏆 Predictions Leaderboard</h1>
        <p className="text-sm text-ink-muted mb-6">
          Points for correctly predicting match winners and Man of the Match. No stakes, just bragging rights.
        </p>

        <div className="flex gap-1 mb-6 border-b border-border">
          <button
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'leaderboard' ? 'text-pitch-400 border-pitch-500' : 'text-ink-secondary border-transparent hover:text-ink'
            }`}
            onClick={() => setTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'mine' ? 'text-pitch-400 border-pitch-500' : 'text-ink-secondary border-transparent hover:text-ink'
            }`}
            onClick={() => setTab('mine')}
          >
            My Predictions
          </button>
        </div>

        {tab === 'leaderboard' ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            {leaderboardLoading ? (
              <p className="p-4 text-sm text-ink-muted">Loading leaderboard...</p>
            ) : leaderboardError ? (
              <p className="p-4 text-sm text-wicket-400">{leaderboardError}</p>
            ) : leaderboard.length === 0 ? (
              <p className="p-4 text-sm text-ink-muted">No settled predictions yet - check back once some matches finish.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-ink-muted border-b border-border">
                    <th className="px-4 py-3 font-medium w-16">Rank</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium text-right">Points</th>
                    <th className="px-4 py-3 font-medium text-right">Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaderboard.map((row) => {
                    const isMe = !!user && row.userId === user.id;
                    return (
                      <tr key={row.userId} className={isMe ? 'bg-pitch-500/10' : ''}>
                        <td className="px-4 py-3 text-ink-secondary">{row.rank}</td>
                        <td className={`px-4 py-3 font-medium ${isMe ? 'text-pitch-400' : 'text-ink'}`}>
                          {row.name}
                          {isMe && <span className="ml-2 text-xs text-pitch-500 font-normal">(you)</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gold-500">{row.totalPoints}</td>
                        <td className="px-4 py-3 text-right text-ink-secondary">
                          {row.correctPredictions}/{row.totalPredictions}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div>
            {authLoading ? null : !user ? (
              <p className="text-sm text-ink-secondary">
                <Link href="/login" className="text-gold-500 hover:text-gold-400 font-medium">Log in</Link> to see your prediction history.
              </p>
            ) : mineLoading ? (
              <p className="text-sm text-ink-muted">Loading your predictions...</p>
            ) : mineError ? (
              <p className="text-sm text-wicket-400">{mineError}</p>
            ) : myPredictions.length === 0 ? (
              <p className="text-sm text-ink-muted">You haven&apos;t made any predictions yet - pick a winner on any upcoming match.</p>
            ) : (
              <>
                <p className="text-sm text-ink-secondary mb-3">
                  Total points: <span className="font-semibold text-gold-500">{totalPoints}</span>
                </p>
                <div className="bg-surface border border-border rounded-xl divide-y divide-border">
                  {myPredictions.map((p) => (
                    <div key={p._id} className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink truncate">
                          {p.match ? (
                            <Link href={`/match/${p.match._id}`} className="hover:text-pitch-400">
                              {p.match.team1.name} vs {p.match.team2.name}
                            </Link>
                          ) : (
                            'Match unavailable'
                          )}
                        </p>
                        <p className="text-xs text-ink-muted mt-1">
                          Picked {p.predictedWinner?.name || 'unknown'} · {p.match?.status || ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.status === 'settled' ? (
                          <>
                            <p className={`text-sm font-semibold ${p.points > 0 ? 'text-pitch-400' : 'text-ink-muted'}`}>
                              {p.points > 0 ? `+${p.points} pts` : '0 pts'}
                            </p>
                            {p.wonOnMotm && <p className="text-xs text-gold-500">MOTM bonus</p>}
                          </>
                        ) : (
                          <p className="text-xs text-ink-muted">Pending</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
