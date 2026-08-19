"""E6 - establish a scientifically trustworthy conventional baseline.

Implements experiments/e6-design.md exactly. The design was committed before this file existed;
the candidate set, the grids, the fork thresholds and the two reporting axes are all fixed there.

Protocol: fit on train -> select on validation -> refit selected config on train+val -> evaluate
ONCE on test. The test labels are not read by any selection path in this file.
"""

import hashlib
import json
import os
import platform
import subprocess

import numpy as np
import pandas as pd
import sklearn
from sklearn.ensemble import GradientBoostingClassifier, RandomForestRegressor
from sklearn.isotonic import IsotonicRegression
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss, log_loss

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results', 'e6')
ORACLE_CSV = os.path.join(HERE, '..', 'results', 'latest', 'oracle-values.csv')
SPLIT_JSON = os.path.join(RESULTS, 'split-match-ids.json')

SEED = 20260819
N_BOOTSTRAP = 4000
RAW = ['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']

# Preregistered thresholds (e6-design.md §4). Not to be edited after results exist.
PRACTICAL_MAE_THRESHOLD = 0.01
ORACLE_EXCESS_BRIER_VAL = 0.00312  # gate: test must not be materially worse than this

# Grids, declared before the run. Every point's validation score is reported, not only the winner.
GRID_C3 = [0.001, 0.01, 0.1, 1.0, 10.0, 100.0]
GRID_C4 = [
    {'min_samples_leaf': leaf, 'max_depth': depth}
    for leaf in (1, 5, 20, 50, 100, 200)
    for depth in (None, 6, 10)
]
GRID_C5 = [
    {'n_estimators': n, 'max_depth': d, 'learning_rate': lr}
    for n in (100, 300)
    for d in (2, 3, 4)
    for lr in (0.05, 0.1)
]


# --------------------------------------------------------------------------- feature construction

def chase_terms(df):
    """The derived basis. Mirrors the RO1a champion so C2 is directly comparable."""
    balls = df['balls_remaining'].to_numpy(dtype=float)
    needed = df['runs_needed'].to_numpy(dtype=float)
    wkts_left = 10.0 - df['wickets_down'].to_numpy(dtype=float)
    rrr = needed / np.maximum(balls / 6.0, 1e-6)
    return np.column_stack([
        rrr,
        needed / np.maximum(balls, 1e-6),
        wkts_left,
        balls / 6.0,
        rrr * (10.0 / np.maximum(wkts_left, 1.0)),
    ])


def chase_terms_rich(df):
    """C3's basis: the C2 terms plus squares and the two interactions a chase actually turns on."""
    base = chase_terms(df)
    rrr, per_ball, wkts_left, overs_left = base[:, 0], base[:, 1], base[:, 2], base[:, 3]
    return np.column_stack([
        base,
        rrr ** 2,
        overs_left ** 2,
        wkts_left ** 2,
        rrr * overs_left,
        wkts_left * overs_left,
        np.log1p(np.maximum(rrr, 0)),
    ])


# --------------------------------------------------------------------------------------- metrics

def ece_and_deciles(y, p):
    frame = pd.DataFrame({'y': y, 'p': p})
    try:
        frame['b'] = pd.qcut(frame['p'], 10, duplicates='drop')
    except ValueError:
        frame['b'] = pd.cut(frame['p'], 10)
    g = frame.groupby('b', observed=True).agg(n=('y', 'size'), mp=('p', 'mean'), aw=('y', 'mean'))
    w = g['n'] / g['n'].sum()
    ece = float((w * (g['mp'] - g['aw']).abs()).sum())
    deciles = [
        {'bucket': str(i), 'n': int(r['n']), 'mean_predicted': round(float(r['mp']), 4),
         'actual_win_rate': round(float(r['aw']), 4)}
        for i, r in g.iterrows()
    ]
    return ece, deciles


