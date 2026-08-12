'use client';

import { useEffect, useState } from 'react';
import Badge from '@/components/ui/Badge';

interface LiveBucket {
  line: string;
  length: string;
  todayAdjustedRate: number | null;
  confidence: string;
  liveBalls: number;
}

interface LivePlan {
  success: boolean;
  targetBuckets?: LiveBucket[];
  message: string;
}

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
  pool: 'neutral',
  none: 'neutral'
};

interface LiveMatchupPanelProps {
  matchId: string;
  batsmanId?: string;
  bowlerId?: string;
  // Bump this (e.g. total legal balls bowled so far) to force a refetch after every
  // ball recorded - the live-bowling-plan endpoint's answer changes as soon as a new
  // ball lands, not just when the striker/bowler themselves change.
  refreshKey: string | number;
}

// Live, in-match version of the matchup finder on the pre-match scouting page - see
// tendencyAnalytics.getLiveMatchupPlan and documentation/hierarchical-matchup-shrinkage-research.md
// for the algorithm. Deliberately compact/quiet (small type, muted panel) since it sits
// inside an already-dense scoring card - a hint for the bowling captain, not a headline.
export default function LiveMatchupPanel({ matchId, batsmanId, bowlerId, refreshKey }: LiveMatchupPanelProps) {
  const [plan, setPlan] = useState<LivePlan | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!batsmanId || !bowlerId) { setPlan(null); return; }
    setLoading(true);
    fetch(`/api/insights/matchup/${batsmanId}/${bowlerId}/live-bowling-plan?matchId=${matchId}`)
      .then(r => r.json())
      .then(setPlan)
      .catch(() => setPlan(null))
      .finally(() => setLoading(false));
  }, [matchId, batsmanId, bowlerId, refreshKey]);

  if (!batsmanId || !bowlerId) return null;

  return (
    <div className="mb-4 bg-surface-alt border border-border rounded-lg p-3">
      <div className="flex items-center justify-between mb-1.5">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Live tactical read</h4>
        {loading && <span className="text-xs text-ink-muted">updating...</span>}
      </div>
      {plan?.targetBuckets && plan.targetBuckets.length > 0 ? (
        <div className="space-y-1.5">
          {plan.targetBuckets.slice(0, 2).map((b, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-ink capitalize">{b.length.replace(/-/g, ' ')}, {b.line.replace(/-/g, ' ')}</span>
              <div className="flex items-center gap-2">
                {b.liveBalls > 0 && (
                  <span className="text-xs text-gold-400">{b.liveBalls} today</span>
                )}
                <Badge variant={CONFIDENCE_VARIANT[b.confidence] ?? 'neutral'}>{b.todayAdjustedRate}%</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-ink-secondary">{plan?.message || 'Not enough tagged data yet for a tactical read.'}</p>
      )}
    </div>
  );
}
