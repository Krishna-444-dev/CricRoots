// The evaluation harness. Seeds a real (in-memory) MongoDB with synthetic-but-structured data
// (research/synthetic/generator.js) using the REAL Player/Match Mongoose models, then calls the
// REAL, unmodified getMatchupPlan/getLiveMatchupPlan/baseline queries against it - never a
// reimplementation of the algorithm, because evaluating a reimplementation would prove nothing
// about the deployed code.
//
// The one design decision worth being explicit about, because it's exactly the kind of thing
// that silently invalidates a result: LEAKAGE. Two distinct leakage risks, both closed here:
//   1. Cross-match leakage - a held-out test match's data must never influence a prediction made
//      for a DIFFERENT held-out test match. Closed by evaluating one test match at a time, each
//      against its own database snapshot (all training matches + only that one test match's
//      so-far-revealed balls), torn down and rebuilt between test matches.
//   2. Within-match temporal leakage - predicting ball i of a test match must never see balls
//      i..N of that SAME match. Closed by inserting a test match's balls into the database one
//      at a time and evaluating the prediction for ball i strictly BEFORE ball i itself is
//      inserted.
// Live-adjustment evaluation (getLiveMatchupPlan / fullHierarchyWithLive) is deliberately OUT OF
// SCOPE for the first experiment - see research/prediction-target.md and
// documentation/research-readiness-audit.md section 5 for why: getLiveMatchupPlan currently
// double-counts in-progress-match balls (already inside the "historical" aggregate by the time
// they're separately read as "live" evidence), and running that comparison before the fix would
// produce a result that looks like an answer but isn't one. This harness only evaluates the
// historical-only methods until that's fixed as its own, separate piece of work.
const mongoose = require('mongoose');
const path = require('path');
const { generatePopulation, generateLeagueMatches, trueProbability, makeRng } = require('../synthetic/generator');
const baselines = require('../baselines');

const Player = require(path.join(__dirname, '..', '..', 'backend', 'src', 'models', 'Player'));
const Match = require(path.join(__dirname, '..', '..', 'backend', 'src', 'models', 'Match'));
const { getLineLengthBreakdown } = require(path.join(__dirname, '..', '..', 'backend', 'src', 'services', 'tendencyAnalytics'));

function fakeObjectId(rng) {
  // Real, well-formed ObjectIds (not referencing any real document) - Mongoose refs aren't
  // foreign-key-enforced by default, so this is sufficient for Player.user/Match.team1/team2/
  // createdBy, none of which getMatchupPlan or the baselines ever dereference.
  const hex = Array.from({ length: 24 }, () => Math.floor(rng.uniform(0, 16)).toString(16)).join('');
  return new mongoose.Types.ObjectId(hex);
}

/** Inserts real Player documents for every batter/bowler in the population - required because
 * getPlayerIdsByArchetype and getMatchupPlan's own Player.findById lookups query the real
 * Player collection for battingStyle/bowlingStyle. Returns a Map from the generator's own string
 * ids ("batter_3") to the real, Mongoose-assigned ObjectIds - deliberately NOT derived from the
 * string (an earlier version tried to encode the string into the ObjectId's hex digits, which
 * risked collisions between different players); every downstream call uses these real _ids the
 * same way real product code would, keyed through this map. */
async function seedPlayers(population, rng) {
  const battersDocs = population.batters.map((b) => ({
    user: fakeObjectId(rng),
    specialization: 'Batsman',
    battingStyle: b.battingStyle,
    bowlingStyle: 'None'
  }));
  const bowlerDocs = population.bowlers.map((w) => ({
    user: fakeObjectId(rng),
    specialization: 'Bowler',
    battingStyle: 'Right-hand',
    bowlingStyle: w.bowlingStyle
  }));
  const insertedBatters = await Player.insertMany(battersDocs);
  const insertedBowlers = await Player.insertMany(bowlerDocs);

  const stringToObjectId = new Map();
  population.batters.forEach((b, i) => stringToObjectId.set(b._id, insertedBatters[i]._id));
  population.bowlers.forEach((w, i) => stringToObjectId.set(w._id, insertedBowlers[i]._id));
  return stringToObjectId;
}

