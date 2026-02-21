#!/bin/bash
# Build Claude Code container for Minibot

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building Claude Code container for Minibot..."

# Build the Claude Code container
echo "Building minibot-claude-code image..."
docker build \
  -f "$PROJECT_DIR/container/Dockerfile.claude" \
  -t minibot-claude-code:latest \
  "$PROJECT_DIR/container"

echo "✅ Claude Code container built successfully!"
echo ""
echo "To run the container:"
echo "  docker run --rm -v /path/to/project:/project minibot-claude-code:latest"
echo ""
echo "To test with Minibot:"
echo "  minibot code 'your task here'"
