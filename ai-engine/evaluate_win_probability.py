import os
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import brier_score_loss

FEATURES = ['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']
RANDOM_STATE = 42


def match_level_split(df, holdout_frac=0.2, seed=RANDOM_STATE):
    # Split by match_id, not by row - rows from the same match share one outcome and a smooth
    # trajectory, so a row-level split would leak the label into "unseen" evaluation data.
    match_ids = df['match_id'].unique()
    rng = np.random.RandomState(seed)
    rng.shuffle(match_ids)
    n_holdout = max(1, int(len(match_ids) * holdout_frac))
    holdout_ids = set(match_ids[:n_holdout])
    holdout = df[df['match_id'].isin(holdout_ids)]
    train = df[~df['match_id'].isin(holdout_ids)]
    return train, holdout


def decile_calibration(y_true, y_pred, label):
    frame = pd.DataFrame({'y_true': y_true, 'y_pred': y_pred})
    try:
        frame['bucket'] = pd.qcut(frame['y_pred'], 10, duplicates='drop')
    except ValueError:
        frame['bucket'] = pd.cut(frame['y_pred'], 10)
    grouped = frame.groupby('bucket', observed=True).agg(
        n=('y_true', 'size'), mean_predicted=('y_pred', 'mean'), actual_win_rate=('y_true', 'mean')
    )
    print(f"\nDecile calibration - {label}")
    print(grouped.to_string(float_format=lambda v: f'{v:.3f}'))
    return grouped


def main():
    data_dir = os.path.join(os.path.dirname(__file__), 'data')
    real_df = pd.read_csv(os.path.join(data_dir, 'real_matches.csv'))
    synthetic_df = pd.read_csv(os.path.join(data_dir, 'matches.csv'))

    train_df, holdout_df = match_level_split(real_df)
    print(f"Real matches: {real_df['match_id'].nunique()} total -> "
          f"{train_df['match_id'].nunique()} train / {holdout_df['match_id'].nunique()} holdout")
    print(f"Real rows: {len(train_df)} train / {len(holdout_df)} holdout")

    real_model = RandomForestRegressor(n_estimators=50, random_state=RANDOM_STATE)
    real_model.fit(train_df[FEATURES], train_df['win_probability'])

    synthetic_model = RandomForestRegressor(n_estimators=50, random_state=RANDOM_STATE)
    synthetic_model.fit(synthetic_df[FEATURES], synthetic_df['win_probability'])

    y_true = holdout_df['win_probability'].values
    real_pred = real_model.predict(holdout_df[FEATURES])
    synthetic_pred = synthetic_model.predict(holdout_df[FEATURES])
    real_pred_clipped = np.clip(real_pred, 0, 1)
    synthetic_pred_clipped = np.clip(synthetic_pred, 0, 1)

    real_brier = brier_score_loss(y_true, real_pred_clipped)
    synthetic_brier = brier_score_loss(y_true, synthetic_pred_clipped)
    print(f"\nBrier score on real holdout (lower is better, 0=perfect, 0.25=coin-flip-blind):")
    print(f"  Real-trained model:      {real_brier:.4f}")
    print(f"  Synthetic-trained model: {synthetic_brier:.4f}")

    decile_calibration(y_true, real_pred_clipped, 'real-trained model on real holdout')
    decile_calibration(y_true, synthetic_pred_clipped, 'synthetic-trained model on real holdout (same situations)')

    print(f"\nHoldout actual win rate: {y_true.mean():.3f}")
    print(f"Real-trained mean predicted:      {real_pred_clipped.mean():.3f}")
    print(f"Synthetic-trained mean predicted: {synthetic_pred_clipped.mean():.3f}")


if __name__ == '__main__':
    main()
