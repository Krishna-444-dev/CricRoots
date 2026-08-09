# CricSync - The All-in-One Cricket Application

CricSync is a comprehensive, full-stack cricket application designed to provide an all-in-one experience for cricket enthusiasts, players, and tournament organizers. Built with modern technologies across web, mobile, and backend platforms, CricSync brings together team management, scoring, commerce, and advanced AI-powered tactical recommendations.

## Project Overview

This repository contains the complete CricSync ecosystem, including:

- **Web Application**: React-based frontend with shopping cart and payment integration.
- **Mobile Application**: React Native (Expo) with platform-specific optimizations for iOS and Android.
- **Backend API**: Node.js/Express server with MongoDB for data persistence and user management.
- **AI Engine**: Python-based machine learning service providing real-time tactical insights and predictions.
- **Comprehensive Documentation**: Detailed guides for architecture, deployment, and development.

## Advanced AI Engine

The CricSync AI Engine is a specialized Python service that leverages machine learning to provide unique strategic advantages:

- **Win Probability**: Predicts match outcomes in real-time based on the current situation.
- **Tactical Advisor**: Provides high-level strategic advice (Aggressive vs. Defensive) based on match data.
- **Dynamic Recommendations**: Recommends the optimal next batsman and bowler.
- **Fielding Optimization**: Suggests the best positions for each player based on their specific abilities.
- **Automated Training**: Includes a full pipeline for generating synthetic training data and retraining models.

## Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend (Web)** | React, TypeScript, TailwindCSS |
| **Frontend (Mobile)** | React Native, Expo, TypeScript |
| **Backend** | Node.js, Express.js, MongoDB |
| **AI Engine** | Python, Flask, scikit-learn, Pandas |
| **Infrastructure** | Docker, Docker Compose, Nginx |

## Getting Started

### Prerequisites
- Node.js 16+
- Python 3.11+
- Docker & Docker Compose
- MongoDB

### Quick Start with Docker
```bash
docker-compose up -d
```
This will launch the entire ecosystem, including the database, backend API, AI engine, and Nginx reverse proxy.

## Documentation
- [System Architecture](ARCHITECTURE.md) - Detailed overview of the system design.
- [Deployment Guide](DEPLOYMENT.md) - Instructions for local and production deployment.
- [Backend Documentation](backend/BACKEND_DOCUMENTATION.md) - API endpoint details.
- [AI Engine Documentation](ai-engine/README.md) - ML model and AI service details.

---

**CricSync** - *Bringing the world of cricket together, one match at a time.*

*Developed with the assistance of Manus AI*
