# 工具系统

工具系统提供了可由 Agent 调用的各种操作工具。

## 内置工具

### file

文件操作工具。

```typescript
{
  name: 'file',
  operations: ['read', 'write', 'append', 'delete', 'list', 'edit']
}
```

### shell

Shell 命令执行工具。

```typescript
{
  name: 'shell',
  operations: ['execute'],
  options: {
    timeout: 30000,
    allowedCommands: ['ls', 'pwd', 'cat', ...]
  }
}
```

### web

HTTP 请求工具。

```typescript
{
  name: 'web',
  operations: ['get', 'post', 'put', 'delete']
}
```

### llm

LLM API 调用工具。

```typescript
{
  name: 'llm',
  operations: ['complete', 'chat']
}
```

### memory

记忆操作工具。

```typescript
{
  name: 'memory',
  operations: ['store', 'search', 'get_recent']
}
```

## 注册自定义工具

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
    },
    required: ['input']
  },
  async execute(params) {
    return { success: true, result: 'Done' }
  }
})
```

## 工具接口

```typescript
interface Tool {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, {
      type: string
      description: string
    }>
    required?: string[]
  }
  execute(params: any): Promise<ToolResult>
}

interface ToolResult {
  success: boolean
  result?: any
  error?: string
}
```

## 相关文档

- [Agent 模块](/api/agent)
- [代码助手](/guide/code-assistant)
