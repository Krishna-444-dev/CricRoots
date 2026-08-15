'use client';

export interface BoundaryBallEntry {
  ball: number;
  count: number;
  percent: number;
}

// Same fixed-order validated dark categorical set DismissalBreakdown.tsx uses (see that file's
// comment) - reused here rather than re-validated since it's the same 6-of-8-slot subset.
const BALL_COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300'];

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

export default function BoundaryBallChart({ data }: { data: BoundaryBallEntry[] }) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No boundaries hit yet.
      </div>
    );
  }

  const size = 240;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 100;
  const rInner = 58;

  let angle = -90;
  const wedges = data
    .filter((d) => d.count > 0)
    .map((d) => {
      const sweep = (d.count / total) * 360;
      const startAngle = angle;
      const endAngle = angle + sweep;
      angle = endAngle;
      return { ...d, startAngle, endAngle, color: BALL_COLORS[(d.ball - 1) % BALL_COLORS.length] };
    });

  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {wedges.map((w) => (
          <path
            key={w.ball}
            d={wedgePath(cx, cy, rOuter, rInner, w.startAngle, w.endAngle)}
            fill={w.color}
            stroke="#131C2E"
            strokeWidth={2}
          >
            <title>{`Ball ${w.ball}: ${w.count} (${w.percent}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 6} textAnchor="middle" className="fill-ink" fontSize={22} fontWeight={800}>
          {total}
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="fill-ink-muted" fontSize={11}>
          boundaries
        </text>
      </svg>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-2 w-full max-w-xs">
        {wedges.map((w) => (
          <div key={w.ball} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: w.color }} />
            <span className="truncate">Ball {w.ball}</span>
            <span className="text-ink-muted ml-auto">{w.count} ({w.percent}%)</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-1">Boundaries by ball-of-the-over position</p>
    </div>
  );
}
