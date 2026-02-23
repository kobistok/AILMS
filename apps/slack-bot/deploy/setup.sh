#!/usr/bin/env bash
# One-time setup script for GCP e2-micro (Ubuntu 22.04)
# Run as the default 'ubuntu' user: bash setup.sh
set -euo pipefail

echo "=== AILMS Slack Bot — VM Setup ==="

# ── 1. System deps ────────────────────────────────────────────────────────────
sudo apt-get update -q
sudo apt-get install -y git curl

# ── 2. Node.js 20 ─────────────────────────────────────────────────────────────
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# ── 3. pnpm ───────────────────────────────────────────────────────────────────
sudo npm install -g pnpm

# ── 4. Clone repo ─────────────────────────────────────────────────────────────
sudo mkdir -p /opt/ailms
sudo chown "$USER:$USER" /opt/ailms
git clone https://github.com/kobistok/AILMS.git /opt/ailms
cd /opt/ailms

# ── 5. Install dependencies ───────────────────────────────────────────────────
pnpm install --frozen-lockfile

# ── 6. Create .env ────────────────────────────────────────────────────────────
cp .env.example .env
echo ""
echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "  1. Fill in your credentials:"
echo "       nano /opt/ailms/.env"
echo ""
echo "  2. Install the systemd service:"
echo "       sudo cp /opt/ailms/apps/slack-bot/deploy/ailms-bot.service /etc/systemd/system/"
echo "       sudo systemctl daemon-reload"
echo "       sudo systemctl enable ailms-bot"
echo "       sudo systemctl start ailms-bot"
echo ""
echo "  3. Check it's running:"
echo "       sudo journalctl -u ailms-bot -f"
