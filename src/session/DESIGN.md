# Session 模块设计说明

## 概述

Session 模块提供会话历史管理功能，支持会话隔离和持久化存储。它遵循 nanobot 的设计原则，使用 JSONL 文件存储会话数据，并通过内存缓存提高性能。

## 架构设计

```
┌────────────────────────────────────────────────┐
│              Session Manager                  │
│         (单例模式)                             │
└────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌─────────┐           ┌─────────┐
    │  缓存   │           │  存储   │
    │ (Map)   │           │ (JSONL) │
    └─────────┘           └─────────┘
```

## 核心组件

### 1. SessionManager

会话管理器的主类，负责管理所有会话。

**职责**：
- 会话创建和获取
- 消息历史管理
- 会话持久化
- 缓存管理
- 会话清理

**核心方法**：
- `getOrCreate(key: string): Session` - 根据 key 获取或创建会话
- `addMessage(key: string, role: string, content: string)` - 向会话添加消息
- `getMessages(key: string, maxMessages?: number): ChatMessage[]` - 获取消息历史
- `save(session: Session)` - 将会话保存到磁盘
- `clear(key: string)` - 清空会话消息
- `unload(key: string)` - 从缓存中卸载会话
- `getAllSessions(): Session[]` - 获取所有缓存的会话
- `delete(key: string)` - 删除会话
- `listSessions()` - 列出所有会话
- `cleanup(maxAge: number)` - 清理过期会话

### 2. Session

表示单个对话会话。

**属性**：
```typescript
interface Session {
  key: string              // 唯一会话标识符
  messages: SessionMessage[]  // 消息历史
  created_at: number          // 创建时间戳
  updated_at: number          // 最后更新时间戳
  metadata: Record<string, any> // 会话元数据
  activeSkill?: string       // 活跃技能
}
```

### 3. SessionMessage

表示会话中的单条消息。

**属性**：
```typescript
interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}
```

### 4. ChatMessage

用于 LLM 上下文的过滤消息类型（排除系统消息）。

**属性**：
```typescript
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

## 会话键格式

会话通过包含平台和聊天信息的键进行标识：

### 私聊
```
{platform}:{userId}
```
示例：`feishu:oc_xxxxxxxxxxxxx`

### 群聊
```
{platform}:{chatId}
```
示例：`feishu:oc_xxxxxxxxxxxxx`

这样确保：
- 每个对话都有自己的上下文
- 群聊与会话隔离
- 多个平台可以共存

## 存储格式

### JSONL 结构

每个会话存储为一个 JSONL 文件：
```
sessions/{key}.jsonl
```

每行包含：
```json
{"type":"metadata","data":{"created_at":1234567890,"updated_at":1234567890}}
{"type":"message","data":{"role":"user","content":"Hello","timestamp":1234567890}}
{"type":"message","data":{"role":"assistant","content":"Hi there!","timestamp":1234567891}}
```

### JSONL 的优势

- **追加写入**：易于添加新消息
- **基于行**：解析和读取简单
- **人类可读**：易于手动检查
- **高效**：只读取需要的内容

## 缓存策略

### 缓存实现

```typescript
private cache: Map<string, Session>
```

### 缓存行为

1. **首次访问**：从磁盘加载并缓存
2. **后续访问**：从缓存返回
3. **更新**：更新缓存并标记为待保存
4. **持久化**：在显式调用 `save()` 时保存

### 缓存优势

- **性能**：避免频繁访问磁盘
- **一致性**：内存中单一数据源
- **简单性**：无需复杂的缓存失效机制

## 消息历史管理

### 消息获取

```typescript
getMessages(key: string, maxMessages: number = 20): ChatMessage[]
```

- 获取最后 N 条消息
- 过滤系统消息
- 按时间顺序返回

### 消息添加

```typescript
addMessage(key: string, role: string, content: string): void
```

- 向会话追加消息
- 更新时间戳
- 标记会话为已修改

## 会话生命周期

### 创建

```typescript
const session = sessionManager.getOrCreate('feishu:oc_xxx')
```

- 首先检查缓存
- 如果未缓存，从磁盘加载
- 如果不存在，创建新会话

### 使用

```typescript
sessionManager.addMessage('feishu:oc_xxx', 'user', 'Hello')
const history = sessionManager.getMessages('feishu:oc_xxx', 20)
```

- 在对话过程中添加消息
- 检索历史记录作为上下文

### 持久化

```typescript
await sessionManager.save(session)
```

- 写入 JSONL 文件
- 更新元数据时间戳

### 清理

```typescript
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)
```

- 删除超过 maxAge 的会话
- 释放磁盘空间
- 清理缓存条目

## 与 Agent 集成

### 会话上下文

Agent 使用会话历史提供上下文：

```typescript
const sessionId = chatType === 'group' ? `feishu:${chatId}` : `feishu:${userId}`
const history = sessionManager.getMessages(sessionId, 20)

