#!/bin/bash

API="http://localhost:3000/api/v1"
SOL="So11111111111111111111111111111111111111112"
USDC="EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
USER="8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ"

echo "🔧 Testing OKX Fix"

# Get quote
QUOTE=$(curl -s "$API/quote?inputMint=$SOL&outputMint=$USDC&amount=1000000000&slippageBps=50")
QUOTE_ID=$(echo $QUOTE | jq -r '.quoteId')
PROVIDER=$(echo $QUOTE | jq -r '.bestRoute.provider')

echo "Quote ID: $QUOTE_ID"
echo "Provider: $PROVIDER"

# Show full quote structure for debugging
echo ""
echo "Full quote response:"
echo $QUOTE | jq '{
  quoteId: .quoteId,
  bestRoute: {
    provider: .bestRoute.provider,
    inputMint: .bestRoute.inputMint,
    outputMint: .bestRoute.outputMint,
    inAmount: .bestRoute.inAmount,
    outAmount: .bestRoute.outAmount,
    slippageBps: .bestRoute.slippageBps
  }
}'

# Try swap execution
echo ""
echo "Attempting swap execution..."
SWAP_RESULT=$(curl -s -X POST "$API/swap/execute" \
  -H "Content-Type: application/json" \
  -d "{\"quoteId\":\"$QUOTE_ID\",\"userPublicKey\":\"$USER\"}")

echo ""
echo "Swap result:"
echo $SWAP_RESULT | jq '.'

# Check if it failed
ERROR_CODE=$(echo $SWAP_RESULT | jq -r '.errorCode // "none"')
if [ "$ERROR_CODE" != "none" ]; then
    echo ""
    echo "❌ Error detected: $ERROR_CODE"
    echo "Details:"
    echo $SWAP_RESULT | jq '.details // {}'
fi
