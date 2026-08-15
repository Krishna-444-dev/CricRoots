// Shared match-playing helpers used by both runTournamentSimulation.js (flat/grouped
// tournaments) and runDivisionedTournament.js (tournaments with divisions) - factored out so
// both scripts run the exact same, already-verified simulate-and-complete logic rather than
// two copies that could quietly drift apart.
const { call, TEST_KRISHNA_USER_ID, Match, matchController } = require('./simulateTournament');
const { simulateInnings, breakTieIfNeeded } = require('./matchSimulator');

const TOTAL_OVERS = 20;

function idOf(refOrDoc) {
  return (refOrDoc && refOrDoc._id ? refOrDoc._id : refOrDoc).toString();
}

async function playMatch(match, rosterByTeam) {
  // match.team1/team2 arrive populated (every controller response populates them), not as raw
  // ObjectIds - .toString() on a populated Mongoose doc doesn't give back the hex id.
  const team1Id = idOf(match.team1);
  const team2Id = idOf(match.team2);
  const roster1 = rosterByTeam.get(team1Id);
  const roster2 = rosterByTeam.get(team2Id);

  // Coin flip for who bats first, like a real toss.
  const team1BatsFirst = Math.random() < 0.5;
  const battingFirst = team1BatsFirst ? roster1 : roster2;
  const battingSecond = team1BatsFirst ? roster2 : roster1;
  const bowlingFirst = team1BatsFirst ? roster2 : roster1;
  const bowlingSecond = team1BatsFirst ? roster1 : roster2;

  const inn1 = simulateInnings({ battingRoster: battingFirst, bowlingRoster: bowlingFirst, totalOvers: TOTAL_OVERS });
  const inn2 = simulateInnings({
    battingRoster: battingSecond,
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

module.exports = { idOf, playMatch, playAllMatches, TOTAL_OVERS };
