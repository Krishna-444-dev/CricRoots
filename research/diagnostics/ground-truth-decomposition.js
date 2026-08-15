// Diagnostic audit of the synthetic ground-truth generating process, requested after Experiment 2
// (research/results/2026-08-15T23-06-42-795Z/) showed the hierarchical method not beating the
// global/single-level baselines. Before touching the algorithm or running another experiment, the
// question this script answers: does the synthetic environment actually contain the hierarchical
// structure (in particular, archetype-level structure) that getMatchupPlan's backoff chain is
// designed to exploit?
//
// Uses the EXACT SAME population as Experiment 2 (populationSeed=1, 176 batters = 16 teams x 11,
// 96 bowlers = 16 teams x 6 - see research/harness/run-experiment.js CONFIG) so this diagnostic
// describes the actual world that was evaluated, not a freshly-drawn one.
//
// Method: trueProbability's logit is an exact sum of independent components (generator.js lines
// 129-140: BASE_RATE_LOGIT + vulnerability + effectiveness + interaction + lineLength + response).
// Rather than reimplementing that formula, this script reads the population's own hidden parameter
// tables directly (the same tables trueProbability reads) and full-enumerates the matchup space
// (176 x 96 x 6 lines x 7 lengths = 709,632 tuples - small enough to enumerate exactly, no Monte
// Carlo sampling error) to compute each component's variance share. A random-subsample self-check
// against the real trueProbability() function confirms the manual decomposition matches it exactly
// before trusting any of the numbers below it.
//
// This script only reads research/synthetic/generator.js's exported functions and population data
// structures, and research/results/.../raw-results.json (already-committed Experiment 2 output).
// It does not modify evaluate.js, metrics.js, baselines.js, or any production code, and produces
// no verdict on the underlying research hypothesis - diagnostic numbers only.

const fs = require('fs');
const path = require('path');
const { generatePopulation, trueProbability, makeRng, LINES, LENGTHS } = require('../synthetic/generator');
const { SAMPLE_SIZE_BINS } = require('../metrics');

const BASE_RATE_LOGIT = Math.log(0.045 / (1 - 0.045));

function mean(sum, n) { return sum / n; }
function variance(sum, sum2, n) { return sum2 / n - (sum / n) ** 2; }

