from flask import Blueprint, request, jsonify
from src.models.recommendation_model import RecommendationModel

recommendations_bp = Blueprint('recommendations', __name__)

# Initialize the recommendation model
recommendation_model = RecommendationModel()

@recommendations_bp.route('/batsman', methods=['POST'])
def recommend_batsman():
    """
    Recommend the best batsman for current match situation.
    
    Expected JSON:
    {
        "current_run_rate": float,
        "wickets_down": int,
        "overs_remaining": float,
        "opposition_bowling_strength": float,
        "batsman_form_score": float
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        result = recommendation_model.recommend_batsman(data)
        return jsonify(result), 200 if result.get('success') else 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@recommendations_bp.route('/bowler', methods=['POST'])
def recommend_bowler():
    """
    Recommend the best bowler for current match situation.
    
    Expected JSON:
    {
        "current_run_rate_against": float,
        "overs_bowled": float,
        "wickets_taken": int,
        "batsman_strength": float,
        "pitch_condition_score": float
    }
    """
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({
                'success': False,
                'message': 'No data provided'
            }), 400
        
        result = recommendation_model.recommend_bowler(data)
        return jsonify(result), 200 if result.get('success') else 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@recommendations_bp.route('/fielding', methods=['POST'])
def recommend_fielding():
    """
    Recommend optimal fielding positions for players.
    
    Expected JSON:
    {
        "player_data": {
            "fielding_ability": float,
            "throwing_accuracy": float,
            "speed_agility": float,
            "catching_ability": float
        },
        "batsman_data": {
            "shot_tendency": float
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or 'player_data' not in data or 'batsman_data' not in data:
            return jsonify({
                'success': False,
                'message': 'Missing required fields: player_data, batsman_data'
            }), 400
        
        result = recommendation_model.recommend_fielding_positions(
            data['player_data'],
            data['batsman_data']
        )
        return jsonify(result), 200 if result.get('success') else 400
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': str(e)
        }), 500

@recommendations_bp.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({
        'status': 'healthy',
        'service': 'CricSync AI Recommendation Engine'
    }), 200
