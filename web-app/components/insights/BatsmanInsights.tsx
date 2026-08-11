'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge, { BadgeVariant } from '@/components/ui/Badge';

interface InsightResponse {
  success: boolean;
  source: 'own-data' | 'pool-data' | 'generic';
  sampleSize: number;
  confidence?: string;
  message: string;
}

const SOURCE_LABEL: Record<string, string> = {
  'own-data': 'Based on this player',
  'pool-data': 'Based on the wider player pool',
  generic: 'Generic tip (no data yet)',
};

const SOURCE_VARIANT: Record<string, BadgeVariant> = {
  'own-data': 'success',
  'pool-data': 'warning',
  generic: 'neutral',
};

function InsightCard({ title, insight, loading }: { title: string; insight: InsightResponse | null; loading: boolean }) {
  return (
    <Card>
      <div className="flex justify-between items-start gap-2 mb-2">
        <h3 className="font-semibold text-ink">{title}</h3>
        {insight && (
          <Badge variant={SOURCE_VARIANT[insight.source]}>
            {SOURCE_LABEL[insight.source]}{insight.sampleSize > 0 ? ` · ${insight.sampleSize} balls` : ''}
          </Badge>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-ink-muted">Loading...</p>
      ) : (
        <p className="text-sm text-ink-secondary">{insight?.message}</p>
      )}
    </Card>
  );
}

export default function BatsmanInsights({ batsmanId, label }: { batsmanId: string; label: string }) {
  const [shotAdvice, setShotAdvice] = useState<InsightResponse | null>(null);
  const [bowlingPlan, setBowlingPlan] = useState<InsightResponse | null>(null);
  const [fieldingPlan, setFieldingPlan] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/insights/batsman/${batsmanId}/shot-advice`).then(r => r.json()),
      fetch(`/api/insights/batsman/${batsmanId}/bowling-plan`).then(r => r.json()),
      fetch(`/api/insights/batsman/${batsmanId}/fielding-plan`).then(r => r.json()),
    ]).then(([shot, bowl, field]) => {
      setShotAdvice(shot);
      setBowlingPlan(bowl);
      setFieldingPlan(field);
      setLoading(false);
    });
  }, [batsmanId]);

  return (
    <div className="space-y-3">
      <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide">{label}</p>
      <InsightCard title="🏏 Shot Advice" insight={shotAdvice} loading={loading} />
      <InsightCard title="🎯 Bowling Plan" insight={bowlingPlan} loading={loading} />
      <InsightCard title="🧤 Fielding Placement" insight={fieldingPlan} loading={loading} />
    </div>
  );
}
