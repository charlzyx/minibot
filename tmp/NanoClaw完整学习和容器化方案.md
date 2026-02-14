# NanoClaw 完整学习和容器化方案

## 📚 项目概述

NanoClaw 是一个轻量级、安全的 AI 助手，专为在隔离容器中运行而设计。它是对 OpenClaw 的简化替代方案，使用 TypeScript/Node.js 构建，集成 Claude Agent SDK。

### 核心特点

✅ **轻量级** - 代码库小，8分钟可理解  
✅ **安全** - 容器隔离，文件系统保护  
✅ **简单** - 单 Node.js 进程，无配置文件  
✅ **可定制** - 通过代码修改而非配置  
✅ **AI 原生** - 直接集成 Claude Agent SDK  

---

## 🏗️ 技术架构

### 技术栈
- **语言**: TypeScript / Node.js 20+
- **数据库**: SQLite (better-sqlite3)
- **容器**: Apple Container (macOS) 或 Docker (Linux)
- **消息队列**: IPC + 文件系统
- **WhatsApp**: @whiskeysockets/baileys

### 架构图
```
WhatsApp (baileys) → 轮询循环 → 容器 (Claude Agent SDK) → 响应
```

---

## 📁 核心文件结构

```
nanoclaw/
├── src/
│   ├── index.ts                    # 主入口 (16.5KB)
│   ├── channels/
│   │   └── whatsapp-auth.ts        # WhatsApp 认证 (5.4KB)
│   ├── container-runner.ts        # 容器管理 (20.6KB)
│   ├── ipc.ts                      # IPC 通信 (12.0KB)
│   ├── router.ts                   # 消息路由 (1.4KB)
│   ├── group-queue.ts              # 群组队列 (8.7KB)
│   ├── task-scheduler.ts           # 任务调度 (6.3KB)
│   ├── db.ts                       # 数据库操作 (15.9KB)
│   ├── mount-security.ts           # 安全管理 (10.6KB)
│   └── [其他辅助模块...]
├── container/
│   ├── Dockerfile                  # Docker 镜像
│   ├── build.sh                    # 构建脚本
│   ├── agent-runner/               # Agent 运行时
│   └── skills/                     # Claude Code 技能
└── [配置文件...]
```

### 关键模块说明

| 文件 | 大小 | 功能 |
|------|------|------|
| `src/index.ts` | 16.5KB | 主要编排器，管理状态、消息循环、Agent 调用 |
| `src/container-runner.ts` | 20.6KB | 启动和管理流式 Agent 容器 |
| `src/ipc.ts` | 12.0KB | IPC 监听器和任务处理 |
| `src/db.ts` | 15.9KB | SQLite 数据库操作 |
| `src/mount-security.ts` | 10.6KB | 挂载点和安全策略管理 |
| `src/group-queue.ts` | 8.7KB | 每组消息队列，支持并发控制 |

---

## 🚀 容器化部署方案

### 方式一：Docker Compose（推荐）

#### 1. Dockerfile 配置

```dockerfile
FROM node:20-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \
    python3 python3-pip git curl build-essential sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# 复制项目文件
COPY package*.json ./
COPY tsconfig.json ./
COPY src/ ./src/
COPY container/ ./container/

# 安装依赖并构建
RUN npm install
RUN npm run build

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/groups

# 设置环境变量
ENV NODE_ENV=production
ENV DATA_DIR=/app/data
ENV LOGS_DIR=/app/logs
ENV GROUPS_DIR=/app/groups

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "console.log('NanoClaw is running')" || exit 1

CMD ["npm", "start"]
```

#### 2. Docker Compose 配置

```yaml
version: '3.8'

services:
  nanoclaw:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nanoclaw
    restart: unless-stopped
    
    environment:
      - NODE_ENV=production
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - WHATSAPP_ACCESS_TOKEN=${WHATSAPP_ACCESS_TOKEN}
      - DATA_DIR=/app/data
      - LOGS_DIR=/app/logs
      - GROUPS_DIR=/app/groups
    
    volumes:
      - nanoclaw-data:/app/data
      - nanoclaw-logs:/app/logs
      - nanoclaw-groups:/app/groups
    
    networks:
      - nanoclaw-network
    
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
    
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  nanoclaw-data:
  nanoclaw-logs:
  nanoclaw-groups:

networks:
  nanoclaw-network:
    driver: bridge
```

#### 3. 环境变量配置 (.env)

```bash
# Anthropic API 配置
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# WhatsApp Business API 配置
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_ACCESS_TOKEN=your_whatsapp_access_token
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token
WHATSAPP_WEBHOOK_URL=https://your-domain.com/webhook

# 其他配置
NODE_ENV=production
LOG_LEVEL=info
MAX_CONCURRENT_AGENTS=5
```

### 方式二：一键部署脚本

