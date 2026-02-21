# Minibot 使用文档

## 目录结构

```
minibot/
├── src/                    # 源代码目录
│   ├── agent/              # Agent 核心逻辑
│   ├── channels/           # 消息通道（飞书等）
│   ├── commands/           # 命令系统
│   ├── config/             # 配置管理
│   ├── container-runner.ts # 容器运行器
│   ├── cron/               # 定时任务系统
│   ├── errors/             # 自定义错误类
│   ├── group-queue.ts      # 组队列管理
│   ├── index.ts            # 主入口文件
│   ├── message-processor.ts # 消息处理器
│   ├── memory/             # 记忆管理
│   ├── plugins/            # 插件系统
│   ├── session/            # 会话管理
│   ├── skills/             # 技能系统
│   ├── task-scheduler.ts   # 任务调度器
│   ├── tools/              # 工具系统
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数（日志、缓存等）
├── scripts/                # 部署脚本
│   ├── install-service.sh       # Linux 安装脚本
│   ├── uninstall-service.sh     # Linux 卸载脚本
│   ├── install-service-macos.sh # macOS 安装脚本
│   └── uninstall-service-macos.sh # macOS 卸载脚本
├── tests/                  # 测试目录
│   └── unit/               # 单元测试
├── .env.example            # 环境变量模板
├── minibot.service         # systemd 服务文件
├── com.github.charlzyx.minibot.plist # launchd 服务文件
├── package.json            # 项目配置
├── tsconfig.json           # TypeScript 配置
├── README.md               # 项目说明
└── USAGE.md                # 使用指南
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，填写必要的配置
nano .env
```

**必需配置**：
```env
# Zhipu LLM
ZHIPU_API_KEY=your_zhipu_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# Feishu
FEISHU_APP_ID=your_feishu_app_id
FEISHU_APP_SECRET=your_feishu_app_secret

# Server
PORT=18791

# Optional: Session cache size (default: 500)
MAX_SESSION_CACHE=500
```

### 3. 启动服务

```bash
# 开发模式（使用默认工作区 /tmp/minibot-workspace）
npm run dev

# 生产模式
npm run build
npm start

# 使用自定义工作区
npm start -- --workspace=/path/to/workspace
```

### 4. 测试连接

访问健康检查接口：
```bash
curl http://localhost:18791/health
```

响应：
```json
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2026-02-21T00:00:00.000Z"
}
```

## 核心功能使用

### 1. 命令系统

Minibot 支持斜杠命令来快速执行特定操作。

#### 可用命令

| 命令 | 描述 | 用法 |
|--------|------|------|
| `/help` | 显示可用命令列表 | `/help` |
| `/reset` | 重置当前会话 | `/reset` |
| `/skills` | 列出所有可用的技能 | `/skills` |
| `/status` | 显示系统状态 | `/status` |
| `/code` | 启动代码助手并在容器中执行任务 | `/code [任务描述]` |
| `/skill-creator` | 创建自定义技能 | `/skill-creator` |

#### 使用示例

```
用户：/help
机器人：📋 可用命令

**/help** - 显示可用命令列表
  用法: /help

**/reset** - 重置当前会话
  用法: /reset

**/skills** - 列出所有可用的技能
  用法: /skills

**/status** - 显示系统状态
  用法: /status

**/code** - 启动代码助手并在容器中执行任务
  用法: /code [任务描述]
```

```
用户：/code 编写一个 TypeScript 函数来解析 JSON
机器人：🤖 **代码助手已启动**

任务: 编写一个 TypeScript 函数来解析 JSON

🚀 正在启动容器...

✅ 容器启动成功！

我现在可以帮助你完成以下任务：

- 💻 编写和调试代码
- 🐳 在容器中运行代码
- 🔧 代码审查和重构

我会及时反馈执行状态，遇到问题立即通知。

请告诉我你需要什么帮助！
```

### 2. 技能系统

#### 技能文件格式

技能使用 Markdown 格式定义，包含 YAML frontmatter：

```markdown
---
name: 技能名称
description: 技能描述
version: 1.0.0
author: 作者
tags: [标签1, 标签2]
tools: [tool1, tool2]
enabled: true
---

技能说明内容...
```

#### 创建技能

在 `workspace/skills/` 目录下创建 `.skill.md` 文件：

```bash
# 创建技能文件
nano workspace/skills/my-skill.skill.md
```

示例技能：

