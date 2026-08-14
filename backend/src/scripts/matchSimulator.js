// Realistic ball-by-ball innings/match simulator used by simulateTournament.js. Kept separate
// from that file's team/player setup and controller-calling harness for readability.

const { generateCommentary } = require('../services/commentaryGenerator');

const LINES = ['wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg'];
const LINE_WEIGHTS = { 'wide-outside-off': 5, 'outside-off': 20, 'off-stump': 30, 'middle-stump': 25, 'leg-stump': 15, 'down-leg': 5 };
const LENGTHS = ['full-toss', 'yorker', 'full', 'good-length', 'short-of-good-length', 'short', 'bouncer'];
const LENGTH_WEIGHTS = { 'full-toss': 4, yorker: 8, full: 18, 'good-length': 40, 'short-of-good-length': 15, short: 10, bouncer: 5 };
const BOUNDARY_SHOT_TYPES = ['drive', 'cut', 'pull-hook', 'sweep', 'flick-glance', 'loft', 'reverse-scoop'];
const SHOT_ZONES = ['fine-leg', 'square-leg', 'mid-wicket', 'mid-on', 'mid-off', 'cover', 'point', 'third-man'];
const WICKET_TYPES_NEEDING_FIELDER = ['caught', 'run out', 'stumped'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickWeighted(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    r -= w;
    if (r <= 0) return key;
  }
  return entries[entries.length - 1][0];
}

function computeOvers(balls) {
  const legalBalls = balls.filter((b) => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))).length;
  return Math.floor(legalBalls / 6) + (legalBalls % 6) / 10;
}

// Selects up to 6 real bowling options from a roster, bowlers/all-rounders first (those with
// an actual bowlingStyle), falling back to anyone if a team is short on specialists.
function pickBowlingAttack(roster) {
  const real = roster.filter((p) => p.bowlingStyle && p.bowlingStyle !== 'None');
  const ordered = [...real, ...roster.filter((p) => !real.includes(p))];
  return ordered.slice(0, 6);
}

function nextBowler({ attack, maxOversPerBowler, oversBowled, lastBowlerId }) {
  const eligible = attack.filter(
    (p) => (oversBowled.get(p._id.toString()) || 0) < maxOversPerBowler && p._id.toString() !== lastBowlerId
  );
  const pool = eligible.length ? eligible : attack.filter((p) => (oversBowled.get(p._id.toString()) || 0) < maxOversPerBowler);
  return pick(pool.length ? pool : attack);
}

