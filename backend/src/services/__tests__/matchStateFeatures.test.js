// AT-E3.1 and AT-E2.x - the training/serving feature parity gate.
//
// The defect this exists to prevent shipped once already and survived a correct written warning:
// training divided runs by `legalBalls / 6`, three serving sites divided by the DB's cricket-
// notation `innings.overs` ("3.4" for 3 overs 4 balls). Measured before the fix, 83.5% of served
// states were mid-over - exactly where the two conventions disagree and exactly where training
// data structurally cannot reach, since the extraction emits rows only at completed overs.
//
// A comment did not stop it. These assertions are the replacement.

const {
  chaseFeatures,
  currentChaseState,
  replayChaseStates,
  isInChase,
  toDecimalOvers,
  resolveTotalOvers
} = require('../matchStateFeatures');

// The exact expression matchController.js:470 uses to persist `innings.overs`.
function storedCricketNotationOvers(legalBalls) {
  return Math.floor(legalBalls / 6) + ((legalBalls % 6) / 10);
}

function ball({ runs = 0, isWicket = false, isExtra = false, extraType = 'none' } = {}) {
  return { runs, isWicket, isExtra, extraType };
}

function makeMatch({ firstInningsRuns = 150, chaseBalls = [], totalOvers = 20, matchType = 'T20' } = {}) {
  return {
    matchType,
    totalOvers,
    innings: [
      { runs: firstInningsRuns, wickets: 6, overs: 20, balls: [ball({ runs: 1 })] },
      { runs: 0, wickets: 0, overs: 0, balls: chaseBalls }
    ]
  };
}

describe('the transformation itself', () => {
  test('overs are true decimal, never cricket notation', () => {
    expect(toDecimalOvers(22)).toBeCloseTo(3.6667, 4);
    expect(toDecimalOvers(22)).not.toBeCloseTo(storedCricketNotationOvers(22), 4);
  });

  test('current_run_rate divides by decimal overs, and provably not by the stored field', () => {
    // 3 overs 4 balls = 22 legal balls, 30 runs.
    const f = chaseFeatures({ legalBalls: 22, runs: 30, wickets: 2, target: 160, totalOvers: 20 });
    expect(f.currentRunRate).toBeCloseTo(30 / (22 / 6), 6);
    expect(f.currentRunRate).not.toBeCloseTo(30 / storedCricketNotationOvers(22), 4);
  });

  test('the two conventions agree at over boundaries and disagree in between', () => {
    // This is why the training file cannot exhibit the skew: it only contains boundary states.
    for (let over = 1; over <= 19; over++) {
      const legal = over * 6;
      expect(toDecimalOvers(legal)).toBeCloseTo(storedCricketNotationOvers(legal), 10);
    }
    for (let into = 1; into <= 5; into++) {
      const legal = 3 * 6 + into;
      expect(toDecimalOvers(legal)).not.toBeCloseTo(storedCricketNotationOvers(legal), 4);
    }
  });

  test('overs_remaining respects the match format rather than assuming 20', () => {
    const odi = chaseFeatures({ legalBalls: 60, runs: 50, wickets: 1, target: 250, totalOvers: 50 });
    expect(odi.oversRemaining).toBeCloseTo(40, 6);
    // The old inline `20 - overs` went negative here.
    expect(odi.oversRemaining).toBeGreaterThan(0);
  });

  test('overs_remaining is never negative', () => {
    const f = chaseFeatures({ legalBalls: 130, runs: 200, wickets: 4, target: 190, totalOvers: 20 });
    expect(f.oversRemaining).toBeGreaterThanOrEqual(0);
  });

  test('resolveTotalOvers prefers the match field over the type mapping', () => {
    expect(resolveTotalOvers({ totalOvers: 15, matchType: 'T20' })).toBe(15);
    expect(resolveTotalOvers({ matchType: 'ODI' })).toBe(50);
    expect(resolveTotalOvers({})).toBe(20);
  });
});

