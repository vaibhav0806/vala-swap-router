#!/bin/bash

BASE_URL="http://localhost:3000/api/v1"
USER_PUBKEY="8WzZd5zKYQK6qZvJVqxFjfK8nkGLCwhfYHSfQ1GqQxcZ"

for i in $(seq 1 1000); do
  echo "----- Request $i -----"

  # Step 1: Get quote
  QUOTE_RESPONSE=$(curl -s --location "$BASE_URL/quote?inputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&outputMint=So11111111111111111111111111111111111111112&amount=100000000&slippageBps=50" \
    --header 'accept: application/json')

  # Extract quoteId using jq
  QUOTE_ID=$(echo "$QUOTE_RESPONSE" | jq -r '.quoteId')

  if [[ -z "$QUOTE_ID" || "$QUOTE_ID" == "null" ]]; then
    echo "❌ Failed to get quoteId on iteration $i"
    sleep 1
    continue
  fi

  echo "Got quoteId: $QUOTE_ID"

  sleep 1

  # Step 2: Execute swap
  EXECUTE_RESPONSE=$(curl -s --location "$BASE_URL/swap/execute" \
    --header 'accept: application/json' \
    --header 'Content-Type: application/json' \
    --data "{
      \"quoteId\": \"$QUOTE_ID\",
      \"userPublicKey\": \"$USER_PUBKEY\"
    }")

  echo "Execute response: $EXECUTE_RESPONSE"
  echo ""

  # Wait 1 second before next iteration
  sleep 1
done
