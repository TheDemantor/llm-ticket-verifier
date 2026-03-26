# Deployment Guide - IT Support Data Quality Verifier

This guide covers deploying the DQMS application to production.

## Prerequisites

- Docker and Docker Compose (for containerized deployment)
- Node.js 20+ and Python 3.11+ (for manual deployment)
- MongoDB instance (local or remote)
- Ollama or DeepSeek API access for LLM

## Quick Start with Docker

### 1. Setup Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your production values:

```env
MONGODB_URI=mongodb://your-production-db:27017
DB_NAME=it_support_dqms
NODE_ENV=production
PORT=3000
LLM_PROVIDER=deepseek  # or 'ollama' for local
DEEPSEEK_API_KEY=your_key_here
FRONTEND_URL=https://your-frontend-domain.com
```

### 2. Build and Run with Docker Compose

```bash
# Build all services
docker-compose build

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

The application will be available at:
- Frontend: http://localhost:8501
- Backend API: http://localhost:3000
- MongoDB: mongodb://localhost:27017

## Manual Deployment

### Backend Setup

```bash
# Install dependencies
npm install

# Set environment variables
export MONGODB_URI="mongodb://localhost:27017"
export DB_NAME="it_support_dqms"
export NODE_ENV="production"
export PORT=3000

# Start backend
npm start
```

### Frontend Setup

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export STREAMLIT_SERVER_PORT=8501

# Start frontend
streamlit run streamlit_app/app.py
```

## Production Deployment Options

### Option 1: AWS EC2 + ECS/Fargate

1. **Push Docker images to ECR:**
   ```bash
   aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin your-ecr-repo
   docker tag dqms_backend:latest your-ecr-repo/dqms-backend:latest
   docker push your-ecr-repo/dqms-backend:latest
   ```

2. **Deploy to ECS/Fargate** using CloudFormation or AWS Console

3. **Set up RDS for MongoDB** (or use DocumentDB)

### Option 2: Azure Container Instances / App Service

1. **Login to Azure:**
   ```bash
   az login
   ```

2. **Create Container Registry:**
   ```bash
   az acr create --resource-group myResourceGroup --name myRegistry --sku Basic
   ```

3. **Push images:**
   ```bash
   az acr build --registry myRegistry --image dqms-backend:latest .
   ```

4. **Deploy with Docker Compose on VM or App Service**

### Option 3: Kubernetes (DigitalOcean, AWS EKS, Azure AKS)

1. **Create deployment manifests** (see kubernetes/ folder structure)

2. **Deploy:**
   ```bash
   kubectl apply -f kubernetes/
   ```

### Option 4: Heroku / Railway / Render

1. **Add Procfile** (for Heroku):
   ```
   web: node ./backend/server.js
   ```

2. **Deploy:**
   ```bash
   git push heroku main
   ```

## Environment Configuration

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://user:pass@host:27017` |
| `DB_NAME` | Database name | `it_support_dqms` |
| `NODE_ENV` | Node environment | `production` |
| `PORT` | Backend port | `3000` |
| `LLM_PROVIDER` | LLM service | `deepseek` or `ollama` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEEPSEEK_API_KEY` | DeepSeek API key | - |
| `OLLAMA_BASE_URL` | Ollama service URL | `http://localhost:11434` |
| `FRONTEND_URL` | Frontend URL for CORS | `http://localhost:8501` |
| `API_TIMEOUT` | Request timeout (ms) | `30000` |
| `LOG_LEVEL` | Logging level | `info` |

## Security Checklist

- [ ] Set strong MongoDB credentials
- [ ] Use HTTPS in production with SSL certificate
- [ ] Set proper CORS origins in FRONTEND_URL
- [ ] Store secrets in environment variables or secret manager
- [ ] Enable database authentication and encryption
- [ ] Use rate limiting on API endpoints
- [ ] Set up firewall rules and security groups
- [ ] Enable logging and monitoring
- [ ] Regular backups of MongoDB database
- [ ] Keep dependencies up to date

## Scaling

### Horizontal Scaling

- Use load balancer (AWS ALB, Azure LB) in front of multiple backend instances
- Sticky sessions recommended for chat functionality
- Use managed database (Atlas, DocumentDB) for MongoDB

### Vertical Scaling

- Increase container resources (CPU/memory)
- Upgrade database instance size
- Use CDN for static assets

## Monitoring & Logging

### Recommended Tools

- **Monitoring**: Prometheus, DataDog, New Relic
- **Logging**: ELK Stack, CloudWatch, Splunk
- **APM**: New Relic APM, DataDog APM, AWS X-Ray

### Health Checks

The backend includes a `/health` endpoint for monitoring:

```bash
curl http://localhost:3000/health
```

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check MongoDB connectivity
telnet localhost 27017

# Verify environment variables
echo $MONGODB_URI
```

### LLM Service Not Responding
```bash
# Check Ollama/DeepSeek
curl http://localhost:11434/api/tags  # For Ollama

# Check logs
docker-compose logs ollama
```

### Frontend Not Connecting to Backend
- Verify `FRONTEND_URL` env variable
- Check CORS configuration in backend
- Ensure backend is running and accessible

## Post-Deployment Verification

1. **API Health:**
   ```bash
   curl https://your-api.com/health
   ```

2. **Database Connection:**
   - Check MongoDB connection logs
   - Query test collection

3. **Frontend Access:**
   - Open frontend URL in browser
   - Test chat functionality

4. **Monitor Logs:**
   ```bash
   docker-compose logs -f backend
   docker-compose logs -f frontend
   ```

## CI/CD Pipeline

Recommended setup with GitHub Actions:

```yaml
name: Deploy
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
          docker build -t my-registry/dqms:latest .
          docker push my-registry/dqms:latest
      - name: Deploy
        run: kubectl apply -f k8s/
```

## Support

For issues or questions:
1. Check logs: `docker-compose logs`
2. Review troubleshooting section above
3. Check GitHub issues
4. Contact development team
