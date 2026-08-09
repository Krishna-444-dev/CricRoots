import pandas as pd
import numpy as np
import os
import random

def generate_synthetic_cricket_data(num_matches=1000, output_dir='data'):
    """
    Generates high-quality synthetic cricket data for training ML models.
    Mimics T20 match patterns.
    """
    os.makedirs(output_dir, exist_ok=True)
    
    # 1. Generate Players
    num_players = 200
    players = []
    for i in range(num_players):
        specialization = random.choice(['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'])
        batting_style = random.choice(['Right-hand', 'Left-hand'])
        bowling_style = random.choice(['Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin', 'None'])
        
        # Skill levels (0 to 10)
        batting_skill = random.uniform(5, 10) if specialization in ['Batsman', 'All-rounder'] else random.uniform(1, 6)
        bowling_skill = random.uniform(5, 10) if specialization in ['Bowler', 'All-rounder'] else random.uniform(1, 4)
        fielding_skill = random.uniform(5, 10)
        
        players.append({
            'player_id': i,
            'specialization': specialization,
            'batting_style': batting_style,
            'bowling_style': bowling_style,
            'batting_skill': batting_skill,
            'bowling_skill': bowling_skill,
            'fielding_skill': fielding_skill,
            'recent_form': random.uniform(4, 9)
        })
    
    players_df = pd.DataFrame(players)
    players_df.to_csv(os.path.join(output_dir, 'players.csv'), index=False)
    
    # 2. Generate Match Data (Features for Recommendations)
    match_features = []
    for _ in range(num_matches):
        # T20 Match Situation
        overs_remaining = random.uniform(0.1, 20.0)
        wickets_down = random.randint(0, 9)
        current_run_rate = random.uniform(4.0, 12.0)
        target_score = random.randint(120, 220)
        runs_scored = random.randint(0, target_score)
        
        # Contextual Features
        pitch_type = random.choice([1, 2, 3]) # 1: Flat, 2: Green, 3: Turning
        opposition_strength = random.uniform(5, 10)
        
        # Target: Recommended Batsman/Bowler ID (simplified for simulation)
        # In a real model, this would be based on historical success
        recommended_batsman = random.randint(0, num_players - 1)
        recommended_bowler = random.randint(0, num_players - 1)
        
        # Win Probability Calculation (Heuristic-based for simulation)
        # Prob increases with low wickets, high run rate, low target
        win_prob = 0.5 + (0.1 * (10 - wickets_down)) + (0.05 * (current_run_rate - 8)) - (0.002 * target_score)
        win_prob = max(0.01, min(0.99, win_prob))
        
        match_features.append({
            'overs_remaining': overs_remaining,
            'wickets_down': wickets_down,
            'current_run_rate': current_run_rate,
            'target_score': target_score,
            'runs_scored': runs_scored,
            'pitch_type': pitch_type,
            'opposition_strength': opposition_strength,
            'recommended_batsman': recommended_batsman,
            'recommended_bowler': recommended_bowler,
            'win_probability': win_prob
        })
        
    matches_df = pd.DataFrame(match_features)
    matches_df.to_csv(os.path.join(output_dir, 'matches.csv'), index=False)
    
    # 3. Generate Fielding Data
    fielding_data = []
    for _ in range(num_matches * 5):
        player_id = random.randint(0, num_players - 1)
        player = players[player_id]
        
        batsman_tendency = random.uniform(1, 10) # 1: Leg side, 10: Off side
        
        # Target: Optimal Position (1: Slips, 2: Boundary, 3: Inner Circle)
        if player['fielding_skill'] > 8 and batsman_tendency > 7:
            position = 1 # Slips
        elif player['fielding_skill'] < 6:
            position = 2 # Boundary
        else:
            position = 3 # Inner Circle
            
        fielding_data.append({
            'player_id': player_id,
            'fielding_ability': player['fielding_skill'],
            'throwing_accuracy': random.uniform(4, 10),
            'speed_agility': random.uniform(4, 10),
            'catching_ability': random.uniform(4, 10),
            'batsman_shot_tendency': batsman_tendency,
            'optimal_position': position
        })
        
    fielding_df = pd.DataFrame(fielding_data)
    fielding_df.to_csv(os.path.join(output_dir, 'fielding.csv'), index=False)
    
    print(f"Generated synthetic data in {output_dir}")

if __name__ == "__main__":
    generate_synthetic_cricket_data()
