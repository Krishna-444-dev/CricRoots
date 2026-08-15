// Structured synthetic cricket data generator - Track A only (see ../dataset-assumptions.md).
// Produces data with a KNOWN, queryable ground-truth dismissal probability per
// (batter, bowler, line, length), so "does the estimator recover the true probability?" has a
// real, checkable answer - something the product's own matchSimulator.js cannot provide (its
// dismissal probability is flat and unconditioned, see documentation/
// research-readiness-audit.md section 5). This file is intentionally separate from
// matchSimulator.js and does not modify it - that script has a different job (realistic-looking
// demo data for the product), not a shared one with this file.
//
// Output uses the exact same enum values and document shape as the real Player/Team/Match
// Mongoose schemas, so the evaluation harness can insert this data into a real (in-memory)
// MongoDB and exercise the actual getMatchupPlan/getLiveMatchupPlan functions unmodified.

const LINES = ['wide-outside-off', 'outside-off', 'off-stump', 'middle-stump', 'leg-stump', 'down-leg'];
const LENGTHS = ['full-toss', 'yorker', 'full', 'good-length', 'short-of-good-length', 'short', 'bouncer'];
const BATTING_STYLES = ['Right-hand', 'Left-hand'];
const BOWLING_STYLES = ['Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin'];

// --- Deterministic PRNG (mulberry32) -----------------------------------------------------
// Math.random() isn't seedable, and reproducibility (same seed -> byte-identical output) is a
// stated requirement for every experiment this program runs. Small, dependency-free, and its
// output has been visually/statistically sane-checked (see generator.test.js) - not a
// cryptographic RNG, and doesn't need to be for this purpose.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const rand = mulberry32(seed);
  return {
    uniform: (min = 0, max = 1) => min + rand() * (max - min),
    // Box-Muller - fine for this purpose (parameter draws, not cryptography).
    normal: (mean = 0, sd = 1) => {
      const u1 = Math.max(rand(), 1e-12);
      const u2 = rand();
      const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return mean + z * sd;
    },
    int: (min, max) => Math.floor(min + rand() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(rand() * arr.length)],
    bernoulli: (p) => rand() < p,
    chance: (p) => rand() < p
  };
}

function sigmoid(x) {
  return 1 / (1 + Math.exp(-x));
}
function logit(p) {
  return Math.log(p / (1 - p));
}

const BASE_RATE_LOGIT = logit(0.045); // matches the real product's own baseline dismissal rate

/**
 * Builds a population: players with real-schema-shaped fields plus hidden ground-truth
 * parameters, a sparse batter x bowler interaction table, and a fixed line/length effect table.
 * Everything here is drawn once and held fixed for the lifetime of one generated dataset - see
 * dataset-assumptions.md for what each component represents.
 */
function generatePopulation({ numBatters = 40, numBowlers = 40, seed = 1 } = {}) {
  const rng = makeRng(seed);

  const batters = Array.from({ length: numBatters }, (_, i) => ({
    _id: `batter_${i}`,
    battingStyle: rng.pick(BATTING_STYLES),
    vulnerability: rng.normal(0, 0.4) // + = more dismissal-prone than average
  }));

  const bowlers = Array.from({ length: numBowlers }, (_, i) => ({
    _id: `bowler_${i}`,
    bowlingStyle: rng.pick(BOWLING_STYLES),
    effectiveness: rng.normal(0, 0.4) // + = more wicket-taking than average
  }));

  // Sparse interaction: most batter/bowler pairs have ~zero special interaction beyond their
  // individual vulnerability/effectiveness - this is deliberate (dataset-assumptions.md) and is
  // exactly the situation real grassroots matchups are in: most pairs never developed a real
  // head-to-head "story," a few genuinely do.
  const INTERACTION_PROBABILITY = 0.12;
  const interactions = new Map(); // `${batterId}|${bowlerId}` -> effect
  for (const b of batters) {
    for (const w of bowlers) {
      if (rng.chance(INTERACTION_PROBABILITY)) {
        interactions.set(`${b._id}|${w._id}`, rng.normal(0, 0.6));
      }
    }
  }

  // Fixed once per population: objectively, some lines/lengths are harder to face than others,
  // independent of who's batting or bowling (a yorker is a yorker).
  const lineLengthEffect = new Map(); // `${line}|${length}` -> effect
  for (const line of LINES) {
    for (const length of LENGTHS) {
      lineLengthEffect.set(`${line}|${length}`, rng.normal(0, 0.3));
    }
  }

  // Sparse per-batter personal response to specific line/length combos (a real weakness/
  // strength beyond the population-wide line/length effect above) - same sparsity reasoning as
  // the interaction table.
  const RESPONSE_PROBABILITY = 0.15;
  const batterLineLengthResponse = new Map(); // `${batterId}|${line}|${length}` -> effect
  for (const b of batters) {
    for (const line of LINES) {
      for (const length of LENGTHS) {
        if (rng.chance(RESPONSE_PROBABILITY)) {
          batterLineLengthResponse.set(`${b._id}|${line}|${length}`, rng.normal(0, 0.3));
        }
      }
    }
  }

  return { batters, bowlers, interactions, lineLengthEffect, batterLineLengthResponse, seed };
}

