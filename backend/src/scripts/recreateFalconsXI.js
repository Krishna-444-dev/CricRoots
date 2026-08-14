// One-off recovery script: recreates the "Falcons XI" team, accidentally deleted by an overly
// broad name-matched cleanup query in runTournamentSimulation.js's smoke-test cleanup step on
// 2026-08-14. The original Team/Player/User documents (and their exact _ids) are unrecoverable
// with no DB backup in place - this reconstructs a same-named team with a roster matching the
// player names visible in this session's own prior context (commentary text, dismissal
// records, scorecards), under fresh IDs. The one match that referenced the original roster's
// IDs (Match 6a7e0aecbb56a9b348f00cb6) keeps its numeric stats intact but will show fallback
// player names for that team's batting/bowling figures going forward - those specific old IDs
// are gone for good.

const bcrypt = require('bcryptjs');
const { connectDB, User, Player, Team } = require('./simulateTournament');

async function main() {
  await connectDB();
  const passwordHash = await bcrypt.hash('RecreatedPlayer123!', 10);
  const names = [
    'Rohan Sharma', 'Arjun Patel', 'Vikram Singh', 'Aditya Kumar', 'Karan Mehta', 'Rahul Verma',
    'Sanjay Gupta', 'Amit Joshi', 'Nikhil Rao', 'Suresh Nair', 'Zaid Ahmed', 'Omar Siddiqui',
    'Ethan Brooks', 'Tariq Aziz', 'Fahad Malik'
  ];
  const specs = [
    'Batsman', 'Batsman', 'Batsman', 'Batsman', 'Batsman', 'Batsman',
    'All-rounder', 'All-rounder', 'Wicket-keeper', 'Wicket-keeper', 'Bowler', 'Bowler', 'Bowler', 'Bowler', 'Bowler'
  ];

  const userDocs = names.map((name, i) => ({
    name,
    email: `restored.${i}.${Date.now()}@cricroots.test`,
    password: passwordHash,
    role: 'player'
  }));
  const users = await User.insertMany(userDocs);

  const playerDocs = users.map((u, i) => ({
    user: u._id,
    specialization: specs[i],
    battingStyle: i % 4 === 0 ? 'Left-hand' : 'Right-hand',
    bowlingStyle: specs[i] === 'Bowler' || specs[i] === 'All-rounder' ? 'Right-arm Fast' : 'None'
  }));
  const players = await Player.insertMany(playerDocs);

  const team = await Team.create({
    name: 'Falcons XI',
    captain: players[0]._id,
    viceCaptain: players[1]._id,
    players: players.map((p) => p._id),
    city: 'Fairview',
    description:
      'Recreated after an accidental deletion during tournament-simulation cleanup (2026-08-14) - ' +
      'original roster/IDs could not be recovered, names reconstructed from session context.'
  });

  console.log('Recreated Falcons XI:', team._id.toString());
  players.forEach((p, i) => console.log(` - ${names[i]}: ${p._id.toString()}`));
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