```markdown
---
name: Calculator
description: 帮助用户进行数学计算
version: 1.0.0
author: minibot
tags: [math, calculation]
tools: []
enabled: true
---

你是一个计算器助手。当用户需要进行数学计算时，请：

1. 理解用户的计算需求
2. 准确执行计算
3. 提供清晰的计算过程和结果

支持的操作：
- 基本运算：加、减、乘、除
- 高级运算：幂运算、平方根、对数
- 三角函数：sin、cos、tan

示例：
用户：计算 2 的 10 次方
助手：2 的 10 次方 = 1024

用户：sin(30度)
助手：sin(30°) ≈ 0.5
```

#### REST API

```bash
# 列出所有技能
GET /api/skills

# 获取特定技能
GET /api/skills/:id

# 创建新技能
POST /api/skills
{
  "name": "My Skill",
  "content": "技能内容...",
  "metadata": {
    "description": "技能描述",
    "tags": ["tag1", "tag2"]
  }
}

# 删除技能
DELETE /api/skills/:id
```

### 3. 飞书集成

#### 配置

```env
# Feishu
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=           # 可选
FEISHU_VERIFICATION_TOKEN=     # 可选
```

#### 功能特性

- ✅ WebSocket 实时通信
- ✅ 消息去重（5分钟 TTL）
- ✅ 自动表情回复（GET → THUMBSUP）
- ✅ 批量消息处理
- ✅ 回复引用
- ✅ 卡片消息
- ✅ 私聊和群聊支持
- ✅ 会话隔离

#### 使用方式

启动服务后，飞书机器人会自动连接并接收消息。每个对话都有独立的会话历史。

### 4. 会话管理

#### 会话隔离

- **私聊**：`feishu:{userId}`（例如：`feishu:oc_xxxxxxxxxxxxx`）
- **群聊**：`feishu:{chatId}`（例如：`feishu:oc_xxxxxxxxxxxxx`）

每个会话都有独立的消息历史，存储在 `workspace/sessions/{key}.jsonl` 文件中。

#### 会话缓存（v2.0.0 新增）

SessionManager 使用 LRU 缓存：
- 默认最大缓存：500 个会话
- 默认 TTL：30 分钟
- 自动保存到磁盘

可通过环境变量 `MAX_SESSION_CACHE` 调整缓存大小。

#### 编程使用

```typescript
import { getSessionManager } from '@/session'

const sessionManager = getSessionManager()

// 获取或创建会话
const session = sessionManager.getOrCreate('feishu:oc_xxx')

// 添加消息
sessionManager.addMessage('feishu:oc_xxx', 'user', '你好')
sessionManager.addMessage('feishu:oc_xxx', 'assistant', '你好！有什么我可以帮助你的？')

// 获取消息历史
const history = sessionManager.getMessages('feishu:oc_xxx', 20)

// 获取指定时间戳后的消息
const recent = sessionManager.getMessagesSince('feishu:oc_xxx', Date.now() - 3600000)

// 获取最后消息的时间戳
const lastTimestamp = sessionManager.getLastTimestamp('feishu:oc_xxx')

// 保存会话
await sessionManager.save(session)

// 获取缓存统计
const stats = sessionManager.getCacheStats()
console.log(`Cache: ${stats.size}/${stats.maxSize} sessions`)

// 列出所有会话
const sessions = await sessionManager.listSessions()

// 清理过期会话（7天）
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)
```

### 5. 记忆管理

#### 存储策略

- **SQLite**：用于带标签的记忆和快速搜索
- **Markdown**：用于每日笔记和长期记忆

#### 编程使用

```typescript
import { getMemoryManager } from '@/memory'

const memoryManager = getMemoryManager()

// SQLite 存储 - 存储记忆
const id = await memoryManager.store(
  '用户询问了如何使用文件工具',
  ['feishu', 'message', 'user-question']
)

// SQLite - 内容搜索
const results = await memoryManager.search('文件工具')

// SQLite - 标签查询
const feishuMemories = await memoryManager.getByTag('feishu')

// SQLite - 最近记忆
const recent = await memoryManager.getRecent(10)

// SQLite - 最近 N 天的记忆
const recentDays = await memoryManager.getRecentMemories(7)

// Markdown - 每日笔记
await memoryManager.appendToday('用户询问了 TypeScript 相关问题')
const todayNotes = await memoryManager.readToday()

// Markdown - 长期记忆
await memoryManager.writeLongTerm('用户是一名开发者，擅长 TypeScript 和 Python')
const longTerm = await memoryManager.readLongTerm()

// Markdown - 获取记忆上下文
const context = await memoryManager.getMemoryContext()

// 关闭
await memoryManager.close()
```

