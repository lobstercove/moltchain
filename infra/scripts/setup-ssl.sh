#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# SSL Certificate Setup using Let's Encrypt / certbot
# Usage: ./setup-ssl.sh <domain>
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

DOMAIN="${1:?Usage: $0 <domain>}"
SSL_DIR="$(dirname "$0")/../nginx/ssl"

echo "═══ SSL Setup for ${DOMAIN} ═══"

# Check for certbot
if ! command -v certbot &>/dev/null; then
    echo "Installing certbot..."
    if command -v brew &>/dev/null; then
        brew install certbot
    elif command -v apt-get &>/dev/null; then
        sudo apt-get update && sudo apt-get install -y certbot
    else
        echo "Please install certbot manually."
        exit 1
    fi
fi

mkdir -p "$SSL_DIR"

# Obtain certificate
certbot certonly --standalone \
    -d "$DOMAIN" \
    --non-interactive \
    --agree-tos \
    --email ${CERTBOT_EMAIL:-admin@moltchain.io}

# Copy certs to nginx ssl dir
cp /etc/letsencrypt/live/"$DOMAIN"/fullchain.pem "$SSL_DIR/fullchain.pem"
cp /etc/letsencrypt/live/"$DOMAIN"/privkey.pem "$SSL_DIR/privkey.pem"

echo "✅ SSL certificates installed to $SSL_DIR"
echo ""
echo "Uncomment the HTTPS server block in infra/nginx/dex.conf"
echo "Then restart nginx: docker compose restart nginx"