def axis1(y, p, oracle_p, base_rate):
    err = np.abs(p - oracle_p)
    brier = float(brier_score_loss(y, np.clip(p, 0, 1)))
    ece, deciles = ece_and_deciles(y, p)
    return {
        'brier': round(brier, 5),
        'log_loss': round(float(log_loss(y, np.clip(p, 1e-6, 1 - 1e-6), labels=[0, 1])), 5),
        'brier_skill_vs_constant': round(1 - brier / float(np.mean((y - base_rate) ** 2)), 5),
        'expected_calibration_error': round(ece, 5),
        'oracle_mae': round(float(err.mean()), 5),
        'oracle_mae_p90': round(float(np.percentile(err, 90)), 5),
        'oracle_rmse': round(float(np.sqrt(np.mean(err ** 2))), 5),
        'corr_with_oracle': round(float(np.corrcoef(p, oracle_p)[0, 1]), 5),
        'decile_calibration': deciles,
    }


def paired_brier_ci(p_cand, p_oracle, y, groups, n=N_BOOTSTRAP, seed=SEED + 7):
    """Bootstrap D = Brier(candidate) - Brier(oracle), resampling MATCHES."""
    rng = np.random.RandomState(seed)
    uniq = np.array(sorted(set(groups)))
    index = {m: np.flatnonzero(groups == m) for m in uniq}
    draws = np.empty(n)
    for i in range(n):
        pick = rng.choice(uniq, size=len(uniq), replace=True)
        idx = np.concatenate([index[m] for m in pick])
        draws[i] = np.mean((y[idx] - p_cand[idx]) ** 2) - np.mean((y[idx] - p_oracle[idx]) ** 2)
    return {
        'point': round(float(np.mean((y - p_cand) ** 2) - np.mean((y - p_oracle) ** 2)), 6),
        'ci95': [round(float(np.percentile(draws, 2.5)), 6), round(float(np.percentile(draws, 97.5)), 6)],
    }


def classify(paired, oracle_mae):
    """The preregistered A / A' / B fork. Thresholds fixed in e6-design.md §4."""
    s_met = paired['ci95'][0] <= 0 <= paired['ci95'][1]
    p_met = oracle_mae <= PRACTICAL_MAE_THRESHOLD
    if s_met and p_met:
        outcome = 'A'
    elif s_met and not p_met:
        outcome = "A'"
    elif not s_met and not p_met:
        outcome = 'B'
    else:
        outcome = 'INCOHERENT (P met, S not) - reported as a defect per design §4'
    return {'statistical_criterion_met': bool(s_met), 'practical_criterion_met': bool(p_met),
            'outcome': outcome}


# ------------------------------------------------------------------------------------ operational

def perturbation_sensitivity(predict, df):
    base = predict(df)
    out = {}
    for feat, step, label in [
        ('target_score', 1.0, 'target_score +1 run'),
        ('wickets_down', 1.0, 'wickets_down +1'),
        ('overs_remaining', 1 / 6, 'overs_remaining +1 ball'),
        ('current_run_rate', 0.1, 'current_run_rate +0.1'),
    ]:
        d = df.copy()
        d[feat] = d[feat] + step
        # Keep the derived columns consistent with the perturbed raw features.
        d['runs_needed'] = d['target_score'] - np.round(d['current_run_rate'] * (20 - d['overs_remaining']))
        d['balls_remaining'] = np.round(d['overs_remaining'] * 6)
        delta = np.abs(predict(d) - base)
        out[label] = {
            'mean_abs_delta_p': round(float(delta.mean()), 5),
            'p90': round(float(np.percentile(delta, 90)), 5),
            'frac_over_0.10': round(float(np.mean(delta > 0.10)), 5),
        }
    return out