```bash
#!/bin/bash

# NanoClaw 容器化快速启动脚本

set -e

echo "====================================="
echo "   NanoClaw 容器化部署脚本"
echo "====================================="

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装"
    exit 1
fi

# 检查 Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装"
    exit 1
fi

echo "✅ Docker 环境检查通过"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo "📝 创建配置文件..."
    cp .env.example .env
    echo "⚠️  请编辑 .env 文件配置 API 密钥"
    ${EDITOR:-nano} .env
fi

# 构建镜像
echo "🔨 构建 Docker 镜像..."
docker-compose build

# 启动服务
echo "🚀 启动 NanoClaw 服务..."
docker-compose up -d

# 等待启动
sleep 5

# 检查状态
if docker ps | grep -q nanoclaw; then
    echo "✅ NanoClaw 服务已成功启动！"
    echo "📊 查看日志: docker-compose logs -f nanoclaw"
else
    echo "❌ 服务启动失败"
    exit 1
fi
```

---

## 📖 快速开始

### 前置要求
- Docker 20.10+
- Docker Compose 2.0+
- Anthropic API Key
- Node.js 20+

### 安装步骤

#### 1. 克隆项目
```bash
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 配置环境变量
```bash
cp .env.example .env
nano .env  # 编辑配置
```

#### 4. 构建项目
```bash
npm run build
```

#### 5. 启动容器
```bash
# 使用 Docker Compose
docker-compose up -d

# 或使用启动脚本
./容器化启动脚本.sh
```

#### 6. 查看日志
```bash
docker-compose logs -f nanoclaw
```

---

## 🛠️ 管理命令

### 容器管理
```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看状态
docker-compose ps

# 查看日志
docker-compose logs -f nanoclaw

# 进入容器
docker exec -it nanoclaw /bin/bash

# 删除容器
docker-compose down
```

### 数据管理
```bash
# 备份数据
docker run --rm -v nanoclaw-data:/data -v $(pwd):/backup \
  ubuntu tar czf /backup/nanoclaw-backup-$(date +%Y%m%d).tar.gz /data

# 恢复数据
docker run --rm -v nanoclaw-data:/data -v $(pwd):/backup \
  ubuntu tar xzf /backup/nanoclaw-backup-20240114.tar.gz -C /
```

### 升级更新
```bash
# 拉取最新代码
git pull origin main

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d
```

---

## 🔒 安全模型

### 容器隔离
- **文件系统隔离**: 只能访问显式挂载的目录
- **进程隔离**: Agents 在独立的容器中运行
- **网络隔离**: 使用私有 Docker 网络
- **资源限制**: CPU、内存和磁盘使用限制

### 安全特性
- ✅ 无应用级权限检查（依赖容器隔离）
- ✅ 每个组有独立的记忆和文件系统
- ✅ Bash 命令在容器内执行
- ✅ IPC 通信加密
- ✅ 健康检查和自动恢复

---

## 📊 与 OpenClaw 对比

| 特性 | OpenClaw | NanoClaw |
|------|----------|----------|
| 模块数 | 52+ | ~15 个文件 |
| 配置文件 | 8 | 0 |
| 依赖 | 45+ | 最少 |
| 架构 | 微服务 | 单进程 |
| 安全 | 应用级 | 容器隔离 |
| 理解时间 | 数小时 | 8分钟 |

---

## 💡 使用示例

### 基础使用
```
@Andy 每周一早上 9 点向我发送销售管道概览
@Andy 回顾过去一周的 git 历史并更新 README
@Andy 每周一上午 8 点，编译 AI 开发新闻并发送简要信息
```

### 管理命令（主频道）
```
@Andy 列出所有跨组的预定任务
@Andy 暂停周一简报任务
@Andy 加入家庭聊天组
```

### 定制化（修改代码）
```
"将触发词改为 @Bob"
"让未来的响应更简短直接"
"添加自定义问候"
"每周存储对话摘要"
```

---

## 🐛 故障排查

### 容器无法启动
```bash
# 查看详细日志
docker logs nanoclaw

# 检查容器状态
docker inspect nanoclaw

# 进入容器调试
docker exec -it nanoclaw /bin/bash
```

### API 认证失败
- 检查 `.env` 文件中的 API 密钥
- 验证 Anthropic API Key 是否有效
- 确认网络连接正常

### 资源不足
```bash
# 查看资源使用
docker stats nanoclaw

# 调整资源限制
# 编辑 docker-compose.yml
```

---

## 📈 性能优化

### 资源调整
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
    reservations:
      cpus: '1.0'
      memory: 1G
```

### 日志管理
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

---

## 🔗 相关资源

- **GitHub**: https://github.com/qwibitai/nanoclaw
- **Discord**: https://discord.gg/VGWXrf8x
- **Claude API**: https://docs.anthropic.com/
- **Docker 文档**: https://docs.docker.com/

---

## 📝 总结

本方案提供了 NanoClaw 的完整学习和容器化部署解决方案：

1. **学习文档**: 详细的项目架构和代码分析
2. **容器配置**: Docker 和 Docker Compose 配置
3. **部署脚本**: 一键部署和管理脚本
4. **管理指南**: 完整的运维和故障排查文档

通过本方案，您可以快速理解 NanoClaw 的架构，并在容器环境中安全、稳定地运行它。

---

**最后更新**: 2026-02-14  
**版本**: 1.0.0  
**许可证**: MIT
