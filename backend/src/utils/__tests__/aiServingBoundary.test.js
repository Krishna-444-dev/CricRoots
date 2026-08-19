// AT-E2.1 - the first-innings domain guard, asserted at the network boundary.
//
// The distinction this test enforces: "we stopped rendering the number" and "we stopped asking the
// question" are different fixes, and only the second is correct. A chase model handed a first-
// innings state produces a number with no interpretation; suppressing it at the UI would leave the
// call in place and the number in the socket payload. So the assertion is on the axios mock's call
// count, not on the response body.

jest.mock('axios');
const axios = require('axios');

const AIService = require('../aiService');
const SocketManager = require('../socketManager');
const { currentChaseState } = require('../../services/matchStateFeatures');

// SocketManager's constructor installs auth middleware and a connection handler, so the double
// needs `use` and `on` as well as the `to(...).emit(...)` chain the assertions read.
function makeIo(emit = jest.fn()) {
  return {
    use: jest.fn(),
    on: jest.fn(),
    to: jest.fn().mockReturnValue({ emit })
  };
}

function ball({ runs = 0, isWicket = false, isExtra = false, extraType = 'none' } = {}) {
  return { runs, isWicket, isExtra, extraType };
}

function makeMatch({ firstInningsRuns = 150, chaseBalls = [], totalOvers = 20, matchType = 'T20' } = {}) {
  return {
    matchType,
    totalOvers,
    innings: [
      { runs: firstInningsRuns, wickets: 5, overs: 18.3, balls: [ball({ runs: 1 })] },
      { runs: 0, wickets: 0, overs: 0, balls: chaseBalls }
    ]
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  axios.post.mockResolvedValue({
    data: { success: true, match_status: 'Balanced', win_probability: 0.5, tactical_advice: 'x' }
  });
});

describe('first innings', () => {
  test('produces no chase state at all', () => {
    expect(currentChaseState(makeMatch({ chaseBalls: [] }))).toBeNull();
  });

  test('socket push makes ZERO calls to the AI engine', async () => {
    const mgr = new SocketManager(makeIo());

    await mgr.emitAIInsights('match-1', currentChaseState(makeMatch({ chaseBalls: [] })));

    expect(axios.post).toHaveBeenCalledTimes(0);
  });

  test('and emits no ai-insights event either', async () => {
    const emit = jest.fn();
    const mgr = new SocketManager(makeIo(emit));

    await mgr.emitAIInsights('match-1', null);

    expect(emit).not.toHaveBeenCalledWith('ai-insights', expect.anything());
  });
});

describe('second innings', () => {
  test('the AI engine IS called, with the corrected target', async () => {
    const mgr = new SocketManager(makeIo());
    const match = makeMatch({ firstInningsRuns: 168, chaseBalls: [ball({ runs: 4 }), ball({ runs: 2 })] });

    await mgr.emitAIInsights('match-1', currentChaseState(match));

    expect(axios.post).toHaveBeenCalledTimes(1);
    const payload = axios.post.mock.calls[0][1];
    expect(payload.target_score).toBe(169); // first-innings runs + 1, not 168
    expect(payload.target_score).not.toBe(match.innings[0].runs);
  });

  test('current_run_rate is never derived from the stored cricket-notation overs field', async () => {
    const mgr = new SocketManager(makeIo());

    // 3 overs 4 balls = 22 legal deliveries, 30 runs. The DB would store overs as 3.4.
    const chaseBalls = [];
    for (let i = 0; i < 22; i++) chaseBalls.push(ball({ runs: i === 0 ? 30 : 0 }));
    const match = makeMatch({ firstInningsRuns: 140, chaseBalls });
    match.innings[1].overs = 3.4;

    await mgr.emitAIInsights('match-1', currentChaseState(match));

    const payload = axios.post.mock.calls[0][1];
    expect(payload.current_run_rate).toBeCloseTo(30 / (22 / 6), 6);
    expect(payload.current_run_rate).not.toBeCloseTo(30 / 3.4, 4);
  });

  test('overs_remaining honours the match format instead of assuming 20', async () => {
    const mgr = new SocketManager(makeIo());

    const chaseBalls = [];
    for (let i = 0; i < 60; i++) chaseBalls.push(ball({ runs: 1 }));
    const match = makeMatch({ firstInningsRuns: 240, chaseBalls, totalOvers: 50, matchType: 'ODI' });

    await mgr.emitAIInsights('match-1', currentChaseState(match));

    const payload = axios.post.mock.calls[0][1];
    expect(payload.overs_remaining).toBeCloseTo(40, 6); // not 20 - 10 = 10
    expect(payload.overs_remaining).toBeGreaterThan(0);
  });
});

describe('AIService surface', () => {
  test('only the two win-probability-backed methods remain', () => {
    expect(typeof AIService.getWinProbability).toBe('function');
    expect(typeof AIService.getTacticalAdvice).toBe('function');
    // Removed in E1 - the models behind these were trained on uniform random integers.
    expect(AIService.recommendBatsman).toBeUndefined();
    expect(AIService.recommendBowler).toBeUndefined();
    expect(AIService.recommendFielding).toBeUndefined();
  });
});
