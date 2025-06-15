#!/bin/bash

# CURL-basierter CPU API Test
# Testet Screeps API Endpunkte für CPU-Daten

if [ -z "$1" ]; then
    echo "❌ Kein API Token angegeben!"
    echo "Verwendung: ./test_cpu_curl.sh <API_TOKEN>"
    exit 1
fi

API_TOKEN="$1"
BASE_URL="https://screeps.com/api"

echo "🧪 Testing Screeps CPU API with curl..."
echo "Token: ${API_TOKEN:0:8}..."

# Test User Info
echo -e "\n📡 Testing /user/me..."
curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/user/me" | jq '{
    cpu: .cpu,
    cpuLimit: .cpuLimit,
    cpuShard: .cpuShard,
    cpuAvailable: .cpuAvailable,
    cpuUsed: .cpuUsed
}'

# Test Memory
echo -e "\n📡 Testing /user/memory..."
MEMORY_RESPONSE=$(curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/user/memory")
echo "Memory dashboard CPU data:"
echo "$MEMORY_RESPONSE" | jq '.data.dashboard.stats.cpu // "No dashboard CPU data found"'

# Test Overview
echo -e "\n📡 Testing /user/overview..."
curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/user/overview" | jq '{
    stats: .stats,
    cpu_in_stats: .stats.cpu
}'

# Test Game Time
echo -e "\n📡 Testing /game/time..."
curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/game/time" | jq '.time'

echo -e "\n🎯 Summary:"
echo "Expected CPU values should be between 2-4."
echo "Check which endpoint shows realistic CPU usage values." 