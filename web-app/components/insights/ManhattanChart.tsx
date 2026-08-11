'use client';

interface OverData {
  over: number;
  runs: number;
  wickets: number;
}

interface TeamRef {
  _id: string;
  name: string;
}

export interface InningsChartData {
  team: TeamRef | string | null;
  overs: OverData[];
  cumulative: { over: number; total: number }[];
}

// One color per innings (batting order), matching WagonWheel's design-token usage.
const TEAM_FILL = ['fill-pitch-500', 'fill-gold-500'];
const TEAM_SWATCH = ['bg-pitch-500', 'bg-gold-500'];

function teamName(team: InningsChartData['team'], fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

export default function ManhattanChart({ innings }: { innings: InningsChartData[] }) {
  const hasData = innings.some((inn) => inn.overs.some((o) => o.runs > 0 || o.wickets > 0));

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No over-by-over data yet.
      </div>
    );
  }

  const maxOvers = Math.max(1, ...innings.map((inn) => inn.overs.length));
  const maxRuns = Math.max(1, ...innings.flatMap((inn) => inn.overs.map((o) => o.runs)));

  const width = Math.max(360, maxOvers * 34);
  const height = 220;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const clusterWidth = chartWidth / maxOvers;
  const barGap = 3;
  const barWidth = Math.max(3, (clusterWidth - barGap * (innings.length + 1)) / innings.length);
  const labelStep = Math.max(1, Math.ceil(maxOvers / 12));

  const yFor = (runs: number) => paddingTop + chartHeight - (runs / maxRuns) * chartHeight;

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
                {Math.round(maxRuns * f)}
              </text>
            </g>
          ))}

          {Array.from({ length: maxOvers }).map((_, overIdx) => {
            const clusterX = paddingLeft + overIdx * clusterWidth;
            return (
              <g key={overIdx}>
                {innings.map((inn, teamIdx) => {
                  const over = inn.overs[overIdx];
                  if (!over) return null;
                  const barX = clusterX + barGap + teamIdx * (barWidth + barGap);
                  const barY = yFor(over.runs);
                  const barH = Math.max(0, paddingTop + chartHeight - barY);
                  return (
                    <g key={teamIdx}>
                      <rect
                        x={barX}
                        y={barY}
                        width={barWidth}
                        height={barH}
                        className={TEAM_FILL[teamIdx % TEAM_FILL.length]}
                        opacity={0.9}
                        rx={1.5}
                      />
                      {over.wickets > 0 && (
                        <circle
                          cx={barX + barWidth / 2}
                          cy={Math.max(paddingTop - 4, barY - 7)}
                          r={2.5}
                          className="fill-wicket-500"
                        />
                      )}
                    </g>
                  );
                })}
                {overIdx % labelStep === 0 && (
                  <text
                    x={clusterX + clusterWidth / 2}
                    y={height - paddingBottom + 14}
                    textAnchor="middle"
                    className="fill-ink-muted"
                    fontSize={9}
                  >
                    {overIdx + 1}
                  </text>
                )}
              </g>
            );
          })}

          <line
            x1={paddingLeft}
            x2={width - paddingRight}
            y1={paddingTop + chartHeight}
            y2={paddingTop + chartHeight}
            stroke="currentColor"
            className="text-border-strong"
            strokeWidth={1}
          />
        </svg>
      </div>
      <div className="flex flex-wrap gap-4 mt-2">
        {innings.map((inn, i) => (
          <div key={i} className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${TEAM_SWATCH[i % TEAM_SWATCH.length]}`} />
            {teamName(inn.team, `Team ${i + 1}`)}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <span className="inline-block w-2.5 h-2.5 rounded-full bg-wicket-500" />
          Wicket that over
        </div>
      </div>
      <p className="text-xs text-ink-muted mt-1">Runs scored per over</p>
    </div>
  );
}
