# Tools 模块设计说明

## 概述

Tools 模块提供了一系列可由 Agent 调用的工具，用于执行各种操作，如文件操作、Shell 命令执行、Web 请求和 LLM 对话生成。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   Tools Registry                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  工具注册和管理                                   │  │
│  │  - 工具注册                                       │  │
│  │  - 工具查询                                       │  │
│  │  - 工具执行                                       │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  File    │        │  Shell   │        │   Web    │
    │  Tool    │        │  Tool    │        │  Tool    │
    └─────────┘        └─────────┘        └─────────┘
         │
         ▼
    ┌─────────┐
    │   LLM    │
    │  Tool    │
    └─────────┘
         │
         ▼
    ┌─────────┐
    │ Memory   │
    │  Tool    │
    └─────────┘
```

## 核心工具

### 1. File Tool

负责文件系统操作。

**功能**：
- 读取文件
- 写入文件
- 追加内容
- 列出目录
- 删除文件
- 编辑文件

**接口**：
```typescript
interface FileTool {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  append(path: string, content: string): Promise<void>
  list(path: string): Promise<string[]>
  delete(path: string): Promise<void>
  edit(path: string, oldContent: string, newContent: string): Promise<void>
}
```

**使用示例**：
```typescript
const fileTool = new FileTool()

// 读取文件
const content = await fileTool.read('test.txt')

// 写入文件
await fileTool.write('test.txt', 'Hello, World!')

// 追加内容
await fileTool.append('test.txt', '\nNew line')

// 列出目录
const files = await fileTool.list('./')

// 删除文件
await fileTool.delete('test.txt')

// 编辑文件
await fileTool.edit('test.txt', 'old text', 'new text')
```

### 2. Shell Tool

负责执行 Shell 命令。

**功能**：
- 执行 Shell 命令
- 传递参数
- 设置工作目录
- 环境变量配置
- 超时控制
- 输出捕获

**接口**：
```typescript
interface ShellTool {
  execute(command: string, args?: string[], options?: {
    cwd?: string
    env?: Record<string, string>
    timeout?: number
  }): Promise<{
    code: number
    stdout: string
    stderr: string
  }>
}
```

**使用示例**：
```typescript
const shellTool = new ShellTool()

// 执行命令
const result = await shellTool.execute('ls', ['-la'])

// 带工作目录
const result = await shellTool.execute('pwd', [], { cwd: '/tmp' })

// 带环境变量
const result = await shellTool.execute('echo', ['$VAR'], {
  env: { VAR: 'value' }
})

// 带超时
const result = await shellTool.execute('sleep', ['10'], { timeout: 5000 })
```

### 3. Web Tool

负责 HTTP 请求。

**功能**：
- GET/POST/PUT/DELETE 请求
- 请求头配置
- 请求体设置
- 响应解析
- 错误处理

**接口**：
```typescript
interface WebTool {
  request(url: string, options?: {
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
    headers?: Record<string, string>
    body?: any
    timeout?: number
  }): Promise<{
    status: number
    headers: Record<string, string>
    data: any
  }>
}
```

**使用示例**：
```typescript
const webTool = new WebTool()

// GET 请求
const result = await webTool.request('https://api.example.com/data')

// POST 请求
const result = await webTool.request('https://api.example.com/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: { name: 'test' }
})

// 带超时
const result = await webTool.request('https://api.example.com/slow', {
  timeout: 5000
})
```

### 4. Memory Tool

负责记忆管理，支持存储、搜索、获取和删除记忆。

**功能**：
- 存储记忆（带标签）
- 搜索记忆（内容匹配）
- 获取指定记忆
- 删除记忆
- 获取最近记忆

**接口**：
```typescript
interface MemoryTool {
  execute(params: {
    action: 'store' | 'search' | 'get' | 'delete' | 'recent'
    content?: string
    query?: string
    id?: number
    tags?: string[]
    limit?: number
  }): Promise<{
    success: boolean
    action: string
    data?: any
    error?: string
  }>
}
```

**使用示例**：
```typescript
const memoryTool = new MemoryTool()

// 存储记忆
const result = await memoryTool.execute({
  action: 'store',
  content: '用户喜欢编程和AI技术',
  tags: ['user', 'preference']
})

// 搜索记忆
const result = await memoryTool.execute({
  action: 'search',
  query: '编程',
  limit: 5
})

// 获取指定记忆
const result = await memoryTool.execute({
  action: 'get',
  id: 1
})

// 获取最近记忆
const result = await memoryTool.execute({
  action: 'recent',
  limit: 10
})

// 删除记忆
const result = await memoryTool.execute({
  action: 'delete',
  id: 1
})
```

### 5. LLM Tool

负责调用 LLM 生成对话。

**功能**：
- 调用 LLM API
- 支持多轮对话
- 模型配置
- 参数调整
- 工具调用支持

**接口**：
```typescript
interface LLMTool {
  execute(params: {
    provider?: string
    model?: string
    messages?: Array<{ role: string; content: string }>
    tools?: Array<{
      type: 'function'
      function: {
        name: string
        description: string
        parameters: Record<string, any>
      }
    }>
  }): Promise<{
    content: string
    model: string
    usage?: {
      input_tokens: number
      output_tokens: number
    }
    finish_reason?: string
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: {
        name: string
        arguments: string
      }
    }>
  }>
}
```

**使用示例**：
```typescript
const llmTool = new LLMTool()

// 单轮对话
const result = await llmTool.execute({
  model: 'glm-4.7',
  messages: [
    { role: 'user', content: '你好' }
  ]
})

// 多轮对话
const result = await llmTool.execute({
  model: 'glm-4.7',
  messages: [
    { role: 'user', content: '我叫小明' },
    { role: 'assistant', content: '你好小明！' },
    { role: 'user', content: '我叫什么名字？' }
  ]
})

// 带工具调用
const result = await llmTool.execute({
  model: 'glm-4.7',
  messages: [
    { role: 'user', content: '帮我查看当前目录的文件' }
  ],
  tools: [/* 工具定义 */]
})
```

## 工具注册

所有工具通过统一的注册机制管理：

```typescript
import { FileTool } from './file'
import { ShellTool } from './shell'
import { WebTool } from './web'
import { LLMTool } from './llm'
import { MemoryTool } from './memory'

export const tools = {
  file: new FileTool(),
  shell: new ShellTool(),
  web: new WebTool(),
  llm: new LLMTool(),
  memory: new MemoryTool()
}

export function getTool(name: string) {
  return tools[name]
}

export function getAllTools() {
  return tools
}
```

## 工具调用流程

```
Agent → 工具选择 → 工具注册表 → 工具执行 → 结果返回 → Agent
```

## 设计原则

1. **统一接口**：所有工具使用相同的调用方式
2. **错误处理**：完善的错误处理和重试机制
3. **可测试性**：支持单元测试和集成测试
4. **可扩展**：易于添加新的工具
5. **类型安全**：使用 TypeScript 接口定义

## 安全考虑

1. **文件操作**：
   - 限制访问路径
   - 验证文件权限
   - 防止路径遍历攻击

2. **Shell 执行**：
   - 白名单命令
   - 参数验证
   - 超时控制

3. **Web 请求**：
   - URL 验证
   - 请求大小限制
   - 超时控制

4. **LLM 调用**：
   - API Key 保护
   - 请求频率限制
   - 内容过滤

## 未来扩展

- 数据库工具
- 邮件工具
- 通知工具
- 图像处理工具
- 数据分析工具
- 更多 LLM 提供商支持
