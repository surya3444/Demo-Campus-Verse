#!/bin/bash

# CampusVerse Deploy Script
# Usage: ./deploy.sh [command]

set -e

COMPOSE_FILE="docker-compose.prod.yml"

case "$1" in
  build)
    echo "🔨 Building API..."
    docker compose -f $COMPOSE_FILE build --no-cache api
    ;;
  up)
    echo "🚀 Starting services..."
    docker compose -f $COMPOSE_FILE up -d
    ;;
  down)
    echo "🛑 Stopping services..."
    docker compose -f $COMPOSE_FILE down
    ;;
  restart)
    echo "🔄 Restarting services..."
    docker compose -f $COMPOSE_FILE restart
    ;;
  logs)
    echo "📋 Showing logs..."
    docker compose -f $COMPOSE_FILE logs -f ${2:-api}
    ;;
  deploy)
    echo "📦 Full deploy: pull, build, and start..."
    git pull
    docker compose -f $COMPOSE_FILE build --no-cache api
    docker compose -f $COMPOSE_FILE up -d
    echo "✅ Deploy complete!"
    ;;
  status)
    echo "📊 Service status..."
    docker compose -f $COMPOSE_FILE ps
    ;;
  seed)
    echo "🌱 Seeding super admin..."
    docker exec -it campusverse-api pnpm seed:admin
    ;;
  *)
    echo "CampusVerse Deploy Script"
    echo ""
    echo "Usage: ./deploy.sh [command]"
    echo ""
    echo "Commands:"
    echo "  build    - Build API container"
    echo "  up       - Start all services"
    echo "  down     - Stop all services"
    echo "  restart  - Restart all services"
    echo "  logs     - Show logs (default: api, or specify service)"
    echo "  deploy   - Full deploy (git pull + build + up)"
    echo "  status   - Show service status"
    echo "  seed     - Seed super admin user"
    echo ""
    echo "Examples:"
    echo "  ./deploy.sh deploy     # Full deployment"
    echo "  ./deploy.sh logs       # View API logs"
    echo "  ./deploy.sh logs mongo # View MongoDB logs"
    ;;
esac
