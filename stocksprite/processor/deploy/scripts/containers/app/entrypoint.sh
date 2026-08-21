#!/bin/sh

echo "Starting crond..."
crond
npm run translate:rel &
npm run send:rel
