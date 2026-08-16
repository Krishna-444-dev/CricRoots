# Nested evidence pools: a verified structural defect in the production hierarchy

**Status: FINDING ONLY. No implementation. Experiment 6 is frozen and running; nothing here
touched it.**

Prompted by the observation that our evidence sources are nested subsets of one dataset rather
than independent experts. That observation is correct, it is verifiable from the production code,
and the magnitude turns out to be much larger than intuition suggests at exactly the rung that
matters most.

---

## 1. The nesting is exact, and guaranteed by construction

Not an assumption — it follows directly from `tendencyAnalytics.js`.

`getPlayerIdsByArchetype({ bowlingStyle })` (lines 109-116) returns **every** player with that
bowling style. It does not exclude the bowler in question. Same for `battingStyle`. So the four
levels assembled at lines 142-147 are:

```
E_exact      = {this batter}      x {this bowler}
E_bVsArch    = {this batter}      x {all bowlers of that style, INCLUDING this bowler}
E_archVsArch = {all batters of that style, INCLUDING this batter} x {all bowlers of that style}
E_global     = every tagged ball
```

giving strict containment:

```
E_exact  ⊂  E_bVsArch  ⊂  E_archVsArch  ⊂  E_global
```

Every ball in the exact matchup is counted again in all three coarser pools.

---

## 2. How much contamination, measured

Computed over the actual Experiment 6 training set (204 matches, 14,280 balls, 4,481 distinct
observed pairs) — pure computation over generated data, no database, no harness.

**Fraction of each pool that is already the finer pool nested inside it:**

| Nesting step | mean | median | p90 | max |
|---|---:|---:|---:|---:|
| `E_exact` within `E_bVsArch` | **15.6%** | 11.8% | 31.3% | **100.0%** |
| `E_bVsArch` within `E_archVsArch` | 1.4% | 1.3% | 2.6% | 4.6% |
| `E_archVsArch` within `E_global` | 12.7% | 12.1% | 15.3% | 15.3% |

Typical pool sizes: exact **3** balls, batter-vs-bowler-archetype **18**, archetype-vs-archetype
1,725, global 14,280.

**The first backoff rung is severely contaminated.** A 3-ball exact estimate is shrunk toward an
18-ball pool of which those same 3 balls are roughly a sixth. At the extreme — a batter who has
only ever faced that bowling style through this one bowler — the "prior" *is* the data, at 100%,
and the shrinkage step does nothing at all except consume a rung.

This is not a rounding-error effect, and it sits precisely at the rung that matters most for sparse
matchups.

---

## 3. Why the direction is consistent with H1's failure

`blendWithPrior` computes `(n·individual + k·prior) / (n + k)`. Empirical-Bayes shrinkage assumes
the prior is *independent* of the estimate being shrunk. Here it is not: the prior has been pulled
toward the individual estimate by the individual's own data.

The consequence has a definite sign. A contaminated prior sits closer to the individual estimate
than a clean one would, so blending moves the estimate **less** than intended. The result is
**systematic under-shrinkage** of exactly the noisiest estimates — the 1-to-14-ball ones.

That predicts the hierarchy should behave like an under-shrunk, noisier estimator. It lost on Brier
and lost badly on Spearman. Consistent.

**A second consistency check, which is the more interesting one.** `fullHierarchyNoArchetype`
(2 levels: exact → global) came out **bit-for-bit identical** to `singleLevelShrinkage` and beat
`fullHierarchy` in both worlds. Under this hypothesis that is exactly what should happen: in the
2-level chain the contamination is 3 balls in 14,280, about **0.02%** — negligible. The ablation
that removed the archetype rungs also removed essentially all of the contamination.

So the diagnostic's original explanation (archetype rungs inject noise from an uninformative
pooling variable) and this one (the first rung's shrinkage target is contaminated by its own data)
are **both** consistent with every result so far, and the archetype ablation cannot distinguish
them — it removed both mechanisms at once.

**This is a hypothesis consistent with the existing evidence. It is not established.** Separating
the two would need a rung that pools by archetype *excluding* the target — an experiment not yet
designed or run.

---

## 4. Novelty: the fix is textbook

The correction is to exclude the target's own observations from its shrinkage target —
leave-one-out or leave-this-group-out pooling. This is standard practice in empirical Bayes and has
been for decades. **Nothing about the remedy is novel**, and it must not be presented as such.

What is legitimately ours:

- **A verified defect in deployed code**, with the magnitude measured rather than asserted.
- **A quantification in a specific regime** — 15.6% mean self-contamination at the finest backoff
  rung under grassroots-scale sparsity — which is the kind of number that is usually assumed
  negligible and here plainly is not.
- **A candidate alternative explanation** for a result we had already attributed to something else,
  which is worth more than a confirmation would have been.

Sharpening the research question from "adaptive evidence allocation" (crowded, §0 of
`general-algorithm-landscape.md`) to "aggregation over *nested, overlapping* evidence pools" is a
genuine improvement in specificity. But note the honest position: standard hierarchical Bayes
handles nesting correctly **by modelling the hierarchy generatively** rather than by chaining
pairwise shrinkage steps. Our problem is arguably not that nesting is unsolved — it is that
`hierarchicalBlend` is a **misspecified approximation** to a well-understood model. That reading is
also fully consistent with H4: the joint model won because it is a correctly specified
hierarchical model, not because joint estimation is inherently superior.

---

## 5. Product implication, separate from the research

Independent of any research direction, `getMatchupPlan` has a real defect: its finest backoff rung
shrinks toward a target contaminated by the very data being shrunk, by ~16% on average and up to
100%. That is a bug to fix in the product regardless of what the research concludes.

It is the **second** self-inclusion defect found in this engine, after `getLiveMatchupPlan`'s
double-counting of in-progress-match balls (D4). Two independent instances of the same class of
error suggests the underlying issue is architectural: the pooling helpers take id lists and have
no notion of excluding the subject. Worth addressing as a pattern rather than as two point fixes.

**Not fixed here.** Production code stays untouched while experiments are in flight (D8), and
changing `getMatchupPlan` mid-programme would invalidate comparability with every result to date.

---

## 6. What this does not license

- No implementation, of anything.
- No claim that nested-evidence aggregation is an open problem — §4 argues it largely is not.
- No new experiment until Experiment 6 completes and its criteria are evaluated.
- Any follow-up needs a preregistered design with falsification criteria, and must include
  **standard hierarchical Bayes with leave-out pooling** as a baseline. If the textbook correction
  closes the gap, there is no mechanism contribution here — only a bug fix and a measurement.