def calibration_by_regime(y, p, df):
    regimes = {}
    overs = df['overs_remaining'].to_numpy()
    wkts_left = 10 - df['wickets_down'].to_numpy()
    rrr = df['runs_needed'].to_numpy() / np.maximum(df['balls_remaining'].to_numpy() / 6.0, 1e-6)
    for name, mask in [
        ('phase: overs_remaining 15-19', (overs >= 15)),
        ('phase: overs_remaining 6-14', (overs >= 6) & (overs < 15)),
        ('phase: overs_remaining 1-5', (overs < 6)),
        ('wickets in hand 0-3', wkts_left <= 3),
        ('wickets in hand 4-6', (wkts_left > 3) & (wkts_left <= 6)),
        ('wickets in hand 7-10', wkts_left > 6),
        ('required rate < 6', rrr < 6),
        ('required rate 6-10', (rrr >= 6) & (rrr <= 10)),
        ('required rate > 10', rrr > 10),
    ]:
        if mask.sum() < 30:
            regimes[name] = {'n': int(mask.sum()), 'note': 'too few rows to report'}
            continue
        ece, _ = ece_and_deciles(y[mask], p[mask])
        regimes[name] = {
            'n': int(mask.sum()),
            'ece': round(ece, 5),
            'mean_predicted': round(float(p[mask].mean()), 5),
            'actual_win_rate': round(float(y[mask].mean()), 5),
        }
    return regimes


def extrapolation_behaviour(predict, oracle_fn_frame):
    """States outside the [1, 19] training range that keyMoments.js genuinely requests."""
    rows = []
    for overs_remaining in (20.0, 19.0, 1.0, 0.5, 0.1):
        for target, wickets, crr in [(160, 2, 8.0), (200, 5, 9.5)]:
            overs_used = 20 - overs_remaining
            runs = round(crr * overs_used)
            rows.append({
                'overs_remaining': overs_remaining, 'wickets_down': wickets,
                'current_run_rate': crr, 'target_score': target,
                'balls_remaining': round(overs_remaining * 6), 'runs_needed': target - runs,
            })
    frame = pd.DataFrame(rows)
    frame['model_p'] = predict(frame)
    frame['oracle_p'] = oracle_fn_frame(frame)
    frame['in_training_range'] = (frame['overs_remaining'] >= 1) & (frame['overs_remaining'] <= 19)
    return [
        {k: (round(float(v), 5) if isinstance(v, (int, float, np.floating)) else bool(v))
         for k, v in r.items()}
        for r in frame.to_dict('records')
    ]


# ------------------------------------------------------------------------------------------- run

def git_sha():
    try:
        return subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=HERE,
                                       stderr=subprocess.DEVNULL).decode().strip()
    except Exception:
        return 'unknown'


