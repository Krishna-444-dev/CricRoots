# CricRoots AI Recommendation Engine

The CricRoots AI Recommendation Engine is a Python-based machine learning service that provides intelligent tactical recommendations for cricket matches. It uses scikit-learn to train and deploy models that provide real-time insights based on match conditions and player abilities.

## Advanced Features

- **Batsman Recommendation**: Suggests the optimal batsman for the current match situation.
- **Bowler Recommendation**: Recommends the best bowler considering pitch and opposition.
- **Fielding Position Optimization**: Suggests optimal fielding positions for players.
- **Win Probability Prediction**: Real-time estimation of the match outcome probability.
- **Tactical Advisor**: Comprehensive summary providing strategic advice and key recommendations.
- **Automated Training**: Built-in logic for retraining models with new match data.

## Architecture

The AI engine is built with Flask and utilizes scikit-learn's `RandomForestClassifier` and `RandomForestRegressor`. It includes a synthetic data generator for development and demonstration purposes.

### Directory Structure

```
ai-engine/
├── src/
│   ├── models/
│   │   ├── recommendation_model.py    # Core ML model logic
│   │   └── trained_models/            # Saved model files (.pkl)
│   ├── api/
│   │   ├── recommendations.py         # Flask API routes (batsman/bowler/fielding/win-prob/tactical-advisor)
│   │   └── analytics.py               # Flask API routes (player form, performance, tournament trends)
│   └── utils/
│       └── data_generator.py          # Synthetic data generation
├── data/                              # Training data (CSV)
├── app.py                             # Flask application entry point
├── train_models.py                    # Training script
├── requirements.txt                   # Python dependencies
└── README.md                          # This file
```

## Getting Started

1. **Install Dependencies**:
```bash
pip install -r requirements.txt
```

2. **Generate Training Data**:
```bash
python src/utils/data_generator.py
```

3. **Train Models**:
```bash
python train_models.py
```

4. **Run the Service**:
```bash
python app.py
```

The service will run on `http://localhost:5001`.

## API Endpoints

### 1. Tactical Advisor (Recommended)
Provides a complete strategic overview of the current match situation.

**Endpoint**: `POST /api/recommendations/tactical-advisor`
**Request**:
```json
{
  "overs_remaining": 10.5,
  "wickets_down": 4,
  "current_run_rate": 7.2,
  "target_score": 180,
  "opposition_strength": 8.0,
  "pitch_type": 1
}
```

### 2. Win Probability
**Endpoint**: `POST /api/recommendations/win-probability`
**Response**:
```json
{
  "success": true,
  "win_probability": 0.65,
  "status": "Balanced"
}
```

### 3. Training
**Endpoint**: `POST /api/recommendations/train`
**Description**: Triggers a full retraining cycle of all machine learning models.

### 4. Individual Recommendations
Lower-level endpoints used by the Tactical Advisor internally, also callable directly:
- `POST /api/recommendations/batsman` — recommended batsman ID + confidence
- `POST /api/recommendations/bowler` — recommended bowler ID + confidence
- `POST /api/recommendations/fielding` — recommended fielding position (`player_data` + `batsman_data` required)

### 5. Health Check
**Endpoint**: `GET /api/recommendations/health`
**Response**: `{ "status": "healthy", "models_loaded": true, "service": "CricSync AI Recommendation Engine" }`

## Analytics Endpoints

A separate blueprint at `/api/analytics`, mounted from `src/api/analytics.py`, provides rule-based (non-ML) statistical helpers:
- `POST /api/analytics/player-form` — form/trend from recent performance ratings
- `POST /api/analytics/player-performance` — batting/bowling prediction adjusted for pitch conditions
- `POST /api/analytics/tournament-trends` — average score, wickets, matches completed
- `POST /api/analytics/tournament-winner-prediction` — top-3 teams by points with a heuristic win probability

## Development & Data

For development, the `data_generator.py` script creates high-quality synthetic data that mimics real-world T20 cricket patterns, including scoring distributions and wicket probabilities. This allows for immediate testing and demonstration of the AI's tactical logic.

---

*Part of the CricRoots - The All-in-One Cricket Application*