// Simulates one full innings ball-by-ball, respecting strike rotation (odd runs, end-of-over
// swap), the standard "no consecutive overs, max totalOvers/5 overs per bowler" rule, and
// (if `target` is given) stopping the chase the moment it's been overhauled. Wickets are
// always attributed to the current striker, matching this app's own established convention
// (see LiveScoringScreen.tsx's handleWicket) rather than trying to model genuine
// non-striker run-outs.
function simulateInnings({ battingRoster, bowlingRoster, totalOvers, target }) {
  const balls = [];
  const maxLegalBalls = totalOvers * 6;
  const maxOversPerBowler = Math.max(1, Math.floor(totalOvers / 5));
  const attack = pickBowlingAttack(bowlingRoster);
  const oversBowled = new Map();

  let runs = 0;
  let wickets = 0;
  let legalBalls = 0;
  let nextBatsmanIdx = 2;
  let strikerIdx = 0;
  let nonStrikerIdx = 1;
  let lastBowlerId = null;
  let currentBowler = null;
  let ballsThisOver = 0;

  const battingLeft = () => nextBatsmanIdx <= battingRoster.length;

  while (legalBalls < maxLegalBalls && wickets < 10) {
    if (ballsThisOver === 0) {
      currentBowler = nextBowler({ attack, maxOversPerBowler, oversBowled, lastBowlerId });
    }
    const striker = battingRoster[strikerIdx];
    const nonStriker = battingRoster[nonStrikerIdx];

    const ballType = pickWeighted({ normal: 88, wide: 5, 'no-ball': 2, bye: 3, 'leg-bye': 2 });
    const line = pickWeighted(LINE_WEIGHTS);
    const length = pickWeighted(LENGTH_WEIGHTS);
    let ball = {
      ballNumber: balls.length + 1,
      batsmanId: striker._id,
      bowlerId: currentBowler._id,
      runs: 0,
      isWicket: false,
      wicketType: null,
      isExtra: false,
      extraType: 'none',
      line,
      length,
      shotType: null,
      shotZone: null,
      fielderId: null,
      fielderPosition: null
    };

    let strikeRotates = false;
    let isLegal = true;

    if (ballType === 'wide') {
      ball.isExtra = true;
      ball.extraType = 'wide';
      ball.runs = 1 + (Math.random() < 0.12 ? Math.ceil(Math.random() * 4) : 0);
      isLegal = false;
    } else if (ballType === 'no-ball') {
      ball.isExtra = true;
      ball.extraType = 'no-ball';
      ball.runs = 1 + (Math.random() < 0.2 ? (Math.random() < 0.3 ? 4 : Math.ceil(Math.random() * 2)) : 0);
      isLegal = false;
    } else if (ballType === 'bye' || ballType === 'leg-bye') {
      ball.isExtra = true;
      ball.extraType = ballType;
      ball.runs = pickWeighted({ 1: 70, 2: 20, 4: 10 }) | 0;
      strikeRotates = ball.runs % 2 === 1;
    } else {
      // Normal delivery: roll for wicket first, then a run outcome.
      const isWicket = Math.random() < 0.045;
      if (isWicket) {
        ball.isWicket = true;
        ball.wicketType = pickWeighted({ bowled: 30, caught: 38, lbw: 12, 'run out': 8, stumped: 8, 'hit wicket': 2, 'retired hurt': 2 });
        if (WICKET_TYPES_NEEDING_FIELDER.includes(ball.wicketType)) {
          const fielders = bowlingRoster.filter((p) => p._id.toString() !== currentBowler._id.toString());
          const fielder = pick(fielders.length ? fielders : bowlingRoster);
          ball.fielderId = fielder._id;
          ball.fielderPosition = ball.wicketType === 'stumped' ? 'wicket-keeper' : pick(SHOT_ZONES);
        }
      } else {
        const runsKey = pickWeighted({ 0: 38, 1: 32, 2: 9, 3: 2, 4: 13, 6: 6 });
        ball.runs = Number(runsKey);
        strikeRotates = ball.runs % 2 === 1;
        if (ball.runs === 4 || ball.runs === 6) {
          ball.shotType = pick(BOUNDARY_SHOT_TYPES);
          ball.shotZone = pick(SHOT_ZONES);
        } else if (ball.runs === 0 && Math.random() < 0.4) {
          ball.shotType = 'defensive';
        }
      }
    }

    // Same call recordBall makes per delivery - names come from the roster objects already
    // in hand (both have {user: {name}} populated), not a lookup, matching the real client-
    // supplies-names contract.
    const fielderPlayer = ball.fielderId ? bowlingRoster.find((p) => p._id.toString() === ball.fielderId.toString()) : null;
    ball.commentary = generateCommentary(ball, {
      batsmanName: striker.user?.name,
      bowlerName: currentBowler.user?.name,
      fielderName: fielderPlayer?.user?.name
    });

    balls.push(ball);
    runs += ball.runs;
    if (ball.isWicket) wickets += 1;

    if (isLegal) {
      legalBalls += 1;
      ballsThisOver += 1;
      oversBowled.set(currentBowler._id.toString(), (oversBowled.get(currentBowler._id.toString()) || 0) + (ballsThisOver === 6 ? 1 : 0));
    }

    if (strikeRotates) {
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }

    if (ball.isWicket) {
      if (!battingLeft()) break;
      strikerIdx = nextBatsmanIdx;
      nextBatsmanIdx += 1;
    }

    if (ballsThisOver === 6) {
      lastBowlerId = currentBowler._id.toString();
      ballsThisOver = 0;
      [strikerIdx, nonStrikerIdx] = [nonStrikerIdx, strikerIdx];
    }

    if (target != null && runs >= target) break;
  }

  return { balls, runs, wickets: Math.min(wickets, 10), overs: computeOvers(balls) };
}

// Breaks an exact tie (both innings finishing on identical runs) by nudging the last
// non-wicket, non-extra ball of the second innings by one run - simpler and more robust than
// threading a "how do knockouts resolve a genuine tie" rule through the whole pipeline, and a
// real match this close is exactly the kind of data point that's more useful decisive than not.
function breakTieIfNeeded(innings1, innings2) {
  if (innings1.runs !== innings2.runs) return innings2;
  for (let i = innings2.balls.length - 1; i >= 0; i--) {
    const b = innings2.balls[i];
    if (!b.isWicket && !b.isExtra) {
      b.runs += 1;
      innings2.runs += 1;
      break;
    }
  }
  return innings2;
}

module.exports = { simulateInnings, breakTieIfNeeded, computeOvers };
