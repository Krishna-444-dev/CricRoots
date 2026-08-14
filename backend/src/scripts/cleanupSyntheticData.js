// Deletes synthetic tournament/team/player/user data created by runTournamentSimulation.js,
// identified ONLY by the distinctive description string createTeamsAndPlayers() stamps on
// every synthetic team (and, for tournaments, by exact name match against SIM_TOURNAMENT_NAME
// - tournament names are actually unique-enough in practice, unlike team names, which is
// exactly what caused an accidental deletion of a real pre-existing "Falcons XI" team earlier
// in this session: a name-based team query matched both a synthetic team and a real one.
// Never match teams by name again - the description marker is the only safe filter.
const { connectDB, User, Player, Team, Tournament, Match, League, TEST_KRISHNA_PLAYER_ID, TEST_KRISHNA_USER_ID } = require('./simulateTournament');

const SYNTHETIC_MARKER = 'Simulated club side for the 28-team CricRoots demo tournament.';
const LEAGUE_NAME = 'CricRoots Premier League';
const TOURNAMENT_NAME = process.argv[2];

async function main() {
  await connectDB();

  const teams = await Team.find({ description: SYNTHETIC_MARKER });
  const teamIds = teams.map((t) => t._id);
  // Test Krishna's own long-lived Player/User are real - he's deliberately rostered as
  // captain of one synthetic team per run, and must never be swept up in this cleanup (this
  // is exactly the exclusion the run that caused the earlier accidental deletion was missing).
  const playerIds = [...new Set(teams.flatMap((t) => t.players.map((p) => p.toString())))].filter(
    (id) => id !== TEST_KRISHNA_PLAYER_ID
  );
  const players = await Player.find({ _id: { $in: playerIds } });
  const userIds = players.map((p) => p.user).filter((id) => id.toString() !== TEST_KRISHNA_USER_ID);

  let tournamentIds = [];
  if (TOURNAMENT_NAME) {
    const tournaments = await Tournament.find({ name: TOURNAMENT_NAME });
    tournamentIds = tournaments.map((t) => t._id);
  }

  const matchesRes = tournamentIds.length ? await Match.deleteMany({ tournament: { $in: tournamentIds } }) : { deletedCount: 0 };
  const tournamentsRes = tournamentIds.length ? await Tournament.deleteMany({ _id: { $in: tournamentIds } }) : { deletedCount: 0 };
  const teamsRes = await Team.deleteMany({ _id: { $in: teamIds } });
  const playersRes = await Player.deleteMany({ _id: { $in: playerIds } });
  const usersRes = await User.deleteMany({ _id: { $in: userIds } });
  const leaguesRes = League ? await League.deleteMany({ name: LEAGUE_NAME }) : { deletedCount: 0 };

  console.log('Deleted:', {
    matches: matchesRes.deletedCount,
    tournaments: tournamentsRes.deletedCount,
    teams: teamsRes.deletedCount,
    players: playersRes.deletedCount,
    users: usersRes.deletedCount,
    leagues: leaguesRes.deletedCount
  });
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
