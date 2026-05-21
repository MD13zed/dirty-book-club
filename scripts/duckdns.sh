#!/bin/bash
# DuckDNS automatic IP updater
# Keeps your free duckdns.org subdomain pointing at your Oracle Cloud IP
#
# Setup:
#   1. Register at https://www.duckdns.org
#   2. Create a subdomain (e.g. "yourclub")
#   3. Copy your token from the dashboard
#   4. Fill in DOMAIN and TOKEN below
#   5. Make executable: chmod +x duckdns.sh
#   6. Add to crontab (updates every 5 min):
#      */5 * * * * /home/ubuntu/dirty-book-club/scripts/duckdns.sh >> /home/ubuntu/logs/duckdns.log 2>&1

DOMAIN="yourclub"          # ← change to your DuckDNS subdomain (without .duckdns.org)
TOKEN="your-duckdns-token" # ← paste your token from duckdns.org

echo "$(date) — Updating DuckDNS..."
RESULT=$(curl -s "https://www.duckdns.org/update?domains=${DOMAIN}&token=${TOKEN}&ip=")
echo "Result: $RESULT"

if [ "$RESULT" = "OK" ]; then
    echo "✓ IP updated successfully"
else
    echo "✗ Update failed: $RESULT"
    exit 1
fi
