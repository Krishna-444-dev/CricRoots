// Ops script: builds N realistic teams/rosters and runs a full tournament (group stage +
// knockout bracket) with realistic ball-by-ball match data. Calls the SAME controller
// functions the real API uses (via a minimal fake req/res harness) rather than
// reimplementing their logic, so every downstream side effect - commentary generation, MVP
// calculation, standings, auto-generated news articles, result derivation - runs through the
// real code path. Kept in the repo (not deleted after use) since it's a reusable way to seed
// a large realistic tournament for demo/load-testing purposes.
//
// Run inside the backend container (needs the real Mongo connection + the app's own models/
// controllers): docker exec cricroots-backend node src/scripts/simulateTournament.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/database');

const User = require('../models/User');
const Player = require('../models/Player');
const Team = require('../models/Team');
const Match = require('../models/Match');
const Tournament = require('../models/Tournament');
let League = null;
try {
  League = require('../models/League');
} catch (e) {
  console.log('League model not found yet - skipping league linkage.');
}

const matchController = require('../controllers/matchController');
const tournamentController = require('../controllers/tournamentController');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
// Overridable via env so runTournamentSimulation.js can smoke-test at small scale before a
// full run without two separate copies of these constants drifting apart.
const NUM_TEAMS = parseInt(process.env.SIM_TEAMS || '28', 10);
const NUM_GROUPS = parseInt(process.env.SIM_GROUPS || '2', 10);
const PLAYERS_PER_TEAM = parseInt(process.env.SIM_PLAYERS_PER_TEAM || '14', 10);
const TOTAL_OVERS = 20;
const QUALIFIERS_PER_GROUP = parseInt(process.env.SIM_QUALIFIERS_PER_GROUP || '4', 10);

// The real, already-logged-in-and-tested "Test Krishna" account from this session's manual
// pilot testing - reused here rather than creating a duplicate, per the user's explicit ask
// to keep this identity as captain of one of the teams.
const TEST_KRISHNA_USER_ID = '6a7b86618dc0c108af5a4eda';
const TEST_KRISHNA_PLAYER_ID = '6a7e082a6d57aed3f8fa1e5b';

// ---------------------------------------------------------------------------
// Fake req/res harness - calls the real Express controller functions in-process, without
// going through HTTP/Express routing. A Proxy that no-ops any method call stands in for
// req.io/req.socketManager (the controllers only use these to emit best-effort realtime
// events; there's nothing listening for them here, and a bug in an emit call must never
// abort the underlying business logic - which is exactly how the real controllers already
// treat them, so a silent no-op is a faithful stand-in, not a shortcut).
// ---------------------------------------------------------------------------
const noopProxy = new Proxy({}, { get: () => () => {} });

function makeReqRes({ user, params = {}, body = {} }) {
  const req = { user, params, body, io: noopProxy, socketManager: noopProxy };
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(payload) {
      jsonBody = payload;
      return this;
    }
  };
  return { req, res, result: () => ({ statusCode, body: jsonBody }) };
}

async function call(fn, opts) {
  const { req, res, result } = makeReqRes(opts);
  await fn(req, res);
  const r = result();
  if (r.statusCode >= 400) {
    throw new Error(`Call failed (${r.statusCode}): ${(r.body && r.body.message) || 'unknown error'}`);
  }
  return r.body;
}

