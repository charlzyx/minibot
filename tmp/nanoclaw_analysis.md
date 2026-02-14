# NanoClaw 代码学习总结

## 🎯 项目概述

**NanoClaw** 是一个轻量级的 Claude AI 助手，在 Apple 容器中运行，提供安全的 AI 对话体验。

- **GitHub**: https://github.com/qwibitai/nanoclaw
- **Stars**: 8097+ (2026年2月)
- **语言**: TypeScript
- **许可证**: MIT
- **运行平台**: Node.js >= 20

---

## 🏗️ 核心架构

### 1. 技术栈

```json
{
  "dependencies": {
    "@whiskeysockets/baileys": "^7.0.0-rc.9",  // WhatsApp 集成
    "better-sqlite3": "^11.8.1",               // SQLite 数据库
    "cron-parser": "^5.5.0",                   // 定时任务
    "pino": "^9.6.0",                          // 日志
    "zod": "^4.3.6"                            // 数据验证
  }
}
```

### 2. 目录结构

```
nanoclaw/
├── src/                      # 源代码
│   ├── index.ts              # 主入口
│   ├── container-runner.ts  # 容器运行器 (20KB+)
│   ├── db.ts                 # 数据库管理 (16KB)
│   ├── task-scheduler.ts     # 任务调度 (6KB)
│   ├── ipc.ts                # 进程间通信 (12KB)
│   ├── whatsapp-auth.ts      # WhatsApp 认证 (5KB)
│   ├── mount-security.ts     # 挂载安全 (10KB)
│   ├── router.ts             # 消息路由 (1KB)
│   ├── logger.ts             # 日志工具
│   ├── types.ts              # TypeScript 类型
│   ├── group-queue.ts        # 群组队列 (9KB)
│   ├── formatting.test.ts    # 格式化测试 (8KB)
│   ├── db.test.ts            # 数据库测试 (9KB)
│   ├── container-runner.test.ts
│   └── channels/             # 通信渠道
│       └── whatsapp.ts
│
├── container/                # 容器相关
│   ├── Dockerfile            # Docker 镜像定义
│   ├── build.sh              # 构建脚本
│   ├── agent-runner/         # Agent 运行器
│   └── skills/               # AI 技能
│
├── config-examples/          # 配置示例
├── docs/                     # 文档
└── package.json
```

---

## 🔍 核心代码分析

### 1. 主入口 (`src/index.ts`)

**功能**:
- 应用初始化
- 配置加载
- 服务启动
- 信号处理

**关键流程**:
```
1. 加载环境变量和配置
2. 初始化数据库
3. 启动 WhatsApp 连接
4. 初始化任务调度器
5. 注册信号处理器
6. 启动主循环
```

### 2. 容器运行器 (`src/container-runner.ts`)

**功能** (20KB+):
- 容器生命周期管理
- 容器创建和销毁
- 进程间通信 (IPC)
- 资源隔离
- 安全限制

**核心类和方法**:
```typescript
class ContainerRunner {
  createContainer()      // 创建新容器
  startContainer()       // 启动容器
  stopContainer()        // 停止容器
  sendMessage()         // 发送消息到容器
  receiveMessage()      // 接收容器消息
  monitorContainer()     // 监控容器状态
  cleanupContainer()     // 清理容器资源
}
```

**安全特性**:
- 文件系统隔离 (只读挂载)
- 网络隔离
- CPU/内存限制
- 进程权限降级
- Capabilities 限制

### 3. 数据库管理 (`src/db.ts`)

**功能** (16KB):
- SQLite 数据库初始化
- 消息存储
- 用户记忆管理
- 对话历史查询
- 数据持久化

**数据表结构**:
```sql
-- 消息表
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  role TEXT,
  content TEXT,
  timestamp DATETIME
);

-- 记忆表
CREATE TABLE memories (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  key TEXT,
  value TEXT,
  updated_at DATETIME
);

-- 任务表
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY,
  user_id TEXT,
  schedule TEXT,
  task TEXT,
  status TEXT,
  created_at DATETIME
);
```

### 4. 任务调度器 (`src/task-scheduler.ts`)

**功能** (6KB):
- Cron 任务调度
- 定时任务执行
- 任务队列管理
- 任务状态跟踪

**核心方法**:
```typescript
class TaskScheduler {
  addTask()           // 添加任务
  removeTask()        // 移除任务
  executeTask()       // 执行任务
  scheduleTask()      // 调度任务
  getNextRunTime()    // 获取下次执行时间
}
```

### 5. 进程间通信 (`src/ipc.ts`)

**功能** (12KB):
- 主进程与容器通信
- 消息路由
- 认证机制
- 错误处理

**通信流程**:
```
主进程 <---> IPC 通道 <---> 容器进程
    |                              |
    |-- 消息序列化                |-- 消息反序列化
    |-- 消息路由                  |-- 命令执行
    |-- 结果返回                  |-- 响应发送
```

### 6. WhatsApp 认证 (`src/whatsapp-auth.ts`)

