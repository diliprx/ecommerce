#!/bin/bash
# Run FastAPI dev server with auto-reload
# Usage: cd ecommerce && ./backend/run_dev.sh

set -e

cd "$(dirname "$0")"  # cd backend/
echo "🚀 Starting FastAPI dev server in $(pwd)..."

# Activate venv if exists, else warn
if [ -d "venv" ]; then
  echo "✅ Activating venv..."
  # Windows cmd (detected from traceback)
  call venv\\Scripts\\activate
else
  echo "⚠️  venv not found. Run: python -m venv venv && venv\\Scripts\\activate && pip install -r requirements.txt"
  exit 1
fi

# Install deps if needed
if ! python -c "import fastapi" 2>/dev/null; then
  echo "📦 Installing requirements..."
  pip install -r requirements.txt
fi

# Start uvicorn (expects app.main:app from backend/ cwd)
echo "🌐 Server starting on http://localhost:8000 (docs: http://localhost:8000/api/docs)"
echo "📱 Frontend on http://localhost:3000"
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# On Ctrl+C
echo ""
echo "🛑 Server stopped. Run 'docker compose up' for full stack."