#### 记忆文件位置

- SQLite 数据库：`workspace/db/memory.db`
- 每日笔记：`workspace/memory/YYYY-MM-DD.md`
- 长期记忆：`workspace/memory/MEMORY.md`

### 6. 工具系统

#### 可用工具

- **file**：文件操作（读、写、追加、删除、列表）
- **shell**：Shell 命令执行
- **web**：HTTP 请求
- **llm**：LLM API 调用
- **memory**：记忆操作

#### 安全特性（v2.0.0）

- **Shell 工具**：命令白名单验证、危险模式检测
- **File 工具**：路径遍历保护
- **Web 工具**：URL 验证、响应大小限制

#### 工具调用

Agent 会自动选择和调用工具。你也可以通过 LLM 提示词引导工具调用。

示例：
```
用户：帮我查看当前目录的文件
Agent：[调用 file.list 工具]
Agent：当前目录包含以下文件：...
```

## API 接口

### 健康检查

```bash
GET /health
```

### 聊天接口

```bash
POST /api/chat
```

请求体：
```json
{
  "message": "你好",
  "userId": "user123",
  "platform": "web",
  "history": []
}
```

### 流式聊天

```bash
GET /api/chat/stream?message=你好&userId=user123
```

### 记忆接口

```bash
GET /api/memory?query=关键词&limit=10
GET /api/memory?tag=feishu
POST /api/memory
DELETE /api/memory/:id
```

### 工具接口

```bash
GET /api/tools
POST /api/tools/:name
```

### 技能接口

```bash
GET /api/skills
GET /api/skills/:id
POST /api/skills
DELETE /api/skills/:id
```

### 插件接口

```bash
GET /api/plugins
GET /api/plugins/:id
POST /api/plugins/:id/config
POST /api/plugins/:id/enable
POST /api/plugins/:id/disable
```

## 开发指南

### 日志系统（v2.0.0）

使用 pino 结构化日志：

```typescript
import { createLogger } from '@/utils'

const logger = createLogger('MyModule')

logger.info('Processing message', { messageId: '123' })
logger.error('Error occurred', error, { context: 'data' })
logger.warn('Warning message', { detail: 'value' })
logger.debug('Debug info', { data })
```

日志输出：
- 开发模式：彩色控制台输出
- 生产模式：JSON 格式，文件输出

### 自定义错误

```typescript
import { ValidationError, ToolExecutionError } from '@/errors'

// 验证错误
throw new ValidationError('Invalid parameter', { param: 'userId' })

// 工具执行错误
throw new ToolExecutionError('Tool failed', { tool: 'shell', error: '...' })
```

### 添加新工具（v2.0.0）

工具现在继承 `ToolBase` 基类：

```typescript
import { ToolBase } from '@/tools/base'
import type { ToolResult, ToolExecutionContext } from '@/types'

interface MyToolParams {
  param1: string
  param2?: number
}

export class MyTool extends ToolBase<MyToolParams, string> {
  readonly name = 'mytool'
  readonly description = 'My custom tool'
  readonly parameters = {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter 1' },
      param2: { type: 'number', description: 'Parameter 2' }
    },
    required: ['param1']
  } as const

  protected async executeImpl(
    params: MyToolParams,
    context?: ToolExecutionContext
  ): Promise<string> {
    // 实现工具逻辑
    return `Result: ${params.param1}`
  }
}
```

注册工具：

```typescript
// src/tools/index.ts
import { ToolRegistry } from './registry'
import { MyTool } from './mytool'

export const toolRegistry = new ToolRegistry()
toolRegistry.register(new MyTool())

export const getTools = () => toolRegistry.getAll()
```

### 添加新命令

```typescript
// src/commands/default.ts
{
  name: 'mycommand',
  description: '我的自定义命令',
  usage: '/mycommand [参数]',
  handler: async (args, context) => {
    // 实现命令逻辑
    return '命令执行成功'
  }
}
```

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- session

