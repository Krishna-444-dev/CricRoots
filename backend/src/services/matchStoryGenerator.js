// Generates a multi-paragraph narrative recap of a completed match - a proper "story", not the
// 2-3 sentence blurb matchSummaryGenerator.js writes for the Info tab card. Shown in its own
// "Match Story" tab (see web-app/app/match/[id]/page.tsx and MatchDetailScreen.tsx). Same
// template/phrase-bank convention as every other "AI" text-generation feature in this codebase
// (commentaryGenerator.js, matchArticleGenerator.js, matchSummaryGenerator.js) - no LLM call, no
// external dependency, everything computed from already-recorded ball data so it stays fast and
// synchronous inside matchController.updateMatch's completion flow. Deliberately does NOT call
// keyMoments.js's win-probability model (that's a real network round-trip to the AI engine,
// batched per over - fine for an on-demand tab load, too slow to award-wait on every match
// completion) - the "how it swung" narrative here comes from phase run rates and partnerships
// instead, which are pure local arithmetic.
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');
const { computeMatchPerformances, resultSentence } = require('./matchArticleGenerator');
const { computePartnerships, computeOverBreakdown } = require('./matchCharts');
const { phaseBoundaries, phasesFor } = require('./postMatchTacticalReport');

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function biggestPartnership(balls) {
  const partnerships = computePartnerships(balls);
  if (partnerships.length === 0) return null;
  return partnerships.reduce((a, b) => (b.runs > a.runs ? b : a));
}

// computeMatchPerformances aggregates across the WHOLE match, not per innings - a naive
// perf.entries() sort would happily surface a player from the other team's innings as a "top
// scorer" for this one. Every batting/bowling pick here is filtered to just the ids that
// actually appear as batsmanId/bowlerId on this specific innings' balls.
function idsInInnings(balls, field) {
  return new Set(balls.map((b) => b[field]?.toString()).filter(Boolean));
}

function topBatting(perf, allowedIds, count) {
  return [...perf.entries()]
    .filter(([id]) => allowedIds.has(id))
    .filter(([, p]) => p.balls > 0)
    .sort((a, b) => b[1].runs - a[1].runs)
    .slice(0, count);
}

function topBowling(perf, allowedIds, count) {
  return [...perf.entries()]
    .filter(([id]) => allowedIds.has(id))
    .filter(([, p]) => p.wickets > 0)
    .sort((a, b) => b[1].wickets - a[1].wickets || a[1].bowlingRuns - b[1].bowlingRuns)
    .slice(0, count);
}

function powerplayPhrase(pp, teamName) {
  if (pp.overs === 0) return null;
  if (pp.wickets >= 3) {
    return pick([
      `${teamName} were rocked early, slipping to ${pp.runs}/${pp.wickets} inside the powerplay.`,
      `It was a torrid start for ${teamName}, who lost ${pp.wickets} wickets in the powerplay for just ${pp.runs} runs.`
    ]);
  }
  if (pp.runRate >= 9) {
    return pick([
      `${teamName} exploded out of the blocks, racing to ${pp.runs}/${pp.wickets} inside the powerplay.`,
      `The powerplay belonged to ${teamName}, who cashed in for ${pp.runs}/${pp.wickets} at better than a run a ball.`
    ]);
  }
  return pick([
    `${teamName} took a watchful approach through the powerplay, reaching ${pp.runs}/${pp.wickets}.`,
    `${teamName} settled in steadily, moving to ${pp.runs}/${pp.wickets} inside the first six overs.`
  ]);
}

function deathOversPhrase(death, teamName) {
  if (death.overs === 0) return null;
  if (death.runRate >= 10) {
    return pick([
      `${teamName} finished with a flourish, plundering ${death.runs} in the death overs alone.`,
      `The closing overs were carnage for the bowlers, as ${teamName} piled on ${death.runs} runs at the death.`
    ]);
  }
  if (death.wickets >= 2) {
    return pick([
      `${teamName} lost their way at the death, shedding ${death.wickets} wickets in the closing overs.`,
      `A late wobble saw ${teamName} lose ${death.wickets} wickets in the final overs, checking their momentum.`
    ]);
  }
  return pick([
    `${teamName} closed things out steadily, adding ${death.runs} in the last few overs.`
  ]);
}

