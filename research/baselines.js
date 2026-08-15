// Every baseline computed from the exact same underlying queries getMatchupPlan itself uses
// (getLineLengthBreakdown, getPlayerIdsByArchetype - both already exported from
// tendencyAnalytics.js, zero changes to production code) - so every baseline and the proposed
// method see identical available data at prediction time. This is what makes the comparison
// fair: a baseline that saw less data than the proposed method would lose for a reason that has
// nothing to do with the actual hypothesis being tested.
const path = require('path');
const {
  getLineLengthBreakdown,
  getPlayerIdsByArchetype,
  getMatchupPlan,
  getLiveMatchupPlan
} = require(path.join(__dirname, '..', 'backend', 'src', 'services', 'tendencyAnalytics'));
const { blendWithPrior } = require(path.join(__dirname, '..', 'backend', 'src', 'utils', 'statUtils'));

function findBucket(breakdown, line, length) {
  return breakdown.buckets.find((b) => b.line === line && b.length === length) || null;
}

/** Baseline A - global rate. No player identity at all; always available once any tagged data exists. */
async function globalRate(batsmanId, bowlerId, line, length) {
  const global = await getLineLengthBreakdown({});
  const bucket = findBucket(global, line, length);
  return bucket ? bucket.dismissalRate / 100 : null; // dismissalRate is a 0-100 percentage; predictions are probabilities in [0,1]
}

/** Baseline B - raw exact-matchup rate. No shrinkage at all - the naive estimate the whole
 * method exists to improve on. Returns null when there's no data for this exact pair/bucket,
 * which is the common case at grassroots scale and an honest limitation of this baseline, not
 * something to paper over with an arbitrary default. */
async function rawExactMatchup(batsmanId, bowlerId, line, length) {
  const exact = await getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] });
  const bucket = findBucket(exact, line, length);
  return bucket ? bucket.dismissalRate / 100 : null;
}

/** Baseline C - single-level shrinkage: the exact-matchup rate blended directly against the
 * global rate, with no archetype level in between. This is what existed before the hierarchical
 * chain was built (see documentation/hierarchical-matchup-shrinkage-research.md) - the real
 * "what did the archetype levels actually add" comparison, not a strawman. */
async function singleLevelShrinkage(batsmanId, bowlerId, line, length) {
  const [exact, global] = await Promise.all([
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] }),
    getLineLengthBreakdown({})
  ]);
  const exactBucket = findBucket(exact, line, length);
  const globalBucket = findBucket(global, line, length);
  if (!globalBucket) return null;
  const result = blendWithPrior(
    exactBucket ? exactBucket.dismissalRate / 100 : 0, exactBucket ? exactBucket.balls : 0,
    globalBucket.dismissalRate / 100, globalBucket.balls
  );
  return result.value;
}

/** Baseline D - archetype-only: skip the exact-matchup and batter-vs-bowler-archetype levels
 * entirely, use the raw (unshrunk) archetype-vs-archetype rate. Represents "just pool by a
 * coarser population, no per-player identity, no further statistical care." */
async function archetypeOnly(batsmanId, bowlerId, line, length, playerLookup) {
  const { battingStyle, bowlingStyle } = await playerLookup(batsmanId, bowlerId);
  const [batterArchetypeIds, bowlerArchetypeIds] = await Promise.all([
    getPlayerIdsByArchetype({ battingStyle }),
    getPlayerIdsByArchetype({ bowlingStyle })
  ]);
  const archetype = await getLineLengthBreakdown({ batsmanIds: batterArchetypeIds, bowlerIds: bowlerArchetypeIds });
  const bucket = findBucket(archetype, line, length);
  return bucket ? bucket.dismissalRate / 100 : null;
}

/** Proposed method - the real, unmodified getMatchupPlan. */
async function fullHierarchy(batsmanId, bowlerId, line, length) {
  const plan = await getMatchupPlan(batsmanId, bowlerId);
  if (!plan) return null;
  const bucket = plan.buckets.find((b) => b.line === line && b.length === length);
  return bucket && bucket.blendedDismissalRate !== null ? bucket.blendedDismissalRate / 100 : null;
}

/** Proposed method + live adjustment - the real, unmodified getLiveMatchupPlan. Requires a
 * matchId (the "current" match providing live evidence) - the evaluation harness supplies this
 * per-checkpoint, since "live" is only meaningful mid-match. */
async function fullHierarchyWithLive(matchId, batsmanId, bowlerId, line, length) {
  const plan = await getLiveMatchupPlan(matchId, batsmanId, bowlerId);
  if (!plan) return null;
  const bucket = plan.buckets.find((b) => b.line === line && b.length === length);
  return bucket && bucket.todayAdjustedRate !== null ? bucket.todayAdjustedRate / 100 : null;
}

module.exports = {
  globalRate,
  rawExactMatchup,
  singleLevelShrinkage,
  archetypeOnly,
  fullHierarchy,
  fullHierarchyWithLive
};