**功能** (5KB):
- WhatsApp 登录
- 二维码生成
- 会话管理
- 认证令牌存储

**认证流程**:
```
1. 生成会话 ID
2. 请求 WhatsApp 登录
3. 生成二维码
4. 用户扫描二维码
5. 验证会话
6. 保存认证信息
```

### 7. 挂载安全 (`src/mount-security.ts`)

**功能** (10KB):
- 文件系统挂载
- 安全策略验证
- 权限检查
- 访问控制

**安全措施**:
```
- 只读挂载 (ro)
- 无设备访问 (nodev)
- 无执行权限 (noexec)
- 禁止 suid (nosuid)
```

---

## 🐳 容器化部署

### Dockerfile 设计要点

```dockerfile
# 使用 Alpine 镜像减小体积
FROM node:20-alpine

# 安装系统依赖
RUN apk add --no-cache python3 make g++ sqlite

# 只安装生产依赖
RUN npm ci --only=production

# 数据持久化
RUN mkdir -p /app/data

# 安全配置
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3

# 只读文件系统
read_only: true
tmpfs:
  - /tmp
  - /run
```

### Docker Compose 配置

```yaml
services:
  nanoclaw:
    build: .
    restart: unless-stopped
    
    # 环境变量
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - WHATSAPP_PHONE_NUMBER=${WHATSAPP_PHONE_NUMBER}
    
    # 数据持久化
    volumes:
      - nanoclaw-data:/app/data
      - nanoclaw-logs:/app/logs
    
    # 资源限制
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
    
    # 安全选项
    security_opt:
      - no-new-privileges:true
    read_only: true
```

---

## 🔒 安全机制

### 1. 容器隔离
- 文件系统隔离
- 网络隔离
- 进程隔离
- 资源限制

### 2. 权限控制
- 降权运行 (非 root)
- Capabilities 限制
- 文件权限检查
- 只读挂载

### 3. 认证机制
- IPC 消息签名
- 会话令牌验证
- 访问控制列表

### 4. 数据保护
- 数据库加密
- 日志脱敏
- 敏感信息过滤

---

## 📊 性能优化

### 1. 资源优化
- Alpine 基础镜像 (~5MB)
- 生产依赖精简
- 数据库连接池
- 消息批处理

### 2. 并发处理
- 异步 I/O
- 任务队列
- 连接复用
- 缓存机制

### 3. 内存管理
- 对象池
- 及时释放
- 垃圾回收优化
- 内存限制

---

## 🚀 部署流程

### 1. 快速启动

```bash
# 克隆仓库
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw

# 安装依赖
npm install

# 构建项目
npm run build

# 配置环境
cp .env.example .env
nano .env  # 填入 ANTHROPIC_API_KEY 等

# 启动容器
docker-compose up -d
```

### 2. 部署脚本

创建的脚本文件:
- `deploy.sh` - 自动化部署
- `quick-start.sh` - 交互式菜单
- `Dockerfile` - 镜像构建
- `docker-compose.yml` - 服务编排
- `docker-compose.full.yml` - 完整配置 (含 Redis, Log Collector)

---

## 📝 关键学习点

### 1. 容器化架构
- 容器作为安全沙箱
- 进程间通信机制
- 资源隔离和限制

### 2. AI Agent 模式
- 基于 Anthropic Agents SDK
- 技能系统 (Skills)
- 上下文管理
- 工具调用

### 3. 数据库设计
- SQLite 嵌入式数据库
- 消息持久化
- 记忆系统
- 任务调度

### 4. 通信集成
- WhatsApp Baileys 库
- 异步消息处理
- 会话管理
- 认证流程

### 5. 安全实践
- 最小权限原则
- 只读文件系统
- 容器安全加固
- 认证和授权

---

## 🛠️ 扩展开发

### 添加新技能
1. 在 `container/skills/` 创建技能文件
2. 实现技能接口
3. 注册到 Agent

### 自定义渠道
1. 在 `src/channels/` 创建渠道
2. 实现消息接口
3. 注册到路由器

### 数据库扩展
1. 定义新的 Schema
2. 实现 DAO 方法
3. 添加迁移脚本

---

## 📚 相关资源

- **GitHub**: https://github.com/qwibitai/nanoclaw
- **Discord**: https://discord.gg/VGWXrf8x
- **Anthropic**: https://www.anthropic.com
- **Baileys**: https://github.com/WhiskeySockets/Baileys
- **Better SQLite3**: https://github.com/WiseLibs/better-sqlite3

---

## ✅ 总结

NanoClaw 是一个设计精良的容器化 AI 助手，具有以下特点:

1. **轻量级**: 基于 Alpine + Node.js，体积小
2. **安全**: 多层安全机制，容器隔离
3. **可扩展**: 插件化技能系统
4. **易部署**: Docker Compose 一键部署
5. **完整功能**: WhatsApp 集成、任务调度、记忆管理

通过学习 NanoClaw，可以掌握:
- 容器化应用开发
- AI Agent 架构设计
- 安全最佳实践
- 微服务部署
- 消息系统集成
