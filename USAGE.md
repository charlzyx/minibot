# Minibot 使用文档

## 目录结构

```
minibot/
├── src/                    # 源代码目录
│   ├── agent/              # Agent 核心逻辑
│   ├── channels/           # 消息通道（飞书、微信等）
│   ├── commands/           # 命令系统
│   ├── cron/               # 定时任务系统
│   ├── memory/             # 记忆管理
│   ├── session/            # 会话管理
│   ├── skills/             # 技能系统
│   ├── tools/              # 工具系统
│   ├── index.ts            # 主入口文件
│   └── cron-demo.ts       # 定时任务示例
├── test/                  # 单元测试
├── tests/                 # 集成测试
├── $HOME/minibot/         # 工作目录（运行时生成）
│   ├── sessions/           # 会话存储
│   ├── memory/             # 记忆存储（Markdown）
│   ├── db/                # SQLite 数据库
│   ├── skills/             # 技能文件
│   ├── workspaces/         # 任务工作区
│   └── minibot.config.ts  # 配置文件
├── .env.example          # 环境变量模板
├── package.json          # 项目配置
├── tsconfig.json        # TypeScript 配置
├── README.md            # 项目说明
├── CRON_README.md      # 定时任务文档
└── CRON_DEPLOYMENT.md  # 定时任务部署指南
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
PORT=18790
```

### 3. 启动服务

```bash
# 开发模式（使用默认工作区 $HOME/minibot）
npm run dev

# 开发模式（使用自定义工作区）
npm run dev -- --workspace=/path/to/workspace

# 生产模式
npm run build
npm start

# 生产模式（使用自定义工作区）
npm start -- --workspace=/path/to/workspace
```

### 4. 测试连接

访问健康检查接口：
```bash
curl http://localhost:18790/health
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
```

```
用户：/reset
机器人：✅ 会话已重置
```

```
用户：/skills
机器人：🎯 可用技能

**Weather Assistant**
  帮助用户查询天气信息，提供天气预报和建议
  标签: weather, information, daily

**Code Reviewer**
  帮助用户进行代码审查，提供改进建议和最佳实践
  标签: code, review, development
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

在 `$HOME/minibot/skills/` 目录下创建 `.skill.md` 文件：

```bash
# 创建技能文件
nano $HOME/minibot/skills/my-skill.skill.md
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

#### 技能自动加载

启动 Minibot 时会自动加载 `$HOME/minibot/skills/` 目录下的所有技能文件。

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
- ✅ 消息去重
- ✅ 自动表情回复（👍）
- ✅ 回复引用
- ✅ 卡片消息
- ✅ 私聊和群聊支持
- ✅ 会话隔离

#### 使用方式

启动服务后，飞书机器人会自动连接并接收消息。每个对话都有独立的会话历史。

### 2. 会话管理

#### 会话隔离

- **私聊**：`feishu:{userId}`（例如：`feishu:oc_xxxxxxxxxxxxx`）
- **群聊**：`feishu:{chatId}`（例如：`feishu:oc_xxxxxxxxxxxxx`）

每个会话都有独立的消息历史，存储在 `sessions/{key}.jsonl` 文件中。

#### 编程使用

```typescript
import { getSessionManager } from './src/session'

const sessionManager = getSessionManager()

// 获取或创建会话
const session = sessionManager.getOrCreate('feishu:oc_xxx')

// 添加消息
sessionManager.addMessage('feishu:oc_xxx', 'user', '你好')
sessionManager.addMessage('feishu:oc_xxx', 'assistant', '你好！有什么我可以帮助你的？')

// 获取消息历史
const history = sessionManager.getMessages('feishu:oc_xxx', 20)

// 保存会话
await sessionManager.save(session)

// 列出所有会话
const sessions = await sessionManager.listSessions()

// 清理过期会话（7天）
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)
```

### 3. 记忆管理

#### 存储策略

- **SQLite**：用于带标签的记忆和快速搜索
- **Markdown**：用于每日笔记和长期记忆

#### 编程使用

```typescript
import { getMemoryManager } from './src/memory'

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

- SQLite 数据库：`db/memory.db`
- 每日笔记：`memory/YYYY-MM-DD.md`
- 长期记忆：`memory/MEMORY.md`

### 4. 工具系统

#### 可用工具

- **file**：文件操作（读、写、追加、删除、列表）
- **shell**：Shell 命令执行
- **web**：HTTP 请求
- **llm**：LLM API 调用
- **memory**：记忆操作

#### 工具调用

Agent 会自动选择和调用工具。你也可以通过 LLM 提示词引导工具调用。

示例：
```
用户：帮我查看当前目录的文件
Agent：[调用 file.list 工具]
Agent：当前目录包含以下文件：...
```

### 5. 定时任务

#### 快速开始

```typescript
import { CronScheduler, ErrorHandler } from './src/cron'

const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true
})

await scheduler.start()

// 添加定时任务
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

#### Cron 表达式

- `0 2 * * *` - 每天凌晨 2 点
- `*/5 * * * *` - 每 5 分钟
- `0 0 * * 0` - 每周日凌晨
- `0 0 1 * *` - 每月 1 号凌晨
- `0 9-17 * * 1-5` - 工作日 9-17 点每小时
- `0 */30 * * * *` - 每 30 秒（6 段式）

