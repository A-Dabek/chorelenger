#!/bin/bash
set -euo pipefail

# Chorelenger production start for Termux (Android).
# Builds the frontend on the device (web/dist is gitignored), prunes dev deps,
# backs up the DB, then runs the server in the foreground.
#
# Config: copy .env.example to .env and fill it in. Real environment variables
# win over .env (the exports below use `:-` defaults).
#
# Env overrides:
#   ENV_FILE=path     alternate env file (default .env)
#   SKIP_BUILD=1      skip npm ci / build / prune (restart only)
#
# Port: 3000 is bombos2 and 3001 is mem-alice, so chorelenger uses 3002.
# Tunnel: chorelenger.bombos.online -> http://127.0.0.1:$PORT

ENV_FILE="${ENV_FILE:-.env}"
if [ -f "$ENV_FILE" ]; then
  echo "Loading $ENV_FILE"
  set -a
  . "$ENV_FILE"
  set +a
fi

export NODE_ENV=production
export PORT="${PORT:-3002}"
export HOST="${HOST:-127.0.0.1}"
export COOKIE_SECURE="${COOKIE_SECURE:-1}"
export CHORELENGER_DB="${CHORELENGER_DB:-data/chorelenger.db}"

echo "=== chorelenger prod ==="

if [ -z "${CHORELENGER_PASSWORD_HASH:-}" ]; then
  echo "ERROR CHORELENGER_PASSWORD_HASH is empty." >&2
  echo "Generate one with: npm run hash-password -- '<password>'" >&2
  exit 1
fi

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  echo "Installing deps (including dev, needed for the build)..."
  npm ci

  echo "Building frontend..."
  npm run build
  if [ ! -f web/dist/index.html ]; then
    echo "ERROR build did not produce web/dist/index.html" >&2
    exit 1
  fi

  echo "Pruning dev dependencies..."
  npm prune --omit=dev
else
  echo "SKIP_BUILD=1: skipping install, build and prune"
  if [ ! -f web/dist/index.html ]; then
    echo "ERROR web/dist/index.html missing; run without SKIP_BUILD=1" >&2
    exit 1
  fi
fi

mkdir -p data backup

# Back up the DB and its WAL/SHM files if present.
if [ -f "$CHORELENGER_DB" ]; then
  BACKUP="backup/chorelenger-$(date +%Y%m%d-%H%M).db"
  echo "Backing up $CHORELENGER_DB -> $BACKUP"
  cp "$CHORELENGER_DB" "$BACKUP"
  cp "$CHORELENGER_DB-wal" "$BACKUP-wal" 2>/dev/null || true
  cp "$CHORELENGER_DB-shm" "$BACKUP-shm" 2>/dev/null || true
fi

echo "Starting chorelenger on $HOST:$PORT DB=$CHORELENGER_DB NODE_ENV=$NODE_ENV"
echo "Tunnel should map chorelenger.bombos.online -> http://127.0.0.1:$PORT"

# Foreground (blocks). For background use one of:
#   tmux new -s chore './prod.sh'
#   nohup ./prod.sh > chorelenger.log 2>&1 &
exec node --experimental-sqlite server/index.js