/**
 * The oracle function - the one thing Track A can provide that no real dataset can: the EXACT
 * true dismissal probability for any (batter, bowler, line, length), independent of how much
 * (or how little) data has actually been observed for that combination. This is what
 * metrics.js's oracle comparison evaluates estimates against.
 */
function trueProbability(population, batterId, bowlerId, line, length) {
  const batter = population.batters.find((b) => b._id === batterId);
  const bowler = population.bowlers.find((w) => w._id === bowlerId);
  if (!batter || !bowler) throw new Error(`Unknown batter/bowler: ${batterId}/${bowlerId}`);

  const interaction = population.interactions.get(`${batterId}|${bowlerId}`) || 0;
  const lineLength = population.lineLengthEffect.get(`${line}|${length}`) || 0;
  const response = population.batterLineLengthResponse.get(`${batterId}|${line}|${length}`) || 0;

  const logitP = BASE_RATE_LOGIT + batter.vulnerability + bowler.effectiveness + interaction + lineLength + response;
  return sigmoid(logitP);
}

/**
 * Generates `numMatches` match documents, each shaped like a real Match document (team1/team2/
 * innings/balls), with dismissal outcomes drawn as real Bernoulli(trueProbability(...)) samples
 * - genuine sampling noise on top of the known-true probability, not a deterministic function of
 * it. Two fixed XI-a-side teams, drawn once from the population and reused across all matches
 * (mirroring how a real club's roster is stable across a season, and letting exact-matchup
 * sample counts actually accumulate across matches the way they would for real recurring
 * opponents).
 */
function generateMatches({ population, numMatches = 200, ballsPerInnings = 60, seed = 2 } = {}) {
  const rng = makeRng(seed);
  const battersPerSide = 11;
  const bowlersPerSide = 6;

  const teamABatters = population.batters.slice(0, battersPerSide);
  const teamABowlers = population.bowlers.slice(0, bowlersPerSide);
  const teamBBatters = population.batters.slice(battersPerSide, battersPerSide * 2);
  const teamBBowlers = population.bowlers.slice(bowlersPerSide, bowlersPerSide * 2);

  const matches = [];
  for (let m = 0; m < numMatches; m++) {
    const inningsFor = (battingSide, bowlingSide) => {
      const balls = [];
      let strikerIdx = 0;
      let wickets = 0;
      let runs = 0;
      for (let i = 0; i < ballsPerInnings && wickets < battingSide.length - 1; i++) {
        const batter = battingSide[strikerIdx];
        const bowler = rng.pick(bowlingSide);
        const line = rng.pick(LINES);
        const length = rng.pick(LENGTHS);
        const pTrue = trueProbability(population, batter._id, bowler._id, line, length);
        const isWicket = rng.bernoulli(pTrue);
        // Run-scoring is intentionally simple and NOT part of the research question (see
        // prediction-target.md) - just enough to keep the match documents realistic-shaped.
        const runsThisBall = isWicket ? 0 : rng.pick([0, 0, 1, 1, 1, 2, 4, 6]);
        runs += runsThisBall;
        balls.push({
          ballNumber: i + 1,
          batsmanId: batter._id,
          bowlerId: bowler._id,
          runs: runsThisBall,
          isWicket,
          wicketType: isWicket ? 'bowled' : null,
          isExtra: false,
          extraType: 'none',
          line,
          length,
          shotType: null,
          shotZone: null,
          fielderId: null,
          fielderPosition: null
        });
        if (isWicket) {
          wickets += 1;
          strikerIdx = Math.min(strikerIdx + 1, battingSide.length - 1);
        }
      }
      return { runs, wickets, overs: Math.floor(ballsPerInnings / 6), balls };
    };

    const team1Bats = rng.chance(0.5);
    const inn1 = team1Bats ? inningsFor(teamABatters, teamBBowlers) : inningsFor(teamBBatters, teamABowlers);
    const inn2 = team1Bats ? inningsFor(teamBBatters, teamABowlers) : inningsFor(teamABatters, teamBBowlers);

    matches.push({
      _synthetic: true,
      title: `Synthetic Match ${m}`,
      team1Name: 'Synthetic Team A',
      team2Name: 'Synthetic Team B',
      matchType: 'T20',
      status: 'Completed',
      venue: 'Synthetic Ground',
      totalOvers: Math.ceil(ballsPerInnings / 6),
      innings: [
        { teamSide: team1Bats ? 'A' : 'B', ...inn1 },
        { teamSide: team1Bats ? 'B' : 'A', ...inn2 }
      ]
    });
  }

  return {
    matches,
    rosters: { teamABatters, teamABowlers, teamBBatters, teamBBowlers }
  };
}

function seededShuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.uniform(0, i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * A double round-robin fixture list for `numTeams` teams - every team plays every other team
 * exactly `rounds` times (rounds=2: home and away, a standard real league structure - not picked
 * to engineer any particular result, see league-design.md). Returns an array of
 * [teamIndexA, teamIndexB] pairs, order shuffled deterministically.
 */
function generateFixtures({ numTeams, rounds = 2, seed }) {
  const rng = makeRng(seed);
  const fixtures = [];
  for (let r = 0; r < rounds; r++) {
    for (let a = 0; a < numTeams; a++) {
      for (let b = a + 1; b < numTeams; b++) {
        fixtures.push([a, b]);
      }
    }
  }
  return seededShuffleInPlace(fixtures, rng);
}

/**
 * League-structured match generation - see league-design.md for why this replaces the pilot
 * experiment's fixed-two-team approach. `population` must have at least
 * numTeams * battersPerTeam batters and numTeams * bowlersPerTeam bowlers (generatePopulation's
 * numBatters/numBowlers should be sized accordingly by the caller). Batting order is
 * re-shuffled every innings (not fixed at roster order) - see league-design.md for why that
 * matters independent of the fixture-schedule fix. generatePopulation/trueProbability are used
 * completely unchanged - only the roster/fixture/order structure around them is new.
 */
function generateLeagueMatches({
  population, numTeams = 16, battersPerTeam = 11, bowlersPerTeam = 6,
  rounds = 2, ballsPerInnings = 35, seed = 2
} = {}) {
  const rng = makeRng(seed);

  if (population.batters.length < numTeams * battersPerTeam) {
    throw new Error(`Population has ${population.batters.length} batters, needs at least ${numTeams * battersPerTeam} for ${numTeams} teams of ${battersPerTeam}`);
  }
  if (population.bowlers.length < numTeams * bowlersPerTeam) {
    throw new Error(`Population has ${population.bowlers.length} bowlers, needs at least ${numTeams * bowlersPerTeam} for ${numTeams} teams of ${bowlersPerTeam}`);
  }

  const teams = Array.from({ length: numTeams }, (_, i) => ({
    batters: population.batters.slice(i * battersPerTeam, (i + 1) * battersPerTeam),
    bowlers: population.bowlers.slice(i * bowlersPerTeam, (i + 1) * bowlersPerTeam)
  }));

  const fixtures = generateFixtures({ numTeams, rounds, seed: seed + 1000 });

  const inningsFor = (battingRoster, bowlingRoster) => {
    // Fresh random batting order every innings - see league-design.md.
    const battingOrder = seededShuffleInPlace([...battingRoster], rng);
    const balls = [];
    let strikerIdx = 0;
    let wickets = 0;
    let runs = 0;
    for (let i = 0; i < ballsPerInnings && wickets < battingOrder.length - 1; i++) {
      const batter = battingOrder[strikerIdx];
      const bowler = rng.pick(bowlingRoster);
      const line = rng.pick(LINES);
      const length = rng.pick(LENGTHS);
      const pTrue = trueProbability(population, batter._id, bowler._id, line, length);
      const isWicket = rng.bernoulli(pTrue);
      const runsThisBall = isWicket ? 0 : rng.pick([0, 0, 1, 1, 1, 2, 4, 6]);
      runs += runsThisBall;
      balls.push({
        ballNumber: i + 1,
        batsmanId: batter._id,
        bowlerId: bowler._id,
        runs: runsThisBall,
        isWicket,
        wicketType: isWicket ? 'bowled' : null,
        isExtra: false,
        extraType: 'none',
        line,
        length,
        shotType: null,
        shotZone: null,
        fielderId: null,
        fielderPosition: null
      });
      if (isWicket) {
        wickets += 1;
        strikerIdx = Math.min(strikerIdx + 1, battingOrder.length - 1);
      }
    }
    return { runs, wickets, overs: Math.floor(ballsPerInnings / 6), balls };
  };

  const matches = fixtures.map(([teamAIdx, teamBIdx], m) => {
    const teamA = teams[teamAIdx];
    const teamB = teams[teamBIdx];
    const teamABats = rng.chance(0.5);
    const inn1 = teamABats ? inningsFor(teamA.batters, teamB.bowlers) : inningsFor(teamB.batters, teamA.bowlers);
    const inn2 = teamABats ? inningsFor(teamB.batters, teamA.bowlers) : inningsFor(teamA.batters, teamB.bowlers);

    return {
      _synthetic: true,
      title: `Synthetic Match ${m} (Team ${teamAIdx} vs Team ${teamBIdx})`,
      matchType: 'T20',
      status: 'Completed',
      venue: 'Synthetic Ground',
      totalOvers: Math.ceil(ballsPerInnings / 6),
      innings: [inn1, inn2]
    };
  });

  return { matches, teams, fixtures };
}

module.exports = {
  generatePopulation, trueProbability, generateMatches, generateLeagueMatches, generateFixtures,
  makeRng, LINES, LENGTHS
};
