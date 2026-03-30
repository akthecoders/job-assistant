#!/bin/bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

echo "================================"
echo "  AI Job Assistant"
echo "================================"

# Check Python
if ! command -v python3 &>/dev/null; then
  echo "ERROR: python3 is required"
  exit 1
fi

# Install backend deps if needed
if [ ! -d "$BACKEND/.venv" ]; then
  echo "Setting up Python virtual environment..."
  python3 -m venv "$BACKEND/.venv"
  source "$BACKEND/.venv/bin/activate"
  pip install -q -r "$BACKEND/requirements.txt"
  echo "Backend deps installed."
else
  source "$BACKEND/.venv/bin/activate"
fi

# Build frontend if dist doesn't exist or is stale
if [ ! -d "$FRONTEND/dist" ]; then
  echo "Building frontend..."
  if ! command -v npm &>/dev/null; then
    echo "WARNING: npm not found — skipping frontend build. Dashboard won't be served."
  else
    cd "$FRONTEND" && npm install -q && npm run build && cd "$ROOT"
    echo "Frontend built."
  fi
fi

echo ""
echo "Starting server at http://localhost:8000"
echo "Dashboard:  http://localhost:8000"
echo "API docs:   http://localhost:8000/docs"
echo ""
echo "Chrome extension: Load /extension/dist as unpacked extension"
echo ""
echo "Press Ctrl+C to stop"
echo "================================"

cd "$BACKEND"
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
