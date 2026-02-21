# Minibot - Lightweight AI Assistant

> 🐈 Minimal AI assistant powered by Hono + TypeScript + Node

Inspired by [nanobot](https://github.com/hkuds/nanobot) and [nanoclaw](https://github.com/gavrielc/nanoclaw), reimplemented with modern tech stack and enhanced with containerization capabilities.

## ✨ Features

### Core
- 🚀 **Fast & Lightweight** - Hono framework for maximum performance
- 🔒 **Type-Safe** - Full TypeScript coverage
- 💾 **Persistent Memory** - SQLite + Markdown hybrid storage
- 🗂️ **Session Management** - JSONL-based session isolation and persistence
- 🔌 **Multiple LLM Providers** - Zhipu, OpenAI, DeepSeek, Dashscope, Qwen, etc.

### Tools & Skills
- 🛠️ **Tool System** - Built-in tools with easy extension
- 📚 **Skill System** - Markdown-based skills with YAML frontmatter
- 🤖 **Subagent Architecture** - Distributed task execution

### Container & Isolation
- 🐳 **Docker Integration** - `/code` command runs in isolated containers
- 🔒 **Mount Security** - Allowlist-based mount validation for containers
- 📦 **Container Orchestration** - Lifecycle management and queue control
- 📡 **IPC System** - Inter-process communication for containers
- 📊 **Monitoring** - System metrics and health monitoring

### Task Management
- ⏰ **Scheduled Tasks** - Cron-based task execution with workspace isolation
- 🔄 **Retry Mechanisms** - Intelligent error classification and retry
- 📋 **Queue Management** - Concurrent execution with priority handling

### Multi-Platform
- 💬 **Feishu** - WebSocket integration with reply reference support
- 🔔 **Auto Reaction** - Auto reacts to messages
- 📝 **Card Messages** - Rich card message support

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
│         /api/skills  /api/plugins         │
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
│         Container Orchestration Layer       │
│  ┌─────────────┐  ┌──────────────┐          │
│  │   Docker    │  │   Queue      │          │
│  │   Runner    │  │   Manager    │          │
│  └─────────────┘  └──────────────┘          │
└────────────────────────────────────────────────┘
                      │
                      ▼
┌────────────────────────────────────────────────┐
│              Memory & Storage              │
│         SQLite / Config / IPC               │
└────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
minibot/
├── src/                          # 源代码目录
│   ├── agent/                     # Agent 核心逻辑
│   ├── channels/                  # 消息通道（飞书、微信等）
│   ├── commands/                  # 命令系统
│   │   ├── default.ts            # 默认命令
│   │   └── manager.ts            # 命令管理器
│   ├── config/                    # 配置管理
│   ├── container-runner-docker.ts # Docker 容器运行器
│   ├── container-orchestrator.ts  # 容器编排层
│   ├── cron/                      # 定时任务系统
│   ├── errors/                    # 错误处理
│   ├── group-queue.ts             # 组队列管理
│   ├── ipc.ts                     # 进程间通信
│   ├── index.ts                   # 主入口文件
│   ├── logger.ts                  # 日志系统
│   ├── message-processor.ts       # 消息处理器
│   ├── memory/                    # 记忆管理
│   ├── monitoring.ts              # 系统监控
│   ├── mount-security.ts           # 挂载安全
│   ├── session/                   # 会话管理
│   ├── skills/                    # 技能系统
│   ├── snapshot.ts                # 快照系统
│   ├── task-scheduler.ts          # 任务调度器
│   ├── types/                     # 类型定义
│   ├── utils/                     # 工具函数
│   └── tools/                     # 工具系统
├── container/                     # 容器相关
│   └── Dockerfile                 # 容器镜像
├── scripts/                       # 脚本
│   ├── build-container.sh         # 构建容器镜像
│   ├── install-service.sh         # Linux 安装脚本
│   └── install-service-macos.sh   # macOS 安装脚本
├── docs/                          # 文档目录
├── tests/                         # 测试目录
├── package.json                   # 项目配置
├── tsconfig.json                 # TypeScript 配置
├── README.md                      # 项目说明
└── USAGE.md                       # 使用指南
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
PORT=18791
```

### Development

```bash
# Install dependencies
npm install

# Run dev server (default workspace: /tmp/minibot-workspace)
npm run dev

# Build
npm run build

# Run production server
npm start

# Run production server with custom workspace
npm start -- --workspace=/path/to/workspace
```

### Workspace

By default, minibot uses `/tmp/minibot-workspace` as the workspace directory. You can specify a custom workspace using the `--workspace` parameter:

```bash
npm run dev -- --workspace=/custom/path/to/workspace
```

The workspace contains:
- `sessions/` - Session storage
- `memory/` - Memory files (Markdown)
- `db/` - SQLite database
- `workspaces/` - Task workspaces
- `skills/` - Skill files
- `ipc/` - Inter-process communication files
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

### Container Runner

Container Runner module provides isolated execution environment for agents.

**Features**:
- Container system checking
- Agent execution in isolated containers
- Output monitoring
- IPC communication
- Fallback to simulated container execution

**Documentation**: [Container Runner Design](src/container-runner.ts)

### Group Queue

Group Queue module manages concurrent container execution with queue system.

**Features**:
- Concurrency control
- State management
- Message queueing
- Retry mechanisms
- Process registration

**Documentation**: [Group Queue Design](src/group-queue.ts)

### Message Processor

Message Processor module handles message processing with context accumulation.

**Features**:
- Context accumulation
- Trigger pattern detection
- Message formatting
- Response generation
- Session management

**Documentation**: [Message Processor Design](src/message-processor.ts)

### Task Scheduler

Task Scheduler module manages scheduled tasks with cron expressions.

**Features**:
- Cron expression parsing
- Task management
- Workspace isolation
- Error handling
- Retry mechanisms

**Documentation**: [Task Scheduler Design](src/task-scheduler.ts)

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
- Context accumulation

**Documentation**: [Session Design](src/session/DESIGN.md)

### Commands

Commands module provides a command system for quick operations.

**Available Commands**:
- `/help` - Display available commands
- `/reset` - Reset current session
- `/skills` - List all available skills
- `/status` - Display system status
- `/code [task]` - Start code assistant in container
- `/monitor` - Display detailed monitoring information
- `/health` - Check system health status
- `/mounts` - Show mount security status

**Features**:
- Slash command support (`/command`)
- Extensible command registration
- Command help generation
- Error handling

**Documentation**: [Commands Design](src/commands/DESIGN.md)

### Skills

Skills module provides a Markdown-based skill system inspired by nanobot.

**Features**:
- Markdown skill files with YAML frontmatter
- Automatic skill loading from `skills/` directory
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

**Documentation**: [Cron Design](src/cron/DESIGN.md)

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

// Get messages since timestamp
const recent = sessionManager.getMessagesSince('feishu:oc_xxx', Date.now() - 3600000)

// Get last timestamp
const lastTimestamp = sessionManager.getLastTimestamp('feishu:oc_xxx')

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
PORT=18791
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
      encryptKey: string
      verificationToken: string
      allowFrom: string[]
    }
    wechat: {
      enabled: boolean
      appId: string
      appSecret: string
    }
    dingtalk: {
      enabled: boolean
      clientId: string
      clientSecret: string
      allowFrom: string[]
    }
    qq: {
      enabled: boolean
      appId: string
      secret: string
      allowFrom: string[]
    }
    discord: {
      enabled: boolean
      botToken: string
      appToken: string
      groupPolicy: string
    }
    slack: {
      enabled: boolean
      botToken: string
      appToken: string
      groupPolicy: string
    }
  }
  tools: {
    shell: {
      enabled: boolean
    }
    web: {
      enabled: boolean
    }
    file: {
      enabled: boolean
      workspace: string
    }
    llm: {
      enabled: boolean
    }
    memory: {
      enabled: boolean
    }
  }
  security: {
    restrictToWorkspace: boolean
  }
}
```

## 🚀 Deployment

### Linux (Systemd)

Minibot includes a systemd service file for auto-start on boot.

#### Installation

```bash
# Build the project
npm run build

# Run the installation script
sudo ./scripts/install-service.sh
```

The installation script will:
- Create a dedicated `minibot` user and group
- Install files to `/opt/minibot`
- Set up the systemd service
- Configure firewall rules (optional)
- Start the service

#### Service Management

```bash
# Start service
sudo systemctl start minibot

# Stop service
sudo systemctl stop minibot

# Restart service
sudo systemctl restart minibot

# Check status
sudo systemctl status minibot

# View logs
sudo journalctl -u minibot -f
```

#### Uninstallation

```bash
sudo ./scripts/uninstall-service.sh
```

### macOS (launchd)

Minibot includes a launchd plist file for auto-start on boot.

#### Installation

```bash
# Build the project
npm run build

# Run the installation script
sudo ./scripts/install-service-macos.sh
```

The installation script will:
- Install files to `/opt/minibot`
- Set up the launchd service
- Configure the plist with your username
- Create log directory
- Start the service

#### Service Management

```bash
# Load/start service
sudo launchctl load /Library/LaunchDaemons/com.github.charlzyx.minibot.plist

# Stop/unload service
sudo launchctl unload /Library/LaunchDaemons/com.github.charlzyx.minibot.plist

# Restart (unload then load)
sudo launchctl unload /Library/LaunchDaemons/com.github.charlzyx.minibot.plist && \
sudo launchctl load /Library/LaunchDaemons/com.github.charlzyx.minibot.plist

# Check status
launchctl list | grep minibot

# View logs
tail -f /opt/minibot/logs/minibot.log
tail -f /opt/minibot/logs/minibot.error.log
```

#### Uninstallation

```bash
sudo ./scripts/uninstall-service-macos.sh
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 18791
CMD ["npm", "start"]
```

## 🛠️ Security

- **Workspace Isolation** - Restricted access to workspace directory
- **Command Validation** - Shell command validation before execution
- **API Key Protection** - Environment variable storage
- **Content Filtering** - Input validation on all incoming messages
- **Message Deduplication** - Prevent duplicate message processing
- **Container Isolation** - Agent execution in isolated containers

## 📊 Performance

- **Hono Framework** - Ultra-fast HTTP/WebSocket server
- **TypeScript** - Type-safe development
- **SQLite Memory** - Efficient persistent storage
- **Lazy Loading** - Modules loaded on demand
- **Connection Pooling** - Efficient channel management
- **Containerization** - Isolated execution for better resource management

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
- [nanoclaw](https://github.com/gavrielc/nanoclaw) - Lightweight, secure AI assistant
- [OpenClaw](https://github.com/openclaw/openclaw) - The OpenAI agent platform
- [Hono](https://github.com/honojs/hono) - The ultra-fast web framework

## 📚 Documentation

- [Agent Design](src/agent/DESIGN.md) - Core agent architecture
- [Channels Design](src/channels/DESIGN.md) - Messaging platform integration
- [Tools Design](src/tools/DESIGN.md) - Tool system documentation
- [Memory Design](src/memory/DESIGN.md) - Memory management
- [Session Design](src/session/DESIGN.md) - Session management
- [Config Design](src/config/DESIGN.md) - Configuration system
- [Cron Design](src/cron/DESIGN.md) - Scheduled task system
- [Container Runner](src/container-runner.ts) - Container execution
- [Group Queue](src/group-queue.ts) - Queue management
- [Message Processor](src/message-processor.ts) - Message handling
- [Task Scheduler](src/task-scheduler.ts) - Task management

---

**Built with ❤️ using Hono + TypeScript**