# Minibot

> 轻量级 AI 助手，基于 Hono + TypeScript + Node.js 构建

受 [nanobot](https://github.com/hkuds/nanobot) 启发，使用现代技术栈重新实现。

## 特性

- **高性能** - Hono 框架提供极致性能
- **类型安全** - 完整的 TypeScript 支持
- **持久化记忆** - SQLite + Markdown 混合存储
- **会话管理** - 基于 JSONL 的会话隔离与持久化
- **多 LLM 支持** - 智谱、OpenAI、DeepSeek、Dashscope、通义等
- **多平台** - 飞书集成，支持回复引用
- **工具系统** - 内置工具，易于扩展
- **定时任务** - 基于 Cron 的任务执行与工作区隔离
- **子代理架构** - 分布式任务执行与负载均衡
- **错误处理** - 智能错误分类与重试机制
- **容器隔离** - Docker 容器化代码执行环境

## 架构

```
┌────────────────────────────────────────────────┐
│                 客户端层                      │
│              飞书 (WebSocket)                 │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Hono 服务器 (API)                 │
│         /health  /chat  /memory  /tools        │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Agent 核心 (LLM)                  │
│      循环 / 上下文 / 记忆 / 工具              │
└────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌─────────┐           ┌─────────┐
    │  工具   │           │  定时   │
    │  系统   │           │  调度   │
    └─────────┘           └─────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│              记忆与存储                        │
│              SQLite / Config                   │
└────────────────────────────────────────────────┘
```

## 快速开始

### 安装

```bash
git clone https://github.com/charlzyx/minibot.git
cd minibot
npm install
```

### 配置

创建 `.env` 文件：

```env
# 智谱 AI
ZHIPU_API_KEY=your_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# 飞书
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 服务器
PORT=18790
```

### 运行

```bash
# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

## 项目结构

```
minibot/
├── src/                    # 源代码
│   ├── agent/              # Agent 核心
│   ├── channels/           # 消息通道
│   ├── commands/           # 命令系统
│   ├── container/          # 容器编排
│   ├── cron/               # 定时任务
│   ├── errors/             # 错误处理
│   ├── ipc/                # 进程通信
│   ├── memory/             # 记忆管理
│   ├── monitoring/         # 系统监控
│   ├── session/            # 会话管理
│   ├── skills/             # 技能系统
│   ├── tools/              # 工具系统
│   └── utils/              # 工具函数
├── docs/                   # 文档
├── tests/                  # 测试
└── package.json
```

## 核心模块

| 模块 | 描述 |
|------|------|
| [Agent](/api/agent) | Agent 核心逻辑 |
| [Commands](/api/commands) | 命令系统 |
| [Session](/api/session) | 会话管理 |
| [Tools](/api/tools) | 工具系统 |
| [Memory](/guide/memory) | 记忆管理 |
| [Scheduler](/guide/scheduler) | 定时任务调度 |
| [Container](/guide/container) | 容器隔离 |

## 对比

| 特性 | nanobot | minibot |
|------|---------|----------|
| 语言 | Python | TypeScript |
| 框架 | 自定义 | Hono |
| 记忆 | JSONL | SQLite + Markdown |
| 类型安全 | 动态 | 静态 (TS) |
| 定时任务 | ✅ | ✅ (增强) |
| 容器隔离 | ❌ | ✅ |

## 许可证

MIT

---

[开始使用](/guide/getting-started) · [快速入门](/guide/quick-start) · [API 文档](/api/agent)
