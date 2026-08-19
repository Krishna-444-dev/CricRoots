// End-to-end training/serving parity: the row the extraction WRITES TO THE CSV must equal the
// payload the backend SENDS OVER THE WIRE for the same match state.
//
// matchStateFeatures.test.js asserts the two feature functions agree. That is necessary but stops
// one layer short: the training file goes through CSV serialisation, and the serving path goes
// through AIService's field renaming (oversRemaining -> overs_remaining, and so on). The original
// defect lived in exactly that outer layer - both inner functions were individually reasonable.
// This test closes it by comparing the two artefacts a human would actually diff.

jest.mock('axios');
const axios = require('axios');

const { extractRows } = require('../extractWinProbabilityData');
const { replayChaseStates } = require('../../services/matchStateFeatures');
const AIService = require('../../utils/aiService');

function ball({ runs = 0, isWicket = false, isExtra = false, extraType = 'none' } = {}) {
  return { runs, isWicket, isExtra, extraType };
}

// A chase that reaches its target, with extras, wickets and boundaries scattered through it, so the
// legal-ball accounting and the over-boundary guard are both exercised.
function buildChase(seedStart) {
  let seed = seedStart;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  const balls = [];
  let runs = 0;
  let wickets = 0;
  let legal = 0;
  while (legal < 120 && wickets < 10 && runs < 150) {
    const r = rand();
    let b;
    if (r < 0.05) b = ball({ runs: 1, isExtra: true, extraType: 'wide' });
    else if (r < 0.07) b = ball({ runs: 1, isExtra: true, extraType: 'no-ball' });
    else if (r < 0.12) b = ball({ runs: 1, isExtra: true, extraType: 'leg-bye' });
    else if (r < 0.16) b = ball({ isWicket: true });
    else b = ball({ runs: [0, 0, 1, 1, 2, 4, 6][Math.floor(rand() * 7)] });
    balls.push(b);
    runs += b.runs;
    if (b.isWicket) wickets += 1;
    if (!(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))) legal += 1;
  }
  return { balls, runs, wickets, legal };
}

function makeCompletedMatch(chase, firstInningsRuns) {
  return {
    _id: 'match-e2e',
    matchType: 'T20',
    totalOvers: 20,
    team1: 'team-1',
    team2: 'team-2',
    result: { winningTeam: chase.runs > firstInningsRuns ? 'team-2' : 'team-1' },
    innings: [
      {
        runs: firstInningsRuns,
        wickets: 10,
        overs: 20,
        balls: Array.from({ length: 120 }, () => ball({ runs: 1 }))
      },
      {
        runs: chase.runs,
        wickets: chase.wickets,
        overs: Math.floor(chase.legal / 6) + ((chase.legal % 6) / 10),
        balls: chase.balls
      }
    ]
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  axios.post.mockResolvedValue({ data: { success: true } });
});

test('every extracted training row equals the wire payload for the same state', async () => {
  const chase = buildChase(99991);
  const firstInningsRuns = chase.runs - 20; // ensure the chase is the higher scorer and won
  const match = makeCompletedMatch(chase, firstInningsRuns);

  const { rows, skipReason } = extractRows(match);
  expect(skipReason).toBeNull();
  expect(rows.length).toBeGreaterThan(5);

  // Serving path: replay the same match and send each over-boundary state through AIService.
  const servingStates = replayChaseStates(match, { at: 'over-boundary' });
  expect(servingStates.length).toBe(rows.length);

  for (let i = 0; i < rows.length; i++) {
    axios.post.mockClear();
    await AIService.getTacticalAdvice(servingStates[i].features);

    const wire = axios.post.mock.calls[0][1];
    const csvRow = rows[i];

    // The four model inputs, compared across the CSV boundary and the HTTP boundary.
    expect(wire.overs_remaining).toBeCloseTo(csvRow.overs_remaining, 12);
    expect(wire.wickets_down).toBe(csvRow.wickets_down);
    expect(wire.current_run_rate).toBeCloseTo(csvRow.current_run_rate, 12);
    expect(wire.target_score).toBe(csvRow.target_score);
  }
});

test('the wire payload carries no hardcoded placeholder features', async () => {
  const chase = buildChase(4242);
  const match = makeCompletedMatch(chase, chase.runs - 15);
  const state = replayChaseStates(match, { at: 'over-boundary' })[2];

  await AIService.getTacticalAdvice(state.features);
  const wire = axios.post.mock.calls[0][1];

  // oppositionStrength: 7 and pitchType: 1 were hardcoded constants at all three serving sites,
  // fed to models that no longer exist. They must not reappear.
  expect(wire).not.toHaveProperty('opposition_strength');
  expect(wire).not.toHaveProperty('pitch_type');
  expect(Object.keys(wire).sort()).toEqual(
    ['current_run_rate', 'overs_remaining', 'target_score', 'wickets_down']
  );
});
