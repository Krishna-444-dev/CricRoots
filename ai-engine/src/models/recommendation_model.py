import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib
import os


class RecommendationModel:
    """Win-probability model for a limited-overs run chase.

    Scope note (E1, 2026-08-19). This class previously also held a batsman model, a bowler model
    and a fielding model. All three were removed, for reasons established in
    documentation/ai-engine-audit.md and not as a stylistic cleanup:

      - `recommended_batsman` and `recommended_bowler` were `random.randint(0, 199)` in
        data_generator.py, drawn independently of every feature. There was no target to learn.
        Fifty unbounded trees memorising a random permutation is why those two .pkl files were
        100 MB each.
      - `optimal_position` was a deterministic two-variable if/else written three lines above it in
        the same generator, fitted on five features of which three were never consulted by the
        rule. The model was a lookup table for code already in the repository.

    Removing them was gated on diagnostics/capture_client_visible_output.py, which proved across
    1,944 match states that no field either client renders changed. Both clients had already
    declined to render `key_recommendations` for a reason they state accurately
    (AITacticalAdvisor.tsx). The engine now computes only what something actually consumes.
    """

    def __init__(self):
        self.win_prob_model = None
        self.model_dir = os.path.join(os.path.dirname(__file__), 'trained_models')
        os.makedirs(self.model_dir, exist_ok=True)

    def train_all_models(self, data_dir='data'):
        """Trains the win-probability model on real match outcomes.

        No fallback to data/matches.csv. That file's `win_probability` column is a hand-written
        heuristic formula, not an outcome, and falling back to it meant a missing training file
        produced a service that served confident, plausible-looking percentages derived from
        arithmetic nobody had validated. A dead service is the correct failure mode here; a
        confident one is not.
        """
        real_data_path = os.path.join(data_dir, 'real_matches.csv')
        if not os.path.exists(real_data_path):
            raise FileNotFoundError(
                f'Win-probability training data not found at {real_data_path}. '
                'Generate it with backend/src/scripts/extractWinProbabilityData.js. '
                'There is deliberately no synthetic fallback - see the docstring above.'
            )

        print('Training win-probability model...')
        df = pd.read_csv(real_data_path)

        # win_probability is the match OUTCOME (1.0/0.0 for whether the chasing team actually won),
        # replicated across every state row of that match. Correct labelling for this target, and
        # the reason evaluate_win_probability.py must split by match_id rather than by row.
        X = df[['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']]
        y = df['win_probability']

        self.win_prob_model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.win_prob_model.fit(X, y)

        self.save_models()
        print(f'Win-probability model trained on {len(df)} rows '
              f'from {df["match_id"].nunique()} matches.')

    def predict_win_probability(self, match_data):
        """Predicts the probability that the CHASING team wins.

        Domain note: this model is trained exclusively on second-innings (chase) states - see
        extractWinProbabilityData.js, which emits nothing else. It has no meaning applied to a
        first-innings state, and the backend is responsible for not asking (E2).
        """
        if self.win_prob_model is None:
            return {'success': False, 'message': 'Win probability model not trained'}

        features = pd.DataFrame([{
            'overs_remaining': match_data.get('overs_remaining', 10),
            'wickets_down': match_data.get('wickets_down', 5),
            'current_run_rate': match_data.get('current_run_rate', 8),
            'target_score': match_data.get('target_score', 150),
        }])

        prediction = float(np.clip(self.win_prob_model.predict(features)[0], 0.0, 1.0))
        return {
            'success': True,
            'win_probability': prediction,
            'status': 'Dominant' if prediction > 0.7 else 'Balanced' if prediction > 0.4 else 'Challenging'
        }

    def get_tactical_summary(self, match_data):
        """Win probability plus a status label and an advice string."""
        win_prob = self.predict_win_probability(match_data)
        if not win_prob.get('success'):
            return win_prob

        return {
            'success': True,
            'match_status': win_prob.get('status'),
            'win_probability': win_prob.get('win_probability'),
            'tactical_advice': self._generate_advice(win_prob.get('win_probability'), match_data)
        }

    def _generate_advice(self, win_prob, match_data):
        # KNOWN DEFECTS, deliberately left unchanged by E1 and recorded in
        # documentation/ai-engine-audit.md §6 (F8, F9):
        #   1. These thresholds (0.8/0.5) disagree with predict_win_probability's status
        #      thresholds (0.7/0.4). Both fields ship in the same payload and both clients render
        #      them together, so p in [0.5, 0.8) shows "Dominant" beside "Aggressive approach".
        #   2. The p < 0.5 branch advises defence. This is a CHASE model; a chasing side below 50%
        #      is usually behind the required rate, where batting defensively is the losing line.
        #   3. `match_data` is accepted and never read.
        # Left alone on purpose: E1's gate (capture_client_visible_output.py) asserts that E1
        # changes NOTHING a user sees, and any fix here is by definition a visible change. Fixing
        # it is a separate, deliberate change with its own review.
        if win_prob > 0.8:
            return "Maintain current momentum. Focus on steady scoring and minimizing risks."
        elif win_prob > 0.5:
            return "Aggressive approach recommended. Increase run rate to pressure the opposition."
        else:
            return "Defensive strategy needed. Focus on building partnerships and preserving wickets."

    def save_models(self):
        joblib.dump(self.win_prob_model, os.path.join(self.model_dir, 'win_prob_model.pkl'))

    def load_models(self):
        try:
            self.win_prob_model = joblib.load(os.path.join(self.model_dir, 'win_prob_model.pkl'))
            return True
        except Exception as e:
            # Previously a bare `except: return False` - swallowed the actual reason (usually a
            # scikit-learn/numpy version mismatch between when the .pkl was pickled and what's
            # installed in the current image) with no log line, so "model not trained" showed up
            # at request time with zero clue why. Log it so this is diagnosable next time.
            print(f"Failed to load trained models ({e.__class__.__name__}: {e}) - training fresh instead.")
            return False
