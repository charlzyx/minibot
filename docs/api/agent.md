# Agent 模块

Agent 是 Minibot 的核心模块，负责处理用户消息、调用工具并生成响应。

## 核心功能

- 消息处理和意图分析
- 工具选择和执行
- 上下文管理
- 响应生成

## 基本使用

```typescript
import { Agent } from '@/agent'

const agent = new Agent({
  provider: {
    name: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514'
  }
})

const response = await agent.process({
  platform: 'feishu',
  userId: 'oc_xxx',
  userMessage: '帮我查看当前目录的文件',
  sessionId: 'feishu:oc_xxx'
})

console.log(response.content)
```

## API 参考

### AgentOptions

```typescript
interface AgentOptions {
  provider: LLMProviderConfig
  tools?: Tool[]
  skills?: Skill[]
  systemPrompt?: string
}
```

### ProcessContext

```typescript
interface ProcessContext {
  platform: string
  userId: string
  userMessage: string
  sessionId: string
  metadata?: Record<string, any>
}
```

### AgentResponse

```typescript
interface AgentResponse {
  content: string
  toolCalls?: ToolCall[]
  metadata?: Record<string, any>
}
```

## 工具系统

Agent 可以调用各种工具来执行任务：

- `file` - 文件操作
- `shell` - Shell 命令执行
- `web` - HTTP 请求
- `llm` - LLM API 调用
- `memory` - 记忆操作

### 注册自定义工具

```typescript
import { getToolRegistry } from '@/tools'

const registry = getToolRegistry()

registry.register({
  name: 'my-tool',
  description: 'My custom tool',
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' }
    }
  },
  async execute(params) {
    return { success: true, result: 'Done' }
  }
})
```

## 技能系统

Agent 可以加载 Markdown 格式的技能文件：

```typescript
import { getSkillManager } from '@/skills'

const skillManager = getSkillManager()
const skills = skillManager.getEnabledSkills()

// Skills are automatically injected into the agent's system prompt
```

## 相关文档

- [工具系统](/api/tools)
- [会话管理](/api/session)
- [记忆管理](/guide/memory)
