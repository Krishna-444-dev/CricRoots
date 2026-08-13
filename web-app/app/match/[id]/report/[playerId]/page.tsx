'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import { labelize } from '@/lib/ballTaxonomy';

interface MatchDoc {
  _id: string;
  title: string;
  venue: string;
}

interface ThisMatchBatting {
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  strikeRate: number;
}

interface ThisMatchBowling {
  balls: number;
  overs: string;
  runs: number;
  wickets: number;
  economy: number;
}

interface CareerComparisonBatting {
  careerAverage: number;
  careerStrikeRate: number;
  runsDelta: number;
  strikeRateDelta: number;
  hasEnoughHistory: boolean;
  message: string;
}

interface CareerComparisonBowling {
  careerAverageWicketsPerMatch: number;
  careerEconomyRate: number;
  wicketsDelta: number;
  economyDelta: number;
  hasEnoughHistory: boolean;
  message: string;
}

interface RecentFormEntry {
  matchId: string;
  scheduledDate: string;
  isThisMatch: boolean;
  runs: number | null;
  wickets: number | null;
}

interface BadgeDef {
  key: string;
  label: string;
  description: string;
}

interface Achievement extends BadgeDef {
  earned: boolean;
  count: number;
}

interface Milestones {
  isCareerBestBatting: boolean;
  priorHighestScore: number | null;
  battingMessage: string | null;
  isCareerBestBowling: boolean;
  priorBestBowlingFigures: string | null;
  bowlingMessage: string | null;
  badgesThisMatch: BadgeDef[];
  careerAchievements: Achievement[];
}

interface RiskBucket {
  line: string;
  length: string;
  blendedDismissalRate: number | null;
  confidence: string;
  basedOn: string;
}

interface DismissalDetail {
  bowlerId: string | null;
  wicketType: string;
  line: string;
  length: string;
  matchedRiskZone?: boolean;
  topRiskBuckets?: RiskBucket[];
  note: string;
}

interface TacticalTieBack {
  dismissals: DismissalDetail[];
  message?: string;
}

interface PerformanceReport {
  success: boolean;
  matchId: string;
  player: { _id: string; name: string; specialization: string };
  participated: boolean;
  message?: string;
  thisMatch?: { batting: ThisMatchBatting | null; bowling: ThisMatchBowling | null };
  careerComparison?: { batting?: CareerComparisonBatting; bowling?: CareerComparisonBowling };
  recentForm?: RecentFormEntry[];
  milestones?: Milestones;
  tacticalTieBack?: TacticalTieBack;
}

const CONFIDENCE_VARIANT: Record<string, BadgeVariant> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
  none: 'neutral'
};

