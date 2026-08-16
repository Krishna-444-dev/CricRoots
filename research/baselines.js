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
const { blendWithPrior, hierarchicalBlend } = require(path.join(__dirname, '..', 'backend', 'src', 'utils', 'statUtils'));
const { lookupOracleArchetype } = require('./oracles');

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

/** Ablation baseline - isolates whether the two archetype-level rungs specifically are what
 * drag fullHierarchy down (research/diagnostics/experiment-2-diagnostic.md Finding 3's
 * falsifiable explanation). Uses the real, unmodified hierarchicalBlend (the same function
 * getMatchupPlan calls) with just 2 levels - exact matchup, global - instead of getMatchupPlan's
 * 4. Built the same way getMatchupPlan builds its own levels array (tendencyAnalytics.js:162-170:
 * raw 0-100 dismissalRate scale, default k=15, {value, n} per level) so this differs from
 * fullHierarchy in exactly one respect: the two archetype rungs are absent. Not a
 * reimplementation of hierarchicalBlend and not a change to tendencyAnalytics.js/statUtils.js -
 * calls their real exported functions with a different levels array. */
async function fullHierarchyNoArchetype(batsmanId, bowlerId, line, length) {
  const [exact, global] = await Promise.all([
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] }),
    getLineLengthBreakdown({})
  ]);
  const exactBucket = findBucket(exact, line, length);
  const globalBucket = findBucket(global, line, length);
  const levels = [
    { value: exactBucket ? exactBucket.dismissalRate : 0, n: exactBucket ? exactBucket.balls : 0 },
    { value: globalBucket ? globalBucket.dismissalRate : 0, n: globalBucket ? globalBucket.balls : 0 }
  ];
  const blended = hierarchicalBlend(levels);
  return blended.value !== null ? blended.value / 100 : null;
}

/** DIAGNOSTIC ONLY (research/experiment-4-design.md, Experiment 4A) - reads synthetic ground
 * truth via research/oracles.js, so this is an upper bound on what perfect archetype estimation
 * could deliver, never a deployable method. Predicts the exact true archetype-pool probability
 * directly: the perfect version of the archetypeOnly baseline, measuring the ceiling of archetype
 * information alone. Takes the already-built oracle table (built once per experiment, not per
 * checkpoint) plus the same playerLookup archetypeOnly uses. */
async function oracleArchetypeOnly(batsmanId, bowlerId, line, length, playerLookup, oracleTable) {
  const { battingStyle, bowlingStyle } = await playerLookup(batsmanId, bowlerId);
  return lookupOracleArchetype(oracleTable, battingStyle, bowlingStyle, line, length);
}

/** DIAGNOSTIC ONLY (research/experiment-4-design.md, Experiment 4A) - same caveat as above. The
 * real, unmodified hierarchicalBlend with the EMPIRICAL exact-matchup rate on top and the ORACLE
 * archetype probability as the coarsest level, trusted as-is (see experiment-4-design.md for why
 * it isn't blended further into global). Isolates "noisy intermediate estimation" from "sequential
 * blending as such": same k=15 mechanism as every other method, but the level it backs off to is
 * perfect instead of estimated. */
async function oracleInformedHierarchy(batsmanId, bowlerId, line, length, playerLookup, oracleTable) {
  const { battingStyle, bowlingStyle } = await playerLookup(batsmanId, bowlerId);
  const oracleValue = lookupOracleArchetype(oracleTable, battingStyle, bowlingStyle, line, length);
  if (oracleValue === null) return null;
  const exact = await getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] });
  const exactBucket = findBucket(exact, line, length);
  // Oracle value is a probability in [0,1]; hierarchicalBlend's other levels here use the 0-100
  // dismissalRate scale getMatchupPlan feeds it, so the oracle is converted up and the result
  // converted back down - keeping the blend arithmetic identical to production's.
  const levels = [
    { value: exactBucket ? exactBucket.dismissalRate : 0, n: exactBucket ? exactBucket.balls : 0 },
    { value: oracleValue * 100, n: Number.MAX_SAFE_INTEGER }
  ];
  const blended = hierarchicalBlend(levels);
  return blended.value !== null ? blended.value / 100 : null;
}

