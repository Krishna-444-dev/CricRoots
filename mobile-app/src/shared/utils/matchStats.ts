// Ball-derived batting/bowling figures, computed fresh from the innings' ball log rather than
// tracked as running state. Extracted from LiveScoringScreen.tsx so MatchDetailScreen's
// read-only scorecard (built from the same BallEvent[] shape) doesn't need its own copy.
import type { BallEvent } from '../types';

export function isLegalDelivery(b: Pick<BallEvent, 'isExtra' | 'extraType'>): boolean {
  return !(b.isExtra && (b.extraType === 'wide' || b.extraType === 'no-ball'));
}

export function battingStatsFor(balls: BallEvent[], playerId: string) {
  let runs = 0;
  let ballsFaced = 0;
  let fours = 0;
  let sixes = 0;
  for (const b of balls) {
    if (b.batsmanId !== playerId) continue;
    if (!(b.isExtra && b.extraType === 'wide')) ballsFaced += 1;
    if (!b.isExtra) {
      runs += b.runs;
      if (b.runs === 4) fours += 1;
      if (b.runs === 6) sixes += 1;
    }
  }
  const strikeRate = ballsFaced > 0 ? (runs / ballsFaced) * 100 : 0;
  return { runs, ballsFaced, fours, sixes, strikeRate };
}

export function bowlingStatsFor(balls: BallEvent[], playerId: string) {
  let legalBalls = 0;
  let runsConceded = 0;
  let wickets = 0;
  for (const b of balls) {
    if (b.bowlerId !== playerId) continue;
    if (isLegalDelivery(b)) legalBalls += 1;
    if (!(b.isExtra && (b.extraType === 'bye' || b.extraType === 'leg-bye'))) runsConceded += b.runs;
    if (b.isWicket && !['run out', 'retired hurt', 'retired out'].includes(b.wicketType || '')) wickets += 1;
  }
  const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
  const economy = legalBalls > 0 ? runsConceded / (legalBalls / 6) : 0;
  return { legalBalls, runsConceded, wickets, overs, economy };
}

// Filtering to just this bowler's own deliveries (in order) reconstructs their overs correctly
// even though other bowlers' balls are interleaved in the full innings list - each individual
// over is always bowled entirely by one bowler, so every run of 6 legal deliveries pulled from
// just their balls is exactly one of their completed overs.
export function maidenOversFor(balls: BallEvent[], playerId: string): number {
  let maidens = 0;
  let runsThisOver = 0;
  let legalInOver = 0;
  for (const b of balls) {
    if (b.bowlerId !== playerId) continue;
    if (!(b.isExtra && (b.extraType === 'bye' || b.extraType === 'leg-bye'))) runsThisOver += b.runs;
    if (isLegalDelivery(b)) {
      legalInOver += 1;
      if (legalInOver === 6) {
        if (runsThisOver === 0) maidens += 1;
        runsThisOver = 0;
        legalInOver = 0;
      }
    }
  }
  return maidens;
}
