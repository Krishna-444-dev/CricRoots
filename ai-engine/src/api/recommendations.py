import os

from flask import Blueprint, request, jsonify

from src.models.recommendation_model import RecommendationModel

recommendations_bp = Blueprint('recommendations', __name__)

# Load the trained model, or train one if the pickle is unusable.
#
# Corrected 2026-08-19 (E7/AT-E7.4): the comment previously here asserted that "the ai-engine
# container has no volume mount (unlike backend), so it only ever sees whatever .pkl files were
# baked into the image at build time". That was FALSE - docker-compose.yml mounts
# `ai_models:/app/src/models/trained_models`, a named volume that shadows the image's copy. The
# real behaviour is: first boot finds the volume empty and trains into it; every subsequent boot
# loads from the volume regardless of what changed in data/ or in the image. The self-healing
# property the old comment argued for was defeated by a mount the comment said did not exist.
# Reconciling that is tracked as AT-E7.3 and is NOT fixed here.
#
# Training now raises if data/real_matches.csv is absent rather than silently falling back to the
# synthetic heuristic file - see RecommendationModel.train_all_models.
recommendation_model = RecommendationModel()
if not recommendation_model.load_models():
    recommendation_model.train_all_models(data_dir='data')


@recommendations_bp.route('/win-probability', methods=['POST'])
def win_probability():
    """Predicts win probability for the CHASING team in a limited-overs run chase.

    Not valid for first-innings states - the model is trained only on chases. The backend does not
    call this during the first innings (E2); this endpoint does not re-check, because it has no
    access to the match to tell.
    """
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        result = recommendation_model.predict_win_probability(data)
        return jsonify(result), 200 if result.get('success') else 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@recommendations_bp.route('/tactical-advisor', methods=['POST'])
def tactical_advisor():
    """Win probability, a status label, and an advice string for the current chase state."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400

        result = recommendation_model.get_tactical_summary(data)
        return jsonify(result), 200 if result.get('success') else 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@recommendations_bp.route('/train', methods=['POST'])
def train_models():
    """Triggers retraining.

    UNAUTHENTICATED - tracked as AT-E7.2 and deliberately not fixed in this pass, because the
    authentication scheme is a deployment decision (shared secret vs. network policy) that should
    be made alongside the rest of E7 rather than invented here. Reachable through nginx at
    /ai/api/recommendations/train and on the published host port 5001.
    """
    try:
        recommendation_model.train_all_models(data_dir='data')
        return jsonify({'success': True, 'message': 'Models retrained successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


@recommendations_bp.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'models_loaded': recommendation_model.win_prob_model is not None,
        'service': 'CricSync AI Recommendation Engine'
    }), 200
