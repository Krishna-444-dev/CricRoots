// Post-match phase analysis for a completed 2-innings match: Powerplay/Middle/Death run rate
// and wickets for both teams, plus a one-line takeaway when the death overs decided the game.
// Distinct from two other already-existing features this deliberately does NOT duplicate:
//   - The live tactical advisor (backend/src/utils/aiService.js -> ai-engine's get_tactical_summary)
//     needs an in-progress win-probability/current-batsman-bowler state and has no meaning once
//     the match is over.
//   - "Key moments" (backend/src/services/keyMoments.js) already finds the chase's biggest
//     ball-level win-probability swings via the real ML model - a per-over required-run-rate
//     heuristic here would just be a worse version of that. This file only covers the one gap
//     neither of those fills: a phase-level shape-of-the-innings comparison.
// Pure backend arithmetic, no ML - same "stats in backend, not ML, at this data scale"
// convention as matchArticleGenerator.js/matchSummaryGenerator.js/commentaryGenerator.js.
// Reuses matchCharts.js's computeOverBreakdown so this and the Manhattan/Worm charts agree on
// over-by-over runs/wickets rather than re-deriving them differently.
const { computeOverBreakdown } = require('./matchCharts');

// Standard T20 phase split (overs 1-6 / 7-15 / 16-20) scaled proportionally to the match's
// actual totalOvers, so an ODI/Friendly match with a different over count still gets a sensible
// 3-way split instead of hardcoded T20 cutoffs.
function phaseBoundaries(totalOvers) {
  const powerplayEnd = Math.max(1, Math.round(totalOvers * 0.3));
  const middleEnd = Math.max(powerplayEnd + 1, Math.round(totalOvers * 0.75));
  return { powerplayEnd, middleEnd };
}

function summarizePhase(overs, fromOverIdx, toOverIdxExclusive) {
  let runs = 0;
  let wickets = 0;
  let overCount = 0;
  for (let i = fromOverIdx; i < toOverIdxExclusive; i++) {
    const o = overs[i];
    if (!o) continue;
    runs += o.runs;
    wickets += o.wickets;
    overCount += 1;
  }
  return { runs, wickets, overs: overCount, runRate: overCount > 0 ? +(runs / overCount).toFixed(2) : 0 };
}

function phasesFor(overs, powerplayEnd, middleEnd) {
  return {
    powerplay: summarizePhase(overs, 0, powerplayEnd),
    middle: summarizePhase(overs, powerplayEnd, middleEnd),
    death: summarizePhase(overs, middleEnd, overs.length)
  };
}

function deathOversTakeaway(team1Name, team2Name, inningsPhases) {
  const death1 = inningsPhases[0].phases.death;
  const death2 = inningsPhases[1].phases.death;
  if (death1.overs === 0 || death2.overs === 0) return null;
  const diff = death2.runRate - death1.runRate;
  if (Math.abs(diff) < 1.5) return null;
  const better = diff > 0 ? team2Name : team1Name;
  const betterRate = diff > 0 ? death2.runRate : death1.runRate;
  const worseRate = diff > 0 ? death1.runRate : death2.runRate;
  return `${better} won the death overs, going at ${betterRate.toFixed(1)} runs an over in the closing stretch against ${worseRate.toFixed(1)}.`;
}

/**
 * @param {object} match - a completed Match document, populated with team1/team2 (name)
 * @returns {object|null} { phases: [{teamId, teamName, phases}, ...], takeaway: string|null }
 *   or null if there isn't a full 2-innings match to compare (Cancelled/abandoned matches, or
 *   a single-innings edge case).
 */
function generatePostMatchTacticalReport(match) {
  if (!match.innings || match.innings.length < 2) return null;
  const [inn1, inn2] = match.innings;
  if (!inn1?.balls?.length || !inn2?.balls?.length) return null;

  const totalOvers = match.totalOvers || 20;
  const { powerplayEnd, middleEnd } = phaseBoundaries(totalOvers);

  const overs1 = computeOverBreakdown(inn1.balls);
  const overs2 = computeOverBreakdown(inn2.balls);

  const team1Id = match.team1?._id?.toString();
  const team2Id = match.team2?._id?.toString();
  const team1Name = match.team1?.name || 'Team 1';
  const team2Name = match.team2?.name || 'Team 2';

  const inn1TeamId = inn1.team?.toString();
  const inn1TeamName = inn1TeamId === team1Id ? team1Name : inn1TeamId === team2Id ? team2Name : 'Team 1';
  const inn2TeamId = inn2.team?.toString();
  const inn2TeamName = inn2TeamId === team1Id ? team1Name : inn2TeamId === team2Id ? team2Name : 'Team 2';

  const inningsPhases = [
    { teamId: inn1TeamId, teamName: inn1TeamName, phases: phasesFor(overs1, powerplayEnd, middleEnd) },
    { teamId: inn2TeamId, teamName: inn2TeamName, phases: phasesFor(overs2, powerplayEnd, middleEnd) }
  ];

  return {
    phases: inningsPhases,
    takeaway: deathOversTakeaway(inn1TeamName, inn2TeamName, inningsPhases)
  };
}

module.exports = { generatePostMatchTacticalReport, phaseBoundaries, phasesFor };
