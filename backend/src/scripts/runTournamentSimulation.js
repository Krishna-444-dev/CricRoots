// Orchestrates a full tournament: creates teams/players, registers them, splits into groups,
// generates + plays the group stage, then generates + plays the knockout bracket through to a
// winner. Configurable via env vars so the same script can smoke-test at small scale before a
// full run. See simulateTournament.js/matchSimulator.js for the pieces this wires together.
//
// Usage: docker exec cricroots-backend node src/scripts/runTournamentSimulation.js
// Env overrides: SIM_TEAMS, SIM_GROUPS, SIM_QUALIFIERS_PER_GROUP, SIM_TOURNAMENT_NAME

const {
  createTeamsAndPlayers,
  call,
  TEST_KRISHNA_USER_ID,
  connectDB,
  mongoose,
  Team,
  Player,
  Match,
  Tournament,
  League,
  matchController,
  tournamentController
} = require('./simulateTournament');
const { simulateInnings, breakTieIfNeeded } = require('./matchSimulator');

const NUM_TEAMS = parseInt(process.env.SIM_TEAMS || '28', 10);
const NUM_GROUPS = parseInt(process.env.SIM_GROUPS || '2', 10);
const QUALIFIERS_PER_GROUP = parseInt(process.env.SIM_QUALIFIERS_PER_GROUP || '4', 10);
const TOTAL_OVERS = 20;
const TOURNAMENT_NAME = process.env.SIM_TOURNAMENT_NAME || 'CricRoots Champions Series 2026';

function idOf(refOrDoc) {
  return (refOrDoc && refOrDoc._id ? refOrDoc._id : refOrDoc).toString();
}

async function playMatch(match, rosterByTeam) {
  // match.team1/team2 arrive populated (every controller response above populates them), not
  // as raw ObjectIds - .toString() on a populated Mongoose doc doesn't give back the hex id.
  const team1Id = idOf(match.team1);
  const team2Id = idOf(match.team2);
  const roster1 = rosterByTeam.get(team1Id);
  const roster2 = rosterByTeam.get(team2Id);

  // Coin flip for who bats first, like a real toss.
  const team1BatsFirst = Math.random() < 0.5;
  const battingFirst = team1BatsFirst ? { roster: roster1, inningsIdx: 0 } : { roster: roster2, inningsIdx: 0 };
  const battingSecond = team1BatsFirst ? { roster: roster2, inningsIdx: 1 } : { roster: roster1, inningsIdx: 1 };
  const bowlingFirst = team1BatsFirst ? roster2 : roster1;
  const bowlingSecond = team1BatsFirst ? roster1 : roster2;

  const inn1 = simulateInnings({ battingRoster: battingFirst.roster, bowlingRoster: bowlingFirst, totalOvers: TOTAL_OVERS });
  const inn2 = simulateInnings({
    battingRoster: battingSecond.roster,
    bowlingRoster: bowlingSecond,
    totalOvers: TOTAL_OVERS,
    target: inn1.runs + 1
  });
  breakTieIfNeeded(inn1, inn2);

  const doc = await Match.findById(match._id);
  // innings[0] is always team1's, innings[1] always team2's, regardless of who batted first
  // (matches this app's own established convention - see hierarchical-matchup-shrinkage
  // research notes on Match.innings ordering).
  const firstIdx = team1BatsFirst ? 0 : 1;
  const secondIdx = team1BatsFirst ? 1 : 0;
  const inningsByIdx = { [firstIdx]: inn1, [secondIdx]: inn2 };

  [0, 1].forEach((idx) => {
    const inn = inningsByIdx[idx];
    doc.innings[idx].runs = inn.runs;
    doc.innings[idx].wickets = inn.wickets;
    doc.innings[idx].overs = inn.overs;
    doc.innings[idx].balls = inn.balls;
  });
  doc.status = 'Live'; // realistic transition before Completed, though not strictly required
  await doc.save();

  const completed = await call(matchController.updateMatch, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: match._id.toString() },
    body: { status: 'Completed' }
  });
  return completed.match;
}

async function playAllMatches(matches, rosterByTeam, label) {
  let done = 0;
  for (const match of matches) {
    // eslint-disable-next-line no-await-in-loop
    const result = await playMatch(match, rosterByTeam);
    done += 1;
    const winnerId = result.result?.winningTeam?.toString();
    const t1 = result.team1?.name || result.team1;
    const t2 = result.team2?.name || result.team2;
    console.log(
      `[${label} ${done}/${matches.length}] ${t1} ${result.innings[0].runs}/${result.innings[0].wickets} vs ` +
        `${t2} ${result.innings[1].runs}/${result.innings[1].wickets} - winner: ${
          winnerId === (result.team1?._id || result.team1)?.toString() ? t1 : t2
        }`
    );
  }
}

