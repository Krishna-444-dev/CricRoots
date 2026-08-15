'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';

interface CurrentTrivia {
  _id: string;
  question: string;
  options: string[];
  createdAt: string;
  // Withheld by the backend until this viewer has actually answered - see
  // triviaController.js's getCurrentTrivia. null means "not yet revealed", not "no answer".
  correctIndex: number | null;
  explanation: string | null;
  myAnswer: { optionIndex: number; correct: boolean } | null;
}

// "Trivia of the day" community-feed card (CricHeroes-style) - a single rotating
// cricket-knowledge question, global/app-wide (not scoped to a team/tournament). Answering is
// one-shot per user; the reveal state (right/wrong + explanation) comes straight from the
// backend response rather than being computed client-side, since the correct answer is
// deliberately never shipped to the client before an answer is submitted.
export default function TriviaCard() {
  const { user } = useAuth();
  const [trivia, setTrivia] = useState<CurrentTrivia | null | undefined>(undefined);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/trivia/current')
      .then((res) => res.json())
      .then((data) => { if (data.success) setTrivia(data.trivia); })
      .catch(() => setTrivia(null));
  }, []);

  const handleAnswer = async (optionIndex: number) => {
    if (!trivia || answering) return;
    setAnswering(true);
    setError('');
    try {
      const res = await apiFetch(`/api/trivia/${trivia._id}/answer`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
      const data = await res.json();
      if (data.success) {
        setTrivia((prev) =>
          prev
            ? { ...prev, correctIndex: data.correctIndex, explanation: data.explanation, myAnswer: { optionIndex, correct: data.correct } }
            : prev
        );
      } else {
        setError(data.message || 'Could not submit your answer');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setAnswering(false);
    }
  };

  if (trivia === undefined) {
    return (
      <Card>
        <p className="text-sm text-ink-secondary">Loading trivia...</p>
      </Card>
    );
  }
  if (trivia === null) {
    return (
      <Card>
        <p className="text-sm text-ink-secondary">No trivia available right now - check back soon.</p>
      </Card>
    );
  }

  const revealed = trivia.myAnswer !== null;

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-ink flex items-center gap-2">
          <span aria-hidden>🏏</span> Trivia of the Day
        </h2>
        {revealed && <Badge variant={trivia.myAnswer!.correct ? 'success' : 'danger'}>{trivia.myAnswer!.correct ? 'Correct!' : 'Not quite'}</Badge>}
      </div>
      <p className="text-ink font-medium mb-3">{trivia.question}</p>
      {error && <p className="text-sm text-wicket-400 mb-2">{error}</p>}
      <div className="space-y-2">
        {trivia.options.map((opt, index) => {
          const isCorrectOption = revealed && trivia.correctIndex === index;
          const isMyWrongPick = revealed && trivia.myAnswer!.optionIndex === index && !trivia.myAnswer!.correct;
          return (
            <button
              key={index}
              type="button"
              disabled={revealed || !user || answering}
              onClick={() => handleAnswer(index)}
              className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                isCorrectOption
                  ? 'border-pitch-500/60 bg-pitch-500/10 text-ink'
                  : isMyWrongPick
                  ? 'border-wicket-500/60 bg-wicket-500/10 text-ink'
                  : 'border-border text-ink hover:border-border-strong'
              } ${revealed || !user ? 'cursor-default' : 'cursor-pointer'}`}
            >
              {opt}
              {isCorrectOption && ' ✓'}
              {isMyWrongPick && ' ✕'}
            </button>
          );
        })}
      </div>
      {revealed && trivia.explanation && (
        <p className="text-sm text-ink-secondary mt-3 pt-3 border-t border-border">{trivia.explanation}</p>
      )}
      {!revealed && !user && (
        <p className="text-xs text-ink-muted mt-3">Log in to answer.</p>
      )}
    </Card>
  );
}
