// One-off recovery step (see recreateFalconsXI.js) - points the affected match's dangling
// team2 reference at the recreated Falcons XI team so it's a valid team again, and the same
// id for innings[1].team (whose runs/wickets/overs are untouched - only the team identity
// pointer was dangling).
const { connectDB, Match, Team } = require('./simulateTournament');

async function main() {
  await connectDB();
  const team = await Team.findOne({ name: 'Falcons XI' });
  if (!team) throw new Error('Falcons XI not found - run recreateFalconsXI.js first');

  const match = await Match.findById('6a7e0aecbb56a9b348f00cb6');
  if (!match) throw new Error('Match not found');

  match.team2 = team._id;
  match.innings[1].team = team._id;
  await match.save();

  console.log('Relinked match', match._id.toString(), 'team2 ->', team._id.toString());
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
