import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Import API routes
from src.api.recommendations import recommendations_bp
from src.api.analytics import analytics_bp

# Register blueprints
app.register_blueprint(recommendations_bp, url_prefix='/api/recommendations')
app.register_blueprint(analytics_bp, url_prefix='/api/analytics')

@app.route('/', methods=['GET'])
def home():
    return jsonify({
        'message': 'Welcome to CricSync AI Recommendation Engine',
        'version': '1.0.0',
        'status': 'Running'
    })

@app.errorhandler(404)
def not_found(error):
    return jsonify({
        'success': False,
        'message': 'Route not found'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({
        'success': False,
        'message': 'Internal server error'
    }), 500

if __name__ == '__main__':
    PORT = os.getenv('PORT', 5001)
    app.run(host='0.0.0.0', debug=True, port=PORT)
