// DIAGNOSTIC INSTRUMENTS ONLY - see research/experiment-4-design.md.
//
// Everything in this file reads the synthetic world's HIDDEN ground-truth parameters, which no
// real-data method could ever access. These exist to answer "if the intermediate level's estimate
// were perfect, would the architecture recover the signal?" - a question about the architecture,
// not a method anyone could deploy. Nothing here may be exported into the product or reported as
// a method that "works": every number it produces is an UPPER BOUND on what perfect intermediate
// estimation could deliver, not an achievable result.
//
// Track A only, by definition - a real dataset has no oracle.
const { trueProbability, LINES, LENGTHS } = require('./synthetic/generator');

/**
 * The exact conditional mean true probability for every
 * (battingStyle, bowlingStyle, line, length) combination: averaged over EVERY batter sharing that
 * battingStyle and EVERY bowler sharing that bowlingStyle in the population, by full enumeration -
 * no sampling error, no estimation. This is the perfect version of what the archetype-vs-archetype
 * rung of getMatchupPlan estimates empirically from observed balls.
 *
 * Deliberately mirrors the real getPlayerIdsByArchetype's pooling definition (every player in the
 * population sharing the style, not just those on the current teams) so the oracle answers the
 * same question the empirical rung is trying to answer, only perfectly.
 */
function buildOracleArchetypeTable(population) {
  const battersByStyle = new Map();
  for (const b of population.batters) {
    if (!battersByStyle.has(b.battingStyle)) battersByStyle.set(b.battingStyle, []);
    battersByStyle.get(b.battingStyle).push(b);
  }
  const bowlersByStyle = new Map();
  for (const w of population.bowlers) {
    if (!bowlersByStyle.has(w.bowlingStyle)) bowlersByStyle.set(w.bowlingStyle, []);
    bowlersByStyle.get(w.bowlingStyle).push(w);
  }

  const table = new Map(); // `${battingStyle}|${bowlingStyle}|${line}|${length}` -> mean true probability
  for (const [battingStyle, batters] of battersByStyle.entries()) {
    for (const [bowlingStyle, bowlers] of bowlersByStyle.entries()) {
      for (const line of LINES) {
        for (const length of LENGTHS) {
          let sum = 0;
          for (const b of batters) {
            for (const w of bowlers) {
              sum += trueProbability(population, b._id, w._id, line, length);
            }
          }
          table.set(`${battingStyle}|${bowlingStyle}|${line}|${length}`, sum / (batters.length * bowlers.length));
        }
      }
    }
  }
  return table;
}

function lookupOracleArchetype(table, battingStyle, bowlingStyle, line, length) {
  const value = table.get(`${battingStyle}|${bowlingStyle}|${line}|${length}`);
  return value === undefined ? null : value;
}

module.exports = { buildOracleArchetypeTable, lookupOracleArchetype };
