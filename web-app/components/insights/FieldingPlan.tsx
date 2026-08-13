'use client';

import { useEffect, useState } from 'react';
import { SHOT_ZONES as ZONE_ORDER, labelize } from '@/lib/ballTaxonomy';

interface RecommendedZone {
  zone: string;
  balls: number;
  runs: number;
  runsPercent: number;
}

interface FieldingPlanResponse {
  success: boolean;
  source: 'own-data' | 'pool-data' | 'generic';
  sampleSize?: number;
  confidence?: 'high' | 'medium' | 'low';
  recommendedZones?: RecommendedZone[];
  message: string;
}

function polarToXY(cx: number, cy: number, radius: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

// Same 8-wedge geometry as WagonWheel.tsx (mid-off/mid-on at top) so a fielder placed here
// lines up with how this app already visualizes shot zones elsewhere - deliberately not a
// shared component since this draws fielder markers in the top-N recommended zones rather
// than wedge-sized-by-runs.
export default function FieldingPlan({ playerId, playerName, roleLabel }: { playerId: string; playerName: string; roleLabel: string }) {
  const [plan, setPlan] = useState<FieldingPlanResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/insights/batsman/${playerId}/fielding-plan`)
      .then((r) => r.json())
      .then((data) => { if (!cancelled) setPlan(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [playerId]);

  const size = 220;
  const center = size / 2;
  const maxRadius = center - 34;
  const startAngle = 112.5;
  const recommended = plan?.recommendedZones ?? [];
  const rankByZone = new Map(recommended.map((z, i) => [z.zone, i]));

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1">{roleLabel}: {playerName}</p>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={maxRadius} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />
        <circle cx={center} cy={center} r={maxRadius * 0.55} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.5} />

        {ZONE_ORDER.map((zone, i) => {
          const rank = rankByZone.get(zone);
          const angleStart = startAngle + i * 45 - 22.5;
          const angleEnd = startAngle + i * 45 + 22.5;
          const p1 = polarToXY(center, center, maxRadius, angleStart);
          const p2 = polarToXY(center, center, maxRadius, angleEnd);
          const path = `M${center},${center} L${p1.x},${p1.y} A${maxRadius},${maxRadius} 0 0 1 ${p2.x},${p2.y} Z`;
          const labelPos = polarToXY(center, center, maxRadius + 16, startAngle + i * 45);
          const fielderPos = polarToXY(center, center, maxRadius * 0.8, startAngle + i * 45);

          return (
            <g key={zone}>
              {rank !== undefined && (
                <path
                  d={path}
                  className="fill-wicket-500"
                  fillOpacity={0.35 - rank * 0.1}
                  stroke="currentColor"
                  strokeOpacity={0.6}
                  strokeWidth={1}
                />
              )}
              <text x={labelPos.x} y={labelPos.y} textAnchor="middle" dominantBaseline="middle" className="fill-ink-muted" fontSize={8}>
                {labelize(zone)}
              </text>
              {rank !== undefined && (
                <g>
                  <circle cx={fielderPos.x} cy={fielderPos.y} r={rank === 0 ? 7 : 5.5} className="fill-wicket-400" stroke="currentColor" strokeWidth={1} />
                  <text x={fielderPos.x} y={fielderPos.y} textAnchor="middle" dominantBaseline="middle" fontSize={8} fontWeight={700} className="fill-[#2a0a0a]">
                    {rank + 1}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Batsman at the crease */}
        <circle cx={center} cy={center} r={3} className="fill-gold-400" />
      </svg>
      {plan && (
        <p className="text-xs text-ink-secondary mt-1 text-center max-w-[220px]">
          {plan.message}
          {plan.source !== 'generic' && plan.confidence === 'low' && ' (light sample so far)'}
        </p>
      )}
    </div>
  );
}
