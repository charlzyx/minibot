# Minibot - Lightweight AI Assistant

> 🐈 Minimal AI assistant powered by Hono + TypeScript + Node

Inspired by [nanobot](https://github.com/hkuds/nanobot), reimplemented with modern tech stack.

## ✨ Features

- 🚀 **Fast & Lightweight** - Hono framework for maximum performance
- 🔒 **Type-Safe** - Full TypeScript coverage
- 💾 **Persistent Memory** - SQLite based long-term storage
- 🔌 **Multiple LLM Providers** - OpenAI, DeepSeek, Dashscope, Qwen, etc.
- 💬 **Multi-Platform** - Feishu, WeChat, DingTalk, QQ, Discord, Slack
- 🛠️ **Tool System** - Built-in tools with easy extension
- ⏰ **Scheduled Tasks** - Cron-based task execution
- 🔍 **Agent Network** - Link with other agents for collaboration

## 🏗️ Architecture

```
┌────────────────────────────────────────────────┐
│                 Client Layer                 │
│            Feishu / WeChat / etc            │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Hono Server (API)            │
│         /chat  /events  /tools          │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Agent Core (LLM)            │
│    Loop / Context / Memory / Tools      │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│            Channel Adapters              │
│  Feishu / WeChat / DingTalk / QQ     │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Memory & Storage              │
│              SQLite / Config                │
└────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
minibot/
├── src/
│   ├── index.ts              # Hono app entry point
│   ├── agent/              # Core agent logic
│   │   ├── context.ts      # Prompt builder
│   │   ├── loop.ts         # Agent main loop (LLM ↔ tools)
│   │   ├── memory.ts       # Long-term memory management
│   │   └── tools.ts        # Tool registry & execution
│   ├── channels/          # Chat platform integrations
│   │   ├── feishu.ts      # Feishu (WebSocket)
│   │   ├── wechat.ts       # WeChat (HTTP)
│   │   ├── dingtalk.ts     # DingTalk (Stream)
│   │   └── qq.ts          # QQ (Bot + Webhook)
│   ├── tools/             # Built-in tools
│   │   ├── shell.ts       # Shell command execution
│   │   ├── web.ts         # HTTP requests
│   │   ├── file.ts        # File operations
│   │   └── index.ts
│   ├── memory/            # Persistent memory (SQLite)
│   ├── config/            # Configuration management
│   │   ├── schema.ts      # Config validation with Zod
│   │   └── manager.ts     # Config load/save
│   └── session/           # Session management
├── tests/
│   ├── agent/
│   ├── channels/
│   └── tools/
├── db/
│   └── memory.db            # SQLite database (gitignored)
├── config/
│   └── config.json         # User configuration (gitignored)
├── package.json
├── tsconfig.json
└── README.md
```

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/charlzyx/minibot.git
cd minibot
npm install
```

### Configuration

Create `config/config.json`:

```json
{
  "provider": {
    "name": "openai",
    "apiKey": "sk-or-v1-xxx"
  },
  "model": {
    "name": "gpt-4o",
    "maxTokens": 4000,
    "temperature": 0.7
  },
  "channels": {
    "feishu": {
      "enabled": true,
      "appId": "cli_xxx",
      "appSecret": "xxx"
    }
  },
  "tools": {
    "shell": {
      "enabled": true
    },
    "web": {
      "enabled": true
    }
  }
}
```

### Development

```bash
# Install dependencies
npm install

# Run dev server (with hot reload)
npm run dev

# Build
npm run build

# Run production server
npm run start

# Run tests
npm test
```

## 🎯 Core Modules

### Agent Core

```typescript
// Agent Loop
async function agentLoop(message: string, context: AgentContext) {
  // 1. Analyze message
  const intent = await analyzeIntent(message, context)
  
  // 2. Plan tasks
  const tasks = await planTasks(intent, context)
  
  // 3. Execute tools
  const results = await executeTools(tasks, context)
  
  // 4. Build response
  const response = await buildResponse(results, context)
  
  // 5. Update memory
  await updateMemory(context, results)
  
  return response
}
```

### Memory System

```typescript
// Long-term memory with SQLite
interface Memory {
  id: string
  content: string
  embedding?: number[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

async function searchMemory(query: string): Promise<Memory[]> {
  // Semantic search with embeddings
}

async function storeMemory(content: string, tags: string[]) {
  // Store with timestamp and embeddings
}
```

### Tool System

```typescript
interface Tool {
  name: string
  description: string
  execute: (params: any) => Promise<any>
}

// Built-in tools
const tools: Record<string, Tool> = {
  shell: {
    name: "shell",
    description: "Execute shell commands",
    execute: async ({ command }) => spawnProcess(command)
  },
  web: {
    name: "web",
    description: "Make HTTP requests",
    execute: async ({ url, method, data }) => fetch(url, { method, body: JSON.stringify(data) })
  },
  file: {
    name: "file",
    description: "Read/write files in workspace",
    execute: async ({ path, action, content }) => fileAction(path, action, content)
  }
}
```

## 📱 Chat Platforms

### Feishu (Priority - WebSocket)

```typescript
// FeishuChannel
const feishu = new FeishuChannel({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
})

// Long connection - no public IP
await feishu.connect({
  mode: 'long'
})
```

### WeChat (HTTP + Webhook)

```typescript
// WeChatChannel
const wechat = new WeChatChannel({
  appId: process.env.WECHAT_APP_ID,
  appSecret: process.env.WECHAT_APP_SECRET
})

// Receive via webhook
app.post('/wechat/webhook', async (c) => {
  await wechat.handleMessage(c.body)
})
```

### DingTalk (Stream Mode)

```typescript
// DingTalkChannel
const dingtalk = new DingTalkChannel({
  clientId: process.env.DINGTALK_CLIENT_ID,
  clientSecret: process.env.DINGTALK_CLIENT_SECRET
})

// Stream mode - no public IP
await dingtalk.connect({
  mode: 'stream'
})
```

## 🔧 Configuration

### Provider Configuration

```typescript
interface ProviderConfig {
  name: 'openai' | 'deepseek' | 'dashscope' | 'qwen' | 'zhipu'
  apiKey: string
  apiBase?: string
  baseUrl?: string
}

interface ModelConfig {
  name: string
  maxTokens: number
  temperature: number
  topP?: number
}
```

### Channel Configuration

```typescript
interface ChannelConfig {
  feishu?: FeishuConfig
  wechat?: WeChatConfig
  dingtalk?: DingTalkConfig
  qq?: QQConfig
  discord?: DiscordConfig
  slack?: SlackConfig
}
```

## 🛠️ Security

- **Workspace Isolation** - Restricted access to workspace directory
- **Command Validation** - Shell command validation before execution
- **API Key Protection** - Encrypted storage with Zod validation
- **Content Filtering** - Input validation on all incoming messages
- **Rate Limiting** - Per-user rate limits on all channels

## 📊 Performance

- **Hono Framework** - Ultra-fast HTTP/WebSocket server
- **TypeScript** - Type-safe development
- **SQLite Memory** - Efficient persistent storage
- **Lazy Loading** - Modules loaded on demand
- **Connection Pooling** - Efficient channel management

## 🤝 Contributing

Contributions are welcome! Please feel free to:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT

## 🙏 Acknowledgments

Inspired by:
- [nanobot](https://github.com/hkuds/nanobot) - The original lightweight AI assistant
- [OpenClaw](https://github.com/openclaw/openclaw) - The OpenAI agent platform
- [Hono](https://github.com/honojs/hono) - The ultra-fast web framework

## 📞 Comparison: nanobot vs minibot

| Feature | nanobot | minibot |
|--------|---------|---------|
| Language | Python | TypeScript |
| Framework | Custom | Hono |
| Memory | Custom | SQLite |
| Type Safety | Dynamic | Static (TS) |
| Performance | Excellent | Excellent |
| Learning Curve | Medium | Low |
| Deployment | Pip/uv | NPM |

---

**Built with ❤️ using Hono + TypeScript**