function main() {
  const population = generatePopulation({ numBatters: 176, numBowlers: 96, seed: 1 });

  // ---- Full enumeration of the matchup space --------------------------------------------
  let n = 0;
  const acc = {}; // term -> { sum, sum2 }
  for (const term of ['V', 'E', 'I', 'LL', 'R', 'logitP']) acc[term] = { sum: 0, sum2: 0 };
  let sumP = 0, sumP2 = 0, minP = Infinity, maxP = -Infinity;

  // Exact sparse-table counts come straight from the Map sizes (unambiguous) rather than
  // counting hits during the full enumeration below, which would double-count entries once per
  // extra dimension the enumeration loops over but the table itself doesn't key on.
  const totalPossibleInteractions = population.batters.length * population.bowlers.length;
  const totalPossibleResponses = population.batters.length * LINES.length * LENGTHS.length;
  const nonZeroInteractionCount = population.interactions.size;
  const nonZeroResponseCount = population.batterLineLengthResponse.size;

  const battingStyleGroups = new Map(); // style -> { n, sum, sum2 } of logitP
  const bowlingStyleGroups = new Map();
  const comboGroups = new Map(); // "battingStyle|bowlingStyle" -> { n, sum, sum2 }

  for (const batter of population.batters) {
    for (const bowler of population.bowlers) {
      const I = population.interactions.get(`${batter._id}|${bowler._id}`) || 0;

      for (const line of LINES) {
        for (const length of LENGTHS) {
          const LL = population.lineLengthEffect.get(`${line}|${length}`) || 0;
          const R = population.batterLineLengthResponse.get(`${batter._id}|${line}|${length}`) || 0;

          const V = batter.vulnerability;
          const E = bowler.effectiveness;
          const logitP = BASE_RATE_LOGIT + V + E + I + LL + R;

          n++;
          acc.V.sum += V; acc.V.sum2 += V * V;
          acc.E.sum += E; acc.E.sum2 += E * E;
          acc.I.sum += I; acc.I.sum2 += I * I;
          acc.LL.sum += LL; acc.LL.sum2 += LL * LL;
          acc.R.sum += R; acc.R.sum2 += R * R;
          acc.logitP.sum += logitP; acc.logitP.sum2 += logitP * logitP;
          const p = 1 / (1 + Math.exp(-logitP));
          sumP += p; sumP2 += p * p;
          if (p < minP) minP = p;
          if (p > maxP) maxP = p;

          for (const [g, groupMap] of [[batter.battingStyle, battingStyleGroups], [bowler.bowlingStyle, bowlingStyleGroups]]) {
            if (!groupMap.has(g)) groupMap.set(g, { n: 0, sum: 0, sum2: 0 });
            const rec = groupMap.get(g);
            rec.n++; rec.sum += logitP; rec.sum2 += logitP * logitP;
          }
          const comboKey = `${batter.battingStyle}|${bowler.bowlingStyle}`;
          if (!comboGroups.has(comboKey)) comboGroups.set(comboKey, { n: 0, sum: 0, sum2: 0 });
          const comboRec = comboGroups.get(comboKey);
          comboRec.n++; comboRec.sum += logitP; comboRec.sum2 += logitP * logitP;
        }
      }
    }
  }

  const totalVar = variance(acc.logitP.sum, acc.logitP.sum2, n);
  const componentVariances = {};
  for (const term of ['V', 'E', 'I', 'LL', 'R']) {
    componentVariances[term] = variance(acc[term].sum, acc[term].sum2, n);
  }
  const sumOfComponentVariances = Object.values(componentVariances).reduce((s, v) => s + v, 0);
  const varianceShare = {};
  for (const term of ['V', 'E', 'I', 'LL', 'R']) {
    varianceShare[term] = round(100 * componentVariances[term] / totalVar);
  }

  // ---- Self-check: manual decomposition vs the real trueProbability() -------------------
  // Random subsample (not all 709,632 - trueProbability() does a linear Array.find() per call,
  // O(numBatters) each, so this is kept small) via the project's own deterministic RNG.
  const rng = makeRng(9001);
  let maxAbsLogitDiff = 0;
  let maxAbsProbDiff = 0;
  const SELF_CHECK_SAMPLES = 5000;
  for (let i = 0; i < SELF_CHECK_SAMPLES; i++) {
    const batter = rng.pick(population.batters);
    const bowler = rng.pick(population.bowlers);
    const line = rng.pick(LINES);
    const length = rng.pick(LENGTHS);
    const I = population.interactions.get(`${batter._id}|${bowler._id}`) || 0;
    const LL = population.lineLengthEffect.get(`${line}|${length}`) || 0;
    const R = population.batterLineLengthResponse.get(`${batter._id}|${line}|${length}`) || 0;
    const manualLogitP = BASE_RATE_LOGIT + batter.vulnerability + bowler.effectiveness + I + LL + R;
    const manualP = 1 / (1 + Math.exp(-manualLogitP));
    const realP = trueProbability(population, batter._id, bowler._id, line, length);
    maxAbsProbDiff = Math.max(maxAbsProbDiff, Math.abs(manualP - realP));
  }

  // ---- Archetype (battingStyle / bowlingStyle) one-way ANOVA on logitP ------------------
  function etaSquared(groups, totalSum, totalSum2, totalN) {
    const grandMean = totalSum / totalN;
    const ssTotal = totalSum2 - totalN * grandMean * grandMean;
    let ssBetween = 0;
    for (const rec of groups.values()) {
      const groupMean = rec.sum / rec.n;
      ssBetween += rec.n * (groupMean - grandMean) ** 2;
    }
    return { etaSquaredPct: round(100 * ssBetween / ssTotal), ssBetween: round(ssBetween, 6), ssTotal: round(ssTotal, 6), groups: [...groups.entries()].map(([k, rec]) => ({ group: k, n: rec.n, mean: round(rec.sum / rec.n) })) };
  }
  const battingStyleAnova = etaSquared(battingStyleGroups, acc.logitP.sum, acc.logitP.sum2, n);
  const bowlingStyleAnova = etaSquared(bowlingStyleGroups, acc.logitP.sum, acc.logitP.sum2, n);
  const comboAnova = etaSquared(comboGroups, acc.logitP.sum, acc.logitP.sum2, n);

  // ---- 2-way ANOVA of the line x length effect table (6 lines x 7 lengths = 42 cells) ---
  const cell = (line, length) => population.lineLengthEffect.get(`${line}|${length}`) || 0;
  const allCells = [];
  for (const line of LINES) for (const length of LENGTHS) allCells.push(cell(line, length));
  const grandMeanLL = mean(allCells.reduce((s, x) => s + x, 0), allCells.length);
  const rowMeans = LINES.map((line) => mean(LENGTHS.reduce((s, length) => s + cell(line, length), 0), LENGTHS.length));
  const colMeans = LENGTHS.map((length) => mean(LINES.reduce((s, line) => s + cell(line, length), 0), LINES.length));
  const ssTotalLL = allCells.reduce((s, x) => s + (x - grandMeanLL) ** 2, 0);
  const ssLine = LENGTHS.length * rowMeans.reduce((s, m) => s + (m - grandMeanLL) ** 2, 0);
  const ssLength = LINES.length * colMeans.reduce((s, m) => s + (m - grandMeanLL) ** 2, 0);
  const ssInteractionResidual = ssTotalLL - ssLine - ssLength;
  const lineLengthDecomposition = {
    linePct: round(100 * ssLine / ssTotalLL),
    lengthPct: round(100 * ssLength / ssTotalLL),
    interactionResidualPct: round(100 * ssInteractionResidual / ssTotalLL)
  };

  // ---- k=15 shrinkage weight table (individualN / (individualN + 15)) -------------------
  const K = 15;
  const weightTable = [];
  for (let ind = 0; ind <= 20; ind++) {
    weightTable.push({ n: ind, individualWeight: round(ind / (ind + K)) });
  }

  // ---- Actual exactMatchupN distribution from Experiment 2's raw results, and the ---------
  // resulting checkpoint-weighted average individual weight per sample-efficiency bin.
  const resultsDir = path.join(__dirname, '..', 'results', '2026-08-15T23-06-42-795Z');
  const raw = JSON.parse(fs.readFileSync(path.join(resultsDir, 'raw-results.json'), 'utf8'));
  const globalRows = raw.filter((r) => r.method === 'global'); // exactMatchupN is method-independent, recorded once per checkpoint; 'global' rows give one row per checkpoint
  const binStats = [];
  for (let i = 0; i < SAMPLE_SIZE_BINS.length - 1; i++) {
    const lo = SAMPLE_SIZE_BINS[i];
    const hi = SAMPLE_SIZE_BINS[i + 1];
    const inBin = globalRows.filter((r) => r.exactMatchupN >= lo && r.exactMatchupN < hi);
    const meanN = inBin.length > 0 ? mean(inBin.reduce((s, r) => s + r.exactMatchupN, 0), inBin.length) : null;
    binStats.push({
      range: hi === Infinity ? `${lo}+` : `${lo}-${hi - 1}`,
      checkpointCount: inBin.length,
      meanExactMatchupN: meanN !== null ? round(meanN, 2) : null,
      meanIndividualWeightAtK15: meanN !== null ? round(meanN / (meanN + K)) : null
    });
  }

  // ---- rawExactMatchup coverage: pair-level aggregate n (exactMatchupN, used for binning) --
  // vs specific-(line,length)-bucket-level n (what rawExactMatchup's own prediction requires) -
  // these are different granularities and conflating them overstates how often exact-matchup
  // data is actually available at the bucket level the prediction needs.
  const rawExactRows = raw.filter((r) => r.method === 'rawExactMatchup');
  const rawExactCoverage = {
    totalCheckpoints: rawExactRows.length,
    nonNullPredictions: rawExactRows.filter((r) => r.prediction !== null).length,
    checkpointsWithPairLevelDataButNoBucketMatch: globalRows.filter((r) => r.exactMatchupN > 0).length - rawExactRows.filter((r) => r.prediction !== null).length
  };

  const output = {
    population: { numBatters: population.batters.length, numBowlers: population.bowlers.length, seed: population.seed },
    baseRateLogit: round(BASE_RATE_LOGIT, 6),
    fullEnumerationSampleCount: n,
    trueProbabilityDescriptiveStats: {
      mean: round(mean(sumP, n)),
      std: round(Math.sqrt(variance(sumP, sumP2, n))),
      min: round(minP),
      max: round(maxP)
    },
    selfCheckAgainstRealTrueProbability: { samples: SELF_CHECK_SAMPLES, maxAbsProbabilityDifference: maxAbsProbDiff },
    logitSpaceVarianceDecomposition: {
      totalVariance: round(totalVar, 6),
      sumOfComponentVariances: round(sumOfComponentVariances, 6),
      unexplainedGapPct: round(100 * (totalVar - sumOfComponentVariances) / totalVar),
      componentVariances: Object.fromEntries(Object.entries(componentVariances).map(([k, v]) => [k, round(v, 6)])),
      varianceSharePct: varianceShare
    },
    sparsity: {
      interactionTable: { nonZero: nonZeroInteractionCount, totalPossible: totalPossibleInteractions, fraction: round(nonZeroInteractionCount / totalPossibleInteractions) },
      responseTable: { nonZero: nonZeroResponseCount, totalPossible: totalPossibleResponses, fraction: round(nonZeroResponseCount / totalPossibleResponses) }
    },
    archetypeAnova: {
      battingStyle: battingStyleAnova,
      bowlingStyle: bowlingStyleAnova,
      battingStyleXBowlingStyleCombo: comboAnova
    },
    lineLengthTwoWayAnova: lineLengthDecomposition,
    shrinkageWeightTable: weightTable,
    experiment2ExactMatchupNByBin: binStats,
    rawExactMatchupCoverage: rawExactCoverage
  };

  fs.writeFileSync(path.join(__dirname, 'ground-truth-decomposition-results.json'), JSON.stringify(output, null, 2));
  console.log(JSON.stringify(output, null, 2));
}

function round(x, places = 4) {
  const factor = 10 ** places;
  return Math.round(x * factor) / factor;
}

main();
