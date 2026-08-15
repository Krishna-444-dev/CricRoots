'use client';

export interface RunsPerInningsEntry {
  matchId: string;
  date: string;
  runs: number;
  notOut: boolean;
}

// Chronological runs-per-innings bar chart - one bar per innings this player has
// batted in, oldest to newest (left to right). Follows ManhattanChart's bar layout
// (horizontal-scroll for many bars, gridlines at 0/50%/100%). Single series of
// magnitude, so one sequential hue (pitch-500) rather than a categorical palette;
// not-out innings get a gold dot above the bar - cricket scorecards mark not-outs
// with an asterisk, this is that convention translated to a chart marker.
export default function RunsPerInnings({ innings }: { innings: RunsPerInningsEntry[] }) {
  if (innings.length === 0) {
    return (
      <div className="flex items-center justify-center h-[220px] text-sm text-ink-muted">
        No innings recorded yet.
      </div>
    );
  }

  const maxRuns = Math.max(1, ...innings.map((i) => i.runs));

  const width = Math.max(360, innings.length * 26);
  const height = 220;
  const paddingLeft = 30;
  const paddingRight = 10;
  const paddingTop = 20;
  const paddingBottom = 26;
  const chartHeight = height - paddingTop - paddingBottom;
  const chartWidth = width - paddingLeft - paddingRight;
  const slotWidth = chartWidth / innings.length;
  const barWidth = Math.max(4, slotWidth - 6);
  const labelStep = Math.max(1, Math.ceil(innings.length / 14));

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

          {innings.map((inn, idx) => {
            const slotX = paddingLeft + idx * slotWidth;
            const barX = slotX + (slotWidth - barWidth) / 2;
            const barY = yFor(inn.runs);
            const barH = Math.max(0, paddingTop + chartHeight - barY);
            return (
              <g key={inn.matchId + idx}>
                <rect
                  x={barX}
                  y={barY}
                  width={barWidth}
                  height={barH}
                  className="fill-pitch-500"
                  opacity={0.9}
                  rx={1.5}
                >
                  <title>{`${new Date(inn.date).toLocaleDateString()}: ${inn.runs}${inn.notOut ? '*' : ''} runs`}</title>
                </rect>
                {inn.notOut && (
                  <circle cx={barX + barWidth / 2} cy={Math.max(paddingTop - 4, barY - 7)} r={2.5} className="fill-gold-400" />
                )}
                {idx % labelStep === 0 && (
                  <text
                    x={slotX + slotWidth / 2}
                    y={height - paddingBottom + 14}
                    textAnchor="middle"
                    className="fill-ink-muted"
                    fontSize={9}
                  >
                    {idx + 1}
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
      <div className="flex items-center gap-1.5 text-xs text-ink-secondary mt-2">
        <span className="inline-block w-2.5 h-2.5 rounded-full bg-gold-400" />
        Not out
      </div>
      <p className="text-xs text-ink-muted mt-1">Runs scored per innings, oldest to newest ({innings.length} innings)</p>
    </div>
  );
}
