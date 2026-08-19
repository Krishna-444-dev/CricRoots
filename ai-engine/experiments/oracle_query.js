// Oracle lookup for arbitrary states, driven from Python.
//
// Deliberately a subprocess rather than a Python port of the dynamic program. The DP is the
// definition of ground truth for this world; a second implementation would be a second definition,
// and the whole point of matchStateFeatures.js was that two definitions of the same quantity drift
// apart silently. One implementation, queried from both sides.
//
// stdin:  JSON array of [ballsRemaining, wicketsDown, runsNeeded]
// stdout: JSON array of probabilities, same order

const { buildOracle } = require('../diagnostics/oracle');

let raw = '';
process.stdin.on('data', (d) => { raw += d; });
process.stdin.on('end', () => {
  const states = JSON.parse(raw);
  const oracle = buildOracle({ maxBalls: 120, maxRuns: 320 });
  process.stdout.write(JSON.stringify(states.map(([b, w, r]) => oracle(b, w, r))));
});
