"""AT-E1.5 - the equivalence gate for E1.

E1 deletes the batsman, bowler and fielding models. The claim justifying that is that no client
renders their output. "I traced the call graph and believe nothing renders it" is not a gate; this
is. It captures, across a grid of match states, exactly the fields both clients actually read from
the tactical-advisor payload:

    mobile-app/src/components/AITacticalAdvisor.tsx:159,175,180,184,195
    web-app/components/AITacticalAdvisor.tsx:128,152,158,163,172
        -> match_status, win_probability, tactical_advice

`key_recommendations` is deliberately excluded from the capture because neither client reads it -
that exclusion IS the claim under test, so it is stated here rather than buried. If E1 changed
anything a user can see, the two captures differ and the gate fails.

Usage:
    python diagnostics/capture_client_visible_output.py before
    ... apply E1 ...
    python diagnostics/capture_client_visible_output.py after
    python diagnostics/capture_client_visible_output.py compare
"""

import itertools
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..'))

OUT_DIR = os.path.join(HERE, '..', 'results', 'pre-remediation')

# Fields the clients actually render. The whole gate rests on this list being right, so it is
# derived from the JSX above rather than from the response shape.
CLIENT_VISIBLE = ['match_status', 'win_probability', 'tactical_advice']

GRID = {
    'overs_remaining': [1, 3, 5, 8, 10, 12, 15, 18, 19],
    'wickets_down': [0, 1, 3, 5, 7, 9],
    'current_run_rate': [3.0, 5.5, 7.0, 8.5, 10.0, 13.0],
    'target_score': [95, 130, 160, 180, 205, 240],
}


def capture():
    from src.models.recommendation_model import RecommendationModel

    model = RecommendationModel()
    if not model.load_models():
        model.train_all_models(data_dir=os.path.join(HERE, '..', 'data'))

    rows = []
    keys = list(GRID)
    for combo in itertools.product(*(GRID[k] for k in keys)):
        state = dict(zip(keys, combo))
        summary = model.get_tactical_summary(state)
        rows.append({
            'state': state,
            'visible': {k: summary.get(k) for k in CLIENT_VISIBLE},
        })
    return rows


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else 'before'
    os.makedirs(OUT_DIR, exist_ok=True)

    if mode in ('before', 'after'):
        rows = capture()
        path = os.path.join(OUT_DIR, f'client-visible-{mode}.json')
        with open(path, 'w') as f:
            json.dump(rows, f, indent=2, sort_keys=True)
            f.write('\n')
        print(f'captured {len(rows)} states -> {path}')
        return

    if mode == 'compare':
        with open(os.path.join(OUT_DIR, 'client-visible-before.json')) as f:
            before = json.load(f)
        with open(os.path.join(OUT_DIR, 'client-visible-after.json')) as f:
            after = json.load(f)

        if len(before) != len(after):
            print(f'FAIL: state count differs ({len(before)} vs {len(after)})')
            sys.exit(1)

        diffs = [
            (b['state'], b['visible'], a['visible'])
            for b, a in zip(before, after)
            if b['visible'] != a['visible']
        ]
        if diffs:
            print(f'FAIL: {len(diffs)} of {len(before)} states differ in client-visible output')
            for state, b, a in diffs[:5]:
                print(f'  {state}\n    before {b}\n    after  {a}')
            sys.exit(1)

        print(f'PASS: all {len(before)} states identical across '
              f'{", ".join(CLIENT_VISIBLE)} - E1 changed nothing a user can see')
        return

    print(__doc__)
    sys.exit(2)


if __name__ == '__main__':
    main()
