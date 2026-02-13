# Agent 模块设计说明

## 概述

Agent 模块是 Minibot 的核心智能体处理单元，负责接收用户消息、调用工具、生成回复。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                      Agent                              │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  1. 接收用户消息                                │  │
│  │  2. 检查命令（/help, /reset等）                   │  │
│  │  3. 分析用户意图                                  │  │
│  │  4. 选择合适的工具                                │  │
│  │  5. 执行工具调用                                  │  │
│  │  6. 生成回复                                      │  │
│  │  7. 更新会话和记忆                                │  │
│  └─────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  LLM    │        │  Tools  │        │ Memory  │
    └─────────┘        └─────────┘        └─────────┘
         │                    │
         ▼                    ▼
    ┌─────────┐        ┌─────────┐
    │ Skills  │        │Commands │
    └─────────┘        └─────────┘
```

## 核心功能

### 1. 命令处理

Agent 在处理用户消息前，首先检查是否为命令（以 `/` 开头）。

**支持的命令**：
- `/help` - 显示可用命令列表
- `/reset` - 重置当前会话
- `/skills` - 列出所有可用的技能
- `/status` - 显示系统状态

**处理流程**：
1. 检查消息是否以 `/` 开头
2. 解析命令名称和参数
3. 调用对应的命令处理器
4. 返回命令执行结果
5. 如果是命令，直接返回，不进入 LLM 处理

### 2. 消息处理

Agent 接收来自不同渠道（飞书等）的用户消息，解析消息内容，提取关键信息。

### 3. 工具调用

Agent 根据用户意图选择合适的工具执行任务：
- 文件操作（读取、写入、编辑）
- Shell 命令执行
- Web 请求
- LLM 对话生成

### 4. 技能系统

Agent 自动加载技能并将技能内容注入到系统提示词中。

**技能注入流程**：
1. 启动时从 `$HOME/minibot/skills/` 加载所有 `.skill.md` 文件
2. 解析 YAML frontmatter 和技能内容
3. 在构建系统提示词时，将启用的技能格式化后追加到提示词末尾
4. LLM 根据用户需求自动选择合适的技能

**技能格式**：
```markdown
---
name: 技能名称
description: 技能描述
tags: [标签1, 标签2]
tools: [tool1, tool2]
enabled: true
---

技能说明内容...
```

### 5. 上下文管理

Agent 维护对话上下文，支持：
- 历史消息记录
- 会话状态管理
- 上下文传递

### 6. 回复生成

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