function toMatchDoc(match, idMap, rng) {
  const mapBalls = (balls) => balls.map((b) => ({
    ...b,
    batsmanId: idMap.get(b.batsmanId),
    bowlerId: idMap.get(b.bowlerId)
  }));
  return {
    title: match.title,
    team1: fakeObjectId(rng),
    team2: fakeObjectId(rng),
    matchType: match.matchType,
    status: match.status,
    venue: match.venue,
    scheduledDate: new Date(),
    totalOvers: match.totalOvers,
    createdBy: fakeObjectId(rng),
    innings: match.innings.map((inn) => ({
      team: fakeObjectId(rng),
      runs: inn.runs,
      wickets: inn.wickets,
      overs: inn.overs,
      balls: mapBalls(inn.balls)
    }))
  };
}

function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng.uniform(0, i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const HISTORICAL_METHODS = {
  global: (b, w, l, n) => baselines.globalRate(b, w, l, n),
  rawExactMatchup: (b, w, l, n) => baselines.rawExactMatchup(b, w, l, n),
  singleLevelShrinkage: (b, w, l, n) => baselines.singleLevelShrinkage(b, w, l, n),
  archetypeOnly: (b, w, l, n, playerLookup) => baselines.archetypeOnly(b, w, l, n, playerLookup),
  fullHierarchyNoArchetype: (b, w, l, n) => baselines.fullHierarchyNoArchetype(b, w, l, n),
  fullHierarchy: (b, w, l, n) => baselines.fullHierarchy(b, w, l, n)
};

/**
 * Runs the full Track A experiment. Assumes an already-connected mongoose instance (see
 * research/harness/run-experiment.js) pointed at an empty database - this function does not
 * manage the connection lifecycle itself, only the data within it.
 *
 * @returns {Promise<Array>} one row per evaluated (ball, method) prediction:
 *   { matchIdx, ballGlobalIndex, batsmanId, bowlerId, line, length, trueOutcome, pTrue, method, prediction }
 */
async function runExperiment({
  numTeams = 16, battersPerTeam = 11, bowlersPerTeam = 6, rounds = 2, populationSeed = 1,
  testFraction = 0.15, ballsPerInnings = 35, matchSeed = 2, splitSeed = 3,
  checkpointStride = 1, // evaluate every Nth ball within a test match; 1 = every ball
  archetypeSignal = false // World B (research/synthetic/world-b-design.md) when true; World A (default) otherwise
} = {}) {
  const rng = makeRng(splitSeed);
  const population = generatePopulation({
    numBatters: numTeams * battersPerTeam, numBowlers: numTeams * bowlersPerTeam, seed: populationSeed, archetypeSignal
  });
  // See research/synthetic/league-design.md for why match generation is fixture-based (a
  // realistic double round-robin across numTeams teams) rather than a fixed pair of teams
  // reused every match - the pilot experiment's flawed sparsity distribution came directly from
  // the latter. This is the only change from the pilot experiment; everything below this point
  // (train/test split mechanics, leakage prevention, checkpoint evaluation) is unchanged.
  const { matches } = generateLeagueMatches({
    population, numTeams, battersPerTeam, bowlersPerTeam, rounds, ballsPerInnings, seed: matchSeed
  });

  const shuffled = seededShuffle(matches, splitSeed);
  const numTestMatches = Math.round(matches.length * testFraction);
  const numTrainMatches = matches.length - numTestMatches;
  const trainMatches = shuffled.slice(0, numTrainMatches);
  const testMatches = shuffled.slice(numTrainMatches, numTrainMatches + numTestMatches);

  const idMap = await seedPlayers(population, rng);

  const playerLookup = async (batsmanId, bowlerId) => {
    const [batter, bowler] = await Promise.all([Player.findById(batsmanId), Player.findById(bowlerId)]);
    return { battingStyle: batter.battingStyle, bowlingStyle: bowler.bowlingStyle };
  };

  // Insert every training match in full up front - representing "all historical data available
  // before any test match is considered."
  const trainDocs = trainMatches.map((m) => toMatchDoc(m, idMap, rng));
  await Match.insertMany(trainDocs);

  const results = [];

  for (let matchIdx = 0; matchIdx < testMatches.length; matchIdx++) {
    const testMatch = testMatches[matchIdx];
    // Fresh, empty test-match document for this match only - inserted incrementally below.
    const testDoc = toMatchDoc(testMatch, idMap, rng);
    const emptyInnings = testDoc.innings.map((inn) => ({ ...inn, balls: [] }));
    const created = await Match.create({ ...testDoc, innings: emptyInnings });

    let globalBallCounter = 0;
    for (let inningsIdx = 0; inningsIdx < testDoc.innings.length; inningsIdx++) {
      const fullBalls = testDoc.innings[inningsIdx].balls;
      for (let ballIdx = 0; ballIdx < fullBalls.length; ballIdx++) {
        const ball = fullBalls[ballIdx];
        const batsmanIdStr = testMatch.innings[inningsIdx].balls[ballIdx].batsmanId;
        const bowlerIdStr = testMatch.innings[inningsIdx].balls[ballIdx].bowlerId;

        if (globalBallCounter % checkpointStride === 0) {
          // Predict ball i using only data inserted so far (all training matches + balls
          // 0..i-1 of THIS test match) - the DB has not yet seen `ball` itself.
          // exactMatchupN: the individual (this exact batter vs this exact bowler, any
          // line/length) sample size available at this exact checkpoint - the dimension
          // metrics.js's sample-efficiency analysis buckets by (n=0,1,2,5,10,15,25,50+), not
          // specific to any one method, so computed once per checkpoint rather than duplicated
          // per method.
          const exactMatchupBreakdown = await getLineLengthBreakdown({ batsmanIds: [ball.batsmanId], bowlerIds: [ball.bowlerId] });
          const exactMatchupN = exactMatchupBreakdown.totalBalls;

          for (const [methodName, fn] of Object.entries(HISTORICAL_METHODS)) {
            const prediction = await fn(ball.batsmanId, ball.bowlerId, ball.line, ball.length, playerLookup);
            results.push({
              matchIdx,
              globalBallCounter,
              batsmanId: batsmanIdStr,
              bowlerId: bowlerIdStr,
              line: ball.line,
              length: ball.length,
              trueOutcome: ball.isWicket ? 1 : 0,
              pTrue: trueProbability(population, batsmanIdStr, bowlerIdStr, ball.line, ball.length),
              exactMatchupN,
              method: methodName,
              prediction
            });
          }
        }

        // Now reveal this ball - it becomes part of the "historical" data available for the
        // NEXT checkpoint in this same match (and remains scoped to this match only; a
        // different test match's evaluation starts from a document that never had these
        // balls in it at all, per the per-test-match teardown below).
        await Match.updateOne(
          { _id: created._id },
          { $push: { [`innings.${inningsIdx}.balls`]: ball } }
        );
        globalBallCounter++;
      }
    }

    // Remove this test match entirely before moving to the next one - otherwise the next test
    // match's "historical" queries would see this one's balls too, which is exactly the
    // cross-match leakage this design exists to prevent.
    await Match.deleteOne({ _id: created._id });
  }

  return {
    results,
    meta: {
      numTeams, battersPerTeam, bowlersPerTeam, rounds,
      numTrainMatches, numTestMatches, ballsPerInnings, checkpointStride,
      populationSeed, matchSeed, splitSeed, archetypeSignal
    }
  };
}

module.exports = { runExperiment };
