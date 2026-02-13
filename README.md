# Minibot - Lightweight AI Assistant

> 🐈 Minimal AI assistant powered by Hono + TypeScript + Node

Inspired by [nanobot](https://github.com/hkuds/nanobot), reimplemented with modern tech stack.

## ✨ Features

- 🚀 **Fast & Lightweight** - Hono framework for maximum performance
- 🔒 **Type-Safe** - Full TypeScript coverage
- 💾 **Persistent Memory** - SQLite based long-term storage
- 🔌 **Multiple LLM Providers** - Zhipu, OpenAI, DeepSeek, Dashscope, Qwen, etc.
- 💬 **Multi-Platform** - Feishu with reply reference support
- 🛠️ **Tool System** - Built-in tools with easy extension
- ⏰ **Scheduled Tasks** - Cron-based task execution with workspace isolation
- 🤖 **Subagent Architecture** - Distributed task execution and load balancing
- 🔍 **Error Handling** - Intelligent error classification and retry mechanisms

## 🏗️ Architecture

```
┌────────────────────────────────────────────────┐
│                 Client Layer                 │
│            Feishu (WebSocket)              │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Hono Server (API)            │
│         /api/health  /api/chat           │
│         /api/memory  /api/tools           │
└────────────────────────────────────────────────┘
                      │
                      ↓
┌────────────────────────────────────────────────┐
│              Agent Core (LLM)            │
│    Loop / Context / Memory / Tools      │
└────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌─────────┐           ┌─────────┐
    │  Tools  │           │  Cron   │
    │  System  │           │Scheduler │
    └─────────┘           └─────────┘
          │                       │
          └───────────┬───────────┘
                      │
                      ▼
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
│   │   ├── index.ts        # Agent implementation
│   │   └── DESIGN.md       # Agent design documentation
│   ├── channels/           # Chat platform integrations
│   │   ├── feishu.ts      # Feishu (WebSocket) with reply reference
│   │   └── DESIGN.md       # Channels design documentation
│   ├── tools/              # Built-in tools
│   │   ├── file.ts         # File operations
│   │   ├── shell.ts        # Shell command execution
│   │   ├── web.ts         # HTTP requests
│   │   ├── llm.ts         # LLM API calls
│   │   ├── index.ts        # Tool registry
│   │   └── DESIGN.md      # Tools design documentation
│   ├── memory/             # Persistent memory (SQLite)
│   │   ├── manager.ts      # Memory manager implementation
│   │   └── DESIGN.md      # Memory design documentation
│   ├── config/             # Configuration management
│   │   ├── manager.ts      # Config manager
│   │   ├── schema.ts      # Config schema
│   │   └── DESIGN.md      # Config design documentation
│   ├── cron/               # Scheduled task system
│   │   ├── parser.ts       # Cron expression parser
│   │   ├── executor.ts     # Shell script executor
│   │   ├── workspace.ts    # Workspace isolation system
│   │   ├── subagent.ts     # Subagent manager
│   │   ├── error-handler.ts # Error handling and retry
│   │   ├── scheduler.ts    # Cron scheduler
│   │   ├── config.ts       # Configuration examples
│   │   ├── index.ts        # Module exports
│   │   └── DESIGN.md      # Cron design documentation
│   └── cron-demo.ts        # Cron system demo
├── db/
│   └── memory.db          # SQLite database (gitignored)
├── workspaces/            # Task workspaces (gitignored)
├── package.json
├── tsconfig.json
├── README.md              # This file
├── CRON_README.md        # Cron system documentation
└── CRON_DEPLOYMENT.md    # Cron deployment guide
```

## 🚀 Quick Start

### Installation

```bash
git clone https://github.com/charlzyx/minibot.git
cd minibot
npm install
```

### Configuration

Create `.env` file:

```env
# Zhipu LLM
ZHIPU_API_KEY=your_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# Feishu
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# Server
PORT=18790
```

### Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build
npm run build

# Run production server
npm run start

# Run cron demo
npm run build
node dist/cron-demo.js
```

## 🎯 Core Modules

### Agent Core

The Agent is the core intelligence unit that processes user messages, calls tools, and generates responses.

**Features**:
- Message processing and intent analysis
- Tool selection and execution
- Context management
- Response generation

**Documentation**: [Agent Design](src/agent/DESIGN.md)

### Channels

Channels module integrates with external messaging platforms.

**Features**:
- Feishu WebSocket integration
- Message deduplication
- Auto reaction (👍)
- Reply reference support
- Card messages

**Documentation**: [Channels Design](src/channels/DESIGN.md)

### Tools

Tools module provides executable operations that can be called by the Agent.

**Available Tools**:
- **File Tool**: Read, write, append, edit, delete files
- **Shell Tool**: Execute shell commands with timeout and environment variables
- **Web Tool**: Make HTTP requests (GET, POST, PUT, DELETE)
- **LLM Tool**: Call LLM APIs for conversation generation

**Documentation**: [Tools Design](src/tools/DESIGN.md)

### Memory

Memory module provides persistent storage using SQLite.

**Features**:
- SQLite-based storage
- Tag system for categorization
- Content search with fuzzy matching
- Recent memories retrieval
- Embedding vector support (for future semantic search)

**Documentation**: [Memory Design](src/memory/DESIGN.md)

### Config

Config module manages application configuration.

**Features**:
- Environment variable loading
- Database persistence
- Configuration validation
- Dynamic updates

**Documentation**: [Config Design](src/config/DESIGN.md)

### Cron Scheduler

Cron module provides a complete scheduled task system.

**Features**:
- Cron expression parsing (5-segment and 6-segment)
- Shell script execution
- Workspace isolation
- Subagent architecture for distributed execution
- Error handling and retry mechanisms
- Task priority management

**Documentation**: [Cron Design](src/cron/DESIGN.md) | [Cron README](CRON_README.md) | [Cron Deployment](CRON_DEPLOYMENT.md)

## 📱 Feishu Integration

### Features

- ✅ WebSocket real-time communication
- ✅ Message deduplication
- ✅ Auto reaction (👍)
- ✅ Reply reference support
- ✅ Card messages
- ✅ Private and group chat support

### Usage

```typescript
import { startFeishuWS, FeishuChannel } from './channels/feishu'

// Start WebSocket
startFeishuWS({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
}, async (message) => {
  console.log('Received:', message.content)
  
  const channel = new FeishuChannel(config)
  // Reply with reference to original message
  await channel.sendCardMessage('Reply content', message.sender_id?.open_id, message.message_id)
})
```

## ⏰ Cron Scheduler

### Quick Start

```typescript
import { CronScheduler, ErrorHandler } from './cron'

const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true
})

