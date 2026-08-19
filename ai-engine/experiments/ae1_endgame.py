"""AE-1 - is the endgame gap a functional-form gap or a representation gap?

Implements experiments/endgame-research-design.md §2 as amended. The design and both amendments
(A5 added by review; primary endpoint changed after step 0 failed validity gate 2) were committed
before this file existed.

Candidate set is closed: A0-A5 plus A5o, against the exact oracle. The 4,800-state grid is frozen.
"""

import json
import os
import platform
import subprocess

import numpy as np
import pandas as pd
from scipy.optimize import minimize
from scipy.stats import norm
from sklearn.ensemble import GradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import brier_score_loss

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from diagnostics_oracle_bridge import oracle_for_states  # noqa: E402
from e6_baseline import chase_terms, chase_terms_rich  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS = os.path.join(HERE, '..', 'results', 'ae1')
ORACLE_CSV = os.path.join(HERE, '..', 'results', 'latest', 'oracle-values.csv')
SPLIT_JSON = os.path.join(HERE, '..', 'results', 'e6', 'split-match-ids.json')

SEED = 20260819
TOTAL_OVERS = 20
C3_PENALTY = 0.01          # exactly what E6 selected on validation
RUN_SUPPORT = [0, 1, 2, 3, 4, 6]
ENDGAME_MAX_OVERS = 2
COMPETITIVE = (0.2, 0.8)

# FROZEN GRID - declared in the design, not to be changed after results exist.
GRID_BALLS = range(1, 13)
GRID_WICKETS = range(0, 10)
GRID_NEEDED = range(1, 41)


# ------------------------------------------------- empirical per-ball model, from training only

def observed_overs(train):
    """Complete-over (runs, wickets) outcomes recovered from consecutive training checkpoints.

    Restricted to overs that CANNOT terminate, so the estimate is not censored by the innings
    ending mid-over: runs still needed > 36 (unreachable in one over) and wickets_down <= 6.

    Validity note carried from the design: pooling overs like this is correct only because this
    world's ball process is homogeneous. It would NOT be valid in World E.
    """
    rows = []
    for _, g in train.groupby('match_id'):
        g = g.sort_values('overs_remaining', ascending=False)
        overs_rem = g['overs_remaining'].to_numpy()
        crr = g['current_run_rate'].to_numpy()
        wk = g['wickets_down'].to_numpy()
        tgt = g['target_score'].to_numpy()
        runs = np.round(crr * (TOTAL_OVERS - overs_rem)).astype(int)
        for i in range(len(g) - 1):
            if overs_rem[i] - overs_rem[i + 1] != 1:
                continue                       # not consecutive overs
            needed_at_start = tgt[i] - runs[i]
            if needed_at_start <= 36 or wk[i] > 6:
                continue                       # censorable
            rows.append((int(runs[i + 1] - runs[i]), int(wk[i + 1] - wk[i])))
    return pd.DataFrame(rows, columns=['runs', 'wickets'])


def over_pmf(p_wicket, p_runs, max_runs=60):
    """Exact joint P(runs=r, wickets=j) for one over of 6 legal balls under the per-ball model.

    Conditioning on j wickets, runs are the sum of (6-j) scoring balls, so the joint factorises
    exactly - no simulation needed.
    """
    from math import comb
    joint = np.zeros((max_runs + 1, 7))
    scoring = np.zeros(max_runs + 1)
    for k, pk in zip(RUN_SUPPORT, p_runs):
        scoring[k] += pk
    for j in range(7):
        conv = np.zeros(max_runs + 1)
        conv[0] = 1.0
        for _ in range(6 - j):
            conv = np.convolve(conv, scoring)[:max_runs + 1]
        joint[:, j] = comb(6, j) * (p_wicket ** j) * ((1 - p_wicket) ** (6 - j)) * conv
    return joint


def fit_per_ball(obs):
    """MLE of the per-ball model against observed over totals. Training data only."""
    counts = obs.groupby(['runs', 'wickets']).size().reset_index(name='n')
    counts = counts[(counts['runs'] >= 0) & (counts['runs'] <= 60) & (counts['wickets'] <= 6)]

    def nll(theta):
        pw = 1 / (1 + np.exp(-theta[0]))
        w = np.exp(theta[1:])
        p_runs = w / w.sum()
        joint = over_pmf(pw, p_runs)
        ll = 0.0
        for r, j, n in counts[['runs', 'wickets', 'n']].to_numpy():
            ll += n * np.log(max(joint[int(r), int(j)], 1e-300))
        return -ll

    x0 = np.concatenate([[np.log(0.05 / 0.95)], np.log(np.array([0.35, 0.33, 0.10, 0.02, 0.14, 0.06]))])
    res = minimize(nll, x0, method='Nelder-Mead',
                   options={'maxiter': 20000, 'maxfev': 20000, 'xatol': 1e-8, 'fatol': 1e-8})
    pw = 1 / (1 + np.exp(-res.x[0]))
    w = np.exp(res.x[1:])
    p_runs = w / w.sum()
    return pw, p_runs, res


