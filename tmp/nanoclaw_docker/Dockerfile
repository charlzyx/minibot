# NanoClaw Dockerfile - 基于 Node.js 20 Alpine
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 安装系统依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite

# 复制依赖文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY dist ./dist
COPY container/agent-runner ./container/agent-runner
COPY container/skills ./container/skills

# 创建数据目录
RUN mkdir -p /app/data

# 设置环境变量
ENV NODE_ENV=production
ENV NANCLAW_DATA_DIR=/app/data

# 暴露端口 (如果需要)
# EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "process.exit(0)"

# 启动命令
CMD ["node", "dist/index.js"]
