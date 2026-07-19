#!/usr/bin/env bash
# Starts the backend API and the frontend dev server together, and stops both
# when you Ctrl+C this script. The frontend automatically opens in your
# default browser once Vite finishes starting (see frontend/vite.config.js).

set -e
cd "$(dirname "$0")"

cleanup() {
  echo ""
  echo "Stopping servers..."
  kill "$BACKEND_PID" "$FRONTEND_PID" 2>/dev/null
}
trap cleanup EXIT INT TERM

echo "Starting backend..."
(cd backend && npm run dev) &
BACKEND_PID=$!

echo "Starting frontend..."
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "Both servers are running. The app will open in your browser automatically."
echo "Press Ctrl+C to stop both."

wait
