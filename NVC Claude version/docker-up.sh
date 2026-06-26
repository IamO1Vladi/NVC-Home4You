#!/usr/bin/env bash
set -euo pipefail
if docker compose version >/dev/null 2>&1; then
  echo "Using: docker compose"
  docker compose -f compose.yaml up --build
else
  echo "Using: docker-compose"
  docker-compose -f compose.yaml up --build
fi