// ---------------------------------------------------------------------------
// Name pools - mixed naming traditions matching the style already used in this session's
// test data (Falcons XI, Arjun Patel, Zaid Ahmed, Ethan Brooks, ...), large enough that
// PLAYERS_PER_TEAM * NUM_TEAMS unique combinations don't require heavy retrying.
// ---------------------------------------------------------------------------
const FIRST_NAMES = [
  'Arjun', 'Rohan', 'Vikram', 'Aditya', 'Karan', 'Rahul', 'Sanjay', 'Amit', 'Nikhil', 'Suresh',
  'Rajesh', 'Ankit', 'Varun', 'Siddharth', 'Manish', 'Deepak', 'Gaurav', 'Harsh', 'Ishaan', 'Kabir',
  'Naveen', 'Pranav', 'Ravi', 'Tarun', 'Vivek', 'Yash', 'Zaid', 'Omar', 'Tariq', 'Fahad',
  'Imran', 'Yusuf', 'Bilal', 'Hamza', 'Adnan', 'Kamran', 'Saad', 'Salman', 'Waseem', 'Ethan',
  'Ryan', 'Jake', 'Connor', 'Liam', 'Noah', 'Oliver', 'Lucas', 'Mason', 'Harry', 'George',
  'Ben', 'James', 'Josh', 'Sam', 'Tom', 'Jordan', 'Marcus', 'Chris', 'Dwayne', 'Kieron',
  'Andre', 'Darren', 'Nathan', 'Shane', 'Brett', 'Curtis', 'Devon', 'Malik', 'Jerome', 'Aaron'
];
const LAST_NAMES = [
  'Patel', 'Sharma', 'Singh', 'Kumar', 'Mehta', 'Verma', 'Gupta', 'Joshi', 'Rao', 'Nair',
  'Reddy', 'Iyer', 'Chauhan', 'Malhotra', 'Bhatt', 'Desai', 'Shah', 'Trivedi', 'Pillai', 'Menon',
  'Ahmed', 'Siddiqui', 'Aziz', 'Malik', 'Khan', 'Hussain', 'Farooq', 'Rashid', 'Qureshi', 'Chowdhury',
  'Islam', 'Rahman', 'Hossain', 'Brooks', 'Carter', 'Mitchell', 'Turner', 'Bennett', 'Hughes', 'Morgan',
  'Walsh', 'Clarke', 'Cooper', 'Fletcher', 'Barnes', 'Wallace', 'Sinclair', 'Douglas', 'Anderson', 'Bailey',
  'Ward', 'Foster', 'Grant', 'Henderson', 'Russell', 'Stewart', 'Watson', 'Campbell', 'Murray', 'Robertson',
  'Fraser', 'Hamilton', 'Kingston', 'Powell', 'Marshall', 'Peters', 'Simmonds', 'Williams', 'Richards', 'Constantine'
];
// Deliberately avoids "Falcons XI" - a real pre-existing team from this session's manual
// pilot testing already uses that name; reusing it here risks exactly the kind of
// name-collision mixup that caused an accidental deletion earlier in this run.
const TEAM_NAMES = [
  'Phoenix Blazers', 'Titans CC', 'Riverside Strikers', 'Ironwood Warriors', 'Coastal Kings', 'Highland Hawks',
  'Sunrise Panthers', 'Metro Gladiators', 'Silverline Royals', 'Thunderbolts CC', 'Redwood Rangers', 'Emerald Eagles',
  'Meadowbrook Lions', 'Stonebridge Spartans', 'Crescent Cobras', 'Harborview Vikings', 'Northgate Knights', 'Westfield Wanderers',
  'Ashwood Avengers', 'Pinehill Panthers', 'Lakeside Legends', 'Oakridge Outlaws', 'Brookfield Bulls', 'Summit Strikers',
  'Valleyview Vipers', 'Cedarpoint Chargers', 'Windsor Wolves', 'Kingsland Comets'
];
const CITIES = [
  'Fairview', 'Riverdale', 'Brookhaven', 'Millfield', 'Ashford', 'Clearwater', 'Stonegate', 'Meadowlands',
  'Highbridge', 'Westbrook', 'Eastport', 'Northfield', 'Southgate', 'Lakeview', 'Hillcrest', 'Rivertown',
  'Oakville', 'Pinecrest', 'Cedarville', 'Elmwood', 'Maple Heights', 'Sunnydale', 'Greenfield', 'Silverlake',
  'Ironbridge', 'Crescent Bay', 'Harborside', 'Kingswood'
];

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