def main():
    df = pd.read_csv(ORACLE_CSV)
    with open(SPLIT_JSON) as f:
        ids = json.load(f)

    train = df[df['match_id'].isin(set(ids['train']))].reset_index(drop=True)
    val = df[df['match_id'].isin(set(ids['val']))].reset_index(drop=True)
    test = df[df['match_id'].isin(set(ids['test']))].reset_index(drop=True)
    trval = pd.concat([train, val], ignore_index=True)

    y_tr, y_va, y_te = (d['win_probability'].to_numpy(dtype=float) for d in (train, val, test))
    y_trval = trval['win_probability'].to_numpy(dtype=float)
    o_va, o_te = val['oracle_p'].to_numpy(), test['oracle_p'].to_numpy()

    base_rate = float(y_trval.mean())

    # --- GATE 1: the oracle must be as well specified on test as on validation ------------------
    oracle_excess_test = float(np.mean((y_te - o_te) ** 2) - np.mean(o_te * (1 - o_te)))
    oracle_excess_val = float(np.mean((y_va - o_va) ** 2) - np.mean(o_va * (1 - o_va)))
    gate_oracle = {
        'oracle_excess_brier_val': round(oracle_excess_val, 6),
        'oracle_excess_brier_test': round(oracle_excess_test, 6),
        'preregistered_val_reference': ORACLE_EXCESS_BRIER_VAL,
        'passed': abs(oracle_excess_test - oracle_excess_val) < 0.02,
    }

    selections = {}

    # --- candidates: fit on train, score on validation ------------------------------------------
    def val_brier(p):
        return float(brier_score_loss(y_va, np.clip(p, 0, 1)))

    # C1
    c1 = LogisticRegression(max_iter=5000)
    c1.fit(train[RAW], y_tr.astype(int))
    selections['C1'] = {'config': 'logistic on 4 raw features',
                        'val_brier': round(val_brier(c1.predict_proba(val[RAW])[:, 1]), 5)}

    # C2
    c2 = LogisticRegression(max_iter=5000)
    c2.fit(chase_terms(train), y_tr.astype(int))
    selections['C2'] = {'config': 'logistic on 5 derived chase terms',
                        'val_brier': round(val_brier(c2.predict_proba(chase_terms(val))[:, 1]), 5)}

    # C3 - penalty selected on validation
    c3_scores = []
    for C in GRID_C3:
        m = LogisticRegression(max_iter=5000, C=C)
        m.fit(chase_terms_rich(train), y_tr.astype(int))
        c3_scores.append({'C': C, 'val_brier': round(val_brier(m.predict_proba(chase_terms_rich(val))[:, 1]), 5),
                          'n_nonzero_coef': int(np.sum(np.abs(m.coef_) > 1e-8))})
    c3_best = min(c3_scores, key=lambda r: r['val_brier'])
    selections['C3'] = {'grid': c3_scores, 'selected': c3_best}

    # C4 - RF capacity selected on validation
    c4_scores = []
    for g in GRID_C4:
        m = RandomForestRegressor(n_estimators=200, random_state=SEED, n_jobs=-1, **g)
        m.fit(train[RAW], y_tr)
        c4_scores.append({**{k: str(v) for k, v in g.items()},
                          'val_brier': round(val_brier(np.clip(m.predict(val[RAW]), 0, 1)), 5)})
    c4_best = min(c4_scores, key=lambda r: r['val_brier'])
    selections['C4'] = {'grid': c4_scores, 'selected': c4_best,
                        'deployed_config_for_reference': {'min_samples_leaf': '1', 'max_depth': 'None',
                                                          'n_estimators': 50}}

    # C5 - boosting capacity selected on validation
    c5_scores = []
    for g in GRID_C5:
        m = GradientBoostingClassifier(random_state=SEED, **g)
        m.fit(chase_terms(train), y_tr.astype(int))
        c5_scores.append({**{k: str(v) for k, v in g.items()},
                          'val_brier': round(val_brier(m.predict_proba(chase_terms(val))[:, 1]), 5)})
    c5_best = min(c5_scores, key=lambda r: r['val_brier'])
    selections['C5'] = {'grid': c5_scores, 'selected': c5_best}

    # --- refit selected configs on train+val, then predict test ----------------------------------
    def fit_final():
        out = {}

        m = LogisticRegression(max_iter=5000)
        m.fit(trval[RAW], y_trval.astype(int))
        out['C1 logistic (raw features)'] = lambda d, m=m: m.predict_proba(d[RAW])[:, 1]

        m = LogisticRegression(max_iter=5000)
        m.fit(chase_terms(trval), y_trval.astype(int))
        out['C2 logistic (chase terms)'] = lambda d, m=m: m.predict_proba(chase_terms(d))[:, 1]

        m = LogisticRegression(max_iter=5000, C=c3_best['C'])
        m.fit(chase_terms_rich(trval), y_trval.astype(int))
        out['C3 regularized logistic (rich)'] = lambda d, m=m: m.predict_proba(chase_terms_rich(d))[:, 1]

        g = {'min_samples_leaf': int(c4_best['min_samples_leaf']),
             'max_depth': None if c4_best['max_depth'] == 'None' else int(c4_best['max_depth'])}
        m = RandomForestRegressor(n_estimators=200, random_state=SEED, n_jobs=-1, **g)
        m.fit(trval[RAW], y_trval)
        out['C4 random forest (tuned)'] = lambda d, m=m: np.clip(m.predict(d[RAW]), 0, 1)

        g = {'n_estimators': int(c5_best['n_estimators']), 'max_depth': int(c5_best['max_depth']),
             'learning_rate': float(c5_best['learning_rate'])}
        m = GradientBoostingClassifier(random_state=SEED, **g)
        m.fit(chase_terms(trval), y_trval.astype(int))
        out['C5 gradient boosting (tuned)'] = lambda d, m=m: m.predict_proba(chase_terms(d))[:, 1]

        return out

    finals = {'C0 constant base rate': lambda d, br=base_rate: np.full(len(d), br)}
    finals.update(fit_final())

    # C6 - post-hoc isotonic on the validation-selected winner.
    #
    # PROTOCOL NOTE, recorded rather than glossed: design §3 says to refit the selected config on
    # train+val, but an isotonic calibrator fitted on validation cannot sit on top of a base model
    # that was refit on validation - its fitting data would be in-sample and the calibration would
    # be measuring itself. So C6's base stays fit on TRAIN only. C6 therefore sees fewer training
    # rows than C0-C5, and any comparison must carry that caveat. This is a gap in the design, not
    # a result-driven change; no candidate was added or removed.
    val_ranking = {k: v for k, v in
                   [('C1', selections['C1']['val_brier']), ('C2', selections['C2']['val_brier']),
                    ('C3', c3_best['val_brier']), ('C4', c4_best['val_brier']),
                    ('C5', c5_best['val_brier'])]}
    c6_base_name = min(val_ranking, key=val_ranking.get)

    base_fitters = {
        'C1': (lambda d: d[RAW], LogisticRegression(max_iter=5000)),
        'C2': (chase_terms, LogisticRegression(max_iter=5000)),
        'C3': (chase_terms_rich, LogisticRegression(max_iter=5000, C=c3_best['C'])),
        'C4': (lambda d: d[RAW], RandomForestRegressor(
            n_estimators=200, random_state=SEED, n_jobs=-1,
            min_samples_leaf=int(c4_best['min_samples_leaf']),
            max_depth=None if c4_best['max_depth'] == 'None' else int(c4_best['max_depth']))),
        'C5': (chase_terms, GradientBoostingClassifier(
            random_state=SEED, n_estimators=int(c5_best['n_estimators']),
            max_depth=int(c5_best['max_depth']), learning_rate=float(c5_best['learning_rate']))),
    }
    tf, est = base_fitters[c6_base_name]
    is_reg = isinstance(est, RandomForestRegressor)
    est.fit(tf(train), y_tr if is_reg else y_tr.astype(int))
    raw_val = np.clip(est.predict(tf(val)), 0, 1) if is_reg else est.predict_proba(tf(val))[:, 1]
    iso = IsotonicRegression(out_of_bounds='clip', y_min=0, y_max=1)
    iso.fit(raw_val, y_va)

    def c6_predict(d, est=est, tf=tf, iso=iso, is_reg=is_reg):
        raw = np.clip(est.predict(tf(d)), 0, 1) if is_reg else est.predict_proba(tf(d))[:, 1]
        return iso.predict(raw)

    finals[f'C6 {c6_base_name} + isotonic'] = c6_predict
    selections['C6'] = {
        'base_selected_on_validation': c6_base_name,
        'validation_brier_ranking': val_ranking,
        'base_fit_on': 'train only (see protocol note in source)',
        'calibrator_changed_predictions': bool(
            np.mean(np.abs(c6_predict(val) - raw_val)) > 1e-9),
        'mean_abs_calibration_shift_on_val': round(float(np.mean(np.abs(c6_predict(val) - raw_val))), 5),
    }

    # --- SINGLE test evaluation ------------------------------------------------------------------
    from diagnostics_oracle_bridge import oracle_for_frame  # noqa: E402  (local helper)

    groups = test['match_id'].to_numpy()
    results = []
    for name, predict in finals.items():
        p = np.clip(predict(test), 0, 1)
        entry = {
            'candidate': name,
            'axis1_predictive': axis1(y_te, p, o_te, base_rate),
            'paired_vs_oracle': paired_brier_ci(p, o_te, y_te, groups),
        }
        entry['classification'] = classify(entry['paired_vs_oracle'],
                                           entry['axis1_predictive']['oracle_mae'])
        entry['axis2_operational'] = {
            'perturbation_sensitivity': perturbation_sensitivity(lambda d: np.clip(predict(d), 0, 1), test),
            'calibration_by_regime': calibration_by_regime(y_te, p, test),
            'extrapolation': extrapolation_behaviour(lambda d: np.clip(predict(d), 0, 1), oracle_for_frame),
        }
        results.append(entry)

    # oracle itself, as the floor row
    results.append({
        'candidate': 'ORACLE (floor, not a candidate)',
        'axis1_predictive': axis1(y_te, o_te, o_te, base_rate),
        'paired_vs_oracle': paired_brier_ci(o_te, o_te, y_te, groups),
        'classification': {'outcome': 'n/a'},
    })

    # --- gate 2: C0 must be beaten ---------------------------------------------------------------
    c0 = next(r for r in results if r['candidate'].startswith('C0'))
    best_non_c0 = min((r for r in results if r['candidate'][:2] not in ('C0', 'OR')),
                      key=lambda r: r['axis1_predictive']['brier'])
    gate_c0 = {
        'c0_brier': c0['axis1_predictive']['brier'],
        'best_candidate': best_non_c0['candidate'],
        'best_brier': best_non_c0['axis1_predictive']['brier'],
        'passed': best_non_c0['axis1_predictive']['brier'] < c0['axis1_predictive']['brier'],
    }

    # --- feature distribution, train vs test -----------------------------------------------------
    dist = {}
    for f in RAW + ['runs_needed', 'balls_remaining']:
        dist[f] = {
            'train': {'mean': round(float(trval[f].mean()), 4), 'min': round(float(trval[f].min()), 4),
                      'max': round(float(trval[f].max()), 4)},
            'test': {'mean': round(float(test[f].mean()), 4), 'min': round(float(test[f].min()), 4),
                     'max': round(float(test[f].max()), 4)},
        }

    with open(SPLIT_JSON, 'rb') as f:
        split_hash = hashlib.sha256(f.read()).hexdigest()[:16]

    report = {
        'experiment': 'E6 - conventional baseline under valid selection discipline',
        'design': 'ai-engine/experiments/e6-design.md (preregistered, committed before this file)',
        'provenance': 'matchSimulator.js output. Statements are about that simulator, not cricket.',
        'environment': {
            'git_sha': git_sha(), 'sklearn': sklearn.__version__, 'numpy': np.__version__,
            'python': platform.python_version(), 'split_file_sha256_16': split_hash, 'seed': SEED,
        },
        'gates': {'oracle_specification': gate_oracle, 'beats_constant_baseline': gate_c0},
        'split': {'train_matches': len(ids['train']), 'val_matches': len(ids['val']),
                  'test_matches': len(ids['test']), 'test_rows': int(len(test)),
                  'test_base_rate': round(float(y_te.mean()), 5)},
        'selection_on_validation': selections,
        'test_results': results,
        'feature_distribution_train_vs_test': dist,
        'preregistered_thresholds': {
            'practical_oracle_mae': PRACTICAL_MAE_THRESHOLD,
            'statistical': 'paired bootstrap 95% CI for Brier(cand)-Brier(oracle) includes 0',
        },
    }

    os.makedirs(RESULTS, exist_ok=True)
    with open(os.path.join(RESULTS, 'e6-results.json'), 'w') as f:
        json.dump(report, f, indent=2, sort_keys=False)
        f.write('\n')

    # concise console summary
    print(f"\nGATES  oracle_spec={gate_oracle['passed']}  beats_C0={gate_c0['passed']}")
    print(f"TEST   {len(ids['test'])} matches / {len(test)} rows, base rate {y_te.mean():.4f}\n")
    print(f"{'candidate':38} {'brier':>8} {'oracleMAE':>10} {'pairedD':>9} {'CI95':>22} {'outcome':>8}")
    for r in results:
        a, p = r['axis1_predictive'], r['paired_vs_oracle']
        ci = f"[{p['ci95'][0]:+.5f},{p['ci95'][1]:+.5f}]"
        print(f"{r['candidate'][:38]:38} {a['brier']:8.5f} {a['oracle_mae']:10.5f} "
              f"{p['point']:+9.5f} {ci:>22} {r['classification']['outcome']:>8}")
    print(f"\nfull report -> {os.path.join(RESULTS, 'e6-results.json')}")


if __name__ == '__main__':
    main()
