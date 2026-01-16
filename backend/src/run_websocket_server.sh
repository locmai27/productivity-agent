#!/usr/bin/env bash
set -euo pipefail

# This script starts the websocket chatbot server without putting secrets in your shell history.
# It prompts for BACKBOARD_API_KEY (hidden input) and optionally BACKBOARD_BASE_URL.

cd "$(dirname "$0")"

if [[ -z "${BACKBOARD_API_KEY:-}" ]]; then
  read -rsp "Enter BACKBOARD_API_KEY (input hidden): " BACKBOARD_API_KEY
  echo
  export BACKBOARD_API_KEY
fi

if [[ -z "${BACKBOARD_BASE_URL:-}" ]]; then
  read -rp "Enter BACKBOARD_BASE_URL (press Enter to use default https://app.backboard.io/api): " BACKBOARD_BASE_URL
  BACKBOARD_BASE_URL="${BACKBOARD_BASE_URL:-https://app.backboard.io/api}"
  export BACKBOARD_BASE_URL
fi

if [[ -z "${BACKBOARD_LLM_PROVIDER:-}" ]]; then
  read -rp "Enter BACKBOARD_LLM_PROVIDER (press Enter to use default aws-bedrock): " BACKBOARD_LLM_PROVIDER
  BACKBOARD_LLM_PROVIDER="${BACKBOARD_LLM_PROVIDER:-aws-bedrock}"
  if [[ -n "${BACKBOARD_LLM_PROVIDER}" ]]; then
    export BACKBOARD_LLM_PROVIDER
  else
    unset BACKBOARD_LLM_PROVIDER || true
  fi
fi

if [[ -z "${BACKBOARD_MODEL_NAME:-}" ]]; then
  read -rp "Enter BACKBOARD_MODEL_NAME (press Enter to use default anthropic.claude-haiku-4-5-20251001-v1:0): " BACKBOARD_MODEL_NAME
  BACKBOARD_MODEL_NAME="${BACKBOARD_MODEL_NAME:-anthropic.claude-haiku-4-5-20251001-v1:0}"
  if [[ -n "${BACKBOARD_MODEL_NAME}" ]]; then
    export BACKBOARD_MODEL_NAME
  else
    unset BACKBOARD_MODEL_NAME || true
  fi
fi

echo "Starting websocket server with BACKBOARD_BASE_URL=${BACKBOARD_BASE_URL}"
exec python3 websocket_server.py


