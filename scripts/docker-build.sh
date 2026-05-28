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
echo "Push this image:"
echo "  docker push ${IMAGE}"
echo ""

if [[ "$IMAGE_TAG" == "latest" ]]; then
  echo "Tag a release version (e.g. 1.0.1) from this build:"
  echo "  docker tag ${IMAGE} ${IMAGE_NAME}:1.0.1"
  echo "  docker push ${IMAGE_NAME}:1.0.1"
else
  echo "Also publish as latest:"
  echo "  docker tag ${IMAGE} ${IMAGE_NAME}:latest"
  echo "  docker push ${IMAGE_NAME}:latest"
fi

echo ""
echo "Build with a version tag directly:"
echo "  IMAGE=${IMAGE_NAME}:1.0.1 npm run docker:build"
