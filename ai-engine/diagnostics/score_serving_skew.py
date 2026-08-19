"""Prediction-space effect of the training/serving feature skew, measured BEFORE any fix.

measure-serving-skew.js quantifies the skew in feature space. That is necessary but not sufficient:
a feature can be wrong and the prediction barely move. This scores both feature vectors through the
model the deployment actually builds, and decomposes the effect by defect so we know which of the
three is worth what.

Trains exactly as recommendation_model.py:51-52 does - RandomForestRegressor(n_estimators=50,
random_state=42) on 100% of data/real_matches.csv - because the question is "what does the DEPLOYED
model do with these inputs", not "what would a well-trained model do".

Read-only. Writes to results/pre-remediation/ only.
"""

import json
import os

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor

HERE = os.path.dirname(__file__)
OUT_DIR = os.path.join(HERE, '..', 'results', 'pre-remediation')
FEATURES = ['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']


def describe(name, v):
    return {
        'label': name,
        'n': int(len(v)),
        'mean': round(float(np.mean(v)), 5),
        'p50': round(float(np.percentile(v, 50)), 5),
        'p90': round(float(np.percentile(v, 90)), 5),
        'p99': round(float(np.percentile(v, 99)), 5),
        'max': round(float(np.max(v)), 5),
        'frac_over_0.05': round(float(np.mean(v > 0.05)), 5),
        'frac_over_0.10': round(float(np.mean(v > 0.10)), 5),
    }


def main():
    real = pd.read_csv(os.path.join(HERE, '..', 'data', 'real_matches.csv'))
    states = pd.read_csv(os.path.join(OUT_DIR, 'serving-skew-states.csv'))

    # Exactly the deployed training call.
    model = RandomForestRegressor(n_estimators=50, random_state=42)
    model.fit(real[FEATURES], real['win_probability'])

    served = states[['served_' + f for f in FEATURES]].to_numpy()
    train = states[['train_' + f for f in FEATURES]].to_numpy()

    # Isolate the two independent defects: overs-notation (features 0 and 2) and the target
    # off-by-one (feature 3). Scoring the hybrid tells us which fix is load-bearing.
    overs_only = served.copy()
    overs_only[:, 3] = train[:, 3]
    target_only = train.copy()
    target_only[:, 3] = served[:, 3]

    p_served = np.clip(model.predict(served), 0, 1)
    p_train = np.clip(model.predict(train), 0, 1)
    p_overs = np.clip(model.predict(overs_only), 0, 1)
    p_target = np.clip(model.predict(target_only), 0, 1)

    mid = states['balls_into_over'].to_numpy() != 0

    report = {
        'model': 'RandomForestRegressor(n_estimators=50, random_state=42), fit on 100% of real_matches.csv',
        'n_states': int(len(states)),
        'mid_over_fraction': round(float(mid.mean()), 4),
        'all_three_defects': describe('|Δp| served vs training', np.abs(p_served - p_train)),
        'all_three_defects_mid_over_only': describe('|Δp| mid-over only', np.abs(p_served - p_train)[mid]),
        'overs_notation_defect_alone': describe('|Δp| overs-notation only', np.abs(p_overs - p_train)),
        'target_off_by_one_alone': describe('|Δp| target off-by-one only', np.abs(p_target - p_train)),
        'mean_predicted': {
            'served': round(float(p_served.mean()), 5),
            'training_convention': round(float(p_train.mean()), 5),
        },
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'serving-skew-predictions.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
