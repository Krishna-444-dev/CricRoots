const { blendWithPrior, hierarchicalBlend, DEFAULT_K } = require('../statUtils');

describe('blendWithPrior', () => {
  test('DEFAULT_K is 15 (documented, and other tests below assume this)', () => {
    expect(DEFAULT_K).toBe(15);
  });

  test('no individual data and no pool data returns null/none, not NaN', () => {
    const result = blendWithPrior(0, 0, 0, 0);
    expect(result).toEqual({ value: null, confidence: 'none', sampleSize: 0 });
  });

  test('zero individual observations falls back entirely to the pool value', () => {
    // n=0 means the blend formula is (0*x + k*poolValue) / (0+k) = poolValue exactly,
    // regardless of k - this is the "0 balls = 100% pool average" case the file's own
    // top-of-file comment documents.
    const result = blendWithPrior(0.9, 0, 0.3, 500);
    expect(result.value).toBeCloseTo(0.3, 10);
    expect(result.confidence).toBe('very-low');
    expect(result.sampleSize).toBe(0);
  });

  test('individualN === k produces an exact 50/50 blend with the pool', () => {
    // (15*1.0 + 15*0.0) / (15+15) = 0.5 - matches the doc comment's own worked example
    // ("a player with 15 balls gets a 50/50 blend") exactly, at k=15.
    const result = blendWithPrior(1.0, 15, 0.0, 500);
    expect(result.value).toBeCloseTo(0.5, 10);
    expect(result.confidence).toBe('medium');
  });

  test('individual data with zero pool data falls back to the individual value exactly', () => {
    // poolN === 0 means prior = individualValue (not poolValue), so
    // (n*x + k*x) / (n+k) = x*(n+k)/(n+k) = x exactly, independent of k. This is the
    // "no pool to fall back to" edge case - worth pinning down explicitly since it's easy
    // to accidentally break by changing the `prior` fallback logic.
    const result = blendWithPrior(0.42, 10, 0, 0);
    expect(result.value).toBeCloseTo(0.42, 10);
  });

  test('confidence buckets match individualN thresholds exactly at the boundaries', () => {
    expect(blendWithPrior(0.5, 0, 0.5, 100).confidence).toBe('very-low');
    expect(blendWithPrior(0.5, 1, 0.5, 100).confidence).toBe('low');
    expect(blendWithPrior(0.5, 14, 0.5, 100).confidence).toBe('low');
    expect(blendWithPrior(0.5, 15, 0.5, 100).confidence).toBe('medium');
    expect(blendWithPrior(0.5, 39, 0.5, 100).confidence).toBe('medium');
    expect(blendWithPrior(0.5, 40, 0.5, 100).confidence).toBe('high');
  });

  test('a smaller k weights the individual value more heavily, sooner', () => {
    // Same inputs, only k differs - the k=5 blend should sit closer to the individual
    // value (1.0) than the k=15 blend does, since a smaller pseudo-count means the prior
    // is trusted less at the same sample size.
    const kFive = blendWithPrior(1.0, 5, 0.0, 500, 5);
    const kFifteen = blendWithPrior(1.0, 5, 0.0, 500, 15);
    expect(kFive.value).toBeCloseTo(0.5, 10); // (5*1 + 5*0)/(5+5)
    expect(kFifteen.value).toBeCloseTo(0.25, 10); // (5*1 + 15*0)/(5+15)
    expect(kFive.value).toBeGreaterThan(kFifteen.value);
  });

  test('larger individualN pulls the blend closer to the individual value', () => {
    const small = blendWithPrior(1.0, 2, 0.1, 500);
    const large = blendWithPrior(1.0, 100, 0.1, 500);
    expect(large.value).toBeGreaterThan(small.value);
    expect(large.value).toBeLessThanOrEqual(1.0);
  });
});

