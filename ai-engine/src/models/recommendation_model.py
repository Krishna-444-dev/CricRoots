import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import RandomForestClassifier
import joblib
import os

class RecommendationModel:
    """
    AI model for tactical cricket recommendations.
    Provides batsman, bowler, and fielding position recommendations.
    """
    
    def __init__(self):
        self.batsman_model = None
        self.bowler_model = None
        self.fielding_model = None
        self.scaler = StandardScaler()
        self.model_dir = os.path.join(os.path.dirname(__file__), 'trained_models')
        
    def train_batsman_model(self, X_train, y_train):
        """
        Train model to recommend next batsman based on match conditions.
        
        Features:
        - Current run rate
        - Wickets down
        - Overs remaining
        - Opposition bowling strength
        - Batsman form (recent scores)
        """
        self.batsman_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        
        X_scaled = self.scaler.fit_transform(X_train)
        self.batsman_model.fit(X_scaled, y_train)
        
        return self.batsman_model
    
    def train_bowler_model(self, X_train, y_train):
        """
        Train model to recommend next bowler based on match conditions.
        
        Features:
        - Current run rate against
        - Overs bowled
        - Wickets taken
        - Batsman strengths
        - Pitch conditions
        """
        self.bowler_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        
        X_scaled = self.scaler.fit_transform(X_train)
        self.bowler_model.fit(X_scaled, y_train)
        
        return self.bowler_model
    
    def train_fielding_model(self, X_train, y_train):
        """
        Train model to recommend fielding positions based on player abilities.
        
        Features:
        - Player fielding ability
        - Throwing accuracy
        - Speed/agility
        - Catching ability
        - Batsman tendencies
        """
        self.fielding_model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
        
        X_scaled = self.scaler.fit_transform(X_train)
        self.fielding_model.fit(X_scaled, y_train)
        
        return self.fielding_model
    
    def recommend_batsman(self, match_data):
        """
        Recommend the best batsman for current match situation.
        
        Args:
            match_data: Dictionary containing match conditions
            
        Returns:
            Dictionary with recommended batsman and confidence score
        """
        if self.batsman_model is None:
            return {
                'success': False,
                'message': 'Batsman model not trained'
            }
        
        # Prepare features
        features = self._prepare_batsman_features(match_data)
        features_scaled = self.scaler.transform([features])
        
        # Get prediction and probability
        prediction = self.batsman_model.predict(features_scaled)[0]
        probabilities = self.batsman_model.predict_proba(features_scaled)[0]
        confidence = np.max(probabilities)
        
        return {
            'success': True,
            'recommended_batsman_id': int(prediction),
            'confidence': float(confidence),
            'all_probabilities': probabilities.tolist()
        }
    
    def recommend_bowler(self, match_data):
        """
        Recommend the best bowler for current match situation.
        
        Args:
            match_data: Dictionary containing match conditions
            
        Returns:
            Dictionary with recommended bowler and confidence score
        """
        if self.bowler_model is None:
            return {
                'success': False,
                'message': 'Bowler model not trained'
            }
        
        # Prepare features
        features = self._prepare_bowler_features(match_data)
        features_scaled = self.scaler.transform([features])
        
        # Get prediction and probability
        prediction = self.bowler_model.predict(features_scaled)[0]
        probabilities = self.bowler_model.predict_proba(features_scaled)[0]
        confidence = np.max(probabilities)
        
        return {
            'success': True,
            'recommended_bowler_id': int(prediction),
            'confidence': float(confidence),
            'all_probabilities': probabilities.tolist()
        }
    
    def recommend_fielding_positions(self, player_data, batsman_data):
        """
        Recommend optimal fielding positions for players.
        
        Args:
            player_data: Dictionary with player abilities
            batsman_data: Dictionary with batsman tendencies
            
        Returns:
            Dictionary with recommended positions for each player
        """
        if self.fielding_model is None:
            return {
                'success': False,
                'message': 'Fielding model not trained'
            }
        
        # Prepare features
        features = self._prepare_fielding_features(player_data, batsman_data)
        features_scaled = self.scaler.transform([features])
        
        # Get prediction
        prediction = self.fielding_model.predict(features_scaled)[0]
        probabilities = self.fielding_model.predict_proba(features_scaled)[0]
        
        return {
            'success': True,
            'recommended_position': int(prediction),
            'position_probabilities': probabilities.tolist()
        }
    
    def _prepare_batsman_features(self, match_data):
        """Prepare features for batsman recommendation."""
        features = [
            match_data.get('current_run_rate', 0),
            match_data.get('wickets_down', 0),
            match_data.get('overs_remaining', 0),
            match_data.get('opposition_bowling_strength', 0),
            match_data.get('batsman_form_score', 0)
        ]
        return features
    
    def _prepare_bowler_features(self, match_data):
        """Prepare features for bowler recommendation."""
        features = [
            match_data.get('current_run_rate_against', 0),
            match_data.get('overs_bowled', 0),
            match_data.get('wickets_taken', 0),
            match_data.get('batsman_strength', 0),
            match_data.get('pitch_condition_score', 0)
        ]
        return features
    
    def _prepare_fielding_features(self, player_data, batsman_data):
        """Prepare features for fielding recommendation."""
        features = [
            player_data.get('fielding_ability', 0),
            player_data.get('throwing_accuracy', 0),
            player_data.get('speed_agility', 0),
            player_data.get('catching_ability', 0),
            batsman_data.get('shot_tendency', 0)
        ]
        return features
    
    def save_models(self):
        """Save trained models to disk."""
        os.makedirs(self.model_dir, exist_ok=True)
        
        if self.batsman_model:
            joblib.dump(self.batsman_model, os.path.join(self.model_dir, 'batsman_model.pkl'))
        
        if self.bowler_model:
            joblib.dump(self.bowler_model, os.path.join(self.model_dir, 'bowler_model.pkl'))
        
        if self.fielding_model:
            joblib.dump(self.fielding_model, os.path.join(self.model_dir, 'fielding_model.pkl'))
    
    def load_models(self):
        """Load trained models from disk."""
        if os.path.exists(os.path.join(self.model_dir, 'batsman_model.pkl')):
            self.batsman_model = joblib.load(os.path.join(self.model_dir, 'batsman_model.pkl'))
        
        if os.path.exists(os.path.join(self.model_dir, 'bowler_model.pkl')):
            self.bowler_model = joblib.load(os.path.join(self.model_dir, 'bowler_model.pkl'))
        
        if os.path.exists(os.path.join(self.model_dir, 'fielding_model.pkl')):
            self.fielding_model = joblib.load(os.path.join(self.model_dir, 'fielding_model.pkl'))
