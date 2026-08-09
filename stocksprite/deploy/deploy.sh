#!/bin/bash

# Check if ZIP filename was passed
if [ -z "$1" ]; then
    echo "Usage: $0 <zip-file>"
    exit 1
fi

zip_file="$1"

# Ensure the zip file exists
if [ ! -f "$zip_file" ]; then
    echo "Error: ZIP file '$zip_file' does not exist."
    exit 1
fi

# Stop Docker containers only if docker-compose.prod.yaml exists
if [ -f "docker-compose.prod.yaml" ]; then
    echo "Stopping and removing Docker containers..."
    docker compose -f docker-compose.prod.yaml down
else
    echo "No docker-compose.prod.yaml found, skipping 'docker compose down'"
fi

echo "Cleaning up files..."
script_path="$(readlink -f "$0")"
zip_path="$(readlink -f "$zip_file")"

for item in *; do
    file_path="$(readlink -f "$item")"

    if [ "$file_path" = "$script_path" ] || [ "$file_path" = "$zip_path" ]; then
        echo "Skipping $item"
    else
        echo "Deleting $item"
        rm -rf "$item"
    fi
done

echo "Extracting $zip_file..."
unzip -o "$zip_file"

echo "Building Docker app service..."
docker compose -f docker-compose.prod.yaml build app

echo "Starting Docker containers..."
docker compose -f docker-compose.prod.yaml up -d
