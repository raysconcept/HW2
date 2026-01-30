#!/bin/sh
set -e

for dir in /app/logs /app/public/qr /app/public/qrOperator /app/public/video /app/calibration-data /app/src/temp/video_uploads; do
  mkdir -p "$dir"
  chown -R node:node "$dir"
done

DB_HOST="${HW_DB_HOST:-mysql}"
DB_PORT="${HW_DB_PORT:-3306}"

if [ -n "$DB_HOST" ]; then
  echo "Waiting for database at ${DB_HOST}:${DB_PORT}..."
  until nc -z "$DB_HOST" "$DB_PORT"; do
    sleep 2
  done
fi

exec su node -c "node src/server/HW_SERVER.js"
