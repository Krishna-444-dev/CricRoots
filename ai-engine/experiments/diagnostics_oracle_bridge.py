"""Python access to the one oracle implementation (diagnostics/oracle.js), via subprocess.

Not a port. Porting the dynamic program would create a second definition of ground truth, and the
lesson of matchStateFeatures.js is that two definitions of the same quantity drift apart silently
and are only caught by an assertion nobody wrote. One implementation, queried from both languages.
"""

import json
import os
import subprocess

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
QUERY_JS = os.path.join(HERE, 'oracle_query.js')


def oracle_for_states(states):
    """states: iterable of (balls_remaining, wickets_down, runs_needed) -> np.ndarray of P(win)."""
    payload = json.dumps([[int(b), int(w), int(r)] for b, w, r in states])
    out = subprocess.run(
        ['node', QUERY_JS], input=payload, capture_output=True, text=True, check=True
    )
    return np.asarray(json.loads(out.stdout), dtype=float)


def oracle_for_frame(frame):
    return oracle_for_states(
        zip(frame['balls_remaining'], frame['wickets_down'], frame['runs_needed'])
    )
