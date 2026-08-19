"""Is the deployed model pathologically sensitive to ANY small input perturbation?

score_serving_skew.py produced a counterintuitive result: the one-run target off-by-one moved
predictions MORE (mean |Δp| = 0.099) than the overs-notation defect (0.065). Two readings:

  (a) the off-by-one specifically matters, or
  (b) the model is unstable to any perturbation, and the off-by-one is merely one instance.

These imply different fixes, so the reading has to be established rather than assumed. This probe
perturbs each feature by one minimal unit on the model's OWN training rows - where there is no
skew, no extrapolation, and no domain violation - and measures the response. If a ±1 run change on
in-distribution data moves predictions as much as the bug does, reading (b) holds and the headline
finding is about model capacity, not about the bug.

Reference point: `sklearn`'s default RandomForestRegressor grows trees to purity. With 11,233 rows
and 4 features that is ~1 row per leaf, so the fitted surface is a step function with steps at
essentially every observed value.
"""

import json
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, '..', 'results', 'pre-remediation')
FEATURES = ['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']

# One minimal, cricket-meaningful unit of each feature.
PERTURBATIONS = {
    'target_score': 1.0,        # one run
    'wickets_down': 1.0,        # one wicket
    'overs_remaining': 1 / 6,   # one ball
    'current_run_rate': 0.1,    # a tenth of a run per over
}


def summarize(v):
    return {
        'mean_abs_delta_p': round(float(np.mean(v)), 5),
        'p50': round(float(np.percentile(v, 50)), 5),
        'p90': round(float(np.percentile(v, 90)), 5),
        'max': round(float(np.max(v)), 5),
        'frac_over_0.10': round(float(np.mean(v > 0.10)), 5),
    }


def main():
    real = pd.read_csv(os.path.join(HERE, '..', 'data', 'real_matches.csv'))
    X = real[FEATURES]
    y = real['win_probability']

    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(X, y)
    base = np.clip(model.predict(X), 0, 1)

    out = {
        'note': 'perturbations applied to the model\'s own training rows - in-distribution, no skew',
        'n_rows': int(len(X)),
        'in_sample_mean_prediction': round(float(base.mean()), 5),
        'actual_base_rate': round(float(y.mean()), 5),
        'per_feature': {},
    }

    for feat, step in PERTURBATIONS.items():
        Xp = X.copy()
        Xp[feat] = Xp[feat] + step
        pert = np.clip(model.predict(Xp), 0, 1)
        out['per_feature'][f'{feat} +{step:g}'] = summarize(np.abs(pert - base))

    # A leaf-purity check: how close is the in-sample fit to simply reproducing the labels?
    out['in_sample_mean_abs_error'] = round(float(np.mean(np.abs(base - y))), 5)
    out['in_sample_fraction_within_0.01_of_label'] = round(float(np.mean(np.abs(base - y) < 0.01)), 5)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'model-stability.json'), 'w') as f:
        json.dump(out, f, indent=2)
        f.write('\n')
    print(json.dumps(out, indent=2))


if __name__ == '__main__':
    main()
