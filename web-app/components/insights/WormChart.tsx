'use client';

interface TeamRef {
  _id: string;
  name: string;
}

export interface InningsChartData {
  team: TeamRef | string | null;
  overs: { over: number; runs: number; wickets: number }[];
  cumulative: { over: number; total: number }[];
}

// One color per innings (batting order), matching WagonWheel's design-token usage.
const TEAM_STROKE = ['stroke-pitch-400', 'stroke-gold-400'];
const TEAM_FILL = ['fill-pitch-500', 'fill-gold-500'];
const TEAM_SWATCH = ['bg-pitch-400', 'bg-gold-400'];

function teamName(team: InningsChartData['team'], fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

export default function WormChart({ innings }: { innings: InningsChartData[] }) {
  const hasData = innings.some((inn) => inn.cumulative.length > 0);

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No over-by-over data yet.
      </div>
    );
  }

  const maxOvers = Math.max(1, ...innings.map((inn) => inn.cumulative.length));
  const maxTotal = Math.max(1, ...innings.flatMap((inn) => inn.cumulative.map((c) => c.total)));

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
  const yFor = (total: number) => paddingTop + chartHeight - (total / maxTotal) * chartHeight;
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
                {Math.round(maxTotal * f)}
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

          {innings.map((inn, teamIdx) => {
            if (inn.cumulative.length === 0) return null;
            const points = [{ over: 0, total: 0 }, ...inn.cumulative.map((c) => ({ over: c.over + 1, total: c.total }))];
            const linePoints = points.map((p) => `${xFor(p.over)},${yFor(p.total)}`).join(' ');
            const areaPoints = `${xFor(0)},${baselineY} ${linePoints} ${xFor(points[points.length - 1].over)},${baselineY}`;

            return (
              <g key={teamIdx}>
                <polygon points={areaPoints} className={TEAM_FILL[teamIdx % TEAM_FILL.length]} opacity={0.08} />
                <polyline
                  points={linePoints}
                  fill="none"
                  className={TEAM_STROKE[teamIdx % TEAM_STROKE.length]}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {inn.overs.map((o, i) => (
                  o.wickets > 0 && (
                    <circle
                      key={i}
                      cx={xFor(o.over + 1)}
                      cy={yFor(points[i + 1].total)}
                      r={3}
                      className="fill-wicket-500"
                    />
                  )
                ))}
              </g>
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
        <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-wicket-500" />
          Wicket
        </div>
      </div>
      <p className="text-xs text-ink-muted mt-1">Cumulative team total after each over</p>
    </div>
  );
}
