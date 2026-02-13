# Minibot - Lightweight AI Assistant

> 🐈 Minimal AI assistant powered by Hono + TypeScript + Node

Inspired by [nanobot](https://github.com/hkuds/nanobot), reimplemented with modern tech stack.

## ✨ Features

- 🚀 **Fast & Lightweight** - Hono framework for maximum performance
- 🔒 **Type-Safe** - Full TypeScript coverage
- 💾 **Persistent Memory** - SQLite + Markdown hybrid storage
- 🗂️ **Session Management** - JSONL-based session isolation and persistence
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
├── src/                    # 源代码目录
│   ├── agent/              # Agent 核心逻辑
│   ├── channels/           # 消息通道（飞书、微信等）
│   ├── cron/               # 定时任务系统
│   ├── memory/             # 记忆管理
│   ├── session/            # 会话管理
│   ├── tools/              # 工具系统
│   ├── index.ts            # 主入口文件
│   └── cron-demo.ts       # 定时任务示例
├── test/                  # 单元测试
├── tests/                 # 集成测试
├── $HOME/minibot/         # 工作目录（运行时生成）
│   ├── sessions/           # 会话存储
│   ├── memory/             # 记忆存储（Markdown）
│   ├── db/                # SQLite 数据库
│   ├── minibot.config.ts   # 配置文件
│   └── workspaces/         # 任务工作区
├── package.json          # 项目配置
├── tsconfig.json        # TypeScript 配置
├── README.md            # 项目说明
├── CRON_README.md      # 定时任务文档
└── CRON_DEPLOYMENT.md    # 定时任务部署指南
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

# Run dev server (default workspace: $HOME/minibot)
npm run dev

# Run dev server with custom workspace
npm run dev -- --workspace=/path/to/workspace

# Build
npm run build

# Run production server
npm run start

# Run production server with custom workspace
npm start -- --workspace=/path/to/workspace

# Run cron demo
npm run build
node dist/cron-demo.js
```

### Workspace

By default, minibot uses `$HOME/minibot` as the workspace directory. You can specify a custom workspace using the `--workspace` parameter:

```bash
npm run dev -- --workspace=/custom/path/to/workspace
```

The workspace contains:
- `sessions/` - Session storage
- `memory/` - Memory files (Markdown)
- `db/` - SQLite database
- `workspaces/` - Task workspaces
- `minibot.config.ts` - Configuration file

This allows you to run multiple instances of minibot with different workspaces.

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
- **Memory Tool**: Store, search, and retrieve memories

**Documentation**: [Tools Design](src/tools/DESIGN.md)

### Memory

Memory module provides persistent storage using SQLite + Markdown hybrid approach.

**Features**:
- SQLite-based storage with tag system
- Daily notes in Markdown format (`memory/YYYY-MM-DD.md`)
- Long-term memory in Markdown format (`memory/MEMORY.md`)
- Content search with fuzzy matching
- Recent memories retrieval
- Memory context generation for LLM
- Embedding vector support (for future semantic search)

**Documentation**: [Memory Design](src/memory/DESIGN.md)

### Session

Session module provides conversation history management with isolation.

**Features**:
- JSONL-based session storage (`sessions/{key}.jsonl`)
- Session isolation by platform and chat ID
- Message history with timestamps
- In-memory caching for performance
- Automatic session cleanup
- Support for group and private chats
- Configurable message history limit

**Documentation**: [Session Design](src/session/DESIGN.md)

### Commands

Commands module provides a command system for quick operations.

**Features**:
- Slash command support (`/command`)
- Built-in commands: `/help`, `/reset`, `/skills`, `/status`
- Extensible command registration
- Command help generation
- Error handling

**Documentation**: [Commands Design](src/commands/DESIGN.md)

### Skills

Skills module provides a Markdown-based skill system inspired by nanobot.

**Features**:
- Markdown skill files with YAML frontmatter
- Automatic skill loading from `$HOME/minibot/skills/`
- Skill injection into agent's system prompt
- Skill categorization with tags
- REST API for skill management
- Example skills included

**Documentation**: [Skills Design](src/skills/DESIGN.md)

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

## 🗂️ Session Management

### Quick Start

```typescript
import { getSessionManager } from './session'

const sessionManager = getSessionManager()

// Get or create session
const session = sessionManager.getOrCreate('feishu:oc_xxx')

// Add messages
sessionManager.addMessage('feishu:oc_xxx', 'user', '你好')
sessionManager.addMessage('feishu:oc_xxx', 'assistant', '你好！有什么我可以帮助你的？')

// Get message history
const history = sessionManager.getMessages('feishu:oc_xxx', 20)

// Save session
await sessionManager.save(session)

// List all sessions
const sessions = await sessionManager.listSessions()

// Cleanup expired sessions
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000) // 7 days
```

### Session Isolation

Sessions are isolated by platform and chat ID:
- **Private Chat**: `{platform}:{userId}` (e.g., `feishu:oc_xxx`)
- **Group Chat**: `{platform}:{chatId}` (e.g., `feishu:oc_xxxxxxxxxxxxx`)

This ensures each conversation has its own context and history.

## 💾 Memory Management

### Quick Start

```typescript
import { getMemoryManager } from './memory'

const memoryManager = getMemoryManager()

// Store memory with tags
await memoryManager.store('User likes programming', ['user', 'preference'])

// Search memories
const results = await memoryManager.search('programming')

// Get recent memories
const recent = await memoryManager.getRecentMemories(7) // 7 days

// Daily notes
await memoryManager.appendToday('User asked about TypeScript')
const today = await memoryManager.readToday()

// Long-term memory
await memoryManager.writeLongTerm('Important: User is a developer')
const longTerm = await memoryManager.readLongTerm()

// Get memory context for LLM
const context = await memoryManager.getMemoryContext()
```

### Memory Storage

The memory system uses a hybrid approach:
- **SQLite**: For tagged memories with search capabilities
- **Daily Notes**: Markdown files (`memory/YYYY-MM-DD.md`) for daily logs
- **Long-term Memory**: Markdown file (`memory/MEMORY.md`) for persistent information

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
| Memory | Text files (JSONL) | SQLite + Markdown |
| Session | JSONL files | JSONL files + Cache |
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
- [Session Design](src/session/DESIGN.md) - Session management
- [Config Design](src/config/DESIGN.md) - Configuration system
- [Cron Design](src/cron/DESIGN.md) - Scheduled task system
- [Cron README](CRON_README.md) - Cron system user guide
- [Cron Deployment](CRON_DEPLOYMENT.md) - Cron deployment instructions

---

**Built with ❤️ using Hono + TypeScript**