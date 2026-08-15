// Ball-derived batting/bowling figures, computed fresh from the innings' ball log rather than
// relying on the client-only `liveState` snapshot (which is absent for any match not scored
// through the live-scoring UI - e.g. every match created by this app's simulation scripts).
// Ported 1:1 from mobile-app/src/shared/utils/matchStats.ts so both platforms compute the same
// numbers the same way - keep the two in sync if either changes.

export interface StatsBall {
  batsmanId?: string;
  bowlerId?: string;
  fielderId?: string;
  runs: number;
  isWicket: boolean;
  wicketType: string | null;
  isExtra: boolean;
  extraType: string;
}

export function isLegalDelivery(b: Pick<StatsBall, 'isExtra' | 'extraType'>): boolean {
  return !(b.isExtra && (b.extraType === 'wide' || b.extraType === 'no-ball'));
}

export function battingStatsFor(balls: StatsBall[], playerId: string) {
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

export function bowlingStatsFor(balls: StatsBall[], playerId: string) {
  let legalBalls = 0;
  let runsConceded = 0;
  let wickets = 0;
  let wides = 0;
  let noBalls = 0;
  for (const b of balls) {
    if (b.bowlerId !== playerId) continue;
    if (isLegalDelivery(b)) legalBalls += 1;
    if (!(b.isExtra && (b.extraType === 'bye' || b.extraType === 'leg-bye'))) runsConceded += b.runs;
    if (b.isWicket && !['run out', 'retired hurt', 'retired out'].includes(b.wicketType || '')) wickets += 1;
    if (b.isExtra && b.extraType === 'wide') wides += 1;
    if (b.isExtra && b.extraType === 'no-ball') noBalls += 1;
  }
  const overs = Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
  const economy = legalBalls > 0 ? runsConceded / (legalBalls / 6) : 0;
  return { legalBalls, runsConceded, wickets, overs, economy, wides, noBalls };
}

/** How a batsman got out, in standard scorecard shorthand - null if not dismissed. */
export function dismissalFor(
  balls: StatsBall[],
  playerId: string,
  nameFor: (id: string | null | undefined) => string | undefined
): string | null {
  const wicketBall = balls.find((b) => b.isWicket && b.batsmanId === playerId);
  if (!wicketBall) return null;
  const bowlerName = nameFor(wicketBall.bowlerId) || 'Bowler';
  const fielderName = nameFor(wicketBall.fielderId) || 'Fielder';
  switch (wicketBall.wicketType) {
    case 'bowled':
      return `b ${bowlerName}`;
    case 'lbw':
      return `lbw b ${bowlerName}`;
    case 'caught':
      return wicketBall.fielderId && wicketBall.fielderId === wicketBall.bowlerId
        ? `c & b ${bowlerName}`
        : `c ${fielderName} b ${bowlerName}`;
    case 'stumped':
      return `st ${fielderName} b ${bowlerName}`;
    case 'hit wicket':
      return `hit wicket b ${bowlerName}`;
    case 'run out':
      return wicketBall.fielderId ? `run out (${fielderName})` : 'run out';
    case 'retired hurt':
    case 'retired out':
      return wicketBall.wicketType;
    default:
      return wicketBall.wicketType || 'out';
  }
}

/** Filtering to just this bowler's own deliveries (in order) reconstructs their overs correctly
 * even though other bowlers' balls are interleaved in the full innings list. */
export function maidenOversFor(balls: StatsBall[], playerId: string): number {
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

/** Batting/bowling order, derived from first appearance in the ball log - team.players isn't
 * reliably populated with real rosters on this endpoint, so the ball log is the source of truth
 * for "who actually played," same convention playersWhoAppeared (in the match page) already uses. */
export function battingBowlingOrder(balls: StatsBall[]): { battingOrder: string[]; bowlingOrder: string[] } {
  const battingOrder: string[] = [];
  const bowlingOrder: string[] = [];
  for (const b of balls) {
    if (b.batsmanId && !battingOrder.includes(b.batsmanId)) battingOrder.push(b.batsmanId);
    if (b.bowlerId && !bowlingOrder.includes(b.bowlerId)) bowlingOrder.push(b.bowlerId);
  }
  return { battingOrder, bowlingOrder };
}

/** Groups an innings' balls into overs with the bowler and a short per-ball outcome label each -
 * the data CricClubs' "Over by Over Score" tab shows (one row per over: bowler, ball sequence,
 * over total, running score). Mirrors matchController.recordBall's over-counting convention. */
export interface OverEntry {
  over: number;
  bowlerId: string | null;
  balls: { label: string; isWicket: boolean }[];
  runs: number;
  wickets: number;
  runningTotal: number;
}
export function overByOver(balls: StatsBall[]): OverEntry[] {
  const overs: OverEntry[] = [];
  let legalBallCount = 0;
  let runningTotal = 0;

  for (const b of balls) {
    const overIndex = Math.floor(legalBallCount / 6);
    if (!overs[overIndex]) {
      overs[overIndex] = { over: overIndex, bowlerId: b.bowlerId ?? null, balls: [], runs: 0, wickets: 0, runningTotal: 0 };
    }
    const entry = overs[overIndex];
    entry.runs += b.runs || 0;
    if (b.isWicket) entry.wickets += 1;
    runningTotal += b.runs || 0;
    entry.runningTotal = runningTotal;

    let label = String(b.runs || 0);
    if (b.isExtra) {
      const short: Record<string, string> = { wide: 'wd', 'no-ball': 'nb', bye: 'b', 'leg-bye': 'lb', penalty: 'pen' };
      label = `${short[b.extraType] || b.extraType}${b.runs > 1 ? b.runs - 1 : ''}`;
    }
    if (b.isWicket) label = 'W';
    entry.balls.push({ label, isWicket: b.isWicket });

    if (isLegalDelivery(b)) legalBallCount += 1;
  }

  return overs;
}
