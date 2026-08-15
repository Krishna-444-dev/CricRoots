// Orchestrates ONE tournament with 2 real Divisions (the first-class `tournament.divisions`
// feature, not the earlier "2 separate Tournament documents" workaround) - each division gets
// its own 20 teams, 2 groups of 10, full round-robin group stage, independent knockout bracket
// (QF/SF/Final), and its own winner/leaderboard, with zero player overlap between divisions
// (guaranteed by construction: all 40 teams/rosters are created fresh in one pass, then split).
// Reuses the same proven match-playing logic as runTournamentSimulation.js via
// matchOrchestration.js, and the same fake req/res harness + team/player generation via
// simulateTournament.js.
//
// Usage: docker exec cricroots-backend node src/scripts/runDivisionedTournament.js
// Env overrides: SIM_TEAMS_PER_DIVISION, SIM_DIVISION_COUNT, SIM_GROUPS_PER_DIVISION,
//                SIM_QUALIFIERS_PER_GROUP, SIM_TOURNAMENT_NAME, SIM_LEAGUE_NAME

const TEAMS_PER_DIVISION = parseInt(process.env.SIM_TEAMS_PER_DIVISION || '20', 10);
const DIVISION_COUNT = parseInt(process.env.SIM_DIVISION_COUNT || '2', 10);
const GROUPS_PER_DIVISION = parseInt(process.env.SIM_GROUPS_PER_DIVISION || '2', 10);
const QUALIFIERS_PER_GROUP = parseInt(process.env.SIM_QUALIFIERS_PER_GROUP || '4', 10);
const TOTAL_TEAMS = TEAMS_PER_DIVISION * DIVISION_COUNT;

// createTeamsAndPlayers() in simulateTournament.js reads its team count/offset from
// process.env at module-load time (not as function params) - these must be set BEFORE that
// module is first required, so all 40 teams get created in one pass with distinct names.
process.env.SIM_TEAMS = String(TOTAL_TEAMS);
process.env.SIM_TEAM_NAME_OFFSET = '0';

const {
  createTeamsAndPlayers,
  call,
  TEST_KRISHNA_USER_ID,
  connectDB,
  League,
  tournamentController
} = require('./simulateTournament');
const { playAllMatches } = require('./matchOrchestration');

const TOURNAMENT_NAME = process.env.SIM_TOURNAMENT_NAME || 'CricRoots Premier League - Season 2026';

function byDivision(matches) {
  const map = new Map();
  for (const m of matches) {
    const key = m.division || 'none';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(m);
  }
  return map;
}