describe('hierarchicalBlend', () => {
  test('empty levels array returns null/none, not a crash', () => {
    expect(hierarchicalBlend([])).toEqual({ value: null, confidence: 'none', sampleSize: 0, level: null });
    expect(hierarchicalBlend(null)).toEqual({ value: null, confidence: 'none', sampleSize: 0, level: null });
  });

  test('a single populated level is returned as-is with confidence "pool"', () => {
    const result = hierarchicalBlend([{ value: 0.37, n: 1000 }]);
    expect(result).toEqual({ value: 0.37, confidence: 'pool', sampleSize: 1000, level: 0 });
  });

  test('a single empty level returns null/none at that level index', () => {
    const result = hierarchicalBlend([{ value: 0, n: 0 }]);
    expect(result.value).toBeNull();
    expect(result.confidence).toBe('none');
    expect(result.level).toBe(0);
  });

  test('a level with n=0 is skipped entirely, not treated as a zero data point', () => {
    // Finest level has no data at all - the result must come purely from the coarsest
    // level, and must report the COARSEST level's index (not the skipped finer one),
    // since nothing at the finer level ever contributed.
    const result = hierarchicalBlend([
      { value: 0.9, n: 0 }, // finest - no data, must be skipped
      { value: 0.2, n: 1000 } // coarsest
    ]);
    expect(result.value).toBeCloseTo(0.2, 10);
    expect(result.level).toBe(1);
    expect(result.confidence).toBe('pool');
  });

  test('two populated levels blend the finer level against the coarser one as its prior', () => {
    // Coarsest (global) first becomes the running "blended" state: {value: 0.0, n: 1000}.
    // Then the finer level (value 1.0, n=15) blends against THAT as its prior via
    // blendWithPrior(1.0, 15, 0.0, 1000, 15) = (15*1 + 15*0)/(15+15) = 0.5, exactly the
    // same arithmetic verified directly against blendWithPrior above.
    const result = hierarchicalBlend([
      { value: 1.0, n: 15 },
      { value: 0.0, n: 1000 }
    ]);
    expect(result.value).toBeCloseTo(0.5, 10);
    expect(result.sampleSize).toBe(15);
    expect(result.level).toBe(0);
    expect(result.confidence).toBe('medium');
  });

  test('a per-level k override is respected instead of the global default', () => {
    const withDefaultK = hierarchicalBlend([
      { value: 1.0, n: 5 },
      { value: 0.0, n: 1000 }
    ]);
    const withSmallK = hierarchicalBlend([
      { value: 1.0, n: 5, k: 5 },
      { value: 0.0, n: 1000 }
    ]);
    // k=5 at n=5 is another exact 50/50 blend: (5*1 + 5*0)/(5+5) = 0.5.
    expect(withSmallK.value).toBeCloseTo(0.5, 10);
    // k=15 (default) at n=5 blends less toward the individual value: (5*1+15*0)/(5+15) = 0.25.
    expect(withDefaultK.value).toBeCloseTo(0.25, 10);
    expect(withSmallK.value).toBeGreaterThan(withDefaultK.value);
  });

  test('a full four-level backoff chain matching getMatchupPlan\'s real usage shape', () => {
    // Mirrors tendencyAnalytics.getMatchupPlan's actual level order (finest to coarsest):
    // exact matchup (no data here - the common case at grassroots scale) -> batter vs
    // bowler-archetype -> archetype vs archetype -> global. The exact-matchup level must
    // be skipped, and the final value must land strictly between the two populated
    // levels that did contribute, since blending is a weighted average.
    const result = hierarchicalBlend([
      { value: 0, n: 0 }, // exact matchup: no history at all
      { value: 0.30, n: 3 }, // this batter vs this bowling archetype
      { value: 0.10, n: 200 }, // archetype vs archetype
      { value: 0.045, n: 5000 } // global
    ]);
    expect(result.level).toBe(1); // finest level that actually contributed
    expect(result.value).toBeGreaterThan(0.045); // pulled up from pure global...
    expect(result.value).toBeLessThan(0.30); // ...but nowhere near the raw 3-ball estimate
  });
});
