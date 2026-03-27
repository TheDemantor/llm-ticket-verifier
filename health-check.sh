#!/bin/bash
# Health check script for DQMS services

echo "🏥 Checking DQMS Service Health..."

BACKEND_URL="${BACKEND_URL:-http://localhost:3000}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:8501}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

health_check() {
    local service=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service is healthy"
        return 0
    else
        echo -e "${RED}✗${NC} $service is down"
        return 1
    fi
}

echo ""
echo "Backend API:"
health_check "Backend" "$BACKEND_URL/health"

echo ""
echo "Frontend:"
health_check "Frontend" "$FRONTEND_URL"

echo ""
echo "Database Connection:"
if mongosh "$MONGODB_URI" --eval "db.adminCommand('ping')" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} MongoDB is accessible"
else
    echo -e "${YELLOW}?${NC} MongoDB check inconclusive (mongosh may not be installed)"
fi

echo ""
echo "✅ Health check complete"
