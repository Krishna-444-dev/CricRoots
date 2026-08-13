'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { resolveRefName } from '@/lib/resolveRef';

interface MatchDoc {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  venue: string;
  pitchType: string;
}

interface RosterPlayer {
  _id: string;
  user: { _id: string; name: string } | string | null;
  specialization: string;
}

function rosterPlayerName(p: RosterPlayer): string {
  return resolveRefName(p.user, p._id);
}

interface MatchupBucket {
  line: string;
  length: string;
  blendedDismissalRate: number | null;
  confidence: string;
  basedOn: string;
}

interface MatchupPlan {
  success: boolean;
  source?: string;
  directMatchupBalls?: number;
  targetBuckets?: MatchupBucket[];
  message: string;
}

const CONFIDENCE_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'neutral'> = {
  high: 'success',
  medium: 'warning',
  low: 'danger',
  pool: 'neutral',
  none: 'neutral'
};

// Lets a captain pick any batter from one side and any bowler from the other and see the
// live hierarchical-shrinkage bowling plan for that exact matchup (see backend/src/services/
// tendencyAnalytics.js#getMatchupPlan and documentation/hierarchical-matchup-shrinkage-research.md
// for the algorithm this is surfacing) - the single biggest gap in the pre-existing
// team-level-only bowler scouting above, which never knew who was actually batting.
function MatchupFinder({ team1, team2, roster1, roster2 }: {
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  roster1: RosterPlayer[];
  roster2: RosterPlayer[];
}) {
  const [battingTeam, setBattingTeam] = useState<'team1' | 'team2'>('team1');
  const [batsmanId, setBatsmanId] = useState('');
  const [bowlerId, setBowlerId] = useState('');
  const [plan, setPlan] = useState<MatchupPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const battingRoster = battingTeam === 'team1' ? roster1 : roster2;
  const bowlingRoster = battingTeam === 'team1' ? roster2 : roster1;
  const battingTeamName = battingTeam === 'team1' ? team1.name : team2.name;
  const bowlingTeamName = battingTeam === 'team1' ? team2.name : team1.name;

  useEffect(() => {
    setBatsmanId('');
    setBowlerId('');
    setPlan(null);
  }, [battingTeam]);

  useEffect(() => {
    if (!batsmanId || !bowlerId) { setPlan(null); return; }
    setLoading(true);
    fetch(`/api/insights/matchup/${batsmanId}/${bowlerId}/bowling-plan`)
      .then(r => r.json())
      .then(setPlan)
      .finally(() => setLoading(false));
  }, [batsmanId, bowlerId]);

  return (
    <Card className="mt-6">
      <h2 className="text-lg font-semibold text-ink mb-1">Matchup finder</h2>
      <p className="text-sm text-ink-secondary mb-4">
        Pick a batter and bowler to see a bowling plan blended across this exact matchup, similar
        bowlers, similar batters, and the wider pool - not just one side&apos;s tendencies alone.
      </p>

      <button
        type="button"
        onClick={() => setBattingTeam(t => t === 'team1' ? 'team2' : 'team1')}
        className="text-xs text-pitch-400 hover:underline mb-3"
      >
        ⇄ Swap: {battingTeamName} batting vs {bowlingTeamName} bowling
      </button>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
        <select
          value={batsmanId}
          onChange={(e) => setBatsmanId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-alt border border-border-strong rounded-lg text-ink text-sm"
        >
          <option value="">Select {battingTeamName} batter...</option>
          {battingRoster.map(p => (
            <option key={p._id} value={p._id}>{rosterPlayerName(p)} ({p.specialization})</option>
          ))}
        </select>
        <select
          value={bowlerId}
          onChange={(e) => setBowlerId(e.target.value)}
          className="w-full px-3 py-2 bg-surface-alt border border-border-strong rounded-lg text-ink text-sm"
        >
          <option value="">Select {bowlingTeamName} bowler...</option>
          {bowlingRoster.map(p => (
            <option key={p._id} value={p._id}>{rosterPlayerName(p)} ({p.specialization})</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-ink-secondary">Computing plan...</p>}

      {!loading && plan && (
        <div className="bg-surface-alt rounded-lg p-4">
          <p className="text-sm text-ink mb-3">{plan.message}</p>
          {plan.targetBuckets && plan.targetBuckets.length > 0 && (
            <div className="space-y-2">
              {plan.targetBuckets.map((b, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-ink-secondary capitalize">{b.length.replace(/-/g, ' ')}, {b.line.replace(/-/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-ink-muted text-xs">{b.blendedDismissalRate}% dismissal</span>
                    <Badge variant={CONFIDENCE_VARIANT[b.confidence] ?? 'neutral'}>{b.confidence}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          {typeof plan.directMatchupBalls === 'number' && (
            <p className="text-xs text-ink-muted mt-3">
              {plan.directMatchupBalls > 0
                ? `Based on ${plan.directMatchupBalls} balls of direct history between these two players, blended with wider pools where that's thin.`
                : 'No direct history between these two players yet - based entirely on similar-player pools.'}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

interface BowlerReport {
  playerId: string;
  name: string;
  specialization: string;
  bowlingStyle: string;
  hasData: boolean;
  stats: { economy: number; strikeRate: number | null; wickets: number; balls: number; blendedEconomy: number | null; confidence: string } | null;
  note: string;
}

function BowlerCard({ bowler, rank }: { bowler: BowlerReport; rank: number }) {
  return (
    <Card>
      <div className="flex justify-between items-start gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">
            <span className="text-ink-muted font-normal">#{rank}</span> {bowler.name}
          </p>
          <p className="text-sm text-ink-secondary">{bowler.specialization} · {bowler.bowlingStyle}</p>
        </div>
        {bowler.hasData && (
          <Badge variant="danger">Econ {bowler.stats?.economy}</Badge>
        )}
      </div>
      <p className="text-sm text-ink-secondary mt-2">{bowler.note}</p>
    </Card>
  );
}

export default function ScoutingReportPage({ params }: { params: { id: string } }) {
  const [match, setMatch] = useState<MatchDoc | null>(null);
  const [team1Bowlers, setTeam1Bowlers] = useState<BowlerReport[]>([]);
  const [team2Bowlers, setTeam2Bowlers] = useState<BowlerReport[]>([]);
  const [roster1, setRoster1] = useState<RosterPlayer[]>([]);
  const [roster2, setRoster2] = useState<RosterPlayer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/matches/${params.id}`)
      .then(r => r.json())
      .then(async (data) => {
        if (!data.success) return;
        setMatch(data.match);
        const [r1, r2, t1, t2] = await Promise.all([
          fetch(`/api/insights/teams/${data.match.team1._id}/bowler-scouting`).then(r => r.json()),
          fetch(`/api/insights/teams/${data.match.team2._id}/bowler-scouting`).then(r => r.json()),
          fetch(`/api/teams/${data.match.team1._id}`).then(r => r.json()),
          fetch(`/api/teams/${data.match.team2._id}`).then(r => r.json()),
        ]);
        if (r1.success) setTeam1Bowlers(r1.bowlers);
        if (r2.success) setTeam2Bowlers(r2.bowlers);
        if (t1.success) setRoster1(t1.team.players || []);
        if (t2.success) setRoster2(t2.team.players || []);
        setLoading(false);
      });
  }, [params.id]);

  if (loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!match) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Match not found.</p></main>;
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href={`/match/${params.id}`} className="text-sm text-pitch-400 hover:underline">&larr; Back to match</Link>
      <h1 className="text-2xl font-bold text-ink mt-4">{match.title} <span className="text-ink-muted font-normal">· Scouting Report</span></h1>
      <p className="text-sm text-ink-secondary mb-6 capitalize">
        {match.venue} · {match.pitchType !== 'unknown' ? `${match.pitchType} pitch` : 'pitch type unknown'}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h2 className="text-lg font-semibold text-ink mb-3">{match.team1.name} bowlers</h2>
          <div className="space-y-3">
            {team1Bowlers.length === 0 ? (
              <p className="text-sm text-ink-secondary">No roster data yet.</p>
            ) : (
              team1Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
            )}
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink mb-3">{match.team2.name} bowlers</h2>
          <div className="space-y-3">
            {team2Bowlers.length === 0 ? (
              <p className="text-sm text-ink-secondary">No roster data yet.</p>
            ) : (
              team2Bowlers.map((b, i) => <BowlerCard key={b.playerId} bowler={b} rank={i + 1} />)
            )}
          </div>
        </div>
      </div>

      <MatchupFinder team1={match.team1} team2={match.team2} roster1={roster1} roster2={roster2} />
    </main>
  );
}
