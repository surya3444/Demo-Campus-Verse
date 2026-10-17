#!/bin/bash
set -e

# ===========================================
# Campus Verse - Initial Server Setup Script
# Run this on a fresh Ubuntu 22.04+ droplet
# ===========================================

echo "=========================================="
echo "Campus Verse - Server Setup"
echo "=========================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "Please run as root (sudo ./setup.sh)"
  exit 1
fi

# Get domain from argument or prompt
DOMAIN=${1:-}
if [ -z "$DOMAIN" ]; then
  read -p "Enter your API domain (e.g., api.campusverse.com): " DOMAIN
fi

EMAIL=${2:-}
if [ -z "$EMAIL" ]; then
  read -p "Enter your email for SSL certificates: " EMAIL
fi

echo ""
echo "Setting up for domain: $DOMAIN"
echo ""

# Update system
echo ">>> Updating system packages..."
apt-get update && apt-get upgrade -y

# Install required packages
echo ">>> Installing required packages..."
apt-get install -y \
  apt-transport-https \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  fail2ban \
  git

# Install Docker
echo ">>> Installing Docker..."
if ! command -v docker &> /dev/null; then
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm get-docker.sh
  systemctl enable docker
  systemctl start docker
fi

# Install Docker Compose
echo ">>> Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
  curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
  chmod +x /usr/local/bin/docker-compose
fi

# Configure firewall
echo ">>> Configuring firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Configure fail2ban
echo ">>> Configuring fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Use current directory as app directory
APP_DIR="$(pwd)"
echo ">>> Using application directory: $APP_DIR"

# Verify we're in the right directory
if [ ! -f "docker-compose.prod.yml" ]; then
  echo ">>> ERROR: docker-compose.prod.yml not found in current directory."
  echo "    Please run this script from the campusverse repository root."
  exit 1
fi

# Update repository if it's a git repo
if [ -d ".git" ]; then
  echo ">>> Updating repository..."
  git pull || echo ">>> Git pull skipped (might have local changes)"
fi

# Update nginx config with actual domain
echo ">>> Configuring Nginx for domain: $DOMAIN..."
sed -i "s/api.yourdomain.com/$DOMAIN/g" infrastructure/nginx/conf.d/api.conf
sed -i "s/api.yourdomain.com/$DOMAIN/g" infrastructure/nginx/conf.d/api.conf.initial

# Create .env.production if it doesn't exist
if [ ! -f ".env.production" ]; then
  echo ">>> Creating .env.production from template..."
  cp .env.production.example .env.production

  # Generate secrets
  JWT_ACCESS=$(openssl rand -base64 48)
  JWT_REFRESH=$(openssl rand -base64 48)
  ENCRYPTION=$(openssl rand -hex 32)

  sed -i "s|JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$JWT_ACCESS|" .env.production
  sed -i "s|JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$JWT_REFRESH|" .env.production
  sed -i "s|ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$ENCRYPTION|" .env.production
  sed -i "s|APP_URL=.*|APP_URL=https://$DOMAIN|" .env.production
  sed -i "s|API_URL=.*|API_URL=https://$DOMAIN|" .env.production

  echo ""
  echo ">>> IMPORTANT: Edit .env.production to add your AWS/SMS/Email credentials"
  echo "    nano $APP_DIR/.env.production"
  echo ""
fi

# Use initial nginx config (without SSL)
echo ">>> Setting up initial Nginx config (HTTP only)..."
cp infrastructure/nginx/conf.d/api.conf infrastructure/nginx/conf.d/api.conf.ssl
cp infrastructure/nginx/conf.d/api.conf.initial infrastructure/nginx/conf.d/api.conf

# Start services
echo ">>> Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo ">>> Waiting for services to start..."
sleep 30

# Get SSL certificate
echo ">>> Obtaining SSL certificate..."
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email $EMAIL \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Switch to SSL nginx config
echo ">>> Enabling SSL configuration..."
cp infrastructure/nginx/conf.d/api.conf.ssl infrastructure/nginx/conf.d/api.conf

# Restart nginx with SSL
docker-compose -f docker-compose.prod.yml restart nginx

# Create database indexes (idempotent)
echo ">>> Creating database indexes..."
docker-compose -f docker-compose.prod.yml exec -T api pnpm db:indexes || \
  echo ">>> WARNING: db:indexes step failed — run manually after .env.production is configured."

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "Your API is now running at: https://$DOMAIN"
echo ""
echo "Next steps:"
echo "1. Edit .env.production with your credentials:"
echo "   nano $APP_DIR/.env.production"
echo ""
echo "2. Restart services after editing:"
echo "   cd $APP_DIR && docker-compose -f docker-compose.prod.yml restart api"
echo ""
echo "3. Set up your frontend on Vercel with:"
echo "   NEXT_PUBLIC_API_URL=https://$DOMAIN/api/v1"
echo ""
echo "4. View logs:"
echo "   docker-compose -f docker-compose.prod.yml logs -f"
echo ""
