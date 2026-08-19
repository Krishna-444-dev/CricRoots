"""RO1a - how close does the deployed estimator get to the exact probability?

This is a VALIDITY CHECK on the estimator, not a claim that any method works. The oracle reads the
ground truth of matchSimulator.js, so every number here is a statement about that simulator and
about our estimator's behaviour inside it. None of it is evidence about cricket.

Three things are measured, on a match-level holdout so the estimator is never scored on matches it
was fit on:

  1. Oracle MAE - mean |model - truth|. The programme's established instrument (Exp 6) for when the
     test distribution moves, because Brier is confounded by the realized base rate.
  2. Brier decomposition - observed = irreducible + excess, where irreducible = mean p(1-p) under
     the oracle. Separates "the world is stochastic" from "the estimator is wrong".
  3. A closed-form baseline built from the oracle's own state variables, to establish what the four
     features can support when used well rather than memorised.
"""

import json
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results', 'latest')
FEATURES = ['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']
SEED = 42


def match_level_split(df, holdout_frac=0.2, seed=SEED):
    ids = df['match_id'].unique()
    rng = np.random.RandomState(seed)
    rng.shuffle(ids)
    holdout = set(ids[:max(1, int(len(ids) * holdout_frac))])
    return df[~df['match_id'].isin(holdout)], df[df['match_id'].isin(holdout)]


def summary(name, model_p, oracle_p, y):
    err = np.abs(model_p - oracle_p)
    brier = float(brier_score_loss(y, np.clip(model_p, 0, 1)))
    irreducible = float(np.mean(oracle_p * (1 - oracle_p)))
    return {
        'name': name,
        'oracle_mae': round(float(err.mean()), 5),
        'oracle_mae_p90': round(float(np.percentile(err, 90)), 5),
        'oracle_rmse': round(float(np.sqrt(np.mean(err ** 2))), 5),
        'brier': round(brier, 5),
        'brier_irreducible': round(irreducible, 5),
        'brier_excess': round(brier - irreducible, 5),
        'corr_with_oracle': round(float(np.corrcoef(model_p, oracle_p)[0, 1]), 5),
    }


def main():
    df = pd.read_csv(os.path.join(RESULTS, 'oracle-values.csv'))
    train, hold = match_level_split(df)

    y = hold['win_probability'].to_numpy()
    oracle_p = hold['oracle_p'].to_numpy()

    # 1. The deployed estimator, fit exactly as deployment fits it.
    rf = RandomForestRegressor(n_estimators=50, random_state=SEED)
    rf.fit(train[FEATURES], train['win_probability'])
    p_rf = np.clip(rf.predict(hold[FEATURES]), 0, 1)

    # 2. A closed-form baseline over the oracle's own state variables. Deliberately simple: this is
    #    the "strong interpretable baseline" the research question is about, expressed with the
    #    quantities the problem actually turns on rather than the raw stored features.
    def design(frame):
        balls = frame['balls_remaining'].to_numpy(dtype=float)
        needed = frame['runs_needed'].to_numpy(dtype=float)
        wkts_left = 10.0 - frame['wickets_down'].to_numpy(dtype=float)
        rrr = needed / np.maximum(balls / 6.0, 1e-6)
        return np.column_stack([
            rrr,
            needed / np.maximum(balls, 1e-6),
            wkts_left,
            balls / 6.0,
            rrr * (10.0 / np.maximum(wkts_left, 1.0)),
        ])

    lr = LogisticRegression(max_iter=2000)
    lr.fit(design(train), train['win_probability'].astype(int))
    p_lr = np.clip(lr.predict_proba(design(hold))[:, 1], 0, 1)

    # 3. The oracle scored against the realized labels - the floor any estimator is chasing.
    p_or = oracle_p

    report = {
        'what_this_is': 'validity check of the estimator against the simulator ground truth. '
                        'Not evidence about cricket.',
        'n_holdout_rows': int(len(hold)),
        'n_holdout_matches': int(hold['match_id'].nunique()),
        'holdout_base_rate': round(float(y.mean()), 5),
        'oracle_mean_p': round(float(oracle_p.mean()), 5),
        'results': [
            summary('deployed RandomForest', p_rf, oracle_p, y),
            summary('closed-form logistic baseline', p_lr, oracle_p, y),
            summary('oracle itself (floor)', p_or, oracle_p, y),
        ],
    }

    with open(os.path.join(RESULTS, 'ro1a-oracle-comparison.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
