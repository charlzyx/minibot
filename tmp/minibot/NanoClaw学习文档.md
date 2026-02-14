# NanoClaw 代码学习笔记

## 项目概述

**NanoClaw** 是一个轻量级、安全的 AI 助手，专为在隔离容器中运行而设计。它是对 OpenClaw 的简化替代方案。

### 核心特性

- **轻量级**: 代码库小，可快速理解（8分钟）
- **安全**: 使用 Linux 容器（macOS 上用 Apple Container）进行文件系统隔离
- **简单**: 单 Node.js 进程，无微服务架构
- **可定制**: 通过代码修改而非配置文件进行定制
- **AI 原生**: 与 Claude Agent SDK 直接集成

## 技术架构

### 技术栈
- **语言**: TypeScript / Node.js 20+
- **数据库**: SQLite (better-sqlite3)
- **容器**: Apple Container (macOS) 或 Docker (Linux)
- **消息队列**: IPC (进程间通信) + 文件系统
- **WhatsApp 集成**: @whiskeysockets/baileys

### 架构图
```
WhatsApp (baileys) --> 轮询循环 --> 容器 (Claude Agent SDK) --> 响应
```

## 核心文件结构

### 入口文件
- **`src/index.ts`** (16.5KB)
  - 主要编排器：状态管理、消息循环、Agent 调用

### 通道模块 (`src/channels/`)
- **`whatsapp-auth.ts`** (5.4KB)
  - WhatsApp 连接、认证、发送/接收消息

### 核心功能
- **`src/ipc.ts`** (12.0KB)
  - IPC 监听器和任务处理
  
- **`src/container-runner.ts`** (20.6KB)
  - 启动和管理流式 Agent 容器
  
- **`src/router.ts`** (1.4KB)
  - 消息格式化和出站路由
  
- **`src/group-queue.ts`** (8.7KB)
  - 每组消息队列，支持并发控制

- **`src/task-scheduler.ts`** (6.3KB)
  - 运行预定任务

- **`src/db.ts`** (15.9KB)
  - SQLite 操作（消息、组、会话、状态）

### 安全模块
- **`src/mount-security.ts`** (10.6KB)
  - 挂载点和安全策略管理

### 辅助模块
- **`src/config.ts`** (1.8KB) - 配置管理
- **`src/types.ts`** (3.2KB) - TypeScript 类型定义
- **`src/logger.ts`** (0.5KB) - 日志记录

### 测试文件
每个 `.test.ts` 文件对应相应的功能测试

## 容器化方案

### 支持的容器运行时
1. **Apple Container** (macOS 默认)
   - 轻量级、快速、为 Apple Silicon 优化
   
2. **Docker** (Linux 或跨平台)
   - 在 `/setup` 时可选择使用 Docker

### 容器目录结构 (`container/`)
- **`Dockerfile`** - Docker 镜像定义
- **`build.sh`** - 构建脚本
- **`agent-runner/`** - Agent 运行时环境
- **`skills/`** - Claude Code 技能

## 安全模型

### 隔离机制
1. **容器隔离**: Agents 在 Linux 容器中运行
2. **文件系统隔离**: 只能访问显式挂载的目录
3. **限制访问**: Bash 命令在容器内执行，不在主机上

### 安全特性
- 无应用级权限检查（依赖容器隔离）
- 每个组有独立的 `CLAUDE.md` 记忆
- 每个组有独立的文件系统挂载
- 消息队列的并发控制

## 安装和运行

### 快速开始
```bash
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
npm install
npm run build
npm start
```

### 设置流程
运行 `/setup` 命令，Claude Code 会自动处理：
- 依赖安装
- 认证配置
- 容器设置
- 服务配置

## 使用方法

### 默认触发词: `@Andy`

示例用法：
```
@Andy 每周一早上 9 点向我发送销售管道概览
@Andy 回顾过去一周的 git 历史并更新 README（如果有变动）
@Andy 每周一上午 8 点，从 Hacker News 和 TechCrunch 编译 AI 开发新闻并发送给我简要信息
```

### 管理命令（主频道）
```
@Andy 列出所有跨组的预定任务
@Andy 暂停周一简报任务
@Andy 加入家庭聊天组
```

## 定制化

### 无配置文件
没有配置文件需要学习，直接修改代码：
- "将触发词改为 @Bob"
- "让未来的响应更简短直接"
- "当我早上好时添加自定义问候"
- "每周存储对话摘要"

### 代码修改
由于代码库足够小，Claude 可以安全地修改它。

## 贡献指南

### 不添加特性，添加技能
如果想要添加 Telegram 支持，不要创建 PR 来添加 WhatsApp。而是贡献技能文件 (`.claude/skills/add-telegram/SKILL.md`) 来教 Claude Code 如何将 NanoClaw 安装转换为使用 Telegram。

### 渴望的技能 (RFS)
1. **通信频道**
   - `/add-telegram` - 添加 Telegram
   - `/add-slack` - 添加 Slack
   - `/add-discord` - 添加 Discord

2. **平台支持**
   - `/setup-windows` - 通过 WSL2 + Docker 的 Windows

3. **会话管理**
   - `/add-clear` - 添加 `/clear` 命令压缩对话（总结上下文同时保留关键信息）

## 系统要求

- **操作系统**: macOS 或 Linux
- **Node.js**: 20+
- **Claude Code**: https://claude.ai/download
- **容器**: Apple Container (macOS) 或 Docker (macOS/Linux)

## 与 OpenClaw 的对比

| 特性 | OpenClaw | NanoClaw |
|------|----------|----------|
| 模块数 | 52+ | ~15 个文件 |
| 配置文件 | 8 | 0 |
| 依赖 | 45+ | 最少 |
| 抽象层 | 15 个通道提供商 | 直接实现 |
| 安全 | 应用级 | 容器隔离 |
| 架构 | 多进程/共享内存 | 单 Node.js 进程 |

## 社区

- **Discord**: https://discord.gg/VGWXrf8x

## 许可证

MIT
