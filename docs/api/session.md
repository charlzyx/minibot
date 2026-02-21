# 会话管理

会话管理模块负责管理用户对话历史，支持多平台、多会话隔离。

## 核心功能

- JSONL 格式的会话存储
- 会话隔离（按平台和用户）
- 内存缓存
- 自动会话清理
- 消息历史限制

## 基本使用

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

// 保存会话
await sessionManager.save(session)

// 清理过期会话（7天）
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)
```

## 会话结构

```typescript
interface Session {
  id: string
  platform: string
  userId: string
  messages: Message[]
  metadata: SessionMetadata
  createdAt: number
  updatedAt: number
}

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

interface SessionMetadata {
  activeSkill?: string
  state?: Record<string, any>
}
```

## 会话隔离

- **私聊**: `{platform}:{userId}` (例如: `feishu:oc_xxx`)
- **群聊**: `{platform}:{chatId}` (例如: `feishu:oc_xxxxxxxxxxxxx`)

## API 参考

### getOrCreate(sessionId: string): Session

获取或创建会话。

### addMessage(sessionId: string, role: string, content: string): void

添加消息到会话。

### getMessages(sessionId: string, limit?: number): Message[]

获取会话消息历史。

### save(session: Session): Promise<void>

保存会话到文件。

### listSessions(): Promise<Session[]>

列出所有会话。

### cleanup(maxAge: number): Promise<void>

清理过期会话。

## 相关文档

- [Agent 模块](/api/agent)
- [记忆管理](/guide/memory)
