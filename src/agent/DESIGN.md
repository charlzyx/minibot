# Agent 模块设计说明

## 概述

Agent 模块是 Minibot 的核心智能体处理单元，负责接收用户消息、调用工具、生成回复。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  1. 接收用户消息                                │  │
│  │  2. 分析用户意图                                  │  │
│  │  3. 选择合适的工具                                │  │
│  │  4. 执行工具调用                                  │  │
│  │  5. 生成回复                                      │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  LLM    │        │  Tools  │        │ Memory  │
    └─────────┘        └─────────┘        └─────────┘
```

## 核心功能

### 1. 消息处理

Agent 接收来自不同渠道（飞书等）的用户消息，解析消息内容，提取关键信息。

### 2. 工具调用

Agent 根据用户意图选择合适的工具执行任务：
- 文件操作（读取、写入、编辑）
- Shell 命令执行
- Web 请求
- LLM 对话生成

### 3. 上下文管理

Agent 维护对话上下文，支持：
- 历史消息记录
- 会话状态管理
- 上下文传递

### 4. 回复生成

Agent 使用 LLM 生成自然语言回复，支持：
- 文本回复
- 卡片消息
- 多轮对话

## 数据流

```
用户消息 → Agent → 意图分析 → 工具选择 → 工具执行 → 结果处理 → LLM生成 → 回复
```

## 接口定义

```typescript
interface AgentContext {
  userMessage: string
  userId: string
  platform: string
  messageId?: string
  history?: Message[]
  metadata?: Record<string, any>
}

interface AgentResponse {
  content: string
  metadata?: Record<string, any>
}
```

## 使用示例

```typescript
import { Agent } from './agent'

const agent = new Agent()

const response = await agent.process({
  userMessage: '帮我读取文件 test.txt',
  userId: 'user123',
  platform: 'feishu',
  messageId: 'msg123',
  history: [],
  metadata: {}
})

console.log(response.content)
```

## 设计原则

1. **模块化**：每个功能独立，易于扩展
2. **可测试性**：支持单元测试和集成测试
3. **可扩展性**：支持添加新的工具和渠道
4. **错误处理**：完善的错误处理和重试机制

## 未来扩展

- 支持更多 LLM 提供商
- 添加更多工具类型
- 支持多轮对话状态管理
- 添加意图识别和分类
