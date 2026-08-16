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
const ARCHETYPE_EFFECT_SD = 0.35; // see world-b-design.md - same order of magnitude as lineLengthEffect's 0.3
// Base standard deviations, named so World C's drift magnitudes can be expressed as fractions of
// each term's own spread (experiment-6-design.md section 2) rather than as bare numbers. Values
// are unchanged from the literals they replace, so Worlds A and B are bit-for-bit unaffected.
const VULNERABILITY_SD = 0.4;
const EFFECTIVENESS_SD = 0.4;
const INTERACTION_SD = 0.6;
const LINE_LENGTH_SD = 0.3;
const RESPONSE_SD = 0.3;
// World D- only: baseline boundary rate, matching the 2-in-8 boundary frequency of the original
// uniform run distribution so the negative control's overall scoring stays comparable.
const BOUNDARY_BASE_LOGIT = logit(0.25);

/**
 * Builds a population: players with real-schema-shaped fields plus hidden ground-truth
 * parameters, a sparse batter x bowler interaction table, and a fixed line/length effect table.
 * Everything here is drawn once and held fixed for the lifetime of one generated dataset - see
 * dataset-assumptions.md for what each component represents.
 *
 * `archetypeSignal` (default false, see world-b-design.md): when true, draws one additional
 * fixed Normal(0, ARCHETYPE_EFFECT_SD) effect per (battingStyle, bowlingStyle) combination -
 * "World B", where archetype genuinely predicts the outcome, vs the default "World A" where it
 * does not. Drawn LAST, after every other table below, so the archetypeSignal:false and
 * archetypeSignal:true populations are byte-identical in every other field for the same seed -
 * this flag changes nothing about the existing five terms or their distributions.
 *
 * `drift` (default null, see experiment-6-design.md): "World C". When set to
 * { types: [...], magnitude: m }, draws per-entity linear drift coefficients so that selected
 * ground-truth terms become functions of normalized season time t. Drawn AFTER the archetype
 * table for the same reason: a population built without `drift` is byte-identical to World A /
 * World B for the same seed, so Experiments 2-5 remain exactly reproducible.
 *   types: any of 'player' (V, E), 'interaction' (I), 'context' (LL)
 *   magnitude: multiplier m, expressed as a fraction of each term's own base SD
 *
 * `latentFactors` (default null, see world-d-design.md): "World D". When set to
 * { K, sigmaPhi, mode }, draws a K-dimensional factor vector z_b per batter and a loading vector
 * phi per (line,length) cell, so batters with similar z share a response PROFILE rather than just
 * a level - the structure Worlds A/B lack entirely (D17).
 *   mode 'target' = D+ : z_b . phi enters the dismissal logit
 *   mode 'runs'   = D- : z_b . phi drives boundary-hitting instead, so the clusters are real and
 *                        discoverable but carry NO information about the prediction target
 * Drawn LAST, after drift, so any population built without it stays byte-identical to Worlds
 * A/B/C for the same seed.
 */
