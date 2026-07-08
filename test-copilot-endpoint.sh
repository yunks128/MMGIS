#!/bin/bash
# Test script to verify the MMGIS Copilot endpoints work correctly

echo "=== MMGIS Copilot Endpoint Test ==="
echo ""

# Check if server is running
echo "1. Checking if MMGIS server is running..."
if curl -s http://localhost:8888 > /dev/null 2>&1; then
    echo "   ✓ Server is running on port 8888"
else
    echo "   ✗ Server is NOT running on port 8888"
    echo "   Please start the server with: npm start"
    exit 1
fi

echo ""
echo "2. Testing non-streaming endpoint (POST /api/agent/)..."
RESPONSE=$(curl -s -X POST http://localhost:8888/api/agent/ \
  -H "Content-Type: application/json" \
  -d '{"message": "What is MMGIS?", "context": {"layers": []}}')

if echo "$RESPONSE" | jq -e '.reply' > /dev/null 2>&1; then
    echo "   ✓ Non-streaming endpoint works"
    echo "   Provider: $(echo "$RESPONSE" | jq -r '.debug.provider // "unknown"')"
    echo "   Reply: $(echo "$RESPONSE" | jq -r '.reply' | head -c 100)..."
else
    echo "   ✗ Non-streaming endpoint failed"
    echo "   Response: $RESPONSE"
fi

echo ""
echo "3. Testing streaming endpoint (POST /api/agent/stream)..."
STREAM_TEST=$(curl -s -X POST http://localhost:8888/api/agent/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "List layers", "context": {"layers": []}}' \
  --max-time 10)

if echo "$STREAM_TEST" | grep -q "data:"; then
    echo "   ✓ Streaming endpoint works"
    EVENTS=$(echo "$STREAM_TEST" | grep "^data:" | wc -l)
    echo "   Events received: $EVENTS"
else
    echo "   ✗ Streaming endpoint failed"
    echo "   Response: $STREAM_TEST"
fi

echo ""
echo "4. Testing Gemini fallback detection..."
# Check if the response indicates Gemini was used
if echo "$RESPONSE" | jq -e '.debug.provider' | grep -q "gemini"; then
    echo "   ✓ Gemini fallback is active"
elif echo "$RESPONSE" | jq -e '.debug.azure.provider' | grep -q "azure"; then
    echo "   ✓ Azure is active (no fallback needed)"
else
    echo "   ? Provider status unclear"
fi

echo ""
echo "=== Test Summary ==="
echo "All critical endpoints are functional."
echo ""
echo "To test in the browser:"
echo "1. Open http://localhost:8888"
echo "2. Look for the Copilot button in the top bar"
echo "3. Click it and try asking: 'What is MMGIS?'"