const response = await agent.process({
  userMessage: content,
  userId,
  platform: 'feishu',
  messageId,
  sessionId,
  history,
  metadata: { chatId, chatType }
})
```

### 消息保存

处理完成后，保存消息到会话：

```typescript
sessionManager.addMessage(sessionId, 'user', context.userMessage)
sessionManager.addMessage(sessionId, 'assistant', finalContent)
await sessionManager.save(sessionManager.getOrCreate(sessionId))
```

## 性能考虑

### 优化策略

1. **内存缓存**：活动会话快速访问
2. **懒加载**：按需加载会话
3. **消息限制**：限制历史大小（默认 20）
4. **异步持久化**：非阻塞保存
5. **定期清理**：移除旧会话

### 内存使用

- **缓存大小**：与活动会话数量成正比
- **消息限制**：可配置（默认 20）
- **清理**：基于年龄自动清理

## 安全考虑

### 会话隔离

- 每个会话通过键隔离
- 无跨会话数据访问
- 基于平台分离

### 数据隐私

- 消息本地存储
- 无外部传输
- 用户控制清理

## 与 nanobot 对比

| 特性 | nanobot | minibot |
|---------|----------|----------|
| 存储 | JSONL 文件 | JSONL 文件 + 缓存 |
| 会话键 | 自定义 | Platform:ChatId |
| 消息限制 | 可配置 | 可配置（20） |
| 清理 | 手动 | 自动 |
| 类型安全 | 动态 | 静态（TS） |

## 未来扩展

### 计划功能

1. **压缩**：压缩旧消息
2. **摘要**：总结长对话
3. **搜索**：跨会话搜索
4. **分析**：会话统计和洞察
5. **导出**：导出会话到各种格式

### 潜在改进

1. **数据库后端**：可选 SQLite 后端
2. **分布式存储**：支持云存储
3. **加密**：加密敏感会话
4. **备份**：自动备份系统

## 使用示例

### 基本用法

```typescript
import { getSessionManager } from './session'

const sessionManager = getSessionManager()

// 获取或创建会话
const session = sessionManager.getOrCreate('feishu:oc_xxx')

// 添加消息
sessionManager.addMessage('feishu:oc_xxx', 'user', 'Hello')
sessionManager.addMessage('feishu:oc_xxx', 'assistant', 'Hi!')

// 获取历史
const history = sessionManager.getMessages('feishu:oc_xxx', 20)

// 保存
await sessionManager.save(session)
```

### 高级用法

```typescript
// 列出所有会话
const sessions = await sessionManager.listSessions()
console.log(`总会话数: ${sessions.length}`)

// 清理旧会话
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)

// 清空特定会话
sessionManager.clear('feishu:oc_xxx')

// 删除会话
await sessionManager.delete('feishu:oc_xxx')
```

## 测试

### 测试场景

1. **会话创建**：验证新会话创建
2. **消息添加**：测试消息添加和检索
3. **持久化**：验证会话在重启后保持
4. **缓存**：测试缓存行为
5. **清理**：验证旧会话被移除

### 测试命令

```bash
npm run test:session
```

## 结论

Session 模块提供了一个健壮、高效、类型安全的会话历史管理解决方案。它结合了 JSONL 存储的简单性和内存缓存的性能优势，遵循 nanobot 经过验证的设计模式，同时添加了 TypeScript 类型安全和现代架构。
