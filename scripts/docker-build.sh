#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
IMAGE="${IMAGE:-elgwhoppo/ollamascope:latest}"
IMAGE_NAME="${IMAGE%:*}"
IMAGE_TAG="${IMAGE##*:}"
if [[ "$IMAGE_TAG" == "$IMAGE" ]]; then
  IMAGE_NAME="$IMAGE"
  IMAGE_TAG="latest"
fi

cd "$ROOT"
echo "Building ${IMAGE} ..."
docker build -t "$IMAGE" .

echo ""
echo "Build complete: ${IMAGE}"
echo ""
echo "Publish (tag version + latest, then push both):"
echo "  docker tag ${IMAGE} ${IMAGE_NAME}:1.0.1"
echo "  docker tag ${IMAGE} ${IMAGE_NAME}:latest"
echo "  docker push ${IMAGE_NAME}:1.0.1"
echo "  docker push ${IMAGE_NAME}:latest"
echo ""
echo "Push only the image you built (${IMAGE}):"
echo "  docker push ${IMAGE}"

echo ""
echo "Build with a version tag directly:"
echo "  IMAGE=${IMAGE_NAME}:1.0.1 npm run docker:build"
echo ""
echo "Run locally for dev testing:"
echo "  ./scripts/docker-dev.sh build"
echo "  ./scripts/docker-dev.sh run"
