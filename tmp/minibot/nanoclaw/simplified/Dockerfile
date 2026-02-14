FROM node:22-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/
COPY tsconfig.json ./

# Install TypeScript and build
RUN npm install -g typescript && npm run build

# Create non-root user
RUN useradd -m -u 1000 nanoclaw && \
    chown -R nanoclaw:nanoclaw /app

# Switch to non-root user
USER nanoclaw

# Set environment variables
ENV NODE_ENV=production

# Expose default port (optional, for future web interface)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)" || exit 1

# Run the application
CMD ["node", "dist/index.js"]
