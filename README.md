# CricSync - The All-in-One Cricket Application

CricSync is a comprehensive, full-stack cricket application designed to provide an all-in-one experience for cricket enthusiasts, players, and tournament organizers. Built with modern technologies across web, mobile, and backend platforms, CricSync brings together team management, scoring, commerce, and AI-powered tactical recommendations.

## Project Overview

This repository contains the complete CricSync ecosystem, including:

- **Web Application**: React-based frontend with shopping cart and payment integration
- **Mobile Application**: React Native (Expo) with platform-specific optimizations for iOS and Android
- **Backend API**: Node.js/Express server with MongoDB for data persistence
- **AI Recommendation Engine**: Python-based machine learning service for tactical analysis
- **Comprehensive Documentation**: Guides for development, testing, and deployment

## Technology Stack

| Component | Technology |
| :--- | :--- |
| **Frontend (Web)** | React, TypeScript, TailwindCSS |
| **Frontend (Mobile)** | React Native, Expo, TypeScript |
| **Backend** | Node.js, Express.js, MongoDB |
| **AI Engine** | Python, Flask, scikit-learn |
| **Authentication** | JWT, bcryptjs |
| **Security** | Helmet, CORS |

## Project Structure

```
CricSync/
├── web-app/                 # React web application
│   ├── components/          # Reusable UI components
│   ├── app/                 # Application pages
│   └── documentation/       # Web app docs
├── mobile-app/              # React Native mobile application
│   ├── src/
│   │   ├── screens/         # App screens
│   │   ├── platform/        # Platform-specific code (iOS/Android)
│   │   ├── navigation/      # Navigation configuration
│   │   └── contexts/        # State management
│   └── documentation/       # Mobile app docs
├── backend/                 # Node.js/Express backend
│   ├── src/
│   │   ├── controllers/     # Business logic
│   │   ├── models/          # Database schemas
│   │   ├── routes/          # API endpoints
│   │   ├── middleware/      # Express middleware
│   │   └── config/          # Configuration files
│   └── BACKEND_DOCUMENTATION.md
├── ai-engine/               # Python AI recommendation engine
│   ├── src/
│   │   ├── models/          # ML models
│   │   ├── api/             # Flask API routes
│   │   └── utils/           # Utility functions
│   └── README.md
├── ai-system/               # AI tactical components
├── documentation/           # Project documentation
└── README.md               # This file
```

## Core Features

### Team Management
Create and manage cricket teams with player registration, role assignment, and team statistics tracking.

### Scoring System
Real-time ball-by-ball scoring with automatic wicket tracking, run calculations, and match result generation.

### Marketplace
Browse and purchase cricket equipment with a fully functional shopping cart, checkout process, and payment integration (Stripe & PayPal).

### Communication
Team chat groups and individual messaging for seamless communication between players, captains, and organizers.

### AI Tactical Recommendations
Machine learning-powered recommendations for:
- Next batsman selection based on match conditions
- Optimal bowler choice considering current situation
- Fielding position optimization for each player

### Tournament Management
Automated fixture generation, scheduling, and standings calculation for cricket tournaments.

## Getting Started

### Prerequisites

- Node.js 16+ (for backend and web)
- Python 3.8+ (for AI engine)
- MongoDB (local or cloud)
- npm or yarn (package manager)

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Configure .env with your MongoDB URI and JWT secret
npm run dev
```

Backend runs on `http://localhost:5000`

### Mobile App Setup

```bash
cd mobile-app
npm install
# For iOS
npx expo start --ios
# For Android
npx expo start --android
```

### AI Engine Setup

```bash
cd ai-engine
pip install -r requirements.txt
cp .env.example .env
python app.py
```

AI engine runs on `http://localhost:5001`

## API Documentation

### Backend API

Comprehensive API documentation is available in [backend/BACKEND_DOCUMENTATION.md](backend/BACKEND_DOCUMENTATION.md)

Key endpoints:
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user
- `POST /api/players/register` - Register player profile
- `GET /api/players` - Get all players
- `GET /api/players/:id` - Get player by ID

### AI Recommendation API

Available in [ai-engine/README.md](ai-engine/README.md)

Key endpoints:
- `POST /api/recommendations/batsman` - Get batsman recommendation
- `POST /api/recommendations/bowler` - Get bowler recommendation
- `POST /api/recommendations/fielding` - Get fielding position recommendation

## Development Workflow

1. **Create a feature branch**: `git checkout -b feature/feature-name`
2. **Make your changes**: Implement the feature with proper testing
3. **Commit with clear messages**: `git commit -m "Add feature description"`
4. **Push to GitHub**: `git push origin feature/feature-name`
5. **Create a Pull Request**: For code review and merging

## Documentation

- [Backend Documentation](backend/BACKEND_DOCUMENTATION.md)
- [AI Engine Documentation](ai-engine/README.md)
- [Mobile App Documentation](mobile-app/documentation/)
- [Project Documentation](documentation/)

## Quality Assurance

The CricSync project maintains high quality standards:

- Comprehensive error handling
- Input validation on all endpoints
- Security best practices (JWT, bcrypt, CORS, Helmet)
- Responsive design for all screen sizes
- Platform-specific optimizations for iOS and Android

## Future Roadmap

### Short-term (1-2 months)
- Complete iOS testing and App Store submission
- Implement Android-specific components
- Prepare for Google Play Store submission

### Medium-term (3-6 months)
- Add offline functionality
- Implement push notifications
- Enhance performance optimizations
- Add real-time match updates

### Long-term (6-12 months)
- Implement advanced features like AR ball tracking
- Add machine learning for player performance analysis
- Expand to additional platforms (desktop, web)
- Integrate with wearable devices

## Contributing

We welcome contributions from the community. Please ensure:

1. Code follows the existing style and conventions
2. All new features include appropriate documentation
3. Tests are included for new functionality
4. Commit messages are clear and descriptive

## License

This project is licensed under the ISC License.

## Support

For issues, questions, or suggestions, please open an issue on GitHub or contact the development team.

---

**CricSync** - *Bringing the world of cricket together, one match at a time.*

*Developed with the assistance of Manus AI*