def ball_moments(pw, p_runs):
    """Mean and sd of runs per legal ball (a wicket ball scores 0)."""
    vals = np.array(RUN_SUPPORT, dtype=float)
    m1 = (1 - pw) * float(np.sum(p_runs * vals))
    m2 = (1 - pw) * float(np.sum(p_runs * vals ** 2))
    return m1, float(np.sqrt(max(m2 - m1 ** 2, 1e-12)))


# ------------------------------------------------------ A5 / A5o: exact finite-horizon DP

def build_empirical_dp(pw, p_runs, max_balls=130, max_runs=330, use_wickets=True):
    """Exact P(win) under the ESTIMATED per-ball model. Same recurrence as diagnostics/oracle.js,
    but driven by moments learned from training data rather than by the generator."""
    outcomes = []
    if use_wickets:
        outcomes.append({'p': pw, 'runs': 0, 'wicket': True})
    for k, pk in zip(RUN_SUPPORT, p_runs):
        outcomes.append({'p': (1 - pw) * pk if use_wickets else pk, 'runs': k, 'wicket': False})

    W = 11
    V = [[np.zeros(max_runs + 1) for _ in range(W)] for _ in range(max_balls + 1)]
    for b in range(max_balls + 1):
        for w in range(W):
            for r in range(max_runs + 1):
                if r <= 0:
                    V[b][w][r] = 1.0
                    continue
                if b == 0 or (use_wickets and w >= 10):
                    V[b][w][r] = 0.0
                    continue
                acc = 0.0
                for o in outcomes:
                    nr = max(0, r - o['runs'])
                    nw = w + 1 if (use_wickets and o['wicket']) else w
                    if nr <= 0:
                        acc += o['p']
                    elif (use_wickets and nw >= 10) or b - 1 == 0:
                        acc += 0.0
                    else:
                        acc += o['p'] * V[b - 1][nw][nr]
                V[b][w][r] = acc

    def f(balls, wickets, needed):
        if needed <= 0:
            return 1.0
        b = int(min(max(0, round(balls)), max_balls))
        w = int(min(max(0, round(wickets)), 10))
        r = int(min(max(0, round(needed)), max_runs))
        if b == 0 or (use_wickets and w >= 10):
            return 0.0
        return float(V[b][w][r])

    return f


# ------------------------------------------------------------------------ candidate assembly

def add_margin(frame, mu, sd):
    balls = frame['balls_remaining'].to_numpy(dtype=float)
    needed = frame['runs_needed'].to_numpy(dtype=float)
    z = (balls * mu - needed) / (sd * np.sqrt(np.maximum(balls, 1e-9)))
    return z.reshape(-1, 1)


def basis_a1(frame, mu, sd):
    return np.hstack([chase_terms_rich(frame), add_margin(frame, mu, sd)])


def basis_a2(frame, mu, sd):
    balls = frame['balls_remaining'].to_numpy(dtype=float)
    needed = frame['runs_needed'].to_numpy(dtype=float)
    rt = np.sqrt(np.maximum(balls, 1e-9))
    return np.hstack([
        chase_terms_rich(frame), add_margin(frame, mu, sd),
        rt.reshape(-1, 1), (needed / rt).reshape(-1, 1), (1 / rt).reshape(-1, 1),
    ])


# ---------------------------------------------------------------------------------- reporting

def mae(p, o):
    return float(np.mean(np.abs(np.asarray(p) - np.asarray(o))))


