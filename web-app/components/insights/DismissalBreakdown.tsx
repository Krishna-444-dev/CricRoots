'use client';

export interface DismissalEntry {
  wicketType: string;
  count: number;
}

// Fixed display/color order for every dismissal-type slice - never reordered by
// count. Colors are the dataviz skill's validated 8-slot dark categorical set
// (node scripts/validate_palette.js, all 6 checks pass against this app's
// #131C2E card surface); 'unknown' is a neutral fallback outside that validated
// set, appended last, only for legacy/untagged wicketType values. Because the
// worst adjacent pair sits in the 6-8 CVD floor band, every slice is also
// text-labeled in the legend below (never color-alone).
const DISMISSAL_ORDER: Array<{ key: string; label: string; color: string }> = [
  { key: 'notOut', label: 'Not Out', color: '#3987e5' },
  { key: 'caught', label: 'Caught', color: '#d95926' },
  { key: 'bowled', label: 'Bowled', color: '#199e70' },
  { key: 'lbw', label: 'LBW', color: '#c98500' },
  { key: 'run out', label: 'Run Out', color: '#d55181' },
  { key: 'stumped', label: 'Stumped', color: '#008300' },
  { key: 'hit wicket', label: 'Hit Wicket', color: '#9085e9' },
  { key: 'retired', label: 'Retired', color: '#e66767' },
  { key: 'unknown', label: 'Unknown', color: '#6B7A99' },
];

function polarToXY(cx: number, cy: number, r: number, degrees: number) {
  const rad = (degrees * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function wedgePath(cx: number, cy: number, rOuter: number, rInner: number, startAngle: number, endAngle: number) {
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polarToXY(cx, cy, rOuter, startAngle);
  const p2 = polarToXY(cx, cy, rOuter, endAngle);
  const p3 = polarToXY(cx, cy, rInner, endAngle);
  const p4 = polarToXY(cx, cy, rInner, startAngle);
  return `M ${p1.x} ${p1.y} A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y} L ${p3.x} ${p3.y} A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y} Z`;
}

export default function DismissalBreakdown({
  dismissals,
  notOut,
  totalInnings,
}: {
  dismissals: DismissalEntry[];
  notOut: number;
  totalInnings: number;
}) {
  if (totalInnings === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No innings recorded yet.
      </div>
    );
  }

  const byKey = new Map(dismissals.map((d) => [d.wicketType, d.count]));
  byKey.set('notOut', notOut);

  const slices = DISMISSAL_ORDER
    .map((def) => ({ ...def, count: byKey.get(def.key) || 0 }))
    .filter((s) => s.count > 0);

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 100;
  const rInner = 58;

  let angle = -90;
  const wedges = slices.map((s) => {
    const sweep = (s.count / totalInnings) * 360;
    const startAngle = angle;
    const endAngle = angle + sweep;
    angle = endAngle;
    return { ...s, startAngle, endAngle, percent: Math.round((s.count / totalInnings) * 1000) / 10 };
  });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {wedges.map((w) => (
          <path
            key={w.key}
            d={wedgePath(cx, cy, rOuter, rInner, w.startAngle, w.endAngle)}
            fill={w.color}
            stroke="#131C2E"
            strokeWidth={2}
          >
            <title>{`${w.label}: ${w.count} (${w.percent}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-ink" fontSize={22} fontWeight={800}>
          {totalInnings}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-ink-muted" fontSize={11}>
          innings
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full max-w-xs">
        {wedges.map((w) => (
          <div key={w.key} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: w.color }} />
            <span className="truncate">{w.label}</span>
            <span className="text-ink-muted ml-auto">{w.count} ({w.percent}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}
