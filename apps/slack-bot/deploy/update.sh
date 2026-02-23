#!/usr/bin/env bash
# Pull latest code and restart the bot.
# Run from anywhere on the VM: bash /opt/ailms/apps/slack-bot/deploy/update.sh
set -euo pipefail

cd /opt/ailms
git pull origin main
pnpm install --frozen-lockfile
sudo systemctl restart ailms-bot
echo "✅ Updated and restarted"
sudo journalctl -u ailms-bot -n 20 --no-pager
