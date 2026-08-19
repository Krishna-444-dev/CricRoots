"""E6 step 0: fix the split, and measure how finely the metric can resolve anything.

Run BEFORE the E6 design document is written, and before any candidate estimator is fitted. It
answers a question about the DATA, not about any model:

    How large a difference in excess Brier can a holdout of this size actually distinguish?

That number is what makes the preregistered Outcome A / Outcome B fork principled instead of
chosen. "Close to the oracle" then means "closer than this holdout can resolve", which is a fact
about the evidence available rather than a threshold picked to land somewhere.

Two disciplines this enforces:

  1. THE TEST SET IS NOT TOUCHED. Resolution is measured on VALIDATION. Validation and test are
     equal-sized draws from the same pool, so the resolution transfers, and the test labels stay
     unread until the single final evaluation.
  2. THE BOOTSTRAP RESAMPLES MATCHES, NOT ROWS. Rows within a match share one label and a smooth
     trajectory; resampling rows would treat ~18 correlated observations as independent and report
     a resolution several times finer than the truth.
"""

import json
import os

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results', 'e6')
ORACLE_CSV = os.path.join(HERE, '..', 'results', 'latest', 'oracle-values.csv')

SEED = 20260819
N_BOOTSTRAP = 4000
# 60 / 20 / 20 over MATCHES.
TRAIN_FRAC, VAL_FRAC = 0.60, 0.20


def three_way_split(df, seed=SEED):
    ids = np.array(sorted(df['match_id'].unique()))
    rng = np.random.RandomState(seed)
    rng.shuffle(ids)
    n = len(ids)
    n_train = int(n * TRAIN_FRAC)
    n_val = int(n * VAL_FRAC)
    train_ids = set(ids[:n_train])
    val_ids = set(ids[n_train:n_train + n_val])
    test_ids = set(ids[n_train + n_val:])
    assert not (train_ids & val_ids) and not (val_ids & test_ids) and not (train_ids & test_ids)
    return (
        df[df['match_id'].isin(train_ids)],
        df[df['match_id'].isin(val_ids)],
        df[df['match_id'].isin(test_ids)],
        {'train': sorted(train_ids), 'val': sorted(val_ids), 'test': sorted(test_ids)},
    )


def excess_brier(y, p, oracle_p):
    """Brier minus the irreducible component. What an estimator can actually control."""
    return float(np.mean((y - p) ** 2) - np.mean(oracle_p * (1 - oracle_p)))


def main():
    df = pd.read_csv(ORACLE_CSV)
    train, val, test, ids = three_way_split(df)

    # Bootstrap the resolution using the ORACLE as the estimator. No fitted model is involved, so
    # nothing here can be tuned toward a desired answer.
    rng = np.random.RandomState(SEED + 1)
    val_by_match = {m: g for m, g in val.groupby('match_id')}
    match_ids = np.array(list(val_by_match))

    draws = np.empty(N_BOOTSTRAP)
    for i in range(N_BOOTSTRAP):
        sample = rng.choice(match_ids, size=len(match_ids), replace=True)
        frames = [val_by_match[m] for m in sample]
        boot = pd.concat(frames, ignore_index=True)
        draws[i] = excess_brier(
            boot['win_probability'].to_numpy(),
            boot['oracle_p'].to_numpy(),
            boot['oracle_p'].to_numpy(),
        )

    se = float(draws.std(ddof=1))

    # The one-sample SE above is NOT the right instrument for the fork, and using it would have set
    # the threshold roughly 40x too loose. Comparing a candidate against the oracle on the SAME
    # holdout is a PAIRED comparison: the irreducible term is identical for both arms and cancels
    # exactly, so
    #
    #     excessBrier(model) - excessBrier(oracle) == Brier(model) - Brier(oracle)
    #
    # and the quantity to bootstrap is that paired difference. Its SE is far smaller because the
    # match-to-match variation in difficulty - which dominates the one-sample SE - cancels too.
    #
    # Calibrating detectable effect size without fitting anything: degrade the oracle by a known
    # amount and measure how small a paired difference the holdout can still resolve. Nothing here
    # is fitted, so nothing can be tuned toward a preferred answer.
    def paired_ci(p_a, p_b, y, groups, n=1500, seed=SEED + 2):
        r = np.random.RandomState(seed)
        uniq = np.array(sorted(set(groups)))
        index = {m: np.flatnonzero(groups == m) for m in uniq}
        out = np.empty(n)
        for i in range(n):
            pick = r.choice(uniq, size=len(uniq), replace=True)
            idx = np.concatenate([index[m] for m in pick])
            out[i] = np.mean((y[idx] - p_a[idx]) ** 2) - np.mean((y[idx] - p_b[idx]) ** 2)
        return float(np.percentile(out, 2.5)), float(np.percentile(out, 97.5))

    y_val = val['win_probability'].to_numpy()
    o_val = val['oracle_p'].to_numpy()
    g_val = val['match_id'].to_numpy()

    noise_rng = np.random.RandomState(SEED + 3)
    detectability = {}
    for sigma in (0.01, 0.02, 0.05, 0.10):
        degraded = np.clip(o_val + noise_rng.normal(0, sigma, size=o_val.shape), 0, 1)
        lo, hi = paired_ci(degraded, o_val, y_val, g_val)
        detectability[f'oracle_plus_noise_sd_{sigma}'] = {
            'mean_abs_deviation_from_oracle': round(float(np.mean(np.abs(degraded - o_val))), 5),
            'paired_brier_diff_ci95': [round(lo, 6), round(hi, 6)],
            'distinguishable_from_oracle': bool(lo > 0),
        }

    resolution = 2 * se

    report = {
        'purpose': 'fix the E6 split and measure the resolution of excess Brier, before any '
                   'estimator is fitted and without reading the test labels',
        'seed': SEED,
        'split_fractions': {'train': TRAIN_FRAC, 'val': VAL_FRAC, 'test': round(1 - TRAIN_FRAC - VAL_FRAC, 4)},
        'n_matches': {'train': len(ids['train']), 'val': len(ids['val']), 'test': len(ids['test'])},
        'n_rows': {'train': int(len(train)), 'val': int(len(val)), 'test': int(len(test))},
        'base_rate': {
            'train': round(float(train['win_probability'].mean()), 5),
            'val': round(float(val['win_probability'].mean()), 5),
            'test': 'DELIBERATELY NOT COMPUTED - test stays unread until the final evaluation',
        },
        'irreducible_brier_val': round(float(np.mean(val['oracle_p'] * (1 - val['oracle_p']))), 5),
        'oracle_excess_brier_val': round(
            excess_brier(val['win_probability'].to_numpy(), val['oracle_p'].to_numpy(),
                         val['oracle_p'].to_numpy()), 5),
        'one_sample_bootstrap': {
            'n_resamples': N_BOOTSTRAP,
            'unit': 'match (NOT row - rows within a match share a label)',
            'excess_brier_se': round(se, 6),
            'two_se': round(resolution, 6),
            'note': 'context only - NOT the fork threshold. The fork is a paired comparison, '
                    'where the irreducible term cancels and match difficulty cancels with it.',
        },
        'paired_detectability': detectability,
    }

    os.makedirs(RESULTS, exist_ok=True)
    with open(os.path.join(RESULTS, 'split-and-resolution.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')
    with open(os.path.join(RESULTS, 'split-match-ids.json'), 'w') as f:
        json.dump(ids, f, indent=2)
        f.write('\n')

    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
