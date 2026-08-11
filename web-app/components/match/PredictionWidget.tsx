'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface Team {
  _id: string;
  name: string;
}

interface Prediction {
  _id: string;
  user: string;
  match: string;
  predictedWinner: string;
  predictedMotm: string | null;
  status: 'pending' | 'settled';
  points: number;
  wonOnWinner: boolean;
  wonOnMotm: boolean;
}

interface PredictionWidgetProps {
  matchId: string;
  matchStatus: string;
  team1: Team;
  team2: Team;
}

export default function PredictionWidget({ matchId, matchStatus, team1, team2 }: PredictionWidgetProps) {
  const { user, isLoading: authLoading } = useAuth();

  const [mine, setMine] = useState<Prediction | null>(null);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [communitySplit, setCommunitySplit] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchPrediction = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/predictions/match/${matchId}`);
      const data = await res.json();
      if (data.success) {
        setMine(data.mine);
        setTotalPredictions(data.totalPredictions);
        setCommunitySplit(data.communitySplit || {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [matchId]);

  useEffect(() => {
    fetchPrediction();
  }, [fetchPrediction]);

  const isScheduled = matchStatus === 'Scheduled';

  const handlePick = async (teamId: string) => {
    if (!user || submitting) return;
    setSubmitting(teamId);
    setError(null);
    try {
      const res = await apiFetch('/api/predictions', {
        method: 'POST',
        body: JSON.stringify({ matchId, predictedWinnerId: teamId }),
      });
      const data = await res.json();
      if (data.success) {
        setMine(data.prediction);
        // Re-fetch so the community split reflects this pick immediately.
        fetchPrediction();
      } else {
        setError(data.message || 'Could not save your prediction');
      }
    } catch (err) {
      setError('Could not reach the CricSync server');
    } finally {
      setSubmitting(null);
    }
  };

  const team1Count = communitySplit[team1._id] || 0;
  const team2Count = communitySplit[team2._id] || 0;
  const splitTotal = team1Count + team2Count;
  const team1Pct = splitTotal > 0 ? Math.round((team1Count / splitTotal) * 100) : 0;
  const team2Pct = splitTotal > 0 ? 100 - team1Pct : 0;

  const renderCommunitySplit = () => (
    <div className="mt-4">
      <p className="text-xs text-ink-muted mb-2">
        {totalPredictions > 0
          ? `${totalPredictions} prediction${totalPredictions === 1 ? '' : 's'} so far - ${team1.name} ${team1Pct}% · ${team2.name} ${team2Pct}%`
          : 'No predictions yet - be the first to pick a winner.'}
      </p>
      {splitTotal > 0 && (
        <div className="w-full h-2 rounded-full bg-surface-alt overflow-hidden flex">
          <div className="h-full bg-pitch-500" style={{ width: `${team1Pct}%` }} />
          <div className="h-full bg-gold-500" style={{ width: `${team2Pct}%` }} />
        </div>
      )}
    </div>
  );

  const teamButtonClasses = (teamId: string) => {
    const isSelected = mine?.predictedWinner === teamId;
    const isSubmittingThis = submitting === teamId;
    return `flex-1 rounded-lg border px-4 py-3 text-sm font-semibold text-center transition-colors ${
      isSelected
        ? 'bg-pitch-500 text-background border-pitch-500'
        : 'bg-surface text-ink-secondary border-border hover:border-border-strong hover:text-ink'
    } ${isSubmittingThis ? 'opacity-60 cursor-wait' : ''} disabled:opacity-50 disabled:cursor-not-allowed`;
  };

  if (loading || authLoading) {
    return (
      <div className="bg-surface border border-border rounded-xl p-4">
        <h3 className="text-base font-bold text-ink mb-2">🔮 Predict the Winner</h3>
        <p className="text-sm text-ink-muted">Loading predictions...</p>
      </div>
    );
  }

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      <h3 className="text-base font-bold text-ink mb-1">🔮 Predict the Winner</h3>
      <p className="text-xs text-ink-muted mb-3">
        Guess right for +10 points, plus +15 if you also nail the Man of the Match.
      </p>

      {isScheduled ? (
        user ? (
          <>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => handlePick(team1._id)}
                className={teamButtonClasses(team1._id)}
              >
                {team1.name}
              </button>
              <button
                type="button"
                disabled={submitting !== null}
                onClick={() => handlePick(team2._id)}
                className={teamButtonClasses(team2._id)}
              >
                {team2.name}
              </button>
            </div>
            {mine && (
              <p className="mt-2 text-xs text-pitch-400">
                You picked {mine.predictedWinner === team1._id ? team1.name : team2.name}. You can change your pick until the match starts.
              </p>
            )}
            {error && <p className="mt-2 text-xs text-wicket-400">{error}</p>}
          </>
        ) : (
          <p className="text-sm text-ink-secondary">
            <Link href="/login" className="text-gold-500 hover:text-gold-400 font-medium">Log in</Link> to predict the winner.
          </p>
        )
      ) : (
        <div>
          {mine ? (
            <div className="rounded-lg border border-border-strong bg-surface-alt p-3">
              <p className="text-sm text-ink">
                You predicted <span className="font-semibold">{mine.predictedWinner === team1._id ? team1.name : team2.name}</span>.
              </p>
              {mine.status === 'settled' ? (
                <p className={`mt-1 text-sm font-medium ${mine.points > 0 ? 'text-pitch-400' : 'text-ink-muted'}`}>
                  {mine.wonOnWinner ? `Correct winner! +${mine.points} points` : mine.points > 0 ? `+${mine.points} points` : 'Not this time - 0 points'}
                  {mine.wonOnMotm && ' (includes the Man of the Match bonus)'}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-muted">Match in progress - points settle once the match completes.</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">Predictions are locked for this match.</p>
          )}
        </div>
      )}

      {renderCommunitySplit()}
    </div>
  );
}
