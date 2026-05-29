#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONTAINER_NAME="${CONTAINER_NAME:-ollamascope-dev}"
IMAGE="${IMAGE:-elgwhoppo/ollamascope:latest}"
APP_PORT="${APP_PORT:-3000}"
PROXY_PORT="${PROXY_PORT:-11435}"
OLLAMA_BASE_URL="${OLLAMA_BASE_URL:-http://host.docker.internal:11434}"

usage() {
  cat <<EOF
Local Docker dev helper (not for production orchestration).

Usage:
  ./scripts/docker-dev.sh [command]

Commands:
  run     Start container from IMAGE (default)
  build   Build IMAGE from Dockerfile, then run
  stop    Stop and remove the dev container
  logs    Follow container logs

Environment (optional .env in repo root):
  IMAGE, APP_PORT, PROXY_PORT, OLLAMA_BASE_URL, CONTAINER_NAME

Examples:
  ./scripts/docker-dev.sh build
  IMAGE=elgwhoppo/ollamascope:1.0.1 ./scripts/docker-dev.sh run
  ./scripts/docker-dev.sh stop
EOF
}

load_env() {
  if [[ -f "$ROOT/.env" ]]; then
    set -a
    # shellcheck source=/dev/null
    source "$ROOT/.env"
    set +a
  fi
}

stop_container() {
  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
}

run_container() {
  mkdir -p "$ROOT/data"
  stop_container

  docker run -d \
    --name "$CONTAINER_NAME" \
    -p "${APP_PORT}:3000" \
    -p "${PROXY_PORT}:11435" \
    -e "NODE_OPTIONS=--max-old-space-size=256" \
    -e "APP_PORT=3000" \
    -e "PROXY_PORT=11435" \
    -e "APP_HOST=0.0.0.0" \
    -e "OLLAMA_BASE_URL=${OLLAMA_BASE_URL}" \
    -e "DATA_DIR=/data" \
    -e "DATABASE_PATH=/data/ollamascope.sqlite" \
    -v "${ROOT}/data:/data" \
    --add-host=host.docker.internal:host-gateway \
    "$IMAGE" >/dev/null

  echo "OllamaScope dev container started: ${CONTAINER_NAME}"
  echo "  Image:     ${IMAGE}"
  echo "  Dashboard: http://localhost:${APP_PORT}"
  echo "  Proxy:     http://localhost:${PROXY_PORT}"
  echo "  Ollama:    ${OLLAMA_BASE_URL}"
  echo "  Data:      ${ROOT}/data"
  echo ""
  echo "  ./scripts/docker-dev.sh logs"
  echo "  ./scripts/docker-dev.sh stop"
}

cmd="${1:-run}"
load_env

case "$cmd" in
  run)
    run_container
    ;;
  build)
    bash "$ROOT/scripts/docker-build.sh"
    run_container
    ;;
  stop)
    stop_container
    echo "Stopped ${CONTAINER_NAME}"
    ;;
  logs)
    docker logs -f "$CONTAINER_NAME"
    ;;
  -h | --help | help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage >&2
    exit 1
    ;;
esac