function deltaLabel(value: number, unit: string): { text: string; positive: boolean } {
  const positive = value >= 0;
  return { text: `${positive ? '+' : ''}${value}${unit}`, positive };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// Compact hand-built bar-list trend (no charting library in this codebase - the same lightweight
// inline-SVG-adjacent approach as WagonWheel/ManhattanChart/WormChart) showing the last few
// matches' worth of one stat as a sequence, not just a single aggregate number.
function TrendBars({ label, entries, valueOf, unit }: {
  label: string;
  entries: RecentFormEntry[];
  valueOf: (e: RecentFormEntry) => number | null;
  unit: string;
}) {
  const points = entries.filter((e) => valueOf(e) !== null);
  if (points.length === 0) return null;

  const max = Math.max(1, ...points.map((e) => valueOf(e) ?? 0));

  return (
    <div>
      <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide mb-2">{label}</p>
      <div className="flex items-end gap-3 h-24">
        {points.map((e) => {
          const value = valueOf(e) ?? 0;
          const heightPct = Math.max(6, (value / max) * 100);
          return (
            <div key={e.matchId} className="flex flex-col items-center justify-end h-full flex-1 min-w-0">
              <span className="text-xs text-ink-muted mb-1">{value}{unit}</span>
              <div
                className={`w-full rounded-t-sm ${e.isThisMatch ? 'bg-gold-500' : 'bg-pitch-500/70'}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className={`text-[10px] mt-1 ${e.isThisMatch ? 'text-gold-400 font-semibold' : 'text-ink-muted'}`}>
                {e.isThisMatch ? 'This match' : formatDate(e.scheduledDate)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TacticalDismissalCard({ dismissal, index }: { dismissal: DismissalDetail; index: number }) {
  const hasZones = dismissal.line !== 'unknown' && dismissal.length !== 'unknown';
  const variant: BadgeVariant = dismissal.matchedRiskZone ? 'danger' : dismissal.matchedRiskZone === false ? 'success' : 'neutral';

  return (
    <div className="bg-surface-alt rounded-lg p-4 border border-border">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold text-ink">
          Dismissal {index + 1}{hasZones ? ` · ${labelize(dismissal.length)}, ${labelize(dismissal.line)}` : ''}
        </p>
        {dismissal.matchedRiskZone !== undefined && (
          <Badge variant={variant}>{dismissal.matchedRiskZone ? 'Flagged risk zone' : 'Off-pattern'}</Badge>
        )}
      </div>
      <p className="text-xs text-ink-muted mb-1 capitalize">{dismissal.wicketType || 'unknown dismissal'}</p>
      <p className="text-sm text-ink-secondary">{dismissal.note}</p>
      {dismissal.topRiskBuckets && dismissal.topRiskBuckets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide">Top risk zones (this matchup)</p>
          {dismissal.topRiskBuckets.map((b, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <span className="text-ink-secondary capitalize">{labelize(b.length)}, {labelize(b.line)}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-ink-muted">{b.blendedDismissalRate}% dismissal</span>
                <Badge variant={CONFIDENCE_VARIANT[b.confidence] ?? 'neutral'}>{b.confidence}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PerformanceReportPage({ params }: { params: { id: string; playerId: string } }) {
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/matches/${params.id}`).then((r) => r.json()),
      fetch(`/api/matches/${params.id}/performance-report/${params.playerId}`).then((r) => r.json())
    ])
      .then(([matchData, reportData]) => {
        if (matchData.success) setMatch(matchData.match);
        if (reportData.success) {
          setReport(reportData);
        } else {
          setError(reportData.message || 'Could not load performance report');
        }
      })
      .catch(() => setError('Error fetching performance report'))
      .finally(() => setLoading(false));
  }, [params.id, params.playerId]);

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (error || !report) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">{error || 'Report not found.'}</p>
          <Link href={`/match/${params.id}`} className="text-pitch-400 hover:underline text-sm">&larr; Back to match</Link>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/match/${params.id}`} className="text-sm text-pitch-400 hover:underline">&larr; Back to match</Link>
      <h1 className="text-2xl font-bold text-ink mt-4">{report.player.name}</h1>
      <p className="text-sm text-ink-secondary mb-6">
        {report.player.specialization} · {match?.title ?? 'Performance Report'}
      </p>

      {!report.participated ? (
        <Card>
          <p className="text-sm text-ink-secondary">{report.message}</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Headline numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {report.thisMatch?.batting && (
              <Card>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Batting</p>
                <p className="text-3xl font-bold text-ink">
                  {report.thisMatch.batting.runs}
                  <span className="text-base font-normal text-ink-muted">{report.thisMatch.batting.out ? '' : '*'}</span>
                </p>
                <p className="text-sm text-ink-secondary mt-1">
                  {report.thisMatch.batting.balls} balls · {report.thisMatch.batting.fours}x4 · {report.thisMatch.batting.sixes}x6 · SR {report.thisMatch.batting.strikeRate}
                </p>
                <p className="text-xs text-ink-muted mt-1">{report.thisMatch.batting.out ? 'Out' : 'Not out'}</p>
              </Card>
            )}
            {report.thisMatch?.bowling && (
              <Card>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Bowling</p>
                <p className="text-3xl font-bold text-ink">
                  {report.thisMatch.bowling.wickets}<span className="text-base font-normal text-ink-muted">/{report.thisMatch.bowling.runs}</span>
                </p>
                <p className="text-sm text-ink-secondary mt-1">
                  {report.thisMatch.bowling.overs} overs · Economy {report.thisMatch.bowling.economy}
                </p>
              </Card>
            )}
          </div>

          {/* Tactical tie-back - the differentiated section, surfaced right up top */}
          <Card className="border-gold-500/30">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-lg font-semibold text-ink">Tactical read</h2>
              <Badge variant="gold">Matchup model</Badge>
            </div>
            <p className="text-xs text-ink-muted mb-4">
              Whether each dismissal came from a zone the hierarchical matchup-shrinkage model had already flagged as high-risk for this batter against this bowler.
            </p>
            {report.tacticalTieBack && report.tacticalTieBack.dismissals.length > 0 ? (
              <div className="space-y-3">
                {report.tacticalTieBack.dismissals.map((d, i) => (
                  <TacticalDismissalCard key={i} dismissal={d} index={i} />
                ))}
              </div>
            ) : (
              <p className="text-sm text-ink-secondary">{report.tacticalTieBack?.message ?? 'Nothing to cross-reference this match.'}</p>
            )}
          </Card>

          {/* Career-average comparison */}
          {(report.careerComparison?.batting || report.careerComparison?.bowling) && (
            <Card>
              <h2 className="text-lg font-semibold text-ink mb-3">Vs. your career average</h2>
              <div className="space-y-4">
                {report.careerComparison.batting && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-ink-secondary">Batting</span>
                      {report.careerComparison.batting.hasEnoughHistory && (
                        <>
                          <Badge variant={deltaLabel(report.careerComparison.batting.runsDelta, '').positive ? 'success' : 'danger'}>
                            {deltaLabel(report.careerComparison.batting.runsDelta, ' runs').text}
                          </Badge>
                          <Badge variant={deltaLabel(report.careerComparison.batting.strikeRateDelta, '').positive ? 'success' : 'danger'}>
                            {deltaLabel(report.careerComparison.batting.strikeRateDelta, ' SR').text}
                          </Badge>
                        </>
                      )}
                    </div>
                    <p className="text-sm text-ink-secondary">{report.careerComparison.batting.message}</p>
                  </div>
                )}
                {report.careerComparison.bowling && (
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-semibold text-ink-secondary">Bowling</span>
                      {report.careerComparison.bowling.hasEnoughHistory && (
                        <Badge variant={report.careerComparison.bowling.economyDelta <= 0 ? 'success' : 'danger'}>
                          {deltaLabel(report.careerComparison.bowling.economyDelta, ' econ').text}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-ink-secondary">{report.careerComparison.bowling.message}</p>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Recent-form trend */}
          {report.recentForm && report.recentForm.length > 1 && (
            <Card>
              <h2 className="text-lg font-semibold text-ink mb-4">Recent form (last {report.recentForm.length} matches)</h2>
              <div className="space-y-5">
                <TrendBars label="Runs" entries={report.recentForm} valueOf={(e) => e.runs} unit="" />
                <TrendBars label="Wickets" entries={report.recentForm} valueOf={(e) => e.wickets} unit="w" />
              </div>
            </Card>
          )}

          {/* Milestones & achievements */}
          {report.milestones && (
            <Card>
              <h2 className="text-lg font-semibold text-ink mb-3">Milestones</h2>
              <div className="space-y-2 mb-4">
                {report.milestones.battingMessage && (
                  <div className="flex items-start gap-2">
                    {report.milestones.isCareerBestBatting && <Badge variant="gold">New Best</Badge>}
                    <p className="text-sm text-ink-secondary">{report.milestones.battingMessage}</p>
                  </div>
                )}
                {report.milestones.bowlingMessage && (
                  <div className="flex items-start gap-2">
                    {report.milestones.isCareerBestBowling && <Badge variant="gold">New Best</Badge>}
                    <p className="text-sm text-ink-secondary">{report.milestones.bowlingMessage}</p>
                  </div>
                )}
              </div>
              {report.milestones.badgesThisMatch.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Earned this match</p>
                  <div className="flex flex-wrap gap-2">
                    {report.milestones.badgesThisMatch.map((b) => (
                      <Badge key={b.key} variant="gold">{b.label}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-2">Career achievements</p>
                <div className="flex flex-wrap gap-2">
                  {report.milestones.careerAchievements.filter((a) => a.earned).map((a) => (
                    <Badge key={a.key} variant="success">{a.label}{a.count > 1 ? ` x${a.count}` : ''}</Badge>
                  ))}
                  {report.milestones.careerAchievements.every((a) => !a.earned) && (
                    <p className="text-sm text-ink-muted">No career badges earned yet.</p>
                  )}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
