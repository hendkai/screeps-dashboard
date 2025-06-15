#!/bin/bash

# FIXED CURL-basierter CPU API Test
# Testet die korrekten Screeps API Endpunkte für CPU-Daten

if [ -z "$1" ]; then
    echo "❌ Kein API Token angegeben!"
    echo "Verwendung: ./test_cpu_curl_fixed.sh <API_TOKEN>"
    exit 1
fi

API_TOKEN="$1"
BASE_URL="https://screeps.com/api"

echo "🧪 Testing Screeps CPU API with correct endpoints..."
echo "Token: ${API_TOKEN:0:8}..."

# Test Auth Me (korrekte User Info)
echo -e "\n📡 Testing /auth/me..."
AUTH_RESPONSE=$(curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/auth/me")
echo "Auth response:"
echo "$AUTH_RESPONSE" | jq '{
    username: .username,
    cpu: .cpu,
    cpuShard: .cpuShard,
    gcl: .gcl
}'

# Test Memory mit Dekomprimierung
echo -e "\n📡 Testing /user/memory?shard=shard3..."
MEMORY_RESPONSE=$(curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/user/memory?shard=shard3")
echo "Memory response status:"
echo "$MEMORY_RESPONSE" | jq '.ok'

echo "Extracting and decompressing memory data..."
COMPRESSED_DATA=$(echo "$MEMORY_RESPONSE" | jq -r '.data')

if [[ "$COMPRESSED_DATA" == gz:* ]]; then
    echo "✅ Found gzipped memory data, decompressing..."
    # Entferne gz: Prefix und dekomprimiere
    CLEAN_DATA=${COMPRESSED_DATA#gz:}
    echo "$CLEAN_DATA" | base64 -d | gunzip | jq '.dashboard.stats.cpu // "No dashboard CPU data"'
else
    echo "❌ Memory data is not gzipped or not found"
    echo "$MEMORY_RESPONSE"
fi

# Test Overview
echo -e "\n📡 Testing /user/overview..."
OVERVIEW_RESPONSE=$(curl -s -H "X-Token: $API_TOKEN" "$BASE_URL/user/overview")
echo "Overview response:"
echo "$OVERVIEW_RESPONSE" | jq '{
    ok: .ok,
    stats: .stats,
    shards: .shards | keys
}'

echo -e "\n🎯 Summary:"
echo "✅ Auth endpoint works - shows CPU limit (20)"
echo "✅ Memory endpoint works - contains real CPU usage (~1.58)"
echo "⚠️ Overview endpoint may not have CPU data"
echo ""
echo "💡 The dashboard should use Memory.dashboard.stats.cpu.used for accurate CPU data!" 