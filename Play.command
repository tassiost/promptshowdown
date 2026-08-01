#!/bin/bash
# Prompt Showdown — double-click to start local server + open browser
cd "$(dirname "$0")"

PORT=8000
URL="http://localhost:$PORT"

# Kill anything already using the port (silently)
lsof -ti tcp:$PORT 2>/dev/null | xargs kill -9 2>/dev/null

echo "============================================"
echo "  Prompt Showdown — Local Test Server"
echo "============================================"
echo ""
echo "Starting server on port $PORT..."
echo "Game will open in your browser shortly."
echo ""
echo "Press Ctrl+C to stop the server."
echo ""

# Open browser after a short delay (in background)
( sleep 1 && open "$URL" ) &

# Start the server (Python's built-in HTTP server)
python3 -m http.server $PORT