async function main() {
  await connectDB();
  console.log(`\n=== Starting simulation: ${NUM_TEAMS} teams, ${NUM_GROUPS} groups, ${QUALIFIERS_PER_GROUP} qualifiers/group ===\n`);

  let leagueId = null;
  if (League) {
    try {
      const league = await League.create({
        name: 'CricRoots Premier League',
        description: 'Flagship demo league - runs the Champions Series and future seasons.',
        organizer: TEST_KRISHNA_USER_ID,
        isPublic: true
      });
      leagueId = league._id;
      console.log(`Created league: ${league.name} (${leagueId})`);
    } catch (e) {
      console.log('Skipping league creation (model exists but create failed):', e.message);
    }
  }

  const teamsWithRosters = await createTeamsAndPlayers();
  const rosterByTeam = new Map(teamsWithRosters.map(({ team, roster }) => [team._id.toString(), roster]));

  const tournamentBody = {
    name: TOURNAMENT_NAME,
    description: `A ${NUM_TEAMS}-team tournament: ${NUM_GROUPS} groups, group stage into a Quarterfinal/Semifinal/Final knockout bracket.`,
    format: 'Group',
    matchType: 'T20',
    venue: 'CricRoots Central Ground',
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    // isRegistrationOpen() requires now < registrationDeadline AND status === 'Registration' -
    // both set explicitly below, right before registering teams.
    registrationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    maxTeams: NUM_TEAMS + 5
  };
  if (leagueId) tournamentBody.leagueId = leagueId.toString();

  const created = await call(tournamentController.createTournament, {
    user: { id: TEST_KRISHNA_USER_ID },
    body: tournamentBody
  });
  const tournamentId = created.tournament._id;
  console.log(`Created tournament: ${created.tournament.name} (${tournamentId})`);

  await call(tournamentController.updateTournament, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: { status: 'Registration' }
  });

  for (const { team } of teamsWithRosters) {
    // eslint-disable-next-line no-await-in-loop
    await call(tournamentController.registerTeam, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { teamId: team._id.toString() }
    });
  }
  console.log(`Registered ${teamsWithRosters.length} teams to the tournament.`);

  await call(tournamentController.updateTournament, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: { status: 'Ongoing' }
  });

  await call(tournamentController.assignGroups, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: { groupCount: NUM_GROUPS }
  });
  console.log(`Assigned ${NUM_GROUPS} groups.`);

  const fixtures = await call(tournamentController.generateFixtures, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });
  console.log(`Generated ${fixtures.count} group-stage fixtures.`);

  await playAllMatches(fixtures.matches, rosterByTeam, 'Group');

  console.log('\n=== Group stage complete - standings ===');
  const standingsRes = await call(tournamentController.getTournamentStandings, {
    params: { id: tournamentId }
  });
  (standingsRes.groups || []).forEach((g) => {
    console.log(`\n${g.name}:`);
    g.standings.forEach((row, i) => {
      const name = row.team?.name || row.team;
      console.log(`  ${i + 1}. ${name} - P${row.played} W${row.won} L${row.lost} Pts${row.points} NRR${row.netRunRate.toFixed(3)}`);
    });
  });

  console.log('\n=== Generating knockout stage ===');
  const qf = await call(tournamentController.generateKnockoutStage, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: { qualifiersPerGroup: QUALIFIERS_PER_GROUP }
  });
  await playAllMatches(qf.matches, rosterByTeam, 'Quarterfinal');

  const sf = await call(tournamentController.advanceKnockoutRound, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });
  await playAllMatches(sf.matches, rosterByTeam, 'Semifinal');

  const final = await call(tournamentController.advanceKnockoutRound, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });
  await playAllMatches(final.matches, rosterByTeam, 'Final');

  const completedTournament = await call(tournamentController.advanceKnockoutRound, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });

  const awards = await call(tournamentController.computeAwards, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });

  console.log('\n=== TOURNAMENT COMPLETE ===');
  console.log('Winner:', awards.tournament.awards.winner?.name || awards.tournament.awards.winner);
  console.log('Runner-up:', awards.tournament.awards.runnerUp?.name || awards.tournament.awards.runnerUp);
  console.log('Third place:', awards.tournament.awards.thirdPlace?.name || awards.tournament.awards.thirdPlace);
  console.log('Man of the tournament:', awards.tournament.awards.manOfTheTournament);
  console.log('Best batsman:', awards.tournament.awards.bestBatsman);
  console.log('Best bowler:', awards.tournament.awards.bestBowler);
  console.log('\nTournament ID:', tournamentId);
  console.log('League ID:', leagueId);

  process.exit(0);
}

main().catch((e) => {
  console.error('SIMULATION FAILED:', e);
  process.exit(1);
});