async function main() {
  await connectDB();
  console.log(
    `\n=== Starting divisioned simulation: ${DIVISION_COUNT} divisions x ${TEAMS_PER_DIVISION} teams, ` +
      `${GROUPS_PER_DIVISION} groups/division, ${QUALIFIERS_PER_GROUP} qualifiers/group ===\n`
  );

  const leagueName = process.env.SIM_LEAGUE_NAME || 'CricRoots Premier League';
  let leagueId = null;
  if (League) {
    try {
      let league = await League.findOne({ name: leagueName });
      if (league) {
        leagueId = league._id;
        console.log(`Reusing existing league: ${league.name} (${leagueId})`);
      } else {
        league = await League.create({
          name: leagueName,
          description: 'Flagship demo league - runs the Champions Series and future seasons.',
          organizer: TEST_KRISHNA_USER_ID,
          isPublic: true
        });
        leagueId = league._id;
        console.log(`Created league: ${league.name} (${leagueId})`);
      }
    } catch (e) {
      console.log('Skipping league creation (model exists but create failed):', e.message);
    }
  }

  const teamsWithRosters = await createTeamsAndPlayers();
  const rosterByTeam = new Map(teamsWithRosters.map(({ team, roster }) => [team._id.toString(), roster]));

  const tournamentBody = {
    name: TOURNAMENT_NAME,
    description: `A ${TOTAL_TEAMS}-team, ${DIVISION_COUNT}-division tournament - each division runs its own ${GROUPS_PER_DIVISION}-group stage into an independent knockout bracket.`,
    format: 'Group',
    matchType: 'T20',
    venue: 'CricRoots Central Ground',
    startDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    registrationDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    maxTeams: TOTAL_TEAMS + 5
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

  const divisionsRes = await call(tournamentController.assignDivisions, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: { divisionCount: DIVISION_COUNT }
  });
  const divisionNames = divisionsRes.tournament.divisions.map((d) => d.name);
  console.log(`Assigned ${divisionNames.length} divisions: ${divisionNames.join(', ')}`);
  divisionsRes.tournament.divisions.forEach((d) => {
    console.log(`  ${d.name}: ${d.teams.length} teams`);
  });

  for (const divisionName of divisionNames) {
    // eslint-disable-next-line no-await-in-loop
    await call(tournamentController.assignGroups, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { groupCount: GROUPS_PER_DIVISION, division: divisionName }
    });
    console.log(`Assigned ${GROUPS_PER_DIVISION} groups within ${divisionName}.`);
  }

  const fixtures = await call(tournamentController.generateFixtures, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });
  console.log(`Generated ${fixtures.count} group-stage fixtures across all divisions.`);

  const groupMatchesByDivision = byDivision(fixtures.matches);
  for (const divisionName of divisionNames) {
    // eslint-disable-next-line no-await-in-loop
    await playAllMatches(groupMatchesByDivision.get(divisionName) || [], rosterByTeam, `${divisionName} Group`);
  }

  console.log('\n=== Group stage complete - standings ===');
  const standingsRes = await call(tournamentController.getTournamentStandings, {
    params: { id: tournamentId }
  });
  (standingsRes.divisions || []).forEach((div) => {
    console.log(`\n--- ${div.name} ---`);
    div.groups.forEach((g) => {
      console.log(`\n${g.name}:`);
      g.standings.forEach((row, i) => {
        const name = row.team?.name || row.team;
        console.log(`  ${i + 1}. ${name} - P${row.played} W${row.won} L${row.lost} Pts${row.points} NRR${row.netRunRate.toFixed(3)}`);
      });
    });
  });

  for (const divisionName of divisionNames) {
    console.log(`\n=== ${divisionName}: generating knockout stage ===`);
    // eslint-disable-next-line no-await-in-loop
    const qf = await call(tournamentController.generateKnockoutStage, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { qualifiersPerGroup: QUALIFIERS_PER_GROUP, division: divisionName }
    });
    // eslint-disable-next-line no-await-in-loop
    await playAllMatches(qf.matches, rosterByTeam, `${divisionName} Quarterfinal`);

    // eslint-disable-next-line no-await-in-loop
    const sf = await call(tournamentController.advanceKnockoutRound, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { division: divisionName }
    });
    // eslint-disable-next-line no-await-in-loop
    await playAllMatches(sf.matches, rosterByTeam, `${divisionName} Semifinal`);

    // eslint-disable-next-line no-await-in-loop
    const final = await call(tournamentController.advanceKnockoutRound, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { division: divisionName }
    });
    // eslint-disable-next-line no-await-in-loop
    await playAllMatches(final.matches, rosterByTeam, `${divisionName} Final`);

    // eslint-disable-next-line no-await-in-loop
    await call(tournamentController.advanceKnockoutRound, {
      user: { id: TEST_KRISHNA_USER_ID },
      params: { id: tournamentId },
      body: { division: divisionName }
    });
  }

  const awards = await call(tournamentController.computeAwards, {
    user: { id: TEST_KRISHNA_USER_ID },
    params: { id: tournamentId },
    body: {}
  });

  console.log('\n=== TOURNAMENT COMPLETE ===');
  console.log('Status:', awards.tournament.status);
  (awards.tournament.divisions || []).forEach((div) => {
    console.log(`\n--- ${div.name} ---`);
    console.log('Winner:', div.awards.winner?.name || div.awards.winner);
    console.log('Runner-up:', div.awards.runnerUp?.name || div.awards.runnerUp);
    const mot = div.awards.manOfTheTournament;
    console.log('Man of the division:', mot?.user?.name || mot);
    const bb = div.awards.bestBatsman;
    console.log('Best batsman:', bb?.user?.name || bb);
    const bwl = div.awards.bestBowler;
    console.log('Best bowler:', bwl?.user?.name || bwl);
  });
  console.log('\nTournament ID:', tournamentId);
  console.log('League ID:', leagueId);

  process.exit(0);
}

main().catch((e) => {
  console.error('SIMULATION FAILED:', e);
  process.exit(1);
});
