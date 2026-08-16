// DIAGNOSTIC ONLY. No algorithm, no hypothesis verdict, no criterion.
//
// Asks: does the player population contain transferable behavioural structure beyond the
// predefined archetypes? I.e. if batters A and B have similar conditional response surfaces, does
// B's data help predict A?
//
// READ SECTION 0 FIRST. There is a strong prior that this generator CANNOT answer the question,
// for reasons visible in its source rather than in its output, and the script measures that
// directly before measuring anything else. A null result driven by the generator's construction
// is not evidence about cricket, and reporting it as though it were would be the same error as
// Experiment 1's sparsity failure.
//
// The transfer test uses an ORACLE neighbourhood - neighbours chosen using the hidden true
// response surfaces. That is deliberate: it is an upper bound. If neighbourhoods chosen with
// perfect knowledge do not beat random neighbourhoods, no learned similarity method can.
//
// Usage: node research/diagnostics/player-response-structure-diagnostic.js
const { generatePopulation, generateLeagueMatches, trueProbability, makeRng, LINES, LENGTHS } = require('../synthetic/generator');

const POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true };  // World B
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const K = 20; // neighbourhood size, comparable to an archetype pool's batter count (176/2 = 88 is larger)

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : num / Math.sqrt(da * db);
}
function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

