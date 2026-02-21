# 配置指南

Minibot 使用 [c12](https://github.com/unjs/c12) 进行配置管理，支持多种配置来源。

## 配置优先级

配置按以下优先级加载（高到低）：

1. 命令行参数
2. 环境变量
3. 配置文件 (minibot.config.ts)
4. 默认值

## 环境变量

### LLM 配置

```env
# 智谱 AI
ZHIPU_API_KEY=your_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# Anthropic Claude
ANTHROPIC_API_KEY=your_key

# OpenAI
OPENAI_API_KEY=your_key
OPENAI_BASE_URL=https://api.openai.com/v1

# 通用 LLM 设置
LLM_PROVIDER=anthropic
LLM_MODEL=claude-sonnet-4-20250514
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7
```

### 服务器配置

```env
PORT=18790
HOST=0.0.0.0
CORS=true
LOG_LEVEL=info
```

### 飞书配置

```env
FEISHU_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxx
```

### 工作空间

```env
MINIBOT_WORKSPACE=$HOME/minibot
```

## 配置文件

创建 `minibot.config.ts` 在项目根目录：

```typescript
import { defineConfig } from 'c12'

export default defineConfig({
  // LLM 提供商配置
  provider: {
    name: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
    temperature: 0.7
  },

  // 消息通道配置
  channels: {
    feishu: {
      enabled: true,
      appId: process.env.FEISHU_APP_ID!,
      appSecret: process.env.FEISHU_APP_SECRET!
    }
  },

  // 服务器配置
  server: {
    port: 18790,
    host: '0.0.0.0',
    cors: true,
    logLevel: 'info'
  },

  // 工具配置
  tools: {
    file: {
      enabled: true,
      allowedPaths: ['./src', './tests']
    },
    shell: {
      enabled: true,
      allowedCommands: ['ls', 'pwd', 'cat', 'grep', 'node', 'npm']
    },
    web: { enabled: true },
    llm: { enabled: true },
    memory: { enabled: true }
  },

  // 容器配置
  container: {
    enabled: true,
    dockerEnabled: true,
    defaultImage: 'node:18-alpine',
    memoryLimit: '2g',
    cpuLimit: '2',
    timeout: 300000
  },

  // 工作空间
  workspace: process.env.MINIBOT_WORKSPACE || '$HOME/minibot',

  // 会话配置
  session: {
    historyLimit: 50,
    cleanupAge: 7 * 24 * 60 * 60 * 1000 // 7 天
  },

  // 记忆配置
  memory: {
    enabled: true,
    dbPath: './db/memory.db',
    dailyNotesPath: './memory',
    longTermMemoryPath: './memory/MEMORY.md'
  },

  // 技能配置
  skills: {
    enabled: true,
    skillsPath: './skills'
  }
})
```

## 配置验证

使用 CLI 验证配置：

```bash
minibot doctor
```

输出示例：

```
Running system diagnostics...

Checking Node.js version...
✔ Node.js v20.11.0

Checking Configuration file...
✔ Configuration loaded

Checking Docker...
✔ Docker installed

Checking Workspace directory...
✔ Workspace: /Users/user/minibot

3/4 checks passed
```

## 配置选项参考

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `provider.name` | string | 'zhipu' | LLM 提供商 |
| `provider.apiKey` | string | - | API 密钥 |
| `provider.model` | string | - | 模型名称 |
| `server.port` | number | 18790 | 服务器端口 |
| `server.host` | string | '0.0.0.0' | 服务器地址 |
| `container.enabled` | boolean | true | 启用容器 |
| `container.timeout` | number | 300000 | 容器超时 (ms) |
| `workspace` | string | '$HOME/minibot' | 工作空间路径 |

## 多环境配置

### 开发环境

`.env.development`:
```env
NODE_ENV=development
LOG_LEVEL=debug
PORT=18790
```

### 生产环境

`.env.production`:
```env
NODE_ENV=production
LOG_LEVEL=warn
PORT=80
```

切换环境：

```bash
NODE_ENV=production minibot start
```

## 相关文档

- [快速开始](/guide/getting-started)
- [部署指南](/guide/deployment)
- [CLI 命令](/reference/cli)
