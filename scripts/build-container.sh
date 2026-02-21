#!/bin/bash
# Build script for Minibot container image
# Used for isolated code execution in /code command

set -e

IMAGE_NAME="${IMAGE_NAME:-minibot-code}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
FULL_IMAGE="${IMAGE_NAME}:${IMAGE_TAG}"

echo "🐳 Building Minibot container image..."
echo "   Image: ${FULL_IMAGE}"

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Build the container image
docker build -t "${FULL_IMAGE}" -f "${REPO_ROOT}/container/Dockerfile" "${REPO_ROOT}"

echo "✅ Container image built successfully!"
echo ""
echo "To test the image:"
echo "  docker run --rm ${FULL_IMAGE}"
echo ""
echo "To use in minibot:"
echo "  export MINIBOT_CONTAINER_IMAGE=${FULL_IMAGE}"
