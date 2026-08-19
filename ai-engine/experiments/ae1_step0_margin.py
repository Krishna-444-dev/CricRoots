"""AE-1 step 0: fix the equivalence margin for the ENDGAME regime, before any candidate is fitted.

E6's fork used "the CI includes zero", which tests non-significance rather than equivalence and is
satisfied by any sufficiently imprecise estimate - C4 met it with an oracle MAE four times the
winner's. AE-1 uses TOST instead, which needs a margin declared in advance.

The margin is measured, not chosen, by the same procedure E6 used: degrade the oracle by a known
amount and find the smallest degradation this holdout can distinguish. Run on VALIDATION only; the
test labels stay unread.

The endgame regime is where AE-1's primary endpoint lives, and it is small (a few hundred rows), so
its resolution is coarser than the whole-test resolution. Measuring it separately is the point.
"""

import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results', 'ae1')
ORACLE_CSV = os.path.join(HERE, '..', 'results', 'latest', 'oracle-values.csv')
SPLIT_JSON = os.path.join(HERE, '..', 'results', 'e6', 'split-match-ids.json')

SEED = 20260819
ENDGAME_MAX_OVERS = 2  # primary endpoint regime: overs_remaining <= 2


def paired_ci(p_a, p_b, y, groups, n=2000, seed=SEED + 11):
    rng = np.random.RandomState(seed)
    uniq = np.array(sorted(set(groups)))
    index = {m: np.flatnonzero(groups == m) for m in uniq}
    draws = np.empty(n)
    for i in range(n):
        pick = rng.choice(uniq, size=len(uniq), replace=True)
        idx = np.concatenate([index[m] for m in pick])
        draws[i] = np.mean((y[idx] - p_a[idx]) ** 2) - np.mean((y[idx] - p_b[idx]) ** 2)
    return float(np.percentile(draws, 2.5)), float(np.percentile(draws, 97.5))


def main():
    df = pd.read_csv(ORACLE_CSV)
    with open(SPLIT_JSON) as f:
        ids = json.load(f)
    val = df[df['match_id'].isin(set(ids['val']))].reset_index(drop=True)
    endgame = val[val['overs_remaining'] <= ENDGAME_MAX_OVERS].reset_index(drop=True)

    y = endgame['win_probability'].to_numpy(dtype=float)
    o = endgame['oracle_p'].to_numpy()
    g = endgame['match_id'].to_numpy()

    rng = np.random.RandomState(SEED + 12)
    ladder = {}
    smallest_detectable_mae = None
    for sigma in (0.01, 0.02, 0.03, 0.05, 0.08, 0.12):
        degraded = np.clip(o + rng.normal(0, sigma, size=o.shape), 0, 1)
        lo, hi = paired_ci(degraded, o, y, g)
        mae = float(np.mean(np.abs(degraded - o)))
        detectable = lo > 0
        ladder[f'sd_{sigma}'] = {
            'mean_abs_deviation_from_oracle': round(mae, 5),
            'paired_brier_diff_ci95': [round(lo, 6), round(hi, 6)],
            'distinguishable': bool(detectable),
        }
        if detectable and smallest_detectable_mae is None:
            smallest_detectable_mae = mae

    report = {
        'purpose': 'fix the AE-1 equivalence margin for the endgame regime, before fitting anything',
        'regime': f'overs_remaining <= {ENDGAME_MAX_OVERS}',
        'measured_on': 'validation only - test labels unread',
        'n_rows': int(len(endgame)),
        'n_matches': int(endgame['match_id'].nunique()),
        'endgame_base_rate': round(float(y.mean()), 5),
        'oracle_mean_p': round(float(o.mean()), 5),
        'irreducible_brier': round(float(np.mean(o * (1 - o))), 5),
        'degradation_ladder': ladder,
        'smallest_detectable_oracle_mae': round(smallest_detectable_mae, 5)
        if smallest_detectable_mae else None,
        'TOST_margin_oracle_mae': round(smallest_detectable_mae, 5) if smallest_detectable_mae else None,
        'decision_rule': (
            'A candidate is EQUIVALENT to the oracle in the endgame iff the upper bound of the '
            'paired bootstrap 95% CI for Brier(cand)-Brier(oracle), restricted to the endgame '
            'regime, lies BELOW the Brier-difference the margin corresponds to, AND its endgame '
            'oracle MAE is at or below the margin. Non-significance alone is not sufficient.'
        ),
    }

    os.makedirs(RESULTS, exist_ok=True)
    with open(os.path.join(RESULTS, 'ae1-step0-margin.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
