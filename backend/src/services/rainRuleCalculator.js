/**
 * Approximate rain-rule (Duckworth-Lewis-Stern-style) target revision for interrupted
 * limited-overs matches.
 *
 * IMPORTANT - read before touching this file or presenting its output to users:
 *
 * This is NOT the official ICC-sanctioned Duckworth-Lewis-Stern (DLS) algorithm. The real
 * DLS resource-percentage tables are commercially confidential, licensed by the ECB, and
 * have never been publicly disclosed - not even in Duckworth & Lewis's original 1998
 * academic paper, which described the exponential-decay MODEL STRUCTURE but explicitly
 * withheld the fitted parameters "due to commercial confidentiality." There is no way to
 * legitimately reproduce the official numbers without an ECB license.
 *
 * What this module uses instead: the RESOURCE_PARAMS table below is an independently
 * reverse-engineered approximation, fitted by curve-matching publicly available DLS output
 * tables (source: https://www.flyingcoloursmaths.co.uk/red-rag-duckworth-lewis-stern/,
 * accessed 2026-08-13). It follows the same published exponential-decay structure
 * Z(u,w) = Z0(w) * (1 - e^(-b(w)*u)) and produces results in the right ballpark (sanity
 * checked: a team reducing from 50 to 40 overs with 0 wickets down, chasing 250, gets a
 * revised target of 224 here - meaningfully above the naive pro-rata 200, matching the
 * well-known real-world direction of DLS adjustments), but it is an approximation, not the
 * licensed calculation. Any UI surfacing this MUST label it clearly as an estimate, not an
 * official/binding result - see the "approximate" wording already threaded through
 * matchController.js's applyInterruption handler and the frontend components using it.
 *
 * Scope: this module only handles the single most common club-cricket scenario - the
 * chasing team's (innings index 1) overs get reduced, assuming the first innings was
 * completed at its full original allocation. It does not attempt multi-interruption chains
 * or a reduced first innings - those are real DLS scenarios this deliberately doesn't cover.
 */

// w = wickets lost (0-9). Z0 = asymptotic average total score with unlimited overs at that
// wicket count. b = exponential decay constant. See file header for provenance.
const RESOURCE_PARAMS = [
  { w: 0, z0: 134.1022939, b: 0.027393558 },
  { w: 1, z0: 118.5253606, b: 0.030996527 },
  { w: 2, z0: 101.9143572, b: 0.036038757 },
  { w: 3, z0: 84.45285677, b: 0.043504654 },
  { w: 4, z0: 66.99557009, b: 0.054869035 },
  { w: 5, z0: 50.28100499, b: 0.073076761 },
  { w: 6, z0: 35.11610741, b: 0.104616858 },
  { w: 7, z0: 21.98992361, b: 0.167213062 },
  { w: 8, z0: 11.90743731, b: 0.309870559 },
  { w: 9, z0: 4.700112328, b: 0.763221136 }
];

/**
 * "Runs still gettable" resource, per the D/L exponential model, for a given overs
 * remaining and wickets already lost.
 */
function resourceRemaining(oversRemaining, wicketsLost) {
  const w = Math.max(0, Math.min(9, Math.floor(wicketsLost)));
  if (wicketsLost >= 10 || oversRemaining <= 0) return 0;
  const { z0, b } = RESOURCE_PARAMS[w];
  return z0 * (1 - Math.exp(-b * oversRemaining));
}

/**
 * Resources available as a percentage of a full, uninterrupted innings at this match's own
 * total-overs format (not hardcoded to the traditional 50-over reference - club cricket
 * runs many different over counts, and the percentage has to be normalized against
 * whatever this specific match's original allocation was).
 */
function resourcePercent(oversRemaining, wicketsLost, matchTotalOvers) {
  const full = resourceRemaining(matchTotalOvers, 0);
  if (full <= 0) return 0;
  const actual = resourceRemaining(oversRemaining, wicketsLost);
  return (actual / full) * 100;
}

/**
 * Revised par score and target for the team batting second, given the resources each side
 * had available. team1ResourcesPercent is 100 in the standard scoped case (team 1 completed
 * their full original allocation without interruption).
 */
function revisedTarget(team1Score, team1ResourcesPercent, team2ResourcesPercent) {
  if (team2ResourcesPercent >= team1ResourcesPercent) {
    // Team 2 has equal or more resources than team 1 had - no reduction below team 1's
    // actual total in this simplified single-interruption scope.
    return { parScore: team1Score, target: team1Score + 1 };
  }
  const parScore = team1Score * (team2ResourcesPercent / team1ResourcesPercent);
  return {
    parScore: Math.round(parScore * 100) / 100,
    target: Math.floor(parScore) + 1
  };
}

module.exports = { resourceRemaining, resourcePercent, revisedTarget, RESOURCE_PARAMS };