await scheduler.start()

await scheduler.addJob({
  name: 'Daily Backup',
  cronExpression: '0 2 * * *',
  command: 'bash',
  args: ['scripts/backup.sh'],
  enabled: true,
  priority: ErrorHandler.getPriority('high'),
  timeout: 600000,
  maxRetries: 3
})
```

### Cron Expression Examples

- `0 2 * * *` - Daily at 2 AM
- `*/5 * * * *` - Every 5 minutes
- `0 0 * * 0` - Weekly on Sunday midnight
- `0 0 1 * *` - Monthly on 1st midnight
- `0 9-17 * * 1-5` - Weekdays 9 AM - 5 PM hourly
- `0 */30 * * * *` - Every 30 seconds (6-segment)

For more details, see [Cron README](CRON_README.md)

## 🔧 Configuration

### Environment Variables

```env
# LLM Provider
ZHIPU_API_KEY=your_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# Feishu
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# Server
PORT=18790
NODE_ENV=development
```

### Config Structure

```typescript
interface Config {
  provider: {
    name: string
    apiKey: string
    apiBase?: string
  }
  model: {
    name: string
    maxTokens?: number
    temperature?: number
  }
  channels: {
    feishu: {
      enabled: boolean
      appId: string
      appSecret: string
    }
  }
  tools: {
    file: { enabled: boolean }
    shell: { enabled: boolean }
    web: { enabled: boolean }
    llm: { enabled: boolean }
  }
  server: {
    port: number
    cors: boolean
  }
}
```

## 🛠️ Security

- **Workspace Isolation** - Restricted access to workspace directory
- **Command Validation** - Shell command validation before execution
- **API Key Protection** - Environment variable storage
- **Content Filtering** - Input validation on all incoming messages
- **Message Deduplication** - Prevent duplicate message processing

## 📊 Performance

- **Hono Framework** - Ultra-fast HTTP/WebSocket server
- **TypeScript** - Type-safe development
- **SQLite Memory** - Efficient persistent storage
- **Lazy Loading** - Modules loaded on demand
- **Connection Pooling** - Efficient channel management

## 🤝 Contributing

Contributions are welcome! Please feel free to:

1. Fork repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
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
|---------|----------|----------|
| Language | Python | TypeScript |
| Framework | Custom | Hono |
| Memory | Text files (JSONL) | SQLite |
| Type Safety | Dynamic | Static (TS) |
| Performance | Excellent | Excellent |
| Cron System | ✅ | ✅ (Enhanced) |
| Workspace Isolation | ✅ | ✅ |
| Subagent Architecture | ✅ | ✅ |
| Reply Reference | ❌ | ✅ |
| Learning Curve | Medium | Low |

## 📚 Documentation

- [Agent Design](src/agent/DESIGN.md) - Core agent architecture
- [Channels Design](src/channels/DESIGN.md) - Messaging platform integration
- [Tools Design](src/tools/DESIGN.md) - Tool system documentation
- [Memory Design](src/memory/DESIGN.md) - Memory management
- [Config Design](src/config/DESIGN.md) - Configuration system
- [Cron Design](src/cron/DESIGN.md) - Scheduled task system
- [Cron README](CRON_README.md) - Cron system user guide
- [Cron Deployment](CRON_DEPLOYMENT.md) - Cron deployment instructions

---

**Built with ❤️ using Hono + TypeScript**
