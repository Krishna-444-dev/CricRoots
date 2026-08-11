import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
import joblib
import os

class RecommendationModel:
    """
    Enhanced AI model for tactical cricket recommendations and match analysis.
    """
    
    def __init__(self):
        self.batsman_model = None
        self.bowler_model = None
        self.fielding_model = None
        self.win_prob_model = None
        self.scaler = StandardScaler()
        self.model_dir = os.path.join(os.path.dirname(__file__), 'trained_models')
        os.makedirs(self.model_dir, exist_ok=True)
        
    def train_all_models(self, data_dir='data'):
        """Trains all models using generated synthetic data."""
        print("Training models...")
        
        # 1. Train Batsman & Bowler Models
        matches_df = pd.read_csv(os.path.join(data_dir, 'matches.csv'))
        
        # Batsman Features
        X_bat = matches_df[['current_run_rate', 'wickets_down', 'overs_remaining', 'opposition_strength']]
        y_bat = matches_df['recommended_batsman']
        self.batsman_model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.batsman_model.fit(X_bat, y_bat)
        
        # Bowler Features
        X_bowl = matches_df[['current_run_rate', 'wickets_down', 'overs_remaining', 'pitch_type']]
        y_bowl = matches_df['recommended_bowler']
        self.bowler_model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.bowler_model.fit(X_bowl, y_bowl)
        
        # Win Probability (Regression)
        X_win = matches_df[['overs_remaining', 'wickets_down', 'current_run_rate', 'target_score']]
        y_win = matches_df['win_probability']
        self.win_prob_model = RandomForestRegressor(n_estimators=50, random_state=42)
        self.win_prob_model.fit(X_win, y_win)
        
        # 2. Train Fielding Model
        fielding_df = pd.read_csv(os.path.join(data_dir, 'fielding.csv'))
        X_field = fielding_df[['fielding_ability', 'throwing_accuracy', 'speed_agility', 'catching_ability', 'batsman_shot_tendency']]
        y_field = fielding_df['optimal_position']
        self.fielding_model = RandomForestClassifier(n_estimators=50, random_state=42)
        self.fielding_model.fit(X_field, y_field)
        
        self.save_models()
        print("All models trained and saved successfully.")

    def predict_win_probability(self, match_data):
        """Predicts the probability of winning the match."""
        if self.win_prob_model is None:
            return {'success': False, 'message': 'Win probability model not trained'}
        
        features = [[
            match_data.get('overs_remaining', 10),
            match_data.get('wickets_down', 5),
            match_data.get('current_run_rate', 8),
            match_data.get('target_score', 150)
        ]]
        
        prediction = self.win_prob_model.predict(features)[0]
        return {
            'success': True,
            'win_probability': float(prediction),
            'status': 'Dominant' if prediction > 0.7 else 'Balanced' if prediction > 0.4 else 'Challenging'
        }

    def recommend_batsman(self, match_data):
        if self.batsman_model is None:
            return {'success': False, 'message': 'Batsman model not trained'}
        
        features = [[
            match_data.get('current_run_rate', 6),
            match_data.get('wickets_down', 2),
            match_data.get('overs_remaining', 15),
            match_data.get('opposition_strength', 7)
        ]]
        
        prediction = self.batsman_model.predict(features)[0]
        probs = self.batsman_model.predict_proba(features)[0]
        
        return {
            'success': True,
            'recommended_batsman_id': int(prediction),
            'confidence': float(np.max(probs))
        }

    def recommend_bowler(self, match_data):
        if self.bowler_model is None:
            return {'success': False, 'message': 'Bowler model not trained'}
        
        features = [[
            match_data.get('current_run_rate', 6),
            match_data.get('wickets_down', 2),
            match_data.get('overs_remaining', 15),
            match_data.get('pitch_type', 1)
        ]]
        
        prediction = self.bowler_model.predict(features)[0]
        probs = self.bowler_model.predict_proba(features)[0]
        
        return {
            'success': True,
            'recommended_bowler_id': int(prediction),
            'confidence': float(np.max(probs))
        }

    def recommend_fielding(self, player_data, batsman_data):
        if self.fielding_model is None:
            return {'success': False, 'message': 'Fielding model not trained'}
        
        features = [[
            player_data.get('fielding_ability', 8),
            player_data.get('throwing_accuracy', 7),
            player_data.get('speed_agility', 8),
            player_data.get('catching_ability', 8),
            batsman_data.get('shot_tendency', 5)
        ]]
        
        prediction = self.fielding_model.predict(features)[0]
        
        # Map prediction to position name
        positions = {1: 'Slips', 2: 'Boundary', 3: 'Inner Circle'}
        
        return {
            'success': True,
            'recommended_position_id': int(prediction),
            'recommended_position_name': positions.get(int(prediction), 'Unknown')
        }

    def get_tactical_summary(self, match_data):
        """Combines all recommendations into a single tactical summary."""
        win_prob = self.predict_win_probability(match_data)
        batsman = self.recommend_batsman(match_data)
        bowler = self.recommend_bowler(match_data)
        
        return {
            'success': True,
            'match_status': win_prob.get('status'),
            'win_probability': win_prob.get('win_probability'),
            'key_recommendations': {
                'batsman': batsman.get('recommended_batsman_id'),
                'bowler': bowler.get('recommended_bowler_id')
            },
            'tactical_advice': self._generate_advice(win_prob.get('win_probability'), match_data)
        }

    def _generate_advice(self, win_prob, match_data):
        if win_prob > 0.8:
            return "Maintain current momentum. Focus on steady scoring and minimizing risks."
        elif win_prob > 0.5:
            return "Aggressive approach recommended. Increase run rate to pressure the opposition."
        else:
            return "Defensive strategy needed. Focus on building partnerships and preserving wickets."

    def save_models(self):
        joblib.dump(self.batsman_model, os.path.join(self.model_dir, 'batsman_model.pkl'))
        joblib.dump(self.bowler_model, os.path.join(self.model_dir, 'bowler_model.pkl'))
        joblib.dump(self.fielding_model, os.path.join(self.model_dir, 'fielding_model.pkl'))
        joblib.dump(self.win_prob_model, os.path.join(self.model_dir, 'win_prob_model.pkl'))

    def load_models(self):
        try:
            self.batsman_model = joblib.load(os.path.join(self.model_dir, 'batsman_model.pkl'))
            self.bowler_model = joblib.load(os.path.join(self.model_dir, 'bowler_model.pkl'))
            self.fielding_model = joblib.load(os.path.join(self.model_dir, 'fielding_model.pkl'))
            self.win_prob_model = joblib.load(os.path.join(self.model_dir, 'win_prob_model.pkl'))
            return True
        except Exception as e:
            # Previously a bare `except: return False` - swallowed the actual reason (usually a
            # scikit-learn/numpy version mismatch between when the .pkl was pickled and what's
            # installed in the current image) with no log line, so "model not trained" showed up
            # at request time with zero clue why. Log it so this is diagnosable next time.
            print(f"Failed to load trained models ({e.__class__.__name__}: {e}) - training fresh instead.")
            return False