function generatePopulation({ numBatters = 40, numBowlers = 40, seed = 1, archetypeSignal = false, drift = null, latentFactors = null } = {}) {
  const rng = makeRng(seed);

  const batters = Array.from({ length: numBatters }, (_, i) => ({
    _id: `batter_${i}`,
    battingStyle: rng.pick(BATTING_STYLES),
    vulnerability: rng.normal(0, VULNERABILITY_SD) // + = more dismissal-prone than average
  }));

  const bowlers = Array.from({ length: numBowlers }, (_, i) => ({
    _id: `bowler_${i}`,
    bowlingStyle: rng.pick(BOWLING_STYLES),
    effectiveness: rng.normal(0, EFFECTIVENESS_SD) // + = more wicket-taking than average
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
        interactions.set(`${b._id}|${w._id}`, rng.normal(0, INTERACTION_SD));
      }
    }
  }

  // Fixed once per population: objectively, some lines/lengths are harder to face than others,
  // independent of who's batting or bowling (a yorker is a yorker).
  const lineLengthEffect = new Map(); // `${line}|${length}` -> effect
  for (const line of LINES) {
    for (const length of LENGTHS) {
      lineLengthEffect.set(`${line}|${length}`, rng.normal(0, LINE_LENGTH_SD));
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
          batterLineLengthResponse.set(`${b._id}|${line}|${length}`, rng.normal(0, RESPONSE_SD));
        }
      }
    }
  }

  // Drawn last and only when requested - see the function-level doc comment above and
  // world-b-design.md for why this ordering matters (keeps every earlier table byte-identical
  // to the archetypeSignal:false population for the same seed).
  let archetypeEffect;
  if (archetypeSignal) {
    archetypeEffect = new Map(); // `${battingStyle}|${bowlingStyle}` -> effect
    for (const battingStyle of BATTING_STYLES) {
      for (const bowlingStyle of BOWLING_STYLES) {
        archetypeEffect.set(`${battingStyle}|${bowlingStyle}`, rng.normal(0, ARCHETYPE_EFFECT_SD));
      }
    }
  }

  // World C drift coefficients - drawn LAST so that a population generated without `drift` is
  // byte-identical to World A / World B for the same seed (verified in generator.test.js).
  // Each is a per-entity slope applied linearly in normalized season time t (experiment-6-design.md
  // section 2). R_ikl and A_ab are deliberately NOT given drift: holding two terms stationary means
  // observed degradation is attributable to the terms that actually moved.
  let driftCoefficients;
  if (drift && drift.magnitude > 0 && drift.types && drift.types.length > 0) {
    const m = drift.magnitude;
    const types = new Set(drift.types);
    driftCoefficients = { types: [...types].sort(), magnitude: m, V: new Map(), E: new Map(), I: new Map(), LL: new Map() };
    if (types.has('player')) {
      for (const b of batters) driftCoefficients.V.set(b._id, rng.normal(0, m * VULNERABILITY_SD));
      for (const w of bowlers) driftCoefficients.E.set(w._id, rng.normal(0, m * EFFECTIVENESS_SD));
    }
    if (types.has('interaction')) {
      // Only pairs that already have an interaction entry - drift modifies existing head-to-head
      // relationships rather than inventing new ones mid-season.
      for (const key of interactions.keys()) driftCoefficients.I.set(key, rng.normal(0, m * INTERACTION_SD));
    }
    if (types.has('context')) {
      for (const key of lineLengthEffect.keys()) driftCoefficients.LL.set(key, rng.normal(0, m * LINE_LENGTH_SD));
    }
  }

  // World D latent factors - drawn LAST (world-d-design.md section 2). battingStyle was assigned
  // far above and is independent of z by construction, so archetype and latent structure are
  // genuinely different partitions - otherwise the benchmark would only be testing whether a
  // method can rediscover a label we planted.
  let latent;
  if (latentFactors) {
    const { K = 3, sigmaPhi = 0.22, mode = 'target' } = latentFactors;
    const z = new Map();
    for (const b of batters) z.set(b._id, Array.from({ length: K }, () => rng.normal(0, 1)));
    const phi = new Map();
    for (const line of LINES) {
      for (const length of LENGTHS) {
        phi.set(`${line}|${length}`, Array.from({ length: K }, () => rng.normal(0, sigmaPhi)));
      }
    }
    latent = { K, sigmaPhi, mode, z, phi };
  }

  // Index maps for O(1) entity lookup in trueProbability. Pure optimization - trueProbability
  // previously did a linear Array.find() per call, which is far too slow for the oracle table's
  // full enumeration once that table has to be rebuilt per distinct season time. Output is
  // unchanged (asserted in generator.test.js).
  const battersById = new Map(batters.map((b) => [b._id, b]));
  const bowlersById = new Map(bowlers.map((w) => [w._id, w]));

  return {
    batters, bowlers, interactions, lineLengthEffect, batterLineLengthResponse, archetypeEffect,
    driftCoefficients, latent, battersById, bowlersById, seed
  };
}

/** The World D latent contribution z_b . phi_{line,length}. Returns 0 for any population without
 * latent factors, and for D- populations (mode 'runs') where the latent term drives scoring rather
 * than dismissals - so every existing world is unaffected. */
function latentTerm(population, batterId, line, length, forChannel) {
  const L = population.latent;
  if (!L || L.mode !== forChannel) return 0;
  const z = L.z.get(batterId);
  const phi = L.phi.get(`${line}|${length}`);
  if (!z || !phi) return 0;
  let s = 0;
  for (let k = 0; k < z.length; k++) s += z[k] * phi[k];
  return s;
}

