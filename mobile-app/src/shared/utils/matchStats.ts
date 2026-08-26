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

// How a batsman got out, in standard scorecard shorthand ("c Fielder b Bowler", "lbw b Bowler",
// "run out (Fielder)", ...) - null if they haven't been dismissed. batsmanName/bowlerName/
// fielderName are accepted on record-ball but the backend only uses them transiently to build
// `commentary` - they're never persisted on the ball subdocument (see Match.js) - so despite
// BallEvent declaring them, they read back as undefined and this always resolves via nameFor
// (a roster lookup) in practice; kept as the primary source rather than removed in case that
// ever changes.
export function dismissalFor(
  balls: BallEvent[],
  playerId: string,
  nameFor: (id: string | null | undefined) => string | undefined
): string | null {
  const wicketBall = balls.find((b) => b.isWicket && b.batsmanId === playerId);
  if (!wicketBall) return null;
  const bowlerName = wicketBall.bowlerName || nameFor(wicketBall.bowlerId) || 'Bowler';
  const fielderName = wicketBall.fielderName || nameFor(wicketBall.fielderId) || 'Fielder';
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

// Groups an innings' balls into overs with the bowler and a short per-ball outcome label each -
// ported 1:1 from web-app/lib/matchStats.ts's overByOver, for the Over by Over tab.
export interface OverEntry {
  over: number;
  bowlerId: string | null;
  balls: { label: string; isWicket: boolean }[];
  runs: number;
  wickets: number;
  runningTotal: number;
}
export function overByOver(balls: BallEvent[]): OverEntry[] {
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

// Full-innings commentary feed, newest first, with an end-of-over summary above each over's
// deliveries - the layout every cricket scoring site uses (Cricinfo, CricClubs, CricHeroes).
//
// Replaces the previous "last 8 balls" slice in the Ball By Ball tab. The commentary text for
// every delivery has always been stored on the ball (commentaryGenerator.js writes it at
// record time); the UI simply never showed more than a handful of it, and the earlier innings
// was unreachable entirely.
//
// Ball numbering follows the standard convention: the number shown is the position of the NEXT
// legal delivery, so a wide and the legal ball that follows it both read "12.3". That is why the
// counter advances on legal deliveries only.
export interface CommentaryBall {
  kind: 'ball';
  key: string;
  label: string;            // "19.6"
  ball: BallEvent;
  runsAfter: number;
  wicketsAfter: number;
}
export interface CommentaryOverBreak {
  kind: 'over-break';
  key: string;
  over: number;             // 1-based, the over that just finished
  runs: number;
  wickets: number;
  runsAfter: number;
  wicketsAfter: number;
  bowlerId: string | null;
}
export type CommentaryEntry = CommentaryBall | CommentaryOverBreak;

export function commentaryFeed(balls: BallEvent[]): CommentaryEntry[] {
  const chronological: CommentaryEntry[] = [];
  let legalBalls = 0;
  let runs = 0;
  let wickets = 0;
  let overRuns = 0;
  let overWickets = 0;
  let overBowlerId: string | null = null;

  balls.forEach((b, i) => {
    const over = Math.floor(legalBalls / 6);
    const ballInOver = (legalBalls % 6) + 1;
    if (overBowlerId === null) overBowlerId = b.bowlerId ?? null;

    runs += b.runs || 0;
    overRuns += b.runs || 0;
    if (b.isWicket) {
      wickets += 1;
      overWickets += 1;
    }

    chronological.push({
      kind: 'ball',
      key: `b${i}`,
      label: `${over}.${ballInOver}`,
      ball: b,
      runsAfter: runs,
      wicketsAfter: wickets
    });

    if (isLegalDelivery(b)) {
      legalBalls += 1;
      // An over ends on its sixth LEGAL delivery, so this check belongs after the increment.
      if (legalBalls % 6 === 0) {
        chronological.push({
          kind: 'over-break',
          key: `o${legalBalls / 6}`,
          over: legalBalls / 6,
          runs: overRuns,
          wickets: overWickets,
          runsAfter: runs,
          wicketsAfter: wickets,
          bowlerId: overBowlerId
        });
        overRuns = 0;
        overWickets = 0;
        overBowlerId = null;
      }
    }
  });

  return chronological.reverse();
}

// One-line outcome badge for a delivery: "6", "W", "wd", "4wd", "4b".
//
// Only wides and no-balls carry an automatic one-run penalty, so only those subtract it to show
// the ADDITIONAL runs ("4wd" = the penalty plus four more). Byes and leg-byes have no penalty -
// every run is a bye - so a four-bye delivery is "4b", not "3b".
const EXTRA_TAG: Record<string, string> = {
  wide: 'wd', 'no-ball': 'nb', bye: 'b', 'leg-bye': 'lb', penalty: 'pen'
};
const PENALTY_EXTRAS = ['wide', 'no-ball'];

export function ballOutcomeLabel(b: BallEvent): string {
  if (b.isWicket) return 'W';
  if (b.isExtra) {
    const tag = EXTRA_TAG[b.extraType] || b.extraType;
    const extraRuns = PENALTY_EXTRAS.includes(b.extraType) ? (b.runs || 0) - 1 : (b.runs || 0);
    return extraRuns > 0 ? `${extraRuns}${tag}` : tag;
  }
  return String(b.runs || 0);
}

// The same commentary, grouped into overs - newest over first, deliveries newest-first inside it.
//
// A flat feed of 120+ rows is how the Ball By Ball tab became a wall. A scorebook is organised by
// over, so this is both the clutter fix and the more native shape: each over collapses to one line
// carrying its own summary (runs, wickets, score at the end of it), and opens to the deliveries.
//
// Derived from commentaryFeed rather than re-walking the balls, so the numbering, the running
// totals and the extras handling cannot drift between the two views.
export interface CommentaryOver {
  over: number;              // 1-based; 0 means the in-progress over that has not completed yet
  complete: boolean;
  runs: number;
  wickets: number;
  runsAfter: number;
  wicketsAfter: number;
  balls: CommentaryBall[];   // newest first
}

export function commentaryOvers(balls: BallEvent[]): CommentaryOver[] {
  // In a newest-first walk an over-break marker appears ABOVE the deliveries it summarises, so:
  //   balls seen BEFORE a break  -> belong to the NEXT over (still in progress, or the last one)
  //   balls seen AFTER a break   -> belong to THAT break's over
  const feed = commentaryFeed(balls);
  const overs: CommentaryOver[] = [];
  let filling: CommentaryOver | null = null;   // the over currently receiving deliveries
  let pending: CommentaryBall[] = [];          // deliveries seen before the first break

  const summarise = (list: CommentaryBall[]) => ({
    runs: list.reduce((a, b) => a + (b.ball.runs || 0), 0),
    wickets: list.filter((b) => b.ball.isWicket).length,
  });

  for (const entry of feed) {
    if (entry.kind === 'over-break') {
      if (pending.length > 0) {
        // The incomplete over above this break - the one still being bowled.
        overs.push({
          over: entry.over + 1,
          complete: false,
          ...summarise(pending),
          runsAfter: pending[0].runsAfter,
          wicketsAfter: pending[0].wicketsAfter,
          balls: pending,
        });
        pending = [];
      }
      filling = {
        over: entry.over,
        complete: true,
        runs: entry.runs,
        wickets: entry.wickets,
        runsAfter: entry.runsAfter,
        wicketsAfter: entry.wicketsAfter,
        balls: [],
      };
      overs.push(filling);
      continue;
    }
    if (filling) filling.balls.push(entry);
    else pending.push(entry);
  }

  // Whatever is left had no break above it: the innings' opening over.
  if (pending.length > 0) {
    overs.push({
      over: 1,
      complete: false,
      ...summarise(pending),
      runsAfter: pending[0].runsAfter,
      wicketsAfter: pending[0].wicketsAfter,
      balls: pending,
    });
  }
  return overs.filter((o) => o.balls.length > 0);
}
