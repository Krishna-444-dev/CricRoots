'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/apiFetch';

interface RainRuleControlProps {
  matchId: string;
}

// Lets the match owner record a rain/stoppage interruption during live scoring and see the
// revised target immediately - see backend/src/services/rainRuleCalculator.js for the
// calculation and its real accuracy/scope caveats (an approximation inspired by
// Duckworth-Lewis-Stern, not the official licensed algorithm). The match page's own poll
// cycle picks up match.interruption on its next refresh; this component doesn't try to push
// the result into shared state itself, it just confirms the action succeeded.
export default function RainRuleControl({ matchId }: RainRuleControlProps) {
  const [open, setOpen] = useState(false);
  const [revisedOvers, setRevisedOvers] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ target: number; parScore: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const overs = parseFloat(revisedOvers);
    if (!overs || overs <= 0) {
      setError('Enter a valid number of overs');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/matches/${matchId}/apply-interruption`, {
        method: 'POST',
        body: JSON.stringify({ revisedOvers: overs }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'Could not apply interruption');
      setResult({ target: data.interruption.target, parScore: data.interruption.parScore });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 text-xs text-gold-400 border border-gold-500/30 bg-gold-500/10 rounded-lg px-3 py-2 hover:bg-gold-500/20 transition-colors"
      >
        ⛈ Report rain delay / reduce overs
      </button>
    );
  }

  return (
    <div className="mb-4 bg-gold-500/10 border border-gold-500/30 rounded-lg p-3">
      <p className="text-xs font-semibold text-gold-400 mb-1">Report a stoppage</p>
      <p className="text-xs text-ink-secondary mb-2">
        Approximate rain-rule estimate (inspired by Duckworth-Lewis-Stern, not the official licensed
        calculation) — enter the new total overs for this chase.
      </p>

      {result ? (
        <div className="text-sm text-ink">
          <p className="font-semibold">Revised target: {result.target} runs</p>
          <p className="text-xs text-ink-muted">Par score {result.parScore}. Refresh to see it reflected on the match page.</p>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={revisedOvers}
            onChange={(e) => setRevisedOvers(e.target.value)}
            placeholder="e.g. 40"
            className="w-24 px-2 py-1.5 bg-surface-alt border border-border-strong rounded-md text-ink text-sm"
          />
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="bg-gold-500 hover:bg-gold-600 disabled:opacity-50 text-background text-xs font-semibold rounded-md px-3 py-1.5 transition-colors"
          >
            {loading ? 'Applying...' : 'Apply'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        </div>
      )}
      {error && <p className="text-xs text-wicket-400 mt-1">{error}</p>}
    </div>
  );
}