# 查看覆盖率
npm run test:coverage
```

### 测试文件

- `tests/unit/session/manager.test.ts` - 会话管理测试
- `tests/unit/memory/manager.test.ts` - 记忆管理测试
- `tests/unit/commands/manager.test.ts` - 命令系统测试
- `tests/unit/utils/lru-cache.test.ts` - LRU 缓存测试
- `tests/unit/tools/shell.test.ts` - Shell 工具测试
- `tests/unit/tools/file.test.ts` - File 工具测试

## 部署

### Linux (systemd)

#### 自动安装

```bash
# 编译项目
npm run build

# 运行安装脚本
sudo ./scripts/install-service.sh
```

#### 手动安装

```bash
# 复制服务文件
sudo cp minibot.service /etc/systemd/system/
sudo systemctl daemon-reload

# 启用并启动服务
sudo systemctl enable minibot
sudo systemctl start minibot
```

#### 服务管理

```bash
# 启动服务
sudo systemctl start minibot

# 停止服务
sudo systemctl stop minibot

# 重启服务
sudo systemctl restart minibot

# 查看状态
sudo systemctl status minibot

# 查看日志
sudo journalctl -u minibot -f
```

### macOS (launchd)

#### 自动安装

```bash
# 编译项目
npm run build

# 运行安装脚本
sudo ./scripts/install-service-macos.sh
```

#### 手动安装

```bash
# 编辑 plist 文件，替换 YOUR_USERNAME
nano com.github.charlzyx.minibot.plist

# 复制到 LaunchDaemons
sudo cp com.github.charlzyx.minibot.plist /Library/LaunchDaemons/

# 加载并启动服务
sudo launchctl load /Library/LaunchDaemons/com.github.charlzyx.minibot.plist
```

#### 服务管理

```bash
# 启动服务
sudo launchctl load /Library/LaunchDaemons/com.github.charlzyx.minibot.plist

# 停止服务
sudo launchctl unload /Library/LaunchDaemons/com.github.charlzyx.minibot.plist

# 查看状态
launchctl list | grep minibot

# 查看日志
tail -f /opt/minibot/logs/minibot.log
```

### Docker 部署

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

## 故障排查

### 常见问题

#### 1. 飞书连接失败

检查 `.env` 配置：
```env
FEISHU_APP_ID=cli_xxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxx
```

确保飞书应用已启用 WebSocket 事件订阅。

#### 2. LLM 调用失败

检查 API Key 配置：
```env
ZHIPU_API_KEY=your_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4
```

检查网络连接和 API 配额。

#### 3. 会话不保存

检查 `workspace/sessions/` 目录权限：
```bash
chmod 755 workspace/sessions/
```

#### 4. 记忆不保存

检查 `workspace/memory/` 和 `workspace/db/` 目录权限：
```bash
chmod 755 workspace/memory/ workspace/db/
```

### 日志查看

```bash
# 开发模式实时日志
npm run dev

# 生产模式日志
tail -f workspace/logs/minibot.log

# Linux systemd 日志
sudo journalctl -u minibot -f

# macOS launchd 日志
log show --predicate 'process == "node"' --info
```

## 性能优化（v2.0.0）

### 1. LRU 缓存

- SessionManager 使用 LRU 缓存限制内存使用
- 可通过 `MAX_SESSION_CACHE` 环境变量调整

### 2. 消息历史限制

默认只保留最近 20 条消息，可在代码中调整：
```typescript
const history = sessionManager.getMessages(sessionId, 20)
```

### 3. 连接池

工具执行使用连接池提高并发性能。

## 安全建议（v2.0.0）

1. **环境变量**：不要将 `.env` 文件提交到版本控制
2. **API Key**：定期轮换 API Key
3. **工作区隔离**：启用工作区隔离限制文件访问
4. **命令验证**：Shell 工具已内置命令白名单验证
5. **输入过滤**：所有输入都经过验证
6. **容器隔离**：使用容器运行器隔离执行环境

## 更新日志

### v2.0.0

主要更新：
- 重构日志系统（pino 结构化日志）
- 添加 LRU 缓存支持
- 安全加固（命令白名单、路径保护）
- 自定义错误类体系
- 工具基类模式
- 完整的类型定义
- 开机启动支持（Linux/macOS）
- 优化测试覆盖

详见 [CHANGELOG.md](CHANGELOG.md)

## 扩展阅读

- [README.md](README.md) - 项目概述
- [CHANGELOG.md](CHANGELOG.md) - 更新日志
- [CONTRIBUTING.md](CONTRIBUTING.md) - 贡献指南

## 许可证

MIT

---

**如有问题，请查看相关文档或提交 Issue。**
