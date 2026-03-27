#!/bin/bash
# Production startup script for DQMS backend

set -e

echo "🚀 Starting DQMS Backend in Production Mode..."

# Check required environment variables
required_vars=("MONGODB_URI" "DB_NAME" "NODE_ENV" "LLM_PROVIDER")

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

echo "✅ All required environment variables are set"

# Log configuration (without secrets)
echo "📋 Configuration:"
echo "  - Node Environment: $NODE_ENV"
echo "  - Port: ${PORT:-3000}"
echo "  - LLM Provider: $LLM_PROVIDER"
echo "  - Frontend URL: $FRONTEND_URL"

# Start the application
echo "🔄 Starting application..."
exec node ./backend/server.js