async function resolveNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const players = await Player.find({ _id: { $in: unique } }).populate('user', 'name');
  const map = new Map();
  for (const p of players) map.set(p._id.toString(), p.user?.name || 'A player');
  return map;
}

function inningsTeamName(innings, team1Id, team2Id, team1Name, team2Name) {
  const teamId = innings.team?.toString();
  return teamId === team1Id ? team1Name : teamId === team2Id ? team2Name : 'The batting side';
}

/**
 * @param {object} match - a completed Match document, populated with team1/team2 (name) and,
 *   ideally, toss.winningTeam and manOfTheMatch (already populated by the time
 *   matchController.updateMatch reaches its post-completion hooks).
 * @returns {Promise<string[]>} an array of paragraphs, or [] if there's nothing recorded to
 *   tell a story about yet.
 */
async function generateMatchStory(match) {
  const [inn1, inn2] = match.innings || [];
  if (!inn1?.balls?.length) return [];

  const team1Name = match.team1?.name || 'Team 1';
  const team2Name = match.team2?.name || 'Team 2';
  const team1Id = match.team1?._id?.toString();
  const team2Id = match.team2?._id?.toString();

  const perf = computeMatchPerformances(match);
  const totalOvers = match.totalOvers || 20;
  const { powerplayEnd, middleEnd } = phaseBoundaries(totalOvers);

  const paragraphs = [];

  // --- Opening: venue, context, toss ---
  let tournamentName = null;
  if (match.tournament) {
    const tournamentId = typeof match.tournament === 'object' ? match.tournament._id : match.tournament;
    const t = await Tournament.findById(tournamentId).select('name').lean();
    tournamentName = t?.name || null;
  }
  const contextPhrase = tournamentName
    ? (match.division ? ` in the ${match.division} division of ${tournamentName}` : ` in ${tournamentName}`)
    : '';
  let tossSentence = '';
  if (match.toss?.winningTeam && match.toss?.decision) {
    const tossTeamName = match.toss.winningTeam.name
      || (match.toss.winningTeam.toString() === team1Id ? team1Name : team2Name);
    tossSentence = ` ${tossTeamName} won the toss and chose to ${match.toss.decision === 'bat' ? 'bat' : 'field'} first.`;
  }
  paragraphs.push(`${team1Name} took on ${team2Name} at ${match.venue}${contextPhrase}.${tossSentence}`);

  // --- First innings ---
  const overs1 = computeOverBreakdown(inn1.balls);
  const phases1 = phasesFor(overs1, powerplayEnd, middleEnd);
  const inn1Team = inningsTeamName(inn1, team1Id, team2Id, team1Name, team2Name);

  const inn1BatsmanIds = idsInInnings(inn1.balls, 'batsmanId');
  const inn1Sentences = [];
  const pp1 = powerplayPhrase(phases1.powerplay, inn1Team);
  if (pp1) inn1Sentences.push(pp1);
  const partnership1 = biggestPartnership(inn1.balls);
  const death1 = deathOversPhrase(phases1.death, inn1Team);

  const namesToResolve1 = [
    ...(partnership1?.batsmen || []),
    ...topBatting(perf, inn1BatsmanIds, 3).map(([id]) => id)
  ];
  const nameMap1 = await resolveNames(namesToResolve1);

  if (partnership1 && partnership1.batsmen.length === 2 && partnership1.runs >= 30) {
    const [a, b] = partnership1.batsmen.map((id) => nameMap1.get(id) || 'A batter');
    inn1Sentences.push(pick([
      `${a} and ${b} put on ${partnership1.runs} together, the platform the innings was built on.`,
      `A key stand of ${partnership1.runs} between ${a} and ${b} gave ${inn1Team} something to build from.`
    ]));
  }
  const topScorers1 = topBatting(perf, inn1BatsmanIds, 2);
  if (topScorers1.length > 0) {
    const scorerText = topScorers1
      .map(([id, p]) => `${nameMap1.get(id) || 'A batter'} (${p.runs} off ${p.balls})`)
      .join(' and ');
    inn1Sentences.push(`${scorerText} led the way with the bat.`);
  }
  if (death1) inn1Sentences.push(death1);
  inn1Sentences.push(`${inn1Team} finished on ${inn1.runs}/${inn1.wickets} from their ${totalOvers > 0 && inn1.overs ? inn1.overs : totalOvers} overs.`);
  paragraphs.push(inn1Sentences.join(' '));

  // --- Second innings (the chase, if it happened) ---
  if (inn2?.balls?.length) {
    const overs2 = computeOverBreakdown(inn2.balls);
    const phases2 = phasesFor(overs2, powerplayEnd, middleEnd);
    const inn2Team = inningsTeamName(inn2, team1Id, team2Id, team1Name, team2Name);
    const target = inn1.runs + 1;

    const inn2Sentences = [
      `Chasing ${target} to win, ${inn2Team} knew exactly what was needed.`
    ];
    const pp2 = powerplayPhrase(phases2.powerplay, inn2Team);
    if (pp2) inn2Sentences.push(pp2);

    const inn2BowlerIds = idsInInnings(inn2.balls, 'bowlerId');
    const topBowlers2 = topBowling(perf, inn2BowlerIds, 2);
    const partnership2 = biggestPartnership(inn2.balls);
    const namesToResolve2 = [
      ...topBowlers2.map(([id]) => id),
      ...(partnership2?.batsmen || [])
    ];
    const nameMap2 = await resolveNames(namesToResolve2);

    if (topBowlers2.length > 0) {
      const bowlerText = topBowlers2
        .map(([id, p]) => `${nameMap2.get(id) || 'A bowler'} (${p.wickets}/${p.bowlingRuns})`)
        .join(' and ');
      inn2Sentences.push(pick([
        `${bowlerText} kept the pressure on with the ball.`,
        `${inn1Team} leaned on ${bowlerText} to stay in the fight.`
      ]));
    }
    if (partnership2 && partnership2.batsmen.length === 2 && partnership2.runs >= 30) {
      const [a, b] = partnership2.batsmen.map((id) => nameMap2.get(id) || 'A batter');
      inn2Sentences.push(`${a} and ${b} steadied things with a stand of ${partnership2.runs}.`);
    }
    const death2 = deathOversPhrase(phases2.death, inn2Team);
    if (death2) inn2Sentences.push(death2);

    const won = match.result?.winningTeam?.toString() === (inn2Team === team1Name ? team1Id : team2Id);
    const finishPhrase = match.result
      ? (won
        ? pick([`It was enough - ${inn2Team} got over the line.`, `${inn2Team} held their nerve to complete the chase.`])
        : pick([`It wasn't quite enough - the chase fell short.`, `${inn2Team} came up just short in the end.`]))
      : '';
    inn2Sentences.push(`${inn2Team} closed on ${inn2.runs}/${inn2.wickets} from their ${inn2.overs || totalOvers} overs.${finishPhrase ? ' ' + finishPhrase : ''}`);
    paragraphs.push(inn2Sentences.join(' '));
  }

  // --- Closing: result + Man of the Match ---
  const winningTeamId = match.result?.winningTeam ? match.result.winningTeam.toString() : null;
  const winningTeamName = winningTeamId === team1Id ? team1Name : winningTeamId === team2Id ? team2Name : null;
  const losingTeamName = winningTeamId === team1Id ? team2Name : winningTeamId === team2Id ? team1Name : null;
  const closingSentences = [];
  if (winningTeamName) {
    closingSentences.push(resultSentence(match, winningTeamName, losingTeamName));
  }
  const motmName = match.manOfTheMatch?.user?.name;
  if (motmName) {
    closingSentences.push(pick([
      `${motmName} was named Man of the Match for their contribution to the win.`,
      `${motmName} walked away with the Man of the Match award.`
    ]));
  }
  if (closingSentences.length > 0) paragraphs.push(closingSentences.join(' '));

  return paragraphs;
}

module.exports = { generateMatchStory };