def paired_ci(p_a, p_b, y, groups, n=2000, seed=SEED + 21):
    rng = np.random.RandomState(seed)
    uniq = np.array(sorted(set(groups)))
    idx = {m: np.flatnonzero(groups == m) for m in uniq}
    draws = np.empty(n)
    for i in range(n):
        pick = rng.choice(uniq, size=len(uniq), replace=True)
        ii = np.concatenate([idx[m] for m in pick])
        draws[i] = np.mean((y[ii] - p_a[ii]) ** 2) - np.mean((y[ii] - p_b[ii]) ** 2)
    return [round(float(np.percentile(draws, 2.5)), 6), round(float(np.percentile(draws, 97.5)), 6)]


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
    y_trval = trval['win_probability'].to_numpy(dtype=float)
    y_te = test['win_probability'].to_numpy(dtype=float)

    # --- empirical per-ball model, TRAINING ONLY -------------------------------------------------
    obs = observed_overs(train)
    pw, p_runs, res = fit_per_ball(obs)
    mu, sd = ball_moments(pw, p_runs)
    empirical_model = {
        'n_uncensored_overs_used': int(len(obs)),
        'p_wicket_per_ball': round(float(pw), 5),
        'p_runs': {str(k): round(float(v), 5) for k, v in zip(RUN_SUPPORT, p_runs)},
        'mean_runs_per_ball': round(mu, 5),
        'sd_runs_per_ball': round(sd, 5),
        'optimiser_converged': bool(res.success),
        'note': 'estimated from training checkpoints only - no generator access, no test data',
    }

    dp_full = build_empirical_dp(pw, p_runs, use_wickets=True)
    dp_nowk = build_empirical_dp(pw, p_runs, use_wickets=False)

    # --- fitted candidates, refit on train+val ---------------------------------------------------
    a0 = LogisticRegression(max_iter=5000, C=C3_PENALTY)
    a0.fit(chase_terms_rich(trval), y_trval.astype(int))

    a1 = LogisticRegression(max_iter=5000, C=C3_PENALTY)
    a1.fit(basis_a1(trval, mu, sd), y_trval.astype(int))

    a2 = LogisticRegression(max_iter=5000, C=C3_PENALTY)
    a2.fit(basis_a2(trval, mu, sd), y_trval.astype(int))

    a3 = GradientBoostingClassifier(random_state=SEED, n_estimators=100, max_depth=2, learning_rate=0.05)
    a3.fit(basis_a1(trval, mu, sd), y_trval.astype(int))

    def a4_predict(frame):
        balls = frame['balls_remaining'].to_numpy(dtype=float)
        needed = frame['runs_needed'].to_numpy(dtype=float)
        return norm.cdf((balls * mu - needed) / (sd * np.sqrt(np.maximum(balls, 1e-9))))

    def dp_predict(frame, fn):
        return np.array([fn(b, w, r) for b, w, r in
                         zip(frame['balls_remaining'], frame['wickets_down'], frame['runs_needed'])])

    candidates = {
        'A0 C3 incumbent': lambda d: a0.predict_proba(chase_terms_rich(d))[:, 1],
        'A1 + standardized margin': lambda d: a1.predict_proba(basis_a1(d, mu, sd))[:, 1],
        'A2 + margin + sqrt(n) terms': lambda d: a2.predict_proba(basis_a2(d, mu, sd))[:, 1],
        'A3 A1 basis, boosted': lambda d: a3.predict_proba(basis_a1(d, mu, sd))[:, 1],
        'A4 Gaussian closed form': a4_predict,
        'A5 empirical finite-horizon DP': lambda d: dp_predict(d, dp_full),
        'A5o same DP, wickets ignored': lambda d: dp_predict(d, dp_nowk),
    }

    # --- PRIMARY: the frozen 4,800-state sweep ---------------------------------------------------
    grid = pd.DataFrame(
        [{'balls_remaining': b, 'wickets_down': w, 'runs_needed': r}
         for b in GRID_BALLS for w in GRID_WICKETS for r in GRID_NEEDED]
    )
    grid['overs_remaining'] = grid['balls_remaining'] / 6.0
    grid['oracle_p'] = oracle_for_states(
        zip(grid['balls_remaining'], grid['wickets_down'], grid['runs_needed']))
    comp = (grid['oracle_p'] > COMPETITIVE[0]) & (grid['oracle_p'] < COMPETITIVE[1])

    # --- SECONDARY / TERTIARY --------------------------------------------------------------------
    eg = test[test['overs_remaining'] <= ENDGAME_MAX_OVERS].reset_index(drop=True)
    y_eg = eg['win_probability'].to_numpy(dtype=float)
    o_eg = eg['oracle_p'].to_numpy()
    o_te = test['oracle_p'].to_numpy()

    rows = []
    for name, fn in list(candidates.items()) + [('ORACLE (floor)', lambda d: d['oracle_p'].to_numpy())]:
        gp = np.clip(fn(grid), 0, 1)
        tp = np.clip(fn(test), 0, 1)
        ep = np.clip(fn(eg), 0, 1)
        rows.append({
            'candidate': name,
            'PRIMARY_grid_oracle_mae_all_4800': round(mae(gp, grid['oracle_p']), 5),
            'PRIMARY_grid_oracle_mae_competitive': round(mae(gp[comp], grid['oracle_p'][comp]), 5),
            'grid_oracle_mae_p90': round(float(np.percentile(np.abs(gp - grid['oracle_p']), 90)), 5),
            'SECONDARY_observed_endgame_oracle_mae': round(mae(ep, o_eg), 5),
            'SECONDARY_observed_endgame_brier': round(float(brier_score_loss(y_eg, ep)), 5),
            'SECONDARY_paired_brier_ci95_vs_oracle': paired_ci(
                ep, o_eg, y_eg, eg['match_id'].to_numpy()),
            'TERTIARY_whole_test_oracle_mae': round(mae(tp, o_te), 5),
            'TERTIARY_whole_test_brier': round(float(brier_score_loss(y_te, tp)), 5),
        })

    # --- E6's extrapolation probe, rerun -------------------------------------------------------
    probe_states = []
    for overs_remaining in (1.0, 0.5, 0.1):
        for target, wickets, crr in [(160, 2, 8.0), (200, 5, 9.5)]:
            runs = round(crr * (TOTAL_OVERS - overs_remaining))
            probe_states.append({'overs_remaining': overs_remaining, 'wickets_down': wickets,
                                 'balls_remaining': round(overs_remaining * 6),
                                 'runs_needed': target - runs, 'target_score': target,
                                 'current_run_rate': crr})
    probe = pd.DataFrame(probe_states)
    probe['oracle_p'] = oracle_for_states(
        zip(probe['balls_remaining'], probe['wickets_down'], probe['runs_needed']))
    probe_out = {'states': probe[['overs_remaining', 'wickets_down', 'runs_needed', 'oracle_p']]
                 .round(4).to_dict('records')}
    for name, fn in candidates.items():
        probe_out[name] = [round(float(v), 4) for v in np.clip(fn(probe), 0, 1)]

    report = {
        'experiment': 'AE-1 - functional form vs representation in the endgame',
        'design': 'ai-engine/experiments/endgame-research-design.md (preregistered + 2 amendments)',
        'provenance': 'matchSimulator.js output. Statements are about that simulator, not cricket.',
        'environment': {'git_sha': git_sha(), 'python': platform.python_version(), 'seed': SEED},
        'frozen_grid': {'balls': '1-12', 'wickets': '0-9', 'runs_needed': '1-40',
                        'n_states': int(len(grid)),
                        'n_competitive': int(comp.sum()),
                        'note': 'frozen in the design; not to be changed after results exist'},
        'empirical_per_ball_model': empirical_model,
        'step0_margin_reference': 'results/ae1/ae1-step0-margin.json (endgame TOST margin 0.04425)',
        'results': rows,
        'extrapolation_probe': probe_out,
    }

    os.makedirs(RESULTS, exist_ok=True)
    with open(os.path.join(RESULTS, 'ae1-results.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    print("\nEMPIRICAL PER-BALL MODEL (training only)")
    print(f"  overs used {empirical_model['n_uncensored_overs_used']}, "
          f"p(wicket)={pw:.4f}, mu={mu:.4f}, sd={sd:.4f}, converged={res.success}")
    print(f"  p_runs {empirical_model['p_runs']}")
    print(f"\nPRIMARY: frozen grid, {len(grid)} states ({int(comp.sum())} competitive)\n")
    print(f"{'candidate':34}{'gridMAE':>9}{'competMAE':>11}{'obsEG_MAE':>11}{'wholeTest':>11}")
    for r in rows:
        print(f"{r['candidate'][:34]:34}{r['PRIMARY_grid_oracle_mae_all_4800']:9.5f}"
              f"{r['PRIMARY_grid_oracle_mae_competitive']:11.5f}"
              f"{r['SECONDARY_observed_endgame_oracle_mae']:11.5f}"
              f"{r['TERTIARY_whole_test_oracle_mae']:11.5f}")
    print(f"\nfull report -> {os.path.join(RESULTS, 'ae1-results.json')}")


if __name__ == '__main__':
    main()
