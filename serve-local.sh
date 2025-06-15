#!/bin/bash

echo "Starting local Screeps Dashboard server..."
echo "Dashboard wird verfügbar sein unter: http://localhost:8000"
echo "Drücke Ctrl+C zum Beenden"
echo ""

# Check if Python 3 is available
if command -v python3 &> /dev/null; then
    python3 -m http.server 8000
elif command -v python &> /dev/null; then
    python -m http.server 8000
else
    echo "Fehler: Python ist nicht installiert"
    exit 1
fi 