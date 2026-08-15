'use client';

interface TeamRef {
  _id: string;
  name: string;
}

export interface RunRateChartInnings {
  team: TeamRef | string | null;
  cumulative: { over: number; total: number }[];
}

// Same per-innings color assignment as WormChart/ManhattanChart (batting order, fixed).
const TEAM_STROKE = ['stroke-pitch-400', 'stroke-gold-400'];
const TEAM_SWATCH = ['bg-pitch-400', 'bg-gold-400'];

function teamName(team: RunRateChartInnings['team'], fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

// Run rate after over N = cumulative runs so far / overs completed so far - derived here from
// the same `cumulative` data the Worm chart already gets from /charts, rather than adding a
// backend field: no new per-ball aggregation is needed, just a division. The one known
// imprecision this carries: if an innings' last over ended mid-over (chase won off the last
// ball, e.g.), `cumulative`'s final point is still divided by a full extra over rather than the
// true fractional overs bowled, so the very last point can read slightly low until/unless a
// full over's worth of balls actually completes it.
function ratePoints(cumulative: RunRateChartInnings['cumulative']): { over: number; rate: number }[] {
  return cumulative.map((c) => ({ over: c.over + 1, rate: c.total / (c.over + 1) }));
}

export default function RunRateChart({ innings }: { innings: RunRateChartInnings[] }) {
  const hasData = innings.some((inn) => inn.cumulative.length > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No over-by-over data yet.
      </div>
    );
  }

  const seriesByTeam = innings.map((inn) => ratePoints(inn.cumulative));
  const maxOvers = Math.max(1, ...innings.map((inn) => inn.cumulative.length));
  const maxRate = Math.max(1, ...seriesByTeam.flatMap((pts) => pts.map((p) => p.rate)));

  const width = Math.max(360, maxOvers * 28);
  const height = 220;
  const paddingLeft = 34;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const labelStep = Math.max(1, Math.ceil(maxOvers / 12));

  const xFor = (overNumber: number) => paddingLeft + (overNumber / maxOvers) * chartWidth;
  const yFor = (rate: number) => paddingTop + chartHeight - (rate / maxRate) * chartHeight;
  const baselineY = paddingTop + chartHeight;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
          {[0, 0.5, 1].map((f) => (
            <g key={f}>
              <line
                x1={paddingLeft}
                x2={width - paddingRight}
                y1={paddingTop + chartHeight * (1 - f)}
                y2={paddingTop + chartHeight * (1 - f)}
                stroke="currentColor"
                className="text-border"
                strokeWidth={1}
                opacity={0.6}
              />
              <text
                x={paddingLeft - 6}
                y={paddingTop + chartHeight * (1 - f)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-muted"
                fontSize={9}
              >
                {(maxRate * f).toFixed(1)}
              </text>
            </g>
          ))}

          {Array.from({ length: maxOvers + 1 }).map((_, overNumber) => (
            overNumber % labelStep === 0 && (
              <text
                key={overNumber}
                x={xFor(overNumber)}
                y={height - paddingBottom + 14}
                textAnchor="middle"
                className="fill-ink-muted"
                fontSize={9}
              >
                {overNumber}
              </text>
            )
          ))}

          {seriesByTeam.map((points, teamIdx) => {
            if (points.length === 0) return null;
            const linePoints = points.map((p) => `${xFor(p.over)},${yFor(p.rate)}`).join(' ');
            return (
              <polyline
                key={teamIdx}
                points={linePoints}
                fill="none"
                className={TEAM_STROKE[teamIdx % TEAM_STROKE.length]}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            );
          })}

          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={baselineY}
            y2={baselineY}
            stroke="currentColor"
            className="text-border-strong"
            strokeWidth={1}
          />
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2">
        {innings.map((inn, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${TEAM_SWATCH[i % TEAM_SWATCH.length]}`} />
            {teamName(inn.team, `Team ${i + 1}`)}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-1">Run rate after each over</p>
    </div>
  );
}
