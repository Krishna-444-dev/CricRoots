// Seeds the four fixture states a demo needs - 1 live, 2 upcoming, 1 recent - and puts a named
// account in the middle of them so every persona is reachable:
//
//   player not involved      any simulated user
//   player in the live match a rostered team-mate
//   scorer of the live match the demo account (match creator, holds the scoring lock)
//   captain with a fixture   the demo account (captain of the home team)
//
// Also builds innings[1].liveState from the live match's own ball log. Without it AtTheCrease,
// FieldingPlan and the real next-bowler recommendation all silently render nothing - they are not
// broken, they are correctly hiding, because the scorer state that normally produces them was
// never saved.
//
// Run AFTER runTournamentSimulation.js. Idempotent: deletes and recreates its own [demo] matches.
//
//   NODE_PATH=$PWD/backend/node_modules MONGO_URI="mongodb://127.0.0.1:27017/cricsync" \
//     node scripts/dev/seed-demo.js
const path = require('path');
const mongoose = require('mongoose');

const B = path.join(__dirname, '..', '..', 'backend', 'src');
const Match = require(path.join(B, 'models/Match'));
const Team = require(path.join(B, 'models/Team'));
const Player = require(path.join(B, 'models/Player'));
const User = require(path.join(B, 'models/User'));
const { simulateInnings, computeOvers } = require(path.join(B, 'scripts/matchSimulator'));

const EMAIL = process.env.DEMO_EMAIL || 'krishna@cricroots.test';
const VENUE = 'CricRoots Central Ground';
const isLegal = (b) => !(b.isExtra && ['wide', 'no-ball'].includes(b.extraType));

const daysFromNow = (d, h = 10) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  x.setHours(h, 0, 0, 0);
  return x;
};

const rosterOf = (team) => Player.find({ _id: { $in: team.players } }).populate('user', 'name').lean();
const emptyInnings = (teamId) => ({ team: teamId, runs: 0, wickets: 0, overs: 0, balls: [], liveState: null });

function buildLiveState(balls, byId) {
  const lp = (id) => {
    const p = byId.get(String(id));
    return p ? { id: String(p._id), name: p.user?.name ?? 'Player', role: p.specialization ?? 'Batsman' } : null;
  };
  const bat = new Map();
  for (const b of balls) {
    const k = String(b.batsmanId);
    if (!bat.has(k)) bat.set(k, { player: lp(k), runs: 0, balls: 0, fours: 0, sixes: 0, strikeRate: 0, status: 'not out', outMethod: null, outBowler: null, outFielder: null });
    const e = bat.get(k);
    if (!b.isExtra) { e.runs += b.runs || 0; e.balls += 1; }
    if (b.runs === 4) e.fours += 1;
    if (b.runs === 6) e.sixes += 1;
    if (b.isWicket) { e.status = 'out'; e.outMethod = b.wicketType; e.outBowler = lp(b.bowlerId); e.outFielder = b.fielderId ? lp(b.fielderId) : null; }
  }
  for (const e of bat.values()) e.strikeRate = e.balls ? +((e.runs / e.balls) * 100).toFixed(2) : 0;

  const bowl = new Map();
  for (const b of balls) {
    const k = String(b.bowlerId);
    if (!bowl.has(k)) bowl.set(k, { player: lp(k), overs: 0, balls: 0, maidens: 0, runs: 0, wickets: 0, economy: 0 });
    const e = bowl.get(k);
    e.runs += b.runs || 0;
    if (isLegal(b)) e.balls += 1;
    if (b.isWicket && !['run out', 'retired hurt', 'retired out'].includes(b.wicketType)) e.wickets += 1;
  }
  for (const e of bowl.values()) {
    e.overs = +(Math.floor(e.balls / 6) + (e.balls % 6) / 10).toFixed(1);
    e.economy = e.balls ? +(e.runs / (e.balls / 6)).toFixed(2) : 0;
  }

  const lastFaced = [...new Set([...balls].reverse().map((b) => String(b.batsmanId)))];
  const atCrease = lastFaced.filter((id) => bat.get(id)?.status !== 'out').slice(0, 2);
  const notOut = [...bat.values()].filter((e) => e.status !== 'out');
  return {
    currentBatsmen: [
      atCrease[0] ? bat.get(atCrease[0]).player : (notOut[0]?.player ?? null),
      atCrease[1] ? bat.get(atCrease[1]).player : (notOut[1]?.player ?? null),
    ],
    currentBowler: lp(balls[balls.length - 1].bowlerId),
    battingScorecard: [...bat.values()],
    bowlingScorecard: [...bowl.values()],
  };
}