/**
 * The oracle function - the one thing Track A can provide that no real dataset can: the EXACT
 * true dismissal probability for any (batter, bowler, line, length), independent of how much
 * (or how little) data has actually been observed for that combination. This is what
 * metrics.js's oracle comparison evaluates estimates against.
 *
 * `t` is normalized season time in [0, 1] and matters only for World C populations (those built
 * with a `drift` option). It defaults to 0, and for any population without driftCoefficients the
 * value of `t` is irrelevant - so every existing caller keeps its exact previous behaviour.
 */
function trueProbability(population, batterId, bowlerId, line, length, t = 0) {
  const batter = population.battersById
    ? population.battersById.get(batterId)
    : population.batters.find((b) => b._id === batterId);
  const bowler = population.bowlersById
    ? population.bowlersById.get(bowlerId)
    : population.bowlers.find((w) => w._id === bowlerId);
  if (!batter || !bowler) throw new Error(`Unknown batter/bowler: ${batterId}/${bowlerId}`);

  let interaction = population.interactions.get(`${batterId}|${bowlerId}`) || 0;
  let lineLength = population.lineLengthEffect.get(`${line}|${length}`) || 0;
  const response = population.batterLineLengthResponse.get(`${batterId}|${line}|${length}`) || 0;
  let vulnerability = batter.vulnerability;
  let effectiveness = bowler.effectiveness;

  // World C (experiment-6-design.md section 2). Absent driftCoefficients - i.e. every World A and
  // World B population - this block is skipped entirely and the arithmetic below is the original
  // five-term (or six-term, with archetype) sum, unchanged.
  const d = population.driftCoefficients;
  if (d && t !== 0) {
    vulnerability += t * (d.V.get(batterId) || 0);
    effectiveness += t * (d.E.get(bowlerId) || 0);
    interaction += t * (d.I.get(`${batterId}|${bowlerId}`) || 0);
    lineLength += t * (d.LL.get(`${line}|${length}`) || 0);
  }
  // World B only (world-b-design.md) - absent (undefined) in every population generated with the
  // default archetypeSignal:false, so this term is always exactly 0 there, matching the original
  // five-term formula precisely.
  const archetype = population.archetypeEffect
    ? population.archetypeEffect.get(`${batter.battingStyle}|${bowler.bowlingStyle}`) || 0
    : 0;

  const logitP = BASE_RATE_LOGIT + vulnerability + effectiveness + interaction + lineLength
    + response + archetype + latentTerm(population, batterId, line, length, 'target');
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

  // `t` is this match's normalized season time, passed through to trueProbability so that World C
  // populations sample from the regime in force at that point in the season. For World A/B
  // populations it has no effect whatsoever (experiment-6-design.md section 2).
  const inningsFor = (battingRoster, bowlingRoster, t) => {
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
      const pTrue = trueProbability(population, batter._id, bowler._id, line, length, t);
      const isWicket = rng.bernoulli(pTrue);
      // World D- (mode 'runs'): the latent factor drives BOUNDARY-HITTING rather than dismissals,
      // so the behavioural clusters are real and discoverable from observed play while carrying no
      // information about the prediction target. Returns 0 for every other world, leaving the
      // original uniform pick exactly intact.
      const scoringTilt = latentTerm(population, batter._id, line, length, 'runs');
      const runsThisBall = isWicket
        ? 0
        : (scoringTilt !== 0 && rng.bernoulli(sigmoid(BOUNDARY_BASE_LOGIT + scoringTilt))
          ? rng.pick([4, 6])
          : rng.pick(scoringTilt !== 0 ? [0, 0, 1, 1, 1, 2] : [0, 0, 1, 1, 1, 2, 4, 6]));
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
    // Normalized season time for this match. Position in the fixture sequence IS the season
    // timeline - the fixtures were shuffled once at generation, so index order is match order.
    const t = fixtures.length > 1 ? m / (fixtures.length - 1) : 0;
    const inn1 = teamABats ? inningsFor(teamA.batters, teamB.bowlers, t) : inningsFor(teamB.batters, teamA.bowlers, t);
    const inn2 = teamABats ? inningsFor(teamB.batters, teamA.bowlers, t) : inningsFor(teamA.batters, teamB.bowlers, t);

    return {
      _synthetic: true,
      matchIndex: m,
      t,
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
  makeRng, latentTerm, LINES, LENGTHS
};
