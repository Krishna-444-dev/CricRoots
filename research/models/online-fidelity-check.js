// Verifies the claim Experiment 5's online procedure rests on: that a bounded number of warm-start
// Adam iterations after each revealed ball tracks what a full cold refit on the same data would have
// produced - and picks the per-ball budget on that basis, never on downstream experimental results.
//
// This matters because if warm-start updates were a poor approximation, jointRegularizedLogitOnline
// would be measuring the optimizer's laziness rather than the model's ability to learn from
// within-match evidence - and the two failure modes look identical in the headline numbers. Per
// research/experiment-5-design.md this check runs BEFORE the main experiment, and its result is
// reported alongside the experiment whatever it shows.
//
// Runs directly: `NODE_PATH=<backend>/node_modules node research/models/online-fidelity-check.js`
const { generatePopulation, generateLeagueMatches } = require('../synthetic/generator');
const { fitWithCrossValidatedLambda, buildDesign, fit, makePredictor, createOnlineModel } = require('./regularizedHierarchicalLogit');

const NUM_TEAMS = 16, BATTERS_PER_TEAM = 11, BOWLERS_PER_TEAM = 6, ROUNDS = 2, BALLS_PER_INNINGS = 35;

function toRows(matches, population) {
  const batterById = new Map(population.batters.map((b) => [b._id, b]));
  const bowlerById = new Map(population.bowlers.map((w) => [w._id, w]));
  const rows = [];
  for (const match of matches) {
    for (const inn of match.innings) {
      for (const ball of inn.balls) {
        rows.push({
          batterId: ball.batsmanId,
          bowlerId: ball.bowlerId,
          battingStyle: batterById.get(ball.batsmanId).battingStyle,
          bowlingStyle: bowlerById.get(ball.bowlerId).bowlingStyle,
          line: ball.line,
          length: ball.length,
          isWicket: ball.isWicket
        });
      }
    }
  }
  return rows;
}

function main() {
  const population = generatePopulation({
    numBatters: NUM_TEAMS * BATTERS_PER_TEAM, numBowlers: NUM_TEAMS * BOWLERS_PER_TEAM, seed: 1
  });
  const { matches } = generateLeagueMatches({
    population, numTeams: NUM_TEAMS, battersPerTeam: BATTERS_PER_TEAM,
    bowlersPerTeam: BOWLERS_PER_TEAM, rounds: ROUNDS, ballsPerInnings: BALLS_PER_INNINGS, seed: 2
  });

  // Same 85/15 proportion the harness uses; the exact split doesn't matter here since this checks
  // optimizer behavior, not predictive performance.
  const numTest = Math.round(matches.length * 0.15);
  const trainMatches = matches.slice(0, matches.length - numTest);
  const oneTestMatch = matches[matches.length - numTest];

  const trainRows = toRows(trainMatches, population);
  const liveRows = toRows([oneTestMatch], population);
  console.log(`Training rows: ${trainRows.length}. Simulating one test match of ${liveRows.length} balls.\n`);

  console.log('Fitting base model (training rows only, CV over training rows only)...');
  const base = fitWithCrossValidatedLambda(trainRows);
  console.log(`  chosen lambda ${base.chosenLambda} (interaction penalty ${base.chosenLambdaInteraction})\n`);

  console.log(`  base fit converged in ${base.finalFitIterations} iterations (hit cap: ${base.hitIterationCap})\n`);

  // Several candidate per-ball budgets, all compared against the SAME converged cold refit, so
  // the budget is chosen on fidelity to a true refit - never on downstream experimental results.
  const BUDGETS = [50, 100, 200];
  const online = new Map(BUDGETS.map((budget) => [budget, createOnlineModel({
    baseParams: base.params,
    baseDesign: base.design,
    baseEncoded: base.design.encoded,
    lambda: base.chosenLambda,
    lambdaInteraction: base.chosenLambdaInteraction,
    onlineIterations: budget
  })]));

  // Checkpoints at which to compare against a full cold refit. Spread across the match so both
  // "barely any live evidence" and "most of the match revealed" are covered.
  const checkAt = new Set([1, 5, 10, 20, 35, 50, liveRows.length - 1].filter((i) => i > 0 && i < liveRows.length));
  const diffs = [];

  for (let i = 0; i < liveRows.length; i++) {
    if (checkAt.has(i)) {
      // Cold refit from scratch on exactly the data the online model has absorbed so far:
      // training rows + revealed balls 0..i-1. Full iteration budget, no warm start.
      const soFar = trainRows.concat(liveRows.slice(0, i));
      const design = buildDesign(soFar);
      const sizes = {
        batter: design.batterIdx.size, bowler: design.bowlerIdx.size,
        arch: design.archIdx.size, ll: design.llIdx.size, pair: design.pairIdx.size
      };
      const coldParams = fit(design.encoded, sizes, {
        lambda: base.chosenLambda, lambdaInteraction: base.chosenLambdaInteraction,
        maxIterations: 8000, tolerance: 1e-8, learningRate: 0.05
      });
      const coldPredict = makePredictor(coldParams, design);

      // Compare on the upcoming ball plus a sample of other rows, so the comparison isn't
      // dominated by one arbitrary matchup.
      const probes = [liveRows[i], ...liveRows.slice(0, Math.min(i, 20))];
      const perBudget = {};
      for (const budget of BUDGETS) {
        let maxAbs = 0, sumAbs = 0;
        for (const probe of probes) {
          const d = Math.abs(online.get(budget).predict(probe) - coldPredict(probe));
          maxAbs = Math.max(maxAbs, d);
          sumAbs += d;
        }
        perBudget[budget] = { meanAbs: sumAbs / probes.length, maxAbs };
      }
      diffs.push({ revealedBalls: i, probes: probes.length, perBudget, coldIterations: coldParams.iterationsRun });
      const summary = BUDGETS.map((b) => `${b}: mean ${perBudget[b].meanAbs.toExponential(2)} max ${perBudget[b].maxAbs.toExponential(2)}`).join('  |  ');
      console.log(`  after ${String(i).padStart(3)} revealed balls (cold refit took ${coldParams.iterationsRun} iters) -> ${summary}`);
    }
    for (const budget of BUDGETS) online.get(budget).observe(liveRows[i]);
  }

  console.log('\n=== Worst-case agreement with a fully converged cold refit, by per-ball budget ===');
  for (const budget of BUDGETS) {
    const worstMean = Math.max(...diffs.map((d) => d.perBudget[budget].meanAbs));
    const worstMax = Math.max(...diffs.map((d) => d.perBudget[budget].maxAbs));
    console.log(`  ${String(budget).padStart(4)} iterations/ball: worst mean ${worstMean.toExponential(3)}, worst single ${worstMax.toExponential(3)}`);
  }
  console.log('\nBetween-method Brier differences in Experiment 4 were ~5e-4, and predicted probabilities are ~0.05.');
  console.log('A per-ball budget is only adequate if its disagreement with a true refit is well below that scale -');
  console.log('otherwise the online method would be measuring optimizer lag rather than within-match learning.');
}

main();
