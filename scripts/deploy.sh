#!/bin/bash
# Run this whenever you update the code on your server
# Usage: ./scripts/deploy.sh

set -e
APP_DIR="/home/ubuntu/dirty-book-club"

echo "🔥 Deploying Dirty Book Club update..."

cd "$APP_DIR"

# Pull latest code (if using git)
# git pull origin main

# Rebuild frontend
echo "→ Building frontend..."
cd frontend && npm install && npm run build
echo "✓ Frontend built"

# Update backend deps
echo "→ Updating backend..."
cd ../backend && npm install --production
echo "✓ Backend updated"

# Reload PM2 (zero-downtime)
echo "→ Reloading PM2..."
pm2 reload dirty-book-club
echo "✓ App reloaded"

echo "✓ Deploy complete!"
pm2 status
