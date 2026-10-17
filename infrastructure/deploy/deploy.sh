#!/bin/bash
set -e

# ===========================================
# Campus Verse - Deployment Script
# Run this to deploy updates
# ===========================================

APP_DIR="/opt/campusverse"
cd $APP_DIR

echo "=========================================="
echo "Campus Verse - Deploying Updates"
echo "=========================================="

# Pull latest code
echo ">>> Pulling latest code..."
git pull

# Build and restart services
echo ">>> Rebuilding and restarting services..."
docker-compose -f docker-compose.prod.yml build api
docker-compose -f docker-compose.prod.yml up -d api

# Ensure DB indexes are present (idempotent — safe to run on every deploy).
echo ">>> Ensuring database indexes..."
docker-compose -f docker-compose.prod.yml exec -T api pnpm db:indexes || \
  echo "WARNING: db:indexes step failed — verify indexes manually."

# Clean up old images
echo ">>> Cleaning up old Docker images..."
docker image prune -f

# Health check
echo ">>> Running health check..."
sleep 10
HEALTH=$(curl -s http://localhost:3001/health | grep -o '"status":"ok"' || echo "failed")

if [ "$HEALTH" = '"status":"ok"' ]; then
  echo ""
  echo "=========================================="
  echo "Deployment Successful!"
  echo "=========================================="
else
  echo ""
  echo "WARNING: Health check failed. Check logs:"
  echo "docker-compose -f docker-compose.prod.yml logs api"
fi