function makeNamePool(count) {
  const used = new Set();
  const names = [];
  while (names.length < count) {
    const name = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`;
    if (used.has(name)) continue;
    used.add(name);
    names.push(name);
  }
  return names;
}

// ---------------------------------------------------------------------------
// Teams + players
// ---------------------------------------------------------------------------
async function createTeamsAndPlayers() {
  const allNames = makeNamePool(NUM_TEAMS * PLAYERS_PER_TEAM);
  const passwordHash = await bcrypt.hash('SimulatedPlayer123!', 10);

  // The real Test Krishna Player record was accidentally deleted earlier this session by an
  // unrelated cleanup script and a restore attempt is pending approval (see
  // restoreTestKrishna.js) - check it actually exists before referencing it as a captain, so
  // this run can't create yet another dangling reference to a missing player.
  const krishnaPlayerExists = !!(await Player.findById(TEST_KRISHNA_PLAYER_ID));
  if (!krishnaPlayerExists) {
    console.log(
      `WARNING: Test Krishna's player record (${TEST_KRISHNA_PLAYER_ID}) does not exist right now - ` +
        'team 1 will get a synthetic captain instead. Re-run once restoreTestKrishna.js has been approved and run.'
    );
  }

  const teams = [];
  let nameIdx = 0;

  for (let t = 0; t < NUM_TEAMS; t++) {
    const isKrishnaTeam = t === 0 && krishnaPlayerExists;
    const rosterSize = isKrishnaTeam ? PLAYERS_PER_TEAM - 1 : PLAYERS_PER_TEAM;
    const names = allNames.slice(nameIdx, nameIdx + rosterSize);
    nameIdx += rosterSize;

    // Composition per team: 5 batsmen, 5 bowlers, 2 all-rounders, 2 keepers - batsmen/
    // all-rounders/keeper first so the roster array (used as batting order) puts specialist
    // batsmen at the top and bowlers at the tail, like a real XI.
    const specPlan = [
      ...Array(5).fill('Batsman'),
      ...Array(2).fill('All-rounder'),
      ...Array(2).fill('Wicket-keeper'),
      ...Array(5).fill('Bowler')
    ];

    const userDocs = names.map((name, i) => ({
      name,
      email: `sim.${t}.${i}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@cricroots-sim.test`,
      password: passwordHash,
      role: 'player'
    }));
    const insertedUsers = userDocs.length ? await User.insertMany(userDocs) : [];

    const playerDocs = insertedUsers.map((u, i) => {
      const specialization = specPlan[i] || 'Batsman';
      const battingStyle = Math.random() < 0.75 ? 'Right-hand' : 'Left-hand';
      let bowlingStyle = 'None';
      const bowlsAtAll = specialization === 'Bowler' || specialization === 'All-rounder' || Math.random() < 0.15;
      if (bowlsAtAll) {
        bowlingStyle = pickWeighted({
          'Right-arm Fast': 35,
          'Right-arm Spin': 30,
          'Left-arm Fast': 15,
          'Left-arm Spin': 20
        });
      }
      return { user: u._id, specialization, battingStyle, bowlingStyle };
    });
    const insertedPlayers = playerDocs.length ? await Player.insertMany(playerDocs) : [];

    let rosterPlayerIds = insertedPlayers.map((p) => p._id);
    let captainId;
    if (isKrishnaTeam) {
      captainId = TEST_KRISHNA_PLAYER_ID;
      rosterPlayerIds = [captainId, ...rosterPlayerIds];
    } else {
      captainId = rosterPlayerIds[0];
    }

    const team = await Team.create({
      name: TEAM_NAMES[t],
      captain: captainId,
      viceCaptain: rosterPlayerIds[1] || null,
      players: rosterPlayerIds,
      city: CITIES[t % CITIES.length],
      description: `Simulated club side for the 28-team CricRoots demo tournament.`
    });

    // Full player docs (populated with user names) for the batting/bowling simulator.
    const fullRoster = await Player.find({ _id: { $in: rosterPlayerIds } })
      .populate('user', 'name')
      .lean();
    // Preserve the intended batting-order sequence (captain/Krishna first for his team,
    // else roster insertion order) rather than whatever order Mongo's $in query returns.
    const orderIndex = new Map(rosterPlayerIds.map((id, i) => [id.toString(), i]));
    fullRoster.sort((a, b) => orderIndex.get(a._id.toString()) - orderIndex.get(b._id.toString()));

    teams.push({ team, roster: fullRoster });
    console.log(`Created team ${t + 1}/${NUM_TEAMS}: ${team.name}${isKrishnaTeam ? ' (captain: Test Krishna)' : ''}`);
  }

  return teams;
}

module.exports = {
  createTeamsAndPlayers,
  call,
  makeReqRes,
  TEST_KRISHNA_USER_ID,
  TEST_KRISHNA_PLAYER_ID,
  NUM_TEAMS,
  NUM_GROUPS,
  PLAYERS_PER_TEAM,
  TOTAL_OVERS,
  QUALIFIERS_PER_GROUP,
  connectDB,
  mongoose,
  User,
  Player,
  Team,
  Match,
  Tournament,
  League,
  matchController,
  tournamentController
};
