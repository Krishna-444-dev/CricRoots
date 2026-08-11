'use client';

interface WagonWheelZone {
  zone: string;
  balls: number;
  runs: number;
  runsPercent: number;
}

// Batsman-relative sweep: off-side backward -> off-side forward -> straight -> leg-side forward -> leg-side backward.
// Matches the SHOT_ZONES order used by the live scoring tagging UI.
const ZONE_ORDER = ['third-man', 'point', 'cover', 'mid-off', 'mid-on', 'mid-wicket', 'square-leg', 'fine-leg'];

function labelize(zone: string): string {
  return zone.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function polarToXY(cx: number, cy: number, radius: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

export default function WagonWheel({ zones }: { zones: WagonWheelZone[] }) {
  const byZone = new Map(zones.map((z) => [z.zone, z]));
  const maxRuns = Math.max(1, ...zones.map((z) => z.runs));
  const totalRuns = zones.reduce((s, z) => s + z.runs, 0);

  const size = 280;
  const center = size / 2;
  const maxRadius = center - 44;
  const minRadius = 26;
  // Center the mid-off/mid-on boundary at the top (-90deg / 270deg).
  const startAngle = 112.5;

  if (totalRuns === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-sm text-ink-muted">
        No tagged shot-zone data yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={maxRadius} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} />
        <circle cx={center} cy={center} r={maxRadius * 0.66} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.6} />
        <circle cx={center} cy={center} r={maxRadius * 0.33} fill="none" stroke="currentColor" className="text-border" strokeWidth={1} opacity={0.6} />

        {ZONE_ORDER.map((zone, i) => {
          const data = byZone.get(zone);
          const runs = data?.runs ?? 0;
          const radius = data && runs > 0 ? Math.max(minRadius, (runs / maxRuns) * maxRadius) : 0;
          const angleStart = startAngle + i * 45 - 22.5;
          const angleEnd = startAngle + i * 45 + 22.5;
          const p1 = polarToXY(center, center, radius, angleStart);
          const p2 = polarToXY(center, center, radius, angleEnd);
          const path = `M${center},${center} L${p1.x},${p1.y} A${radius},${radius} 0 0 1 ${p2.x},${p2.y} Z`;

          const labelPos = polarToXY(center, center, maxRadius + 22, startAngle + i * 45);

          return (
            <g key={zone}>
              {data && runs > 0 && (
                <path
                  d={path}
                  className="fill-pitch-500 text-pitch-300"
                  fillOpacity={0.45 + 0.45 * (runs / maxRuns)}
                  stroke="currentColor"
                  strokeOpacity={0.9}
                  strokeWidth={1.5}
                />
              )}
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-ink-secondary"
                fontSize={10}
              >
                {labelize(zone)}
              </text>
              {data && (
                <text
                  x={labelPos.x}
                  y={labelPos.y + 12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-ink-muted"
                  fontSize={9}
                >
                  {data.runs}r
                </text>
              )}
            </g>
          );
        })}

        <circle cx={center} cy={center} r={3} className="fill-gold-400" />
      </svg>
      <p className="text-xs text-ink-muted mt-1">Wedge size = share of runs scored in that zone ({totalRuns} tagged runs)</p>
    </div>
  );
}
