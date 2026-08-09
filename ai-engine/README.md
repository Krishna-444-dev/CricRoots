# CricSync AI Recommendation Engine

The CricSync AI Recommendation Engine is a Python-based machine learning service that provides intelligent tactical recommendations for cricket matches. It uses scikit-learn to train and deploy models that recommend the best batsmen, bowlers, and fielding positions based on match conditions and player abilities.

## Features

- **Batsman Recommendation**: Suggests the optimal batsman for the current match situation based on run rate, wickets down, overs remaining, opposition bowling strength, and batsman form.
- **Bowler Recommendation**: Recommends the best bowler considering current run rate against, overs bowled, wickets taken, batsman strength, and pitch conditions.
- **Fielding Position Optimization**: Suggests optimal fielding positions for players based on their abilities and batsman tendencies.

## Architecture

The AI engine is built with Flask and uses scikit-learn's RandomForestClassifier for making predictions. The service exposes RESTful API endpoints that can be called by the backend or frontend applications.

### Directory Structure

```
ai-engine/
├── src/
│   ├── models/
│   │   └── recommendation_model.py    # Core ML model
│   ├── api/
│   │   └── recommendations.py         # Flask API routes
│   └── utils/
│       └── (utility functions)
├── app.py                             # Flask application entry point
├── requirements.txt                   # Python dependencies
└── README.md                          # This file
```

## Installation

1. Install Python dependencies:
```bash
pip install -r requirements.txt
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

## Running the Service

Start the AI recommendation engine:
```bash
python app.py
```

The service will run on `http://localhost:5001` by default.

## API Endpoints

### 1. Batsman Recommendation

**Endpoint**: `POST /api/recommendations/batsman`

**Request Body**:
```json
{
  "current_run_rate": 6.5,
  "wickets_down": 2,
  "overs_remaining": 15,
  "opposition_bowling_strength": 7.5,
  "batsman_form_score": 8.0
}
```

**Response**:
```json
{
  "success": true,
  "recommended_batsman_id": 5,
  "confidence": 0.87,
  "all_probabilities": [0.05, 0.08, 0.12, 0.15, 0.23, 0.37]
}
```

### 2. Bowler Recommendation

**Endpoint**: `POST /api/recommendations/bowler`

**Request Body**:
```json
{
  "current_run_rate_against": 8.2,
  "overs_bowled": 8,
  "wickets_taken": 1,
  "batsman_strength": 7.0,
  "pitch_condition_score": 6.5
}
```

**Response**:
```json
{
  "success": true,
  "recommended_bowler_id": 3,
  "confidence": 0.79,
  "all_probabilities": [0.10, 0.15, 0.21, 0.54]
}
```

### 3. Fielding Position Recommendation

**Endpoint**: `POST /api/recommendations/fielding`

**Request Body**:
```json
{
  "player_data": {
    "fielding_ability": 8.5,
    "throwing_accuracy": 7.8,
    "speed_agility": 8.0,
    "catching_ability": 8.2
  },
  "batsman_data": {
    "shot_tendency": 6.5
  }
}
```

**Response**:
```json
{
  "success": true,
  "recommended_position": 2,
  "position_probabilities": [0.15, 0.65, 0.20]
}
```

### 4. Health Check

**Endpoint**: `GET /api/recommendations/health`

**Response**:
```json
{
  "status": "healthy",
  "service": "CricSync AI Recommendation Engine"
}
```

## Model Training

The recommendation models use RandomForestClassifier from scikit-learn. To train the models with your own data:

```python
from src.models.recommendation_model import RecommendationModel
import numpy as np

# Initialize model
model = RecommendationModel()

# Prepare training data
X_train = np.array([...])  # Feature matrix
y_train = np.array([...])  # Target labels

# Train models
model.train_batsman_model(X_train, y_train)
model.train_bowler_model(X_train, y_train)
model.train_fielding_model(X_train, y_train)

# Save trained models
model.save_models()
```

## Integration with Backend

The AI engine can be integrated with the Node.js backend by making HTTP requests to the recommendation endpoints. Example using Node.js:

```javascript
const axios = require('axios');

async function getBatsmanRecommendation(matchData) {
  try {
    const response = await axios.post('http://localhost:5001/api/recommendations/batsman', matchData);
    return response.data;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## Performance Considerations

- The RandomForestClassifier uses 100 estimators for a balance between accuracy and performance.
- Feature scaling is applied using StandardScaler to normalize input features.
- Models are trained on historical match data for optimal recommendations.

## Future Enhancements

- Integration with deep learning models (TensorFlow/PyTorch) for more complex pattern recognition
- Real-time model updates based on live match data
- Ensemble methods combining multiple models for improved accuracy
- Support for different cricket formats (T20, ODI, Test)

---

*Part of the CricSync - The All-in-One Cricket Application*
