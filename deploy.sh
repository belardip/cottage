#!/bin/bash
set -e

SERVER="root@142.93.153.52"
REMOTE_DIR="/var/www/cottage"

echo "→ Committing..."
git add -A
git commit -m "${1:-deploy}" || echo "Nothing to commit"

echo "→ Pushing to git..."
git push

echo "→ Deploying on server..."
ssh $SERVER "cd $REMOTE_DIR \
  && git pull \
  && git diff HEAD~1 --name-only 2>/dev/null | grep -q 'package' && npm install --omit=dev || true \
  && git diff HEAD~1 --name-only 2>/dev/null | grep -q 'prisma/' && DATABASE_URL='file:$REMOTE_DIR/prod.db' npx prisma db push && DATABASE_URL='file:$REMOTE_DIR/prod.db' npx prisma generate || true \
  && NODE_OPTIONS='--max-old-space-size=3000' npm run build \
  && pm2 restart cottage \
  && echo '✓ Deploy complete'"

echo "✓ Done → https://cottage.tenderbones.org"
