#!/bin/bash
set -e

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "❌ Error: ANTHROPIC_API_KEY environment variable is not set"
    echo ""
    echo "Usage: ANTHROPIC_API_KEY=sk-ant-xxx ./run.sh"
    echo "Or export your API key first:"
    echo "  export ANTHROPIC_API_KEY=sk-ant-xxx"
    echo "  ./run.sh"
    exit 1
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    echo "Please install Docker first: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if image exists
if ! docker image inspect nanoclaw-agent:latest &> /dev/null; then
    echo "📦 Building Docker image..."
    ./build.sh
fi

echo "🚀 Starting NanoClaw container..."
echo ""

# Run container
docker run -it --rm \
    --name nanoclaw-agent \
    -e ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    -e ASSISTANT_NAME="${ASSISTANT_NAME:-NanoClaw}" \
    -v nanoclaw-data:/app/data \
    nanoclaw-agent:latest
