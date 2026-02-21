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
- **容器隔离** - Docker 容器化 Claude Code 代码执行环境

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

## CLI 使用

```bash
# 查看帮助
minibot --help

# 开发模式
minibot dev

# 代码助手
minibot code "帮我重构这个文件"

# 系统诊断
minibot doctor
```

## 对比

| 特性 | nanobot | minibot |
|------|---------|----------|
| 语言 | Python | TypeScript |
| 框架 | 自定义 | Hono |
| 记忆 | JSONL | SQLite + Markdown |
| 类型安全 | 动态 | 静态 (TS) |
| Claude Code | ❌ | ✅ |

## 许可证

MIT

---

[开始使用](/guide/getting-started) · [快速入门](/guide/quick-start) · [API 文档](/api/agent)
