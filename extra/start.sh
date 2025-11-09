#!/bin/sh

# Start the services
pm2 start server.js --cwd /app/web --name learnhouse-web > /dev/null 2>&1
pm2 start uv --cwd /app/api --name learnhouse-api -- run app.py 2>&1

# Check if the services are running and log the status
pm2 status

# --- NEW: Add a small delay before checking port ---
echo "Giving learnhouse-api a moment to bind..."
sleep 5 # Add a 5-second delay
# --- END NEW ---

# --- Wait for learnhouse-api health endpoint to be ready ---
echo "Waiting for learnhouse-api health endpoint to be ready..."
until curl -v --fail http://localhost:9000/api/v1/health; do
  echo -n "."
  sleep 1
done
echo "learnhouse-api is ready!"

# Start Nginx in the background
nginx -g 'daemon off;' &

# Tail Nginx error and access logs
pm2 logs