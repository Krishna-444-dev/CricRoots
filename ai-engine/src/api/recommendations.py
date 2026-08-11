from flask import Blueprint, request, jsonify
from src.models.recommendation_model import RecommendationModel
import os

recommendations_bp = Blueprint('recommendations', __name__)

# Initialize and load the recommendation model. The ai-engine container has no volume mount
# (unlike backend), so it only ever sees whatever .pkl files were baked into the image at build
# time - if those fail to unpickle (e.g. a scikit-learn/numpy version bump since they were saved),
# every recommendation endpoint would otherwise stay silently broken ("model not trained") until
# someone notices and manually hits /train. Train fresh on the spot instead so the service is
# self-healing on every startup regardless of pickle compatibility - training is a few seconds
# against the small synthetic dataset in data/, not worth leaving the service degraded over.
recommendation_model = RecommendationModel()
if not recommendation_model.load_models():
    recommendation_model.train_all_models(data_dir='data')

@recommendations_bp.route('/batsman', methods=['POST'])
def recommend_batsman():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        result = recommendation_model.recommend_batsman(data)
        return jsonify(result), 200 if result.get('success') else 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@recommendations_bp.route('/bowler', methods=['POST'])
def recommend_bowler():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'success': False, 'message': 'No data provided'}), 400
        
        result = recommendation_model.recommend_bowler(data)
        return jsonify(result), 200 if result.get('success') else 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@recommendations_bp.route('/fielding', methods=['POST'])
def recommend_fielding():
    try:
        data = request.get_json()
        if not data or 'player_data' not in data or 'batsman_data' not in data:
            return jsonify({'success': False, 'message': 'Missing required fields'}), 400
        
        result = recommendation_model.recommend_fielding(data['player_data'], data['batsman_data'])
        return jsonify(result), 200 if result.get('success') else 400
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@recommendations_bp.route('/win-probability', methods=['POST'])
def win_probability():
    """Predicts win probability based on current match situation."""
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
    """Provides a comprehensive tactical summary for the current match situation."""
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
    """Triggers retraining of all models."""
    try:
        # In a real app, this might be protected by an API key
        recommendation_model.train_all_models(data_dir='data')
        return jsonify({'success': True, 'message': 'Models retrained successfully'}), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@recommendations_bp.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'healthy',
        'models_loaded': recommendation_model.batsman_model is not None,
        'service': 'CricSync AI Recommendation Engine'
    }), 200
