"""Removes the duplicated over-boundary rows from data/real_matches.csv.

The committed training file was produced by the pre-fix extraction, which had no guard against
re-emitting an over boundary once per trailing wide/no-ball (those do not increment legalBalls, so
`legalBalls % 6 == 0` stayed true). Found by backend/src/services/__tests__/matchStateFeatures.test.js.

Regenerating from the database is not possible here - the matches live in a Mongo instance this
environment has no access to - so the file is corrected in place. That is sound because the
correction is exactly reproducible: the fixed extraction keeps the FIRST checkpoint at each over
boundary (an over ends the instant its sixth legal ball is bowled; a following wide belongs to the
next over), and rows are written in ball order, so "keep the first row per (match_id,
overs_remaining)" is the same operation.

Verified equivalent rather than assumed: the script asserts that every duplicate group shares
overs_remaining and wickets_down and differs only in current_run_rate, which is the signature of
this defect and not of any other.
"""

import csv
import json
import os
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.join(HERE, '..', 'data', 'real_matches.csv')
OUT_DIR = os.path.join(HERE, '..', 'results', 'pre-remediation')


def main():
    with open(CSV_PATH) as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    groups = defaultdict(list)
    for i, r in enumerate(rows):
        groups[(r['match_id'], r['overs_remaining'])].append(i)

    dup_groups = {k: v for k, v in groups.items() if len(v) > 1}

    # The defect's signature: within a duplicate group, only current_run_rate moves.
    for key, idxs in dup_groups.items():
        for col in ('wickets_down', 'target_score', 'win_probability'):
            values = {rows[i][col] for i in idxs}
            assert len(values) == 1, f'unexpected variation in {col} for {key}: {values}'
        crrs = [float(rows[i]['current_run_rate']) for i in idxs]
        assert crrs == sorted(crrs), f'run rate not monotonically increasing for {key}'

    keep = sorted(idxs[0] for idxs in groups.values())
    kept_rows = [rows[i] for i in keep]

    report = {
        'rows_before': len(rows),
        'rows_after': len(kept_rows),
        'rows_removed': len(rows) - len(kept_rows),
        'duplicate_checkpoints': len(dup_groups),
        'matches_affected': len({k[0] for k in dup_groups}),
        'matches_total': len({r['match_id'] for r in rows}),
        'cause': "pre-fix extraction re-emitted an over boundary once per trailing wide/no-ball; "
                 "legalBalls %% 6 == 0 stayed true because extras do not increment legalBalls",
        'correction': 'kept the first checkpoint per (match_id, overs_remaining)',
    }

    with open(CSV_PATH, 'w', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(kept_rows)

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(os.path.join(OUT_DIR, 'training-row-dedupe.json'), 'w') as f:
        json.dump(report, f, indent=2)
        f.write('\n')

    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
