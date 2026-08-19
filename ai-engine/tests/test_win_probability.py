"""CI gate for the win-probability engine.

Deliberately small. These assert the properties that, had they existed, would have caught the
defects documented in documentation/ai-engine-audit.md - not the model's accuracy, which
evaluate_win_probability.py measures and gates separately.
"""

import os
import sys

import pandas as pd
import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, ROOT)

DATA = os.path.join(ROOT, 'data', 'real_matches.csv')


@pytest.fixture(scope='module')
def df():
    return pd.read_csv(DATA)


@pytest.fixture(scope='module')
def model():
    from src.models.recommendation_model import RecommendationModel
    m = RecommendationModel()
    if not m.load_models():
        m.train_all_models(data_dir=os.path.join(ROOT, 'data'))
    return m


class TestTrainingData:
    def test_only_the_win_probability_dataset_remains(self):
        files = sorted(os.listdir(os.path.join(ROOT, 'data')))
        assert files == ['real_matches.csv'], (
            'matches.csv/fielding.csv/players.csv were removed in E1 - their labels were uniform '
            f'random integers or a deterministic rule. Found: {files}'
        )

    def test_labels_are_binary_outcomes(self, df):
        assert set(df['win_probability'].unique()) <= {0, 1}

    def test_label_is_constant_within_a_match(self, df):
        assert (df.groupby('match_id')['win_probability'].nunique() == 1).all()

    def test_no_duplicate_over_checkpoints(self, df):
        # Regression for the defect the backend parity assertion found: trailing wides re-emitted
        # the same over boundary with inflated runs. 792 such rows existed.
        dupes = df.duplicated(subset=['match_id', 'overs_remaining']).sum()
        assert dupes == 0, f'{dupes} duplicated over checkpoints'

    def test_no_crlf_line_endings(self):
        # The dedupe pass introduced CRLF once, which broke the oracle emitter's header lookup.
        with open(DATA, 'rb') as f:
            assert b'\r' not in f.read()

    def test_every_match_is_twenty_overs(self, df):
        # The oracle's runs_scored recovery in emit-oracle-values.js depends on this.
        assert df['overs_remaining'].max() <= 19


class TestServingContract:
    def test_removed_models_are_gone(self, model):
        for attr in ('batsman_model', 'bowler_model', 'fielding_model'):
            assert not hasattr(model, attr), f'{attr} should have been removed in E1'

    def test_tactical_summary_shape_is_exactly_what_clients_read(self, model):
        out = model.get_tactical_summary({
            'overs_remaining': 8, 'wickets_down': 3,
            'current_run_rate': 7.5, 'target_score': 165,
        })
        assert set(out) == {'success', 'match_status', 'win_probability', 'tactical_advice'}
        assert 'key_recommendations' not in out

    def test_predictions_are_probabilities(self, model):
        for state in [
            {'overs_remaining': 19, 'wickets_down': 0, 'current_run_rate': 4.0, 'target_score': 240},
            {'overs_remaining': 1, 'wickets_down': 9, 'current_run_rate': 12.0, 'target_score': 100},
            {'overs_remaining': 10, 'wickets_down': 4, 'current_run_rate': 8.0, 'target_score': 170},
        ]:
            p = model.predict_win_probability(state)['win_probability']
            assert 0.0 <= p <= 1.0

    def test_training_refuses_to_fall_back_to_synthetic_data(self, tmp_path):
        from src.models.recommendation_model import RecommendationModel
        m = RecommendationModel()
        with pytest.raises(FileNotFoundError):
            m.train_all_models(data_dir=str(tmp_path))
