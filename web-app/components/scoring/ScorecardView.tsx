'use client';

import type { InningsData } from './BallByBallScoring';

// Full batting/bowling scorecard for whoever's scoring right now - BallByBallScoring only
// ever shows the two current batsmen and the current bowler, with no way to check the rest
// of the lineup's figures (who's already out, who hasn't bowled yet, etc.) without leaving
// the scoring screen. Pure display over the same InningsData the scorer already has locally,
// no extra API call.
export default function ScorecardView({ inningsData }: { inningsData: InningsData }) {
  return (
    <div className="bg-surface border border-border rounded-xl shadow-card p-4 space-y-6">
      <div>
        <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wide text-ink-muted">Batting</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-border">
                <th className="py-1.5 pr-2 font-medium">Batsman</th>
                <th className="py-1.5 px-2 font-medium text-right">R</th>
                <th className="py-1.5 px-2 font-medium text-right">B</th>
                <th className="py-1.5 px-2 font-medium text-right">4s</th>
                <th className="py-1.5 px-2 font-medium text-right">6s</th>
                <th className="py-1.5 pl-2 font-medium text-right">SR</th>
              </tr>
            </thead>
            <tbody>
              {inningsData.battingScorecard.map((entry) => {
                const isCurrent = inningsData.currentBatsmen.some((b) => b?.id === entry.player.id);
                return (
                  <tr key={entry.player.id} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className={isCurrent ? 'font-semibold text-ink' : 'text-ink-secondary'}>
                        {entry.player.name}{isCurrent && entry.player.id === inningsData.currentBatsmen[0]?.id ? ' *' : ''}
                      </span>
                      {entry.status === 'out' && (
                        <span className="block text-xs text-ink-muted">
                          {entry.outMethod}{entry.outBowler ? ` b ${entry.outBowler.name}` : ''}{entry.outFielder ? ` c ${entry.outFielder.name}` : ''}
                        </span>
                      )}
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums">{entry.runs}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">{entry.balls}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">{entry.fours}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">{entry.sixes}</td>
                    <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-ink-secondary">{entry.strikeRate.toFixed(1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-ink-muted mt-2">
          Extras: {inningsData.extras.wides + inningsData.extras.noBalls + inningsData.extras.byes + inningsData.extras.legByes + inningsData.extras.penalty}
          {' '}(w {inningsData.extras.wides}, nb {inningsData.extras.noBalls}, b {inningsData.extras.byes}, lb {inningsData.extras.legByes}, p {inningsData.extras.penalty})
        </p>
      </div>

      <div>
        <h3 className="text-sm font-bold text-ink mb-2 uppercase tracking-wide text-ink-muted">Bowling</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-ink-muted border-b border-border">
                <th className="py-1.5 pr-2 font-medium">Bowler</th>
                <th className="py-1.5 px-2 font-medium text-right">O</th>
                <th className="py-1.5 px-2 font-medium text-right">M</th>
                <th className="py-1.5 px-2 font-medium text-right">R</th>
                <th className="py-1.5 px-2 font-medium text-right">W</th>
                <th className="py-1.5 pl-2 font-medium text-right">Econ</th>
              </tr>
            </thead>
            <tbody>
              {inningsData.bowlingScorecard.filter((e) => e.balls > 0 || e.overs > 0).map((entry) => {
                const isCurrent = inningsData.currentBowler?.id === entry.player.id;
                return (
                  <tr key={entry.player.id} className="border-b border-border/50 last:border-0">
                    <td className="py-1.5 pr-2">
                      <span className={isCurrent ? 'font-semibold text-ink' : 'text-ink-secondary'}>{entry.player.name}</span>
                    </td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums">{entry.overs}.{entry.balls}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">{entry.maidens}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink-secondary">{entry.runs}</td>
                    <td className="py-1.5 px-2 text-right font-mono tabular-nums text-ink">{entry.wickets}</td>
                    <td className="py-1.5 pl-2 text-right font-mono tabular-nums text-ink-secondary">{entry.economy.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
