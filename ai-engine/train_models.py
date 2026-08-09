from src.models.recommendation_model import RecommendationModel
import os

def train():
    # Initialize model
    model = RecommendationModel()
    
    # Check if data directory exists
    if not os.path.exists('data'):
        print("Data directory not found. Please run data_generator.py first.")
        return
        
    # Train all models
    model.train_all_models(data_dir='data')
    
if __name__ == "__main__":
    train()
