'use client';

interface ExtraEntry {
  type: string;
  runs: number;
}

interface TeamRef {
  _id: string;
  name: string;
}

export interface ExtrasChartInnings {
  team: TeamRef | string | null;
  extrasBreakdown: ExtraEntry[];
}

// Matches ManhattanChart/WormChart's per-innings color assignment (batting order, fixed).
const TEAM_FILL = ['fill-pitch-500', 'fill-gold-500'];
const TEAM_SWATCH = ['bg-pitch-500', 'bg-gold-500'];

const EXTRA_LABELS: Record<string, string> = {
  wide: 'Wides',
  'no-ball': 'No Balls',
  bye: 'Byes',
  'leg-bye': 'Leg Byes',
  penalty: 'Penalty'
};

function teamName(team: ExtrasChartInnings['team'], fallback: string): string {
  if (team && typeof team === 'object' && 'name' in team) return team.name;
  return fallback;
}

export default function ExtrasChart({ innings }: { innings: ExtrasChartInnings[] }) {
  const types = Object.keys(EXTRA_LABELS).filter((type) =>
    innings.some((inn) => (inn.extrasBreakdown.find((e) => e.type === type)?.runs ?? 0) > 0)
  );

  if (types.length === 0) {
    return (
      <div className="flex items-center justify-center h-[180px] text-sm text-ink-muted">
        No extras bowled yet.
      </div>
    );
  }

  const maxRuns = Math.max(1, ...innings.flatMap((inn) => inn.extrasBreakdown.map((e) => e.runs)));

  const width = Math.max(280, types.length * 70);
  const height = 180;
  const paddingLeft = 24;
  const paddingRight = 10;
  const paddingTop = 18;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const clusterWidth = chartWidth / types.length;
  const barGap = 4;
  const barWidth = Math.max(8, (clusterWidth - barGap * (innings.length + 1)) / innings.length);

  const yFor = (runs: number) => paddingTop + chartHeight - (runs / maxRuns) * chartHeight;
  const baselineY = paddingTop + chartHeight;

  return (
    <div className="flex flex-col items-center">
      <div className="w-full overflow-x-auto">
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="mx-auto">
          {types.map((type, typeIdx) => {
            const clusterX = paddingLeft + typeIdx * clusterWidth;
            return (
              <g key={type}>
                {innings.map((inn, teamIdx) => {
                  const runs = inn.extrasBreakdown.find((e) => e.type === type)?.runs ?? 0;
                  if (runs === 0) return null;
                  const barX = clusterX + barGap + teamIdx * (barWidth + barGap);
                  const barY = yFor(runs);
                  const barH = Math.max(0, baselineY - barY);
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
                      <text x={barX + barWidth / 2} y={barY - 4} textAnchor="middle" className="fill-ink-muted" fontSize={9}>
                        {runs}
                      </text>
                    </g>
                  );
                })}
                <text
                  x={clusterX + clusterWidth / 2}
                  y={height - paddingBottom + 14}
                  textAnchor="middle"
                  className="fill-ink-muted"
                  fontSize={9}
                >
                  {EXTRA_LABELS[type]}
                </text>
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
            <span className={`inline-block w-2.5 h-2.5 rounded-sm ${TEAM_SWATCH[i % TEAM_SWATCH.length]}`} />
            {teamName(inn.team, `Team ${i + 1}`)}
          </div>
        ))}
      </div>
      <p className="text-xs text-ink-muted mt-1">Extra runs conceded, by type</p>
    </div>
  );
}
