#!/bin/sh
set -euo pipefail

# --- Configuration ---
HOST="sftp.cromwell.co.uk"
USER="agrogarden"
KEY="/secrets/cromwell-sftp-private-id_rsa"
REMOTE_DIR="/"
LOCAL_DIR="/csv-provider-data"
LOCAL_FILE="cromwell-raw.csv"

# --- Ensure local dir exists ---
mkdir -p "$LOCAL_DIR"

# --- Get file list from SFTP ---
echo "Connecting to $HOST to get file list..."
RAW_LIST=$(sftp -i "$KEY" -o StrictHostKeyChecking=no "$USER@$HOST" <<EOF 2>/dev/null
ls -1 $REMOTE_DIR
bye
EOF
)

# Filter out prompts (avoid pipefail killing script if empty)
FILE_LIST=$(echo "$RAW_LIST" | grep -v "sftp>" | grep -v "bye" || true)

# --- Check if empty ---
if [ -z "$FILE_LIST" ]; then
  echo "ERROR: No files found in $REMOTE_DIR on $HOST" >&2
  exit 1
fi

# --- Pick the latest file ---
LATEST_FILE=$(echo "$FILE_LIST" | sort | tail -n 1)
echo "Latest file is: $LATEST_FILE"

# --- Download the latest file ---
sftp -i "$KEY" -o StrictHostKeyChecking=no "$USER@$HOST" <<EOF
get $REMOTE_DIR/$LATEST_FILE $LOCAL_DIR/$LOCAL_FILE
bye
EOF

echo "Downloaded $LATEST_FILE to $LOCAL_DIR/$LOCAL_FILE"
echo "$(date): cromwell csv conversion completed"
