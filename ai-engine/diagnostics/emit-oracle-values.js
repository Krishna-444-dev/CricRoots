// Emits the exact simulator win probability for every row of data/real_matches.csv, so the Python
// side can compare the deployed estimator against it (RO1a).
//
// The four stored features are a SUFFICIENT STATISTIC for the oracle in this world, which is worth
// stating because it is the crux of the research argument. Given totalOvers = 20 (true of all 577
// matches - overs_remaining never exceeds 19 anywhere in the file):
//
//   overs_used     = 20 - overs_remaining
//   runs_scored    = current_run_rate * overs_used
//   runs_needed    = target_score - runs_scored
//   balls_remaining = overs_remaining * 6
//
// so (balls_remaining, wickets_down, runs_needed) - the oracle's entire input - is recoverable
// exactly. Nothing else about the match state carries information under this generator.

const fs = require('fs');
const path = require('path');
const { buildOracle } = require('./oracle');

const CSV_IN = path.join(__dirname, '..', 'data', 'real_matches.csv');
const OUT = path.join(__dirname, '..', 'results', 'latest', 'oracle-values.csv');
const TOTAL_OVERS = 20;

function main() {
  const lines = fs.readFileSync(CSV_IN, 'utf8').trim().split('\n');
  const header = lines[0].split(',');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));

  const oracle = buildOracle({ maxBalls: TOTAL_OVERS * 6, maxRuns: 320 });

  const out = ['match_id,overs_remaining,wickets_down,current_run_rate,target_score,' +
    'win_probability,balls_remaining,runs_needed,oracle_p'];

  let maxOversRemaining = 0;
  for (const line of lines.slice(1)) {
    const f = line.split(',');
    const oversRemaining = Number(f[idx.overs_remaining]);
    const wickets = Number(f[idx.wickets_down]);
    const crr = Number(f[idx.current_run_rate]);
    const target = Number(f[idx.target_score]);
    const label = Number(f[idx.win_probability]);

    maxOversRemaining = Math.max(maxOversRemaining, oversRemaining);

    const oversUsed = TOTAL_OVERS - oversRemaining;
    const runsScored = Math.round(crr * oversUsed);
    const runsNeeded = target - runsScored;
    const ballsRemaining = Math.round(oversRemaining * 6);

    out.push([
      f[idx.match_id], oversRemaining, wickets, crr, target, label,
      ballsRemaining, runsNeeded, oracle(ballsRemaining, wickets, runsNeeded)
    ].join(','));
  }

  // The sufficiency argument above assumes every match is 20 overs. Assert it rather than trust it.
  if (maxOversRemaining > TOTAL_OVERS - 1) {
    throw new Error(
      `Found overs_remaining=${maxOversRemaining}, which is inconsistent with every match being ` +
      `${TOTAL_OVERS} overs. The runs_scored recovery above is no longer valid.`
    );
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, out.join('\n') + '\n');
  console.log(`wrote ${out.length - 1} rows (max overs_remaining ${maxOversRemaining}) -> ${OUT}`);
}

main();
