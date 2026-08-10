from flask import Blueprint, request, jsonify
import numpy as np
from datetime import datetime, timedelta

analytics_bp = Blueprint('analytics', __name__)

class AnalyticsEngine:
    """Provides statistical analysis and insights for cricket tournaments and players."""
    
    @staticmethod
    def calculate_player_form(recent_performances):
        """Calculate player form based on recent performances."""
        if not recent_performances:
            return 0
        
        ratings = [p.get('rating', 5) for p in recent_performances[-5:]]
        form_score = np.mean(ratings)
        trend = np.polyfit(range(len(ratings)), ratings, 1)[0]
        
        return {
            'current_form': round(form_score, 2),
            'trend': 'improving' if trend > 0 else 'declining' if trend < 0 else 'stable',
            'trend_value': round(trend, 2)
        }
    
    @staticmethod
    def predict_player_performance(player_stats, match_conditions):
        """Predict player performance in upcoming match."""
        batting_score = 0
        bowling_score = 0
        
        # Batting prediction
        if player_stats.get('batting', {}).get('average'):
            avg_runs = player_stats['batting']['average']
            strike_rate = player_stats['batting'].get('strikeRate', 100)
            
            # Adjust for match conditions
            condition_factor = 1.0
            if match_conditions.get('pitch_type') == 'batting_friendly':
                condition_factor = 1.2
            elif match_conditions.get('pitch_type') == 'bowling_friendly':
                condition_factor = 0.8
            
            batting_score = min(100, (avg_runs / 50) * 100 * condition_factor)
        
        # Bowling prediction
        if player_stats.get('bowling', {}).get('average'):
            avg_wickets = 1 / (player_stats['bowling']['average'] + 1)
            economy = player_stats['bowling'].get('economyRate', 8)
            
            condition_factor = 1.0
            if match_conditions.get('pitch_type') == 'bowling_friendly':
                condition_factor = 1.2
            elif match_conditions.get('pitch_type') == 'batting_friendly':
                condition_factor = 0.8
            
            bowling_score = min(100, (avg_wickets * 100) * condition_factor)
        
        return {
            'batting_prediction': round(batting_score, 2),
            'bowling_prediction': round(bowling_score, 2),
            'overall_prediction': round((batting_score + bowling_score) / 2, 2)
        }
    
    @staticmethod
    def analyze_tournament_trends(tournament_stats):
        """Analyze trends in tournament statistics."""
        trends = {
            'total_runs_trend': 0,
            'average_score': 0,
            'highest_score': tournament_stats.get('highestScore', 0),
            'lowest_score': tournament_stats.get('lowestScore', 0),
            'total_wickets': tournament_stats.get('totalWickets', 0),
            'matches_completed': tournament_stats.get('completedMatches', 0)
        }
        
        if tournament_stats.get('totalMatches', 0) > 0:
            trends['average_score'] = round(
                tournament_stats.get('totalRuns', 0) / tournament_stats.get('totalMatches', 1),
                2
            )
        
        return trends
    
    @staticmethod
    def predict_tournament_winner(standings, remaining_matches):
        """Predict tournament winner based on current standings and remaining matches."""
        if not standings:
            return None
        
        # Sort by points
        sorted_standings = sorted(standings, key=lambda x: x.get('points', 0), reverse=True)
        
        predictions = []
        for team in sorted_standings[:3]:
            current_points = team.get('points', 0)
            remaining = remaining_matches - team.get('played', 0)
            
            # Estimate win probability
            win_prob = min(100, (current_points / max(1, team.get('played', 1))) * 100)
            
            predictions.append({
                'team': team.get('team'),
                'current_points': current_points,
                'win_probability': round(win_prob, 2),
                'net_run_rate': team.get('netRunRate', 0)
            })
        
        return predictions

@analytics_bp.route('/player-form', methods=['POST'])
def analyze_player_form():
    """Analyze player form based on recent performances."""
    try:
        data = request.get_json()
        if not data or 'recent_performances' not in data:
            return jsonify({'success': False, 'message': 'Missing required data'}), 400
        
        form_analysis = AnalyticsEngine.calculate_player_form(data['recent_performances'])
        
        return jsonify({
            'success': True,
            'form_analysis': form_analysis
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/player-performance', methods=['POST'])
def predict_player_performance():
    """Predict player performance in upcoming match."""
    try:
        data = request.get_json()
        if not data or 'player_stats' not in data:
            return jsonify({'success': False, 'message': 'Missing required data'}), 400
        
        match_conditions = data.get('match_conditions', {})
        prediction = AnalyticsEngine.predict_player_performance(
            data['player_stats'],
            match_conditions
        )
        
        return jsonify({
            'success': True,
            'prediction': prediction
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/tournament-trends', methods=['POST'])
def analyze_tournament_trends():
    """Analyze trends in tournament statistics."""
    try:
        data = request.get_json()
        if not data or 'tournament_stats' not in data:
            return jsonify({'success': False, 'message': 'Missing required data'}), 400
        
        trends = AnalyticsEngine.analyze_tournament_trends(data['tournament_stats'])
        
        return jsonify({
            'success': True,
            'trends': trends
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@analytics_bp.route('/tournament-winner-prediction', methods=['POST'])
def predict_tournament_winner():
    """Predict tournament winner based on current standings."""
    try:
        data = request.get_json()
        if not data or 'standings' not in data:
            return jsonify({'success': False, 'message': 'Missing required data'}), 400
        
        remaining_matches = data.get('remaining_matches', 10)
        predictions = AnalyticsEngine.predict_tournament_winner(
            data['standings'],
            remaining_matches
        )
        
        return jsonify({
            'success': True,
            'predictions': predictions
        }), 200
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500