function main() {
  const pop = generatePopulation(POP);

  // ---- 0. What structure can this generator contain, by construction? ------------------------
  console.log('='.repeat(100));
  console.log('0. STRUCTURAL PRECONDITION - what could transfer even in principle?');
  console.log('='.repeat(100));
  console.log(`
  A batter's true response surface is (generator.js, trueProbability):
      logit p(b,w,line,len) = BASE + V_b + E_w + I_bw + LL_{line,len} + R_{b,line,len} + A_{sty(b),sty(w)}

  Of the terms that vary BY BATTER:
      V_b      scalar, drawn independently per batter        -> shareable only as a scalar offset
      I_bw     drawn independently per (batter,bowler) pair  -> no cross-batter structure
      R_b      drawn independently per (batter,line,length)  -> no cross-batter structure
      A        depends only on battingStyle                  -> exactly the predefined archetype

  There are NO shared latent factors in this generator. Two batters resemble each other only via
  (a) a similar scalar V, or (b) the same battingStyle. Nothing else is shared by construction.

  So a null transfer result here would be a property of the SIMULATOR, not a finding about
  cricket. The measurements below quantify how completely that is the case.`);

  // ---- 1-3. Response-surface similarity --------------------------------------------------------
  // Each batter's surface: the 42-vector of mean-over-bowlers true probability per (line,length).
  const surface = new Map();
  for (const b of pop.batters) {
    const v = [];
    for (const line of LINES) for (const length of LENGTHS) {
      let s = 0;
      for (const w of pop.bowlers) s += trueProbability(pop, b._id, w._id, line, length);
      v.push(s / pop.bowlers.length);
    }
    surface.set(b._id, v);
  }
  // Population mean surface - the component every batter shares (LL, and the mean of everything else)
  const dim = LINES.length * LENGTHS.length;
  const popMean = Array.from({ length: dim }, (_, i) => mean(pop.batters.map((b) => surface.get(b._id)[i])));
  // Residual surface: idiosyncratic part only, after removing the shared component and each
  // batter's own scalar level. What remains is essentially R_b.
  const residual = new Map();
  for (const b of pop.batters) {
    const raw = surface.get(b._id);
    const centred = raw.map((x, i) => x - popMean[i]);
    const m = mean(centred);
    residual.set(b._id, centred.map((x) => x - m));
  }

  const sameStyle = [], diffStyle = [], sameStyleRes = [], diffStyleRes = [];
  const batters = pop.batters;
  for (let i = 0; i < batters.length; i++) for (let j = i + 1; j < batters.length; j++) {
    const a = batters[i], b = batters[j];
    const cRaw = corr(surface.get(a._id), surface.get(b._id));
    const cRes = corr(residual.get(a._id), residual.get(b._id));
    if (a.battingStyle === b.battingStyle) { sameStyle.push(cRaw); sameStyleRes.push(cRes); }
    else { diffStyle.push(cRaw); diffStyleRes.push(cRes); }
  }

  console.log('');
  console.log('='.repeat(100));
  console.log('1-3. RESPONSE-SURFACE SIMILARITY between batter pairs (true surfaces, no estimation)');
  console.log('='.repeat(100));
  console.log(`  RAW surface correlation (includes the shared line/length component):`);
  console.log(`    same battingStyle      mean ${mean(sameStyle).toFixed(4)}   (n=${sameStyle.length})`);
  console.log(`    different battingStyle mean ${mean(diffStyle).toFixed(4)}   (n=${diffStyle.length})`);
  console.log(`  RESIDUAL surface correlation (shared component removed - idiosyncratic structure only):`);
  console.log(`    same battingStyle      mean ${mean(sameStyleRes).toFixed(4)}   sd ${Math.sqrt(variance(sameStyleRes)).toFixed(4)}`);
  console.log(`    different battingStyle mean ${mean(diffStyleRes).toFixed(4)}   sd ${Math.sqrt(variance(diffStyleRes)).toFixed(4)}`);
  const allRes = [...sameStyleRes, ...diffStyleRes];
  console.log(`    all pairs              mean ${mean(allRes).toFixed(4)}   sd ${Math.sqrt(variance(allRes)).toFixed(4)}`);
  console.log(`    fraction of pairs with residual correlation > 0.5: ${(allRes.filter((c) => c > 0.5).length / allRes.length * 100).toFixed(2)}%`);

  // ---- 4. Predictive transferability -----------------------------------------------------------
  const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE });
  const shuffled = seededShuffle(matches, 3);
  const numTest = Math.round(matches.length * 0.15);
  const trainMatches = shuffled.slice(0, matches.length - numTest);
  const testMatches = shuffled.slice(matches.length - numTest);

  const bStyle = new Map(pop.batters.map((b) => [b._id, b.battingStyle]));
  const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));
  const trainBalls = [];
  for (const m of trainMatches) for (const inn of m.innings) for (const ball of inn.balls) trainBalls.push(ball);
  const testBalls = [];
  for (const m of testMatches) for (const inn of m.innings) for (const ball of inn.balls) testBalls.push(ball);

  // Oracle neighbourhoods: the K most similar batters by TRUE residual response surface, and
  // separately by TRUE scalar vulnerability. Upper bounds - no estimation involved.
  const vulnOf = new Map(pop.batters.map((b) => [b._id, b.vulnerability]));
  const neighboursByResidual = new Map(), neighboursByVuln = new Map();
  for (const b of pop.batters) {
    const others = pop.batters.filter((o) => o._id !== b._id);
    neighboursByResidual.set(b._id, new Set(
      others.map((o) => ({ id: o._id, s: corr(residual.get(b._id), residual.get(o._id)) }))
        .sort((x, y) => y.s - x.s).slice(0, K).map((x) => x.id)));
    neighboursByVuln.set(b._id, new Set(
      others.map((o) => ({ id: o._id, s: -Math.abs(vulnOf.get(b._id) - vulnOf.get(o._id)) }))
        .sort((x, y) => y.s - x.s).slice(0, K).map((x) => x.id)));
  }
  const rngRand = makeRng(777);
  const neighboursRandom = new Map(pop.batters.map((b) => {
    const others = pop.batters.filter((o) => o._id !== b._id).map((o) => o._id);
    return [b._id, new Set(seededShuffle(others, Math.floor(rngRand.uniform(1, 1e9))).slice(0, K))];
  }));

  // Pool estimator: dismissal rate among {neighbour batters} x {bowlers sharing this bowler's
  // style} at this (line,length) - the direct analogue of archetypeOnly with a different batter set.
  function poolEstimator(neighbourMap) {
    const idx = new Map();
    for (const ball of trainBalls) {
      const key = `${ball.batsmanId}|${wStyle.get(ball.bowlerId)}|${ball.line}|${ball.length}`;
      if (!idx.has(key)) idx.set(key, [0, 0]);
      const e = idx.get(key); e[0]++; if (ball.isWicket) e[1]++;
    }
    return (batterId, bowlerId, line, length) => {
      const ws = wStyle.get(bowlerId);
      let n = 0, k = 0;
      for (const nb of neighbourMap.get(batterId)) {
        const e = idx.get(`${nb}|${ws}|${line}|${length}`);
        if (e) { n += e[0]; k += e[1]; }
      }
      return n > 0 ? k / n : null;
    };
  }
  // archetypeOnly analogue: every batter sharing the target's battingStyle
  const archNeighbours = new Map(pop.batters.map((b) => [b._id,
    new Set(pop.batters.filter((o) => o.battingStyle === b.battingStyle).map((o) => o._id))]));

  const estimators = {
    'oracle-similar (residual surface)': poolEstimator(neighboursByResidual),
    'oracle-similar (vulnerability)': poolEstimator(neighboursByVuln),
    'RANDOM neighbourhood (same size)': poolEstimator(neighboursRandom),
    'battingStyle archetype (all ~88)': poolEstimator(archNeighbours)
  };
  // Global rate per (line,length)
  const globalIdx = new Map();
  for (const ball of trainBalls) {
    const key = `${ball.line}|${ball.length}`;
    if (!globalIdx.has(key)) globalIdx.set(key, [0, 0]);
    const e = globalIdx.get(key); e[0]++; if (ball.isWicket) e[1]++;
  }
  estimators['global (line/length only)'] = (b, w, line, length) => {
    const e = globalIdx.get(`${line}|${length}`);
    return e && e[0] > 0 ? e[1] / e[0] : null;
  };

  console.log('');
  console.log('='.repeat(100));
  console.log(`4. PREDICTIVE TRANSFERABILITY - oracle MAE on ${testBalls.length} held-out balls, K=${K}`);
  console.log('   Neighbourhoods chosen with PERFECT knowledge of the true surfaces: an upper bound.');
  console.log('='.repeat(100));
  console.log(`  ${'pool'.padEnd(36)} ${'oracle MAE'.padStart(12)} ${'coverage'.padStart(10)}`);
  for (const [label, est] of Object.entries(estimators)) {
    const errs = [];
    let covered = 0;
    for (const ball of testBalls) {
      const p = est(ball.batsmanId, ball.bowlerId, ball.line, ball.length);
      if (p === null) continue;
      covered++;
      errs.push(Math.abs(p - trueProbability(pop, ball.batsmanId, ball.bowlerId, ball.line, ball.length)));
    }
    console.log(`  ${label.padEnd(36)} ${mean(errs).toFixed(6).padStart(12)} ${(covered / testBalls.length * 100).toFixed(1).padStart(9)}%`);
  }

  console.log('');
  console.log('='.repeat(100));
  console.log('Diagnostic only. No hypothesis verdict, no proposed mechanism, no algorithm.');
  console.log('='.repeat(100));
}

main();
