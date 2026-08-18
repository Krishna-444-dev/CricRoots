# CricRoots Deployment Guide

This guide provides comprehensive instructions for deploying the CricRoots application using Docker and Docker Compose.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Local Development Deployment](#local-development-deployment)
3. [Production Deployment](#production-deployment)
4. [Environment Configuration](#environment-configuration)
5. [Database Management](#database-management)
6. [Monitoring and Logs](#monitoring-and-logs)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Software

- Docker 20.10+ ([Install Docker](https://docs.docker.com/get-docker/))
- Docker Compose 2.0+ ([Install Docker Compose](https://docs.docker.com/compose/install/))
- Git
- (Optional) Docker Hub account for pushing images

### System Requirements

- **Minimum**: 2GB RAM, 2 CPU cores
- **Recommended**: 4GB RAM, 4 CPU cores
- **Storage**: 10GB free disk space

## Local Development Deployment

### 1. Clone the Repository

```bash
git clone https://github.com/Krishna-444-dev/CricRoots.git
cd CricRoots
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and update the following for development:

```env
NODE_ENV=development
MONGO_ROOT_PASSWORD=dev_password
JWT_SECRET=dev_jwt_secret
FLASK_ENV=development
```

### 3. Start Services

`nginx.conf` terminates TLS on 443 and redirects all port-80 traffic to https, so nginx needs `ssl/cert.pem` and `ssl/key.pem` to exist before it will start — the `ssl/` directory is gitignored and empty on a fresh clone. For local dev, generate a self-signed pair first:

```bash
mkdir -p ssl
openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout ssl/key.pem -out ssl/cert.pem -subj "/CN=localhost"
```

```bash
docker-compose up -d
```

This command will:
- Pull necessary base images
- Build backend and AI engine images
- Start MongoDB, Backend, AI Engine, and Nginx containers
- Create a shared network for inter-service communication

### 4. Verify Services

Check if all services are running:

```bash
docker-compose ps
```

Expected output:
```
NAME                    STATUS
cricroots-mongodb        Up (healthy)
cricroots-backend        Up (healthy)
cricroots-ai-engine      Up (healthy)
cricroots-nginx          Up
```

### 5. Access Services

- **Backend API**: http://localhost:5000
- **AI Engine**: http://localhost:5001
- **MongoDB**: localhost:27017 (published to the host by default; restrict with a firewall or drop the port mapping in production)
- **Nginx Proxy**: http://localhost:80 (redirects to https://localhost, see SSL note below)

### 6. View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f ai-engine
docker-compose logs -f mongodb
```

### 7. Stop Services

```bash
docker-compose down
```

To also remove volumes:

```bash
docker-compose down -v
```

## Production Deployment

> **Scope note (2026-08-18).** This section documents the Docker mechanics. A repository audit found
> two things it does **not** cover, both of which block a real deployment:
>
> 1. **The web app is not deployed by anything here.** There is no `web-app/Dockerfile`, no web-app
>    service in `docker-compose.yml`, and `nginx.conf` ends with `location / { return 404; }`.
>    Following this guide produces a working API and **nothing at the site root**.
> 2. **Step 3's MongoDB Atlas guidance conflicts with `docker-compose.yml`**, which hardcodes a
>    local Mongo connection string (`MONGO_URI: mongodb://...@mongodb:27017/...`). Using Atlas needs
>    a compose change, not just an environment variable — otherwise a stray local Mongo runs with
>    `admin`/`password` defaults alongside it.
>
> For the audited, sequenced version of what actually remains before a pilot, see
> [`documentation/pilot-deployment-plan.md`](documentation/pilot-deployment-plan.md).

### 1. Prepare Production Environment

Create a production `.env` file with secure values:

```bash
cp .env.example .env.production
```

Update `.env.production`:

```env
NODE_ENV=production
MONGO_ROOT_PASSWORD=<strong_random_password>
JWT_SECRET=<strong_random_jwt_secret>
FLASK_ENV=production
BACKEND_URL=https://api.yourdomain.com
AI_ENGINE_URL=https://ai.yourdomain.com
```

### 2. SSL/TLS Certificate Setup

> The `ssl/cert.pem` checked into this repository is **self-signed and development-only**
> (`CN=localhost`, `O=CricSync Dev`). A mobile device will refuse it. Production requires a real
> certificate for the actual hostname — which for the mobile client must be `api.cricroots.com`,
> since `mobile-app/src/shared/api/apiClient.ts` hardcodes that as its production fallback.

Generate or obtain SSL certificates:

```bash
# Create SSL directory
mkdir -p ssl

# Using Let's Encrypt (recommended)
certbot certonly --standalone -d yourdomain.com -d api.yourdomain.com

# Copy certificates
cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ssl/cert.pem
cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ssl/key.pem
```

### 3. Build Production Images

```bash
# Build with specific tags
docker-compose -f docker-compose.yml build

# Tag images for registry
docker tag cricroots-backend:latest your-registry/cricroots-backend:1.0.0
docker tag cricroots-ai-engine:latest your-registry/cricroots-ai-engine:1.0.0

# Push to registry
docker push your-registry/cricroots-backend:1.0.0
docker push your-registry/cricroots-ai-engine:1.0.0
```

### 4. Deploy to Production Server

```bash
# SSH into production server
ssh user@production-server.com

# Clone repository
git clone https://github.com/Krishna-444-dev/CricRoots.git
cd CricRoots

# Copy production env file
cp .env.production .env

# Pull latest images
docker pull your-registry/cricroots-backend:1.0.0
docker pull your-registry/cricroots-ai-engine:1.0.0

# Start services
docker-compose up -d

# Verify deployment
docker-compose ps
```

### 5. Configure Reverse Proxy

Update DNS records to point to your production server:

```
api.yourdomain.com -> your-server-ip
ai.yourdomain.com -> your-server-ip
```

## Environment Configuration

### Backend Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://user:pass@host:27017/db` |
| `JWT_SECRET` | JWT signing secret | `your-secret-key` |
| `JWT_EXPIRE` | Token expiration | `30d` |
| `ANTHROPIC_API_KEY` | Claude API key for the in-app assistant; leave blank to keep the assistant in its "not configured yet" state | `sk-ant-...` |
| `AI_ENGINE_URL` | AI engine base URL (fixed to `http://ai-engine:5001` inside docker-compose) | `http://ai-engine:5001` |

### AI Engine Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `FLASK_ENV` | Flask environment | `production` |
| `PORT` | AI engine port | `5001` |
| `BACKEND_API_URL` | Backend API URL | `http://backend:5000` |

### MongoDB Environment Variables

| Variable | Description | Example |
| :--- | :--- | :--- |
| `MONGO_ROOT_USER` | Root username (mapped to `MONGO_INITDB_ROOT_USERNAME` in the container) | `admin` |
| `MONGO_ROOT_PASSWORD` | Root password (mapped to `MONGO_INITDB_ROOT_PASSWORD` in the container) | `secure-password` |

The initial database name (`cricsync`) is hardcoded in `docker-compose.yml`, not configurable via `.env`.

## Database Management

### Backup MongoDB

```bash
# Create backup
docker-compose exec mongodb mongodump --username admin --password <password> --authenticationDatabase admin --out /backup

# Copy backup to host
docker cp cricroots-mongodb:/backup ./mongodb_backup
```

### Restore MongoDB

```bash
# Copy backup to container
docker cp ./mongodb_backup cricroots-mongodb:/backup

# Restore data
docker-compose exec mongodb mongorestore --username admin --password <password> --authenticationDatabase admin /backup
```

### Access MongoDB Shell

```bash
docker-compose exec mongodb mongosh -u admin -p <password> --authenticationDatabase admin
```

## Monitoring and Logs

### Health Checks

```bash
# Backend health
curl http://localhost:5000/

# AI Engine health
curl http://localhost:5001/api/recommendations/health

# Nginx health (port 80 redirects to https; -k accepts the self-signed dev cert)
curl -k https://localhost/health
```

### Container Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker-compose logs backend
```

### Resource Usage

```bash
# Monitor resource usage
docker stats

# View container details
docker inspect cricroots-backend
```

## Troubleshooting

### Services Not Starting

```bash
# Check logs
docker-compose logs

# Rebuild images
docker-compose build --no-cache

# Restart services
docker-compose restart
```

### MongoDB Connection Issues

```bash
# Check MongoDB logs
docker-compose logs mongodb

# Verify connection string
docker-compose exec backend env | grep MONGO_URI

# Test connection
docker-compose exec mongodb mongosh -u admin -p <password> --authenticationDatabase admin
```

### Port Already in Use

```bash
# Find process using port
lsof -i :5000

# Kill process
kill -9 <PID>

# Or change port in .env
BACKEND_PORT=5001
```

### High Memory Usage

```bash
# Check memory limits
docker inspect cricroots-backend | grep -i memory

# Update docker-compose.yml with memory limits
# Add under service:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

### SSL Certificate Issues

```bash
# Verify certificate
openssl x509 -in ssl/cert.pem -text -noout

# Check certificate expiration
openssl x509 -in ssl/cert.pem -noout -dates

# Renew certificate
certbot renew --force-renewal
```

## Performance Optimization

### Enable Caching

Update `docker-compose.yml` to add Redis:

```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
```

### Database Indexing

```bash
docker-compose exec mongodb mongosh -u admin -p <password> --authenticationDatabase admin

# In mongo shell
use cricsync
db.users.createIndex({ email: 1 })
db.players.createIndex({ user: 1 })
db.teams.createIndex({ captain: 1 })
db.matches.createIndex({ scheduledDate: -1 })
```

### Load Balancing

Configure multiple backend instances in `docker-compose.yml`:

```yaml
backend:
  deploy:
    replicas: 3
```

## Security Best Practices

1. **Environment Variables**: Never commit `.env` files to version control
2. **SSL/TLS**: Always use HTTPS in production
3. **Database**: Use strong passwords and enable authentication
4. **Secrets**: Rotate JWT secrets regularly
5. **Updates**: Keep Docker images updated
6. **Firewall**: Restrict access to necessary ports only

## Scaling

### Horizontal Scaling

Deploy multiple instances across servers:

```bash
# On Server 1
docker-compose -f docker-compose.yml up -d

# On Server 2
docker-compose -f docker-compose.yml up -d

# Use load balancer (e.g., HAProxy, AWS ELB) to distribute traffic
```

### Vertical Scaling

Increase resource allocation:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
        reservations:
          cpus: '1'
          memory: 512M
```

## Continuous Integration/Deployment

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Build and push
        run: |
          docker build -t cricroots-backend:latest ./backend
          docker push cricroots-backend:latest
      - name: Deploy
        run: |
          ssh user@server "cd CricRoots && docker-compose pull && docker-compose up -d"
```

---

For more information, see the main [README.md](README.md) and service-specific documentation.