/** Experiment 7 arm B (research/experiment-7-design.md) - the SAME four-level chain
 * getMatchupPlan builds, through the SAME real hierarchicalBlend, differing in exactly one
 * respect: the archetype pools exclude the target player, so a level's shrinkage target no longer
 * contains the observations being shrunk.
 *
 *   L1 exact                = {b} x {w}                     unchanged
 *   L2 batter-vs-arch(LOO)  = {b} x (arch(w) \ {w})
 *   L3 arch-vs-arch(LOO)    = (arch(b) \ {b}) x (arch(w) \ {w})
 *   L4 global                                               UNCHANGED - contamination there is
 *                                                           ~0.02%, and leaving it alone keeps
 *                                                           arms A and B differing only where
 *                                                           contamination is material.
 *
 * Level construction mirrors tendencyAnalytics.js:160-172 exactly (raw 0-100 dismissalRate scale,
 * {value, n} per level, default k). tendencyAnalytics.js and statUtils.js are untouched. */
async function fullHierarchyLOO(batsmanId, bowlerId, line, length, playerLookup) {
  const { battingStyle, bowlingStyle } = await playerLookup(batsmanId, bowlerId);
  const [bowlerArchIds, batterArchIds] = await Promise.all([
    getPlayerIdsByArchetype({ bowlingStyle }),
    getPlayerIdsByArchetype({ battingStyle })
  ]);
  const bowlerArchLOO = bowlerArchIds.filter((id) => String(id) !== String(bowlerId));
  const batterArchLOO = batterArchIds.filter((id) => String(id) !== String(batsmanId));

  const [exact, bVsArch, archVsArch, global] = await Promise.all([
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] }),
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: bowlerArchLOO }),
    getLineLengthBreakdown({ batsmanIds: batterArchLOO, bowlerIds: bowlerArchLOO }),
    getLineLengthBreakdown({})
  ]);

  const levels = [exact, bVsArch, archVsArch, global].map((source) => {
    const bucket = findBucket(source, line, length);
    return { value: bucket ? bucket.dismissalRate : 0, n: bucket ? bucket.balls : 0 };
  });
  const blended = hierarchicalBlend(levels);
  return blended.value !== null ? blended.value / 100 : null;
}

/** Experiment 7 mechanism diagnostics (research/experiment-7-design.md section 5). Records the
 * bucket-level pool sizes under both arms at one checkpoint, so overlap fractions and achieved
 * shrinkage can be computed afterwards from the committed raw results. Purely observational - no
 * prediction is produced here and nothing feeds back into any method. */
async function nestingDiagnostics(batsmanId, bowlerId, line, length, playerLookup) {
  const { battingStyle, bowlingStyle } = await playerLookup(batsmanId, bowlerId);
  const [bowlerArchIds, batterArchIds] = await Promise.all([
    getPlayerIdsByArchetype({ bowlingStyle }),
    getPlayerIdsByArchetype({ battingStyle })
  ]);
  const bowlerArchLOO = bowlerArchIds.filter((id) => String(id) !== String(bowlerId));
  const batterArchLOO = batterArchIds.filter((id) => String(id) !== String(batsmanId));

  const [exact, bVsArch, bVsArchLOO, archVsArch, archVsArchLOO, global] = await Promise.all([
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: [bowlerId] }),
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: bowlerArchIds }),
    getLineLengthBreakdown({ batsmanIds: [batsmanId], bowlerIds: bowlerArchLOO }),
    getLineLengthBreakdown({ batsmanIds: batterArchIds, bowlerIds: bowlerArchIds }),
    getLineLengthBreakdown({ batsmanIds: batterArchLOO, bowlerIds: bowlerArchLOO }),
    getLineLengthBreakdown({})
  ]);
  const nOf = (bd) => { const b = findBucket(bd, line, length); return b ? b.balls : 0; };
  const rateOf = (bd) => { const b = findBucket(bd, line, length); return b ? b.dismissalRate / 100 : null; };

  return {
    exactBucketN: nOf(exact),
    exactBucketRate: rateOf(exact),
    bVsArchBucketN: nOf(bVsArch),
    bVsArchLOOBucketN: nOf(bVsArchLOO),
    archVsArchBucketN: nOf(archVsArch),
    archVsArchLOOBucketN: nOf(archVsArchLOO),
    globalBucketN: nOf(global)
  };
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
  fullHierarchyNoArchetype,
  fullHierarchyLOO,
  nestingDiagnostics,
  oracleArchetypeOnly,
  oracleInformedHierarchy,
  fullHierarchy,
  fullHierarchyWithLive
};
