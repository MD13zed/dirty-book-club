#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Dirty Book Club — Oracle Cloud E2.1.Micro Setup Script
# Run as ubuntu user on a fresh Oracle Ubuntu 22.04 instance
# ═══════════════════════════════════════════════════════════════════════════════
set -e

DOMAIN="yourclub.duckdns.org"   # ← change this before running
APP_DIR="/home/ubuntu/dirty-book-club"
DB_NAME="dirtybc"
DB_USER="dbcuser"
DB_PASS="$(openssl rand -base64 24)"

echo "════════════════════════════════════════════"
echo "  Dirty Book Club — E2.1.Micro Setup"
echo "════════════════════════════════════════════"

# ── 1. Swap file (critical on 1GB RAM) ───────────────────────────────────────
echo "[1/10] Creating 2GB swap file..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✓ Swap created"
else
    echo "  Swap already exists, skipping"
fi

# ── 2. System update ──────────────────────────────────────────────────────────
echo "[2/10] Updating system..."
sudo apt-get update -q && sudo apt-get upgrade -y -q

# ── 3. Install Node.js, Nginx, MySQL, Certbot ────────────────────────────────
echo "[3/10] Installing Node.js 20, Nginx, MySQL, Certbot..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx mysql-server certbot python3-certbot-nginx ufw
sudo npm install -g pm2
echo "✓ Packages installed"

# ── 4. Firewall ───────────────────────────────────────────────────────────────
echo "[4/10] Configuring firewall..."
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
echo "✓ UFW firewall enabled"
echo "⚠  Make sure ports 80 + 443 are open in Oracle Console → VCN Security Lists"

# ── 5. MySQL — install + tune for low RAM ─────────────────────────────────────
echo "[5/10] Configuring MySQL for low memory..."
sudo systemctl start mysql
sudo systemctl enable mysql

# Write memory-optimised config
sudo tee /etc/mysql/mysql.conf.d/lowmem.cnf > /dev/null << 'EOF'
[mysqld]
innodb_buffer_pool_size = 64M
innodb_log_file_size    = 32M
max_connections         = 25
tmp_table_size          = 16M
max_heap_table_size     = 16M
EOF

sudo systemctl restart mysql

sudo mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"
sudo mysql ${DB_NAME} < "${APP_DIR}/backend/db/schema.sql"

echo "${DB_PASS}" > /home/ubuntu/.dbc_db_password
chmod 600 /home/ubuntu/.dbc_db_password
echo "✓ MySQL ready — password saved to ~/.dbc_db_password"

# ── 6. App dependencies ───────────────────────────────────────────────────────
echo "[6/10] Installing app dependencies..."
mkdir -p /home/ubuntu/logs

cd "${APP_DIR}/backend"
# Limit Node memory during install to avoid OOM
NODE_OPTIONS="--max-old-space-size=256" npm install --production
echo "✓ Backend dependencies installed"

cd "${APP_DIR}/frontend"
NODE_OPTIONS="--max-old-space-size=384" npm install
NODE_OPTIONS="--max-old-space-size=384" npm run build
echo "✓ Frontend built"

# ── 7. Environment file ───────────────────────────────────────────────────────
echo "[7/10] Creating .env file..."
if [ ! -f "${APP_DIR}/backend/.env" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
    cat > "${APP_DIR}/backend/.env" << EOF
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_SECRET=${JWT_SECRET}

# Fill these in after creating your Discord application:
DISCORD_CLIENT_ID=FILL_ME_IN
DISCORD_CLIENT_SECRET=FILL_ME_IN
DISCORD_REDIRECT_URI=https://${DOMAIN}/auth/discord/callback

API_URL=https://${DOMAIN}
FRONTEND_URL=https://${DOMAIN}

PORT=3001
NODE_ENV=production
EOF
    chmod 600 "${APP_DIR}/backend/.env"
    echo "✓ .env created — you still need to add Discord credentials"
else
    echo "  .env already exists, skipping"
fi

# Copy PM2 config into backend dir
cp "${APP_DIR}/ecosystem.config.js" "${APP_DIR}/backend/"

# ── 8. PM2 ───────────────────────────────────────────────────────────────────
echo "[8/10] Starting app with PM2..."
cd "${APP_DIR}/backend"
pm2 start "${APP_DIR}/backend/ecosystem.config.js"
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | sudo bash
echo "✓ PM2 running"

# ── 9. Nginx ──────────────────────────────────────────────────────────────────
echo "[9/10] Configuring Nginx..."
sudo cp "${APP_DIR}/nginx/dirty-book-club.conf" /etc/nginx/sites-available/dirty-book-club
sudo sed -i "s/yourclub.duckdns.org/${DOMAIN}/g" /etc/nginx/sites-available/dirty-book-club
sudo ln -sf /etc/nginx/sites-available/dirty-book-club /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
echo "✓ Nginx configured"

# ── 10. SSL ───────────────────────────────────────────────────────────────────
echo "[10/10] Getting SSL certificate..."
echo ""
echo "Make sure ${DOMAIN} is pointing to this server's IP before continuing."
read -p "Press Enter when ready (or Ctrl+C to do SSL later)..."

sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
    --email "admin@${DOMAIN}" --redirect
sudo systemctl enable certbot.timer
echo "✓ SSL certificate obtained"

# ── DuckDNS cron ─────────────────────────────────────────────────────────────
chmod +x "${APP_DIR}/scripts/duckdns.sh"
(crontab -l 2>/dev/null; echo "*/5 * * * * ${APP_DIR}/scripts/duckdns.sh >> /home/ubuntu/logs/duckdns.log 2>&1") | crontab -

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  ✓ Setup complete!"
echo ""
echo "  NEXT: edit your Discord credentials"
echo "  nano ${APP_DIR}/backend/.env"
echo "  (then run: pm2 restart dirty-book-club)"
echo ""
echo "  App URL : https://${DOMAIN}"
echo "  PM2 logs: pm2 logs dirty-book-club"
echo "════════════════════════════════════════════════════════════════"