async function main() {
  await mongoose.connect(process.env.MONGO_URI);

  const user = await User.findOne({ email: EMAIL });
  if (!user) throw new Error(`${EMAIL} not found - register it through the API first`);

  let me = await Player.findOne({ user: user._id });
  if (!me) {
    me = await Player.create({
      user: user._id, specialization: 'All-rounder',
      battingStyle: 'Right-hand', bowlingStyle: 'Right-arm Fast',
    });
  }

  const teams = await Team.find().limit(3);
  if (teams.length < 3) throw new Error('need at least 3 teams - run runTournamentSimulation.js first');
  const [home, away, third] = teams;

  if (!home.players.some((p) => String(p) === String(me._id))) home.players.push(me._id);
  home.captain = me._id;
  await home.save();
  if (!me.teams?.some((t) => String(t) === String(home._id))) {
    me.teams = [...(me.teams || []), home._id];
    await me.save();
  }

  await Match.deleteMany({ title: { $regex: '^\\[demo\\]' } });

  const homeRoster = await rosterOf(home);
  const awayRoster = await rosterOf(away);

  const first = simulateInnings({ battingRoster: awayRoster, bowlingRoster: homeRoster, totalOvers: 20 });
  const chase = simulateInnings({ battingRoster: homeRoster, bowlingRoster: awayRoster, totalOvers: 20, target: first.runs + 1 });
  const partial = chase.balls.slice(0, Math.max(6, Math.floor(chase.balls.length * 0.82)));
  const runs = partial.reduce((a, b) => a + (b.runs || 0), 0);
  const wickets = Math.min(partial.filter((b) => b.isWicket).length, 9);

  const ids = [...new Set(partial.flatMap((b) => [String(b.batsmanId), String(b.bowlerId)]))];
  const byId = new Map((await Player.find({ _id: { $in: ids } }).populate('user', 'name').lean()).map((p) => [String(p._id), p]));

  await Match.create({
    title: `[demo] ${home.name} vs ${away.name}`,
    team1: home._id, team2: away._id, matchType: 'T20', totalOvers: 20,
    venue: VENUE, scheduledDate: daysFromNow(0, 9), status: 'Live', createdBy: user._id,
    toss: { winningTeam: away._id, decision: 'bat' },
    innings: [
      { team: away._id, runs: first.runs, wickets: first.wickets, overs: first.overs, balls: first.balls, liveState: null },
      { team: home._id, runs, wickets, overs: computeOvers(partial), balls: partial, liveState: buildLiveState(partial, byId) },
    ],
  });

  for (const [opp, days, venue] of [[third, 3, VENUE], [away, 10, 'Riverside Oval']]) {
    await Match.create({
      title: `[demo] ${home.name} vs ${opp.name}`,
      team1: home._id, team2: opp._id, matchType: 'T20', totalOvers: 20,
      venue, scheduledDate: daysFromNow(days, 10), status: 'Scheduled', createdBy: user._id,
      innings: [emptyInnings(home._id), emptyInnings(opp._id)],
    });
  }

  const recent = await Match.findOne({ status: 'Completed', $or: [{ team1: home._id }, { team2: home._id }] }).sort({ updatedAt: -1 });
  if (recent) { recent.scheduledDate = daysFromNow(-1, 10); await recent.save(); }

  const legal = partial.filter(isLegal).length;
  console.log(`  LIVE      ${home.name} ${runs}/${wickets} chasing ${first.runs + 1} - needs ${first.runs + 1 - runs} off ${120 - legal}`);
  console.log(`  UPCOMING  2 fixtures for ${home.name}`);
  console.log(`  RECENT    ${recent ? recent.title : '(none)'}`);
  console.log(`  identity  ${user.name}: captain of ${home.name}, creator of all demo matches`);
  await mongoose.disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
