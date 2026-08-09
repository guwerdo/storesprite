#!/bin/sh

cd /app || exit 1
echo "$(date '+%Y-%m-%d %H:%M') - running 'npm run pub:rel' " >> /app/cron.log 2>&1
/usr/local/bin/npm run pub:rel
