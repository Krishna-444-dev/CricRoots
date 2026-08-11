'use client';

import { useEffect, useState } from 'react';

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

function InsightCard({ title, insight, loading }: { title: string; insight: InsightResponse | null; loading: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-900">{title}</h3>
        {insight && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${insight.source === 'own-data' ? 'bg-green-100 text-green-700' : insight.source === 'pool-data' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
            {SOURCE_LABEL[insight.source]}{insight.sampleSize > 0 ? ` · ${insight.sampleSize} balls` : ''}
          </span>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <p className="text-sm text-gray-700">{insight?.message}</p>
      )}
    </div>
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
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <InsightCard title="🏏 Shot Advice" insight={shotAdvice} loading={loading} />
      <InsightCard title="🎯 Bowling Plan" insight={bowlingPlan} loading={loading} />
      <InsightCard title="🧤 Fielding Placement" insight={fieldingPlan} loading={loading} />
    </div>
  );
}
