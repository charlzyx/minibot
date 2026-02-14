#!/bin/bash
set -e

echo "🔨 Building NanoClaw Docker image..."

# Get version from package.json
VERSION=$(node -p "require('./package.json').version")

# Build with cache
docker build \
  --tag nanoclaw-agent:${VERSION} \
  --tag nanoclaw-agent:latest \
  --file Dockerfile \
  --progress=plain \
  .

echo "✅ Build complete!"
echo "📦 Image: nanoclaw-agent:${VERSION}"
echo ""
echo "To run the container:"
echo "  docker run -it --rm \\\\\\n    -e ANTHROPIC_API_KEY=your_key_here \\\\\\n    nanoclaw-agent"
