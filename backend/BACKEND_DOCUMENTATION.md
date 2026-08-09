# CricSync Backend API Documentation

## Overview

The CricSync backend is a Node.js/Express server that provides a RESTful API for the CricSync mobile and web applications. It handles user authentication, player management, team operations, and integrates with the Python AI recommendation engine.

## Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcryptjs
- **Security**: Helmet, CORS

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js          # MongoDB connection
│   │   └── jwt.js               # JWT token generation/verification
│   ├── controllers/
│   │   ├── authController.js    # Authentication logic
│   │   └── playerController.js  # Player management logic
│   ├── middleware/
│   │   └── auth.js              # Authentication middleware
│   ├── models/
│   │   ├── User.js              # User schema
│   │   ├── Player.js            # Player schema
│   │   └── Team.js              # Team schema
│   ├── routes/
│   │   ├── authRoutes.js        # Auth endpoints
│   │   └── playerRoutes.js      # Player endpoints
│   └── index.js                 # Main entry point
├── package.json
└── .env.example
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Configure environment variables in `.env`:
```
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/cricsync
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=30d
```

## Running the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Authentication Endpoints

#### 1. Register User

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "player"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player"
  }
}
```

#### 2. Login User

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player"
  }
}
```

#### 3. Get Current User

**Endpoint**: `GET /api/auth/me`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "player",
    "createdAt": "2023-08-09T10:00:00.000Z"
  }
}
```

### Player Endpoints

#### 1. Register Player Profile

**Endpoint**: `POST /api/players/register`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "specialization": "Batsman",
  "battingStyle": "Right-hand",
  "bowlingStyle": "None"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "bowlingStyle": "None",
    "stats": {
      "matches": 0,
      "runs": 0,
      "wickets": 0,
      "average": 0
    },
    "teams": [],
    "profilePicture": "no-photo.jpg"
  }
}
```

#### 2. Get All Players

**Endpoint**: `GET /api/players`

**Response** (200 OK):
```json
{
  "success": true,
  "count": 2,
  "players": [
    {
      "_id": "507f1f77bcf86cd799439012",
      "user": {
        "_id": "507f1f77bcf86cd799439011",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "specialization": "Batsman",
      "battingStyle": "Right-hand",
      "stats": {
        "matches": 5,
        "runs": 250,
        "wickets": 0,
        "average": 50
      }
    }
  ]
}
```

#### 3. Get Player by ID

**Endpoint**: `GET /api/players/:id`

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "stats": {
      "matches": 5,
      "runs": 250,
      "wickets": 0,
      "average": 50
    },
    "teams": []
  }
}
```

#### 4. Update Player Profile

**Endpoint**: `PUT /api/players/:id`

**Headers**:
```
Authorization: Bearer <token>
```

**Request Body**:
```json
{
  "specialization": "All-rounder",
  "battingStyle": "Right-hand",
  "bowlingStyle": "Right-arm Fast"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": "507f1f77bcf86cd799439011",
    "specialization": "All-rounder",
    "battingStyle": "Right-hand",
    "bowlingStyle": "Right-arm Fast"
  }
}
```

#### 5. Get Current User's Player Profile

**Endpoint**: `GET /api/players/me/profile`

**Headers**:
```
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "success": true,
  "player": {
    "_id": "507f1f77bcf86cd799439012",
    "user": {
      "_id": "507f1f77bcf86cd799439011",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "specialization": "Batsman",
    "battingStyle": "Right-hand",
    "stats": {
      "matches": 5,
      "runs": 250,
      "wickets": 0,
      "average": 50
    }
  }
}
```

## Authentication

The API uses JWT (JSON Web Tokens) for authentication. After registering or logging in, clients receive a token that must be included in the `Authorization` header for protected routes:

```
Authorization: Bearer <token>
```

Tokens expire after 30 days (configurable via `JWT_EXPIRE` in `.env`).

## Error Handling

All error responses follow this format:

```json
{
  "success": false,
  "message": "Error description"
}
```

Common HTTP status codes:
- `200`: OK
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Database Models

### User Model

```javascript
{
  name: String (required),
  email: String (required, unique),
  password: String (required, hashed),
  role: String (enum: ['player', 'captain', 'organizer', 'admin'], default: 'player'),
  createdAt: Date
}
```

### Player Model

```javascript
{
  user: ObjectId (ref: User, required),
  specialization: String (enum: ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper']),
  battingStyle: String (enum: ['Right-hand', 'Left-hand']),
  bowlingStyle: String (enum: ['Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin', 'None']),
  stats: {
    matches: Number,
    runs: Number,
    wickets: Number,
    average: Number
  },
  teams: [ObjectId] (ref: Team),
  profilePicture: String,
  timestamps: true
}
```

### Team Model

```javascript
{
  name: String (required),
  captain: ObjectId (ref: Player, required),
  players: [ObjectId] (ref: Player),
  description: String,
  city: String (required),
  stats: {
    matchesPlayed: Number,
    wins: Number,
    losses: Number
  },
  logo: String,
  timestamps: true
}
```

## Integration with Frontend

### Example: React Native Integration

```javascript
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

// Register
async function register(name, email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      name,
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Registration error:', error);
  }
}

// Login
async function login(email, password) {
  try {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    // Store token in secure storage
    return response.data;
  } catch (error) {
    console.error('Login error:', error);
  }
}

// Get current user
async function getCurrentUser(token) {
  try {
    const response = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching user:', error);
  }
}
```

## Future Endpoints

The following endpoints are planned for future implementation:

- `POST /api/teams` - Create team
- `GET /api/teams` - Get all teams
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team
- `POST /api/matches` - Create match
- `GET /api/matches` - Get all matches
- `POST /api/shop` - Get shop items
- `POST /api/messages` - Send message

---

*For more information, see the main CricSync README.md*
