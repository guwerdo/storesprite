#!/bin/sh

cd /app || exit 1
echo "$(date '+%Y-%m-%d %H:%M') - running 'npm run cache:rel' " >> /app/cron.log 2>&1
/usr/local/bin/npm run cache:rel