describe('AT-E3.1 training/serving parity', () => {
  test('the extraction path and the serving path produce identical vectors', () => {
    // Build a chase whose ball sequence includes extras, wickets and boundaries, then compare the
    // features the training extraction would emit at each completed over against the features the
    // serving path produces for a match truncated to that same point.
    const balls = [];
    let seed = 7;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (let i = 0; i < 120; i++) {
      const r = rand();
      if (r < 0.05) balls.push(ball({ runs: 1, isExtra: true, extraType: 'wide' }));
      else if (r < 0.07) balls.push(ball({ runs: 1, isExtra: true, extraType: 'no-ball' }));
      else if (r < 0.11) balls.push(ball({ runs: 2, isExtra: true, extraType: 'leg-bye' }));
      else if (r < 0.15) balls.push(ball({ isWicket: true }));
      else balls.push(ball({ runs: Math.floor(rand() * 7) }));
    }

    const full = makeMatch({ firstInningsRuns: 168, chaseBalls: balls });
    const extractionStates = replayChaseStates(full, { at: 'over-boundary' });
    expect(extractionStates.length).toBeGreaterThan(5);

    for (const state of extractionStates) {
      // Truncate the match to the same prefix and ask the SERVING entry point.
      let seen = 0;
      let legal = 0;
      while (legal < state.legalBalls && seen < balls.length) {
        const b = balls[seen];
        if (!(b.isExtra && ['wide', 'no-ball'].includes(b.extraType))) legal += 1;
        seen += 1;
      }
      const truncated = makeMatch({ firstInningsRuns: 168, chaseBalls: balls.slice(0, seen) });
      const served = currentChaseState(truncated);

      expect(served).toEqual(state.features);
    }
  });

  test('an over boundary is emitted exactly once, whatever follows it', () => {
    // Regression for the defect the parity assertion found on its first run: trailing wides do
    // not increment legalBalls, so `legalBalls % 6 === 0` stayed true and the boundary re-emitted
    // once per extra with inflated runs. 792 such rows (7.1%) were in the committed training file.
    const balls = [];
    for (let i = 0; i < 6; i++) balls.push(ball({ runs: 1 }));
    balls.push(ball({ runs: 1, isExtra: true, extraType: 'wide' }));
    balls.push(ball({ runs: 1, isExtra: true, extraType: 'wide' }));
    balls.push(ball({ runs: 5, isExtra: true, extraType: 'no-ball' }));
    for (let i = 0; i < 6; i++) balls.push(ball({ runs: 2 }));

    const states = replayChaseStates(makeMatch({ chaseBalls: balls }), { at: 'over-boundary' });
    const boundaries = states.map((s) => s.legalBalls);
    expect(boundaries).toEqual([6, 12]);
    expect(new Set(boundaries).size).toBe(boundaries.length);

    // The retained checkpoint is the one at the instant the over completed - 6 runs off 1 over,
    // not 6 + the three following extras.
    expect(states[0].runs).toBe(6);
    expect(states[0].features.currentRunRate).toBeCloseTo(6, 6);
  });

  test('target is first-innings runs plus one, on both paths', () => {
    const m = makeMatch({ firstInningsRuns: 168, chaseBalls: [ball({ runs: 4 })] });
    expect(currentChaseState(m).targetScore).toBe(169);
    expect(replayChaseStates(m, { at: 'every-ball' })[0].features.targetScore).toBe(169);
  });
});

describe('AT-E2 first-innings domain guard', () => {
  test('currentChaseState is null before the chase starts', () => {
    expect(currentChaseState(makeMatch({ chaseBalls: [] }))).toBeNull();
    expect(isInChase(makeMatch({ chaseBalls: [] }))).toBe(false);
  });

  test('no state can be produced whose target equals the batting side own score', () => {
    // The specific defect: during the first innings the old code passed innings[0].runs as the
    // target, i.e. the batting side's own live score.
    const m = makeMatch({ firstInningsRuns: 87, chaseBalls: [] });
    const state = currentChaseState(m);
    expect(state).toBeNull();
    if (state) expect(state.targetScore).not.toBe(m.innings[0].runs);
  });

  test('Test matches are out of scope', () => {
    const m = makeMatch({ chaseBalls: [ball({ runs: 1 })], matchType: 'Test' });
    expect(currentChaseState(m)).toBeNull();
    expect(replayChaseStates(m)).toEqual([]);
  });

  test('a live chase does produce a state', () => {
    const m = makeMatch({ firstInningsRuns: 140, chaseBalls: [ball({ runs: 4 }), ball({ runs: 1 })] });
    const s = currentChaseState(m);
    expect(s).not.toBeNull();
    expect(s.targetScore).toBe(141);
    expect(s.wicketsDown).toBe(0);
  });
});