#### 运行示例

```bash
# 构建项目
npm run build

# 运行定时任务示例
node dist/cron-demo.js
```

详细文档：[CRON_README.md](CRON_README.md) | [CRON_DEPLOYMENT.md](CRON_DEPLOYMENT.md)

## API 接口

### 健康检查

```bash
GET /health
```

响应：
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2026-02-13T00:00:00.000Z"
}
```

### 配置接口

```bash
GET /api/config
```

获取当前配置信息。

## 开发指南

### 项目结构说明

#### src/agent/
- **index.ts**：Agent 核心实现
- **DESIGN.md**：Agent 设计文档

#### src/channels/
- **feishu.ts**：飞书 WebSocket 实现
- **DESIGN.md**：通道设计文档

#### src/cron/
- **parser.ts**：Cron 表达式解析器
- **executor.ts**：Shell 脚本执行器
- **workspace.ts**：工作区隔离系统
- **subagent.ts**：子代理管理器
- **error-handler.ts**：错误处理和重试
- **scheduler.ts**：定时任务调度器
- **config.ts**：配置示例
- **DESIGN.md**：定时任务设计文档

#### src/memory/
- **manager.ts**：记忆管理器实现
- **DESIGN.md**：记忆管理设计文档

#### src/session/
- **manager.ts**：会话管理器实现
- **DESIGN.md**：会话管理设计文档

#### src/tools/
- **file.ts**：文件工具
- **shell.ts**：Shell 工具
- **web.ts**：Web 工具
- **llm.ts**：LLM 工具
- **memory.ts**：记忆工具
- **index.ts**：工具注册表
- **DESIGN.md**：工具系统设计文档

### 添加新工具

1. 在 `src/tools/` 创建工具文件
2. 实现工具接口
3. 在 `src/tools/index.ts` 注册工具
4. 更新 `src/tools/DESIGN.md`

示例：
```typescript
// src/tools/mytool.ts
export const myTool = {
  name: 'mytool',
  description: 'My custom tool',
  parameters: {
    type: 'object',
    properties: {
      param1: { type: 'string', description: 'Parameter 1' }
    },
    required: ['param1']
  },
  async execute(params: any) {
    // 实现工具逻辑
    return { success: true, result: 'Done' }
  }
}
```

### 添加新通道

1. 在 `src/channels/` 创建通道文件
2. 实现消息接收和发送逻辑
3. 在 `src/index.ts` 集成通道
4. 更新 `src/channels/DESIGN.md`

## 测试

### 运行测试

```bash
# 运行所有测试
npm test

# 运行集成测试
node tests/test.js
```

### 测试文件

- `test/session.test.ts`：会话管理测试
- `test/memory.test.ts`：记忆管理测试
- `test/config.test.ts`：配置管理测试
- `test/feishu.test.ts`：飞书通道测试
- `test/server.test.ts`：服务器测试
- `tests/test.js`：集成测试

## 部署

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 18790
CMD ["npm", "start"]
```

### 系统服务

创建 systemd 服务文件 `/etc/systemd/system/minibot.service`：

```ini
[Unit]
Description=Minibot AI Assistant
After=network.target

[Service]
Type=simple
User=bot
WorkingDirectory=/opt/minibot
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node /opt/minibot/dist/index.js
Restart=always

[Install]
WantedBy=multi-user.target
```

启动服务：
```bash
sudo systemctl enable minibot
sudo systemctl start minibot
sudo systemctl status minibot
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

检查 `sessions/` 目录权限：
```bash
chmod 755 sessions/
```

#### 4. 记忆不保存

检查 `memory/` 和 `db/` 目录权限：
```bash
chmod 755 memory/ db/
```

### 日志查看

```bash
# 查看实时日志
npm run dev

# 查看系统服务日志
sudo journalctl -u minibot -f
```

## 性能优化

### 1. 会话缓存

SessionManager 使用内存缓存，频繁访问的会话会保持在内存中。

### 2. 消息历史限制

默认只保留最近 20 条消息，可在代码中调整：
```typescript
const history = sessionManager.getMessages(sessionId, 20)
```

### 3. 定时任务优化

- 使用子代理分布式执行
- 合理设置任务优先级
- 配置适当的超时时间

## 安全建议

1. **环境变量**：不要将 `.env` 文件提交到版本控制
2. **API Key**：定期轮换 API Key
3. **工作区隔离**：启用工作区隔离限制文件访问
4. **命令验证**：验证 Shell 命令的安全性
5. **输入过滤**：过滤恶意输入

## 扩展阅读

- [README.md](README.md) - 项目概述
- [Agent Design](src/agent/DESIGN.md) - Agent 架构
- [Channels Design](src/channels/DESIGN.md) - 通道设计
- [Tools Design](src/tools/DESIGN.md) - 工具系统
- [Memory Design](src/memory/DESIGN.md) - 记忆管理
- [Session Design](src/session/DESIGN.md) - 会话管理
- [Cron Design](src/cron/DESIGN.md) - 定时任务
- [Cron README](CRON_README.md) - 定时任务使用指南
- [Cron Deployment](CRON_DEPLOYMENT.md) - 定时任务部署

## 贡献

欢迎贡献！请遵循以下步骤：

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

## 许可证

MIT

---

**如有问题，请查看相关文档或提交 Issue。**
