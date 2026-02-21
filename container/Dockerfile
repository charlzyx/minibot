# Minibot Container Image
# Used for isolated code execution in /code command

FROM node:18-alpine

# Install common tools
RUN apk add --no-cache \
    bash \
    curl \
    git \
    python3 \
    py3-pip \
    build-base \
    && rm -rf /var/cache/apk/*

# Create workspace directory
WORKDIR /workspace

# Set environment variables
ENV NODE_ENV=production \
    MINIBOT_CONTAINER=true

# Create non-root user for security
RUN addgroup -g 1001 -S minibot && \
    adduser -u 1001 -S minibot -G minibot

# Create directories
RUN mkdir -p /workspace/workspace && \
    chown -R minibot:minibot /workspace

# Switch to non-root user
USER minibot

# Default command
CMD ["node", "-e", "console.log('Minibot container ready')"]
