// World D benchmark validity gates J1, J2a, J2b, J3. See research/world-d-design.md section 4.
//
// These run BEFORE any method or baseline is built. If the world cannot support the question,
// nothing built on top of it would mean anything - which is exactly what the Worlds A/B
// response-structure diagnostic established after the fact (D17).
//
// All instruments here are ORACLES: they read hidden ground truth. They are upper bounds and
// benchmark-validity checks, never candidate methods.
//
// Usage: node research/diagnostics/world-d-validity-gates.js
const { generatePopulation, generateLeagueMatches, trueProbability, latentTerm, makeRng, LINES, LENGTHS } = require('../synthetic/generator');

const BASE_POP = { numBatters: 176, numBowlers: 96, seed: 1, archetypeSignal: true };
const LEAGUE = { numTeams: 16, battersPerTeam: 11, bowlersPerTeam: 6, rounds: 2, ballsPerInnings: 35, seed: 2 };
const LATENT = { K: 3, sigmaPhi: 0.22 };
const NEIGHBOURHOOD_SIZES = [10, 20, 40]; // J2b checked at several pool sizes - see design §8 q4

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const variance = (a) => { const m = mean(a); return m === null ? null : mean(a.map((x) => (x - m) ** 2)); };
function corr(a, b) {
  const ma = mean(a), mb = mean(b);
  let n = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { n += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  return da === 0 || db === 0 ? 0 : n / Math.sqrt(da * db);
}
function seededShuffle(arr, seed) {
  const rng = makeRng(seed);
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng.uniform(0, i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
const sigmoid = (x) => 1 / (1 + Math.exp(-x));
const logit = (p) => Math.log(p / (1 - p));

function buildWorld(mode) {
  const pop = generatePopulation({ ...BASE_POP, latentFactors: { ...LATENT, mode } });
  const { matches } = generateLeagueMatches({ population: pop, ...LEAGUE });
  const shuffled = seededShuffle(matches, 3);
  const numTest = Math.round(matches.length * 0.15);
  const train = shuffled.slice(0, matches.length - numTest);
  const test = shuffled.slice(matches.length - numTest);
  const flat = (ms) => { const out = []; for (const m of ms) for (const i of m.innings) for (const b of i.balls) out.push(b); return out; };
  return { pop, trainBalls: flat(train), testBalls: flat(test) };
}

function residualSurfaces(pop) {
  const dim = LINES.length * LENGTHS.length;
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
  const popMean = Array.from({ length: dim }, (_, i) => mean(pop.batters.map((b) => surface.get(b._id)[i])));
  const residual = new Map();
  for (const b of pop.batters) {
    const centred = surface.get(b._id).map((x, i) => x - popMean[i]);
    const m = mean(centred);
    residual.set(b._id, centred.map((x) => x - m));
  }
  return residual;
}

function main() {
  const dPlus = buildWorld('target');
  const dMinus = buildWorld('runs');

  // ---- J1 -------------------------------------------------------------------------------------
  console.log('='.repeat(100));
  console.log('J1 - does D+ contain shared latent structure?   (Worlds A/B reference: 0.0101, no separation)');
  console.log('='.repeat(100));
  const pop = dPlus.pop;
  const residual = residualSurfaces(pop);
  const zOf = (id) => pop.latent.z.get(id);
  const zDist = (a, b) => { const x = zOf(a), y = zOf(b); let s = 0; for (let k = 0; k < x.length; k++) s += (x[k] - y[k]) ** 2; return Math.sqrt(s); };

  const pairs = [];
  for (let i = 0; i < pop.batters.length; i++) for (let j = i + 1; j < pop.batters.length; j++) {
    const a = pop.batters[i], b = pop.batters[j];
    pairs.push({ d: zDist(a._id, b._id), c: corr(residual.get(a._id), residual.get(b._id)), sameStyle: a.battingStyle === b.battingStyle });
  }
  const sorted = [...pairs].sort((x, y) => x.d - y.d);
  const closest = sorted.slice(0, Math.floor(sorted.length * 0.1));
  const farthest = sorted.slice(-Math.floor(sorted.length * 0.1));
  console.log(`  residual surface correlation, closest 10% by z-distance:  ${mean(closest.map((p) => p.c)).toFixed(4)}`);
  console.log(`  residual surface correlation, farthest 10% by z-distance: ${mean(farthest.map((p) => p.c)).toFixed(4)}`);
  console.log(`  all pairs: ${mean(pairs.map((p) => p.c)).toFixed(4)}`);
  console.log(`  same battingStyle ${mean(pairs.filter((p) => p.sameStyle).map((p) => p.c)).toFixed(4)}  vs different ${mean(pairs.filter((p) => !p.sameStyle).map((p) => p.c)).toFixed(4)}   <- must NOT separate (archetype independent of z)`);

  // Realised latent variance share, computed the same way as the ground-truth decomposition.
  const rng = makeRng(4242);
  const terms = [];
  for (let i = 0; i < 60000; i++) {
    const b = rng.pick(pop.batters), line = rng.pick(LINES), length = rng.pick(LENGTHS);
    terms.push(latentTerm(pop, b._id, line, length, 'target'));
  }
  const logitVals = [];
  for (let i = 0; i < 60000; i++) {
    const b = rng.pick(pop.batters), w = rng.pick(pop.bowlers), line = rng.pick(LINES), length = rng.pick(LENGTHS);
    logitVals.push(logit(trueProbability(pop, b._id, w._id, line, length)));
  }
  const share = variance(terms) / variance(logitVals);
  console.log(`\n  realised latent variance share: ${(share * 100).toFixed(2)}%   (target 10-15%; interaction is 8.6%, archetype 8.84%)`);
  const j1 = mean(closest.map((p) => p.c)) > 0.25 && mean(closest.map((p) => p.c)) - mean(farthest.map((p) => p.c)) > 0.2;
  console.log(`\n  J1: ${j1 ? 'PASS' : 'FAIL'}`);

  // ---- J2a / J2b / J3 --------------------------------------------------------------------------
  function evaluateWorld(world, label) {
    const { pop, trainBalls, testBalls } = world;
    const wStyle = new Map(pop.bowlers.map((w) => [w._id, w.bowlingStyle]));

    // global rate per (line,length), from training data
    const gIdx = new Map();
    for (const ball of trainBalls) {
      const k = `${ball.line}|${ball.length}`;
      if (!gIdx.has(k)) gIdx.set(k, [0, 0]);
      const e = gIdx.get(k); e[0]++; if (ball.isWicket) e[1]++;
    }
    const globalAt = (line, length) => { const e = gIdx.get(`${line}|${length}`); return e && e[0] > 0 ? e[1] / e[0] : null; };

    const errs = { global: [], oracleLatent: [] };
    for (const ball of testBalls) {
      const pT = trueProbability(pop, ball.batsmanId, ball.bowlerId, ball.line, ball.length);
      const g = globalAt(ball.line, ball.length);
      if (g === null) continue;
      errs.global.push(Math.abs(g - pT));
      // J2a instrument: global PLUS direct access to the true latent term.
      const withLatent = sigmoid(logit(Math.min(Math.max(g, 1e-6), 1 - 1e-6)) + latentTerm(pop, ball.batsmanId, ball.line, ball.length, 'target'));
      errs.oracleLatent.push(Math.abs(withLatent - pT));
    }

    // J2b instrument: oracle latent neighbourhood pools, at several sizes.
    const nbErrs = {};
    for (const K of NEIGHBOURHOOD_SIZES) {
      const neigh = new Map();
      for (const b of pop.batters) {
        neigh.set(b._id, new Set(pop.batters.filter((o) => o._id !== b._id)
          .map((o) => ({ id: o._id, d: (() => { const x = pop.latent.z.get(b._id), y = pop.latent.z.get(o._id); let s = 0; for (let k = 0; k < x.length; k++) s += (x[k] - y[k]) ** 2; return s; })() }))
          .sort((p, q) => p.d - q.d).slice(0, K).map((p) => p.id)));
      }
      const idx = new Map();
      for (const ball of trainBalls) {
        const k = `${ball.batsmanId}|${wStyle.get(ball.bowlerId)}|${ball.line}|${ball.length}`;
        if (!idx.has(k)) idx.set(k, [0, 0]);
        const e = idx.get(k); e[0]++; if (ball.isWicket) e[1]++;
      }
      const es = [];
      for (const ball of testBalls) {
        const ws = wStyle.get(ball.bowlerId);
        let n = 0, w = 0;
        for (const nb of neigh.get(ball.batsmanId)) {
          const e = idx.get(`${nb}|${ws}|${ball.line}|${ball.length}`);
          if (e) { n += e[0]; w += e[1]; }
        }
        if (n === 0) continue;
        es.push(Math.abs(w / n - trueProbability(pop, ball.batsmanId, ball.bowlerId, ball.line, ball.length)));
      }
      nbErrs[K] = mean(es);
    }

    console.log('');
    console.log('='.repeat(100));
    console.log(label);
    console.log('='.repeat(100));
    console.log(`  global (line/length only)                   ${mean(errs.global).toFixed(6)}`);
    console.log(`  global + TRUE latent term (J2a instrument)  ${mean(errs.oracleLatent).toFixed(6)}   delta ${(mean(errs.oracleLatent) - mean(errs.global)).toExponential(3)}`);
    for (const K of NEIGHBOURHOOD_SIZES) {
      console.log(`  oracle latent neighbourhood K=${String(K).padEnd(3)} (J2b)     ${nbErrs[K].toFixed(6)}   delta ${(nbErrs[K] - mean(errs.global)).toExponential(3)}`);
    }
    return { global: mean(errs.global), oracleLatent: mean(errs.oracleLatent), nb: nbErrs };
  }

  const rPlus = evaluateWorld(dPlus, 'J2a / J2b - D+ (latent drives the TARGET)');
  const rMinus = evaluateWorld(dMinus, 'J3 - D- negative control (latent drives RUN-SCORING only)');

  console.log('');
  console.log('='.repeat(100));
  console.log('GATE SUMMARY');
  console.log('='.repeat(100));
  const j2a = rPlus.oracleLatent < rPlus.global;
  const bestNb = Math.min(...NEIGHBOURHOOD_SIZES.map((K) => rPlus.nb[K]));
  const j2b = bestNb < rPlus.global;
  const j3 = !(rMinus.oracleLatent < rMinus.global) && !(Math.min(...NEIGHBOURHOOD_SIZES.map((K) => rMinus.nb[K])) < rMinus.global);
  console.log(`  J1  structure present in D+                     ${j1 ? 'PASS' : 'FAIL'}`);
  console.log(`  J2a latent info useful for the target           ${j2a ? 'PASS' : 'FAIL'}`);
  console.log(`  J2b neighbourhood transfer exploits it          ${j2b ? 'PASS' : 'FAIL'}  (best pool size beats global: ${j2b})`);
  console.log(`  J3  negative control does not fire in D-        ${j3 ? 'PASS' : 'FAIL'}`);
  console.log('');
  if (!j1) console.log('  => D+ does not contain the intended structure. Redesign the generator.');
  else if (!j2a) console.log('  => D+ FAILED as a world: the latent term carries no useful target information. Redesign or abandon.');
  else if (!j2b) console.log('  => Latent information EXISTS but sparse neighbourhood transfer cannot exploit it.\n     Per design section 4 this is a genuine negative result about the transfer mechanism:\n     the pooling variance cost exceeds the signal. Do NOT build neighbourhood methods.');
  else console.log('  => The world can test the question. Proceed to baselines (low-rank joint model first).');
  if (!j3) console.log('  => WARNING: the negative control fired in D-. The benchmark is gameable as built.');
  console.log('\nGates only. No method or baseline built.');
  console.log('='.repeat(100));
}

main();
