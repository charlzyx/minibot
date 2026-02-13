# Commands 模块设计说明

## 概述

Commands 模块提供命令系统，允许用户通过斜杠命令（`/command`）快速执行特定操作，无需通过 LLM 处理。

## 架构设计

```
┌─────────────────────────────────────────────────────┐
│              CommandManager                       │
│  ┌─────────────────────────────────────────────┐  │
│  │  命令注册表 (Map<name, Command>)      │  │
│  └─────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────┐  │
│  │  命令执行器                               │  │
│  │  - 解析命令                               │  │
│  │  - 调用处理器                              │  │
│  │  - 返回结果                               │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         │
         ▼
    ┌─────────────────────────────────────────┐
    │         Default Commands              │
    │  ┌───────────────────────────────┐   │
    │  │ /help    - 显示帮助          │   │
    │  │ /reset   - 重置会话          │   │
    │  │ /skills  - 列出技能          │   │
    │  │ /status  - 系统状态          │   │
    │  └───────────────────────────────┘   │
    └─────────────────────────────────────────┘
```

## 数据结构

### Command

```typescript
interface Command {
  name: string                                      // 命令名称（不带斜杠）
  description: string                               // 命令描述
  usage: string                                     // 使用说明
  handler: (args: string[], context: any) => Promise<string>  // 命令处理器
}
```

### CommandContext

```typescript
interface CommandContext {
  userId: string          // 用户ID
  platform: string        // 平台（feishu, web等）
  sessionId: string       // 会话ID
  metadata: any         // 额外元数据
}
```

## 核心功能

### 1. 命令注册

```typescript
commandManager.register({
  name: 'mycommand',
  description: '我的命令',
  usage: '/mycommand [args]',
  handler: async (args, context) => {
    return '命令执行结果'
  }
})
```

### 2. 批量注册

```typescript
commandManager.registerMany([
  command1,
  command2,
  command3
])
```

### 3. 命令执行

```typescript
const result = await commandManager.execute('/mycommand arg1 arg2', context)

// 如果不是命令，返回 null
if (result === null) {
  // 正常处理为用户消息
} else {
  // 返回命令执行结果
}
```

### 4. 命令解析

- 以 `/` 开头的消息被视为命令
- 第一个 `/` 后的单词为命令名称
- 剩余部分为参数（按空格分割）

示例：
```
/help              -> name: 'help', args: []
/reset             -> name: 'reset', args: []
/skills            -> name: 'skills', args: []
/mycommand arg1 arg2 -> name: 'mycommand', args: ['arg1', 'arg2']
```

### 5. 帮助生成

```typescript
const helpText = commandManager.getHelpText()

// 输出：
// 📋 可用命令
//
// **/help** - 显示可用命令列表
//   用法: /help
//
// **/reset** - 重置当前会话
//   用法: /reset
// ...
```

## 默认命令

### /help

**描述**：显示可用命令列表

**用法**：`/help`

**实现**：
```typescript
{
  name: 'help',
  description: '显示可用命令列表',
  usage: '/help',
  handler: async (args, context) => {
    return commandManager.getHelpText()
  }
}
```

### /reset

**描述**：重置当前会话

**用法**：`/reset`

**实现**：
```typescript
{
  name: 'reset',
  description: '重置当前会话',
  usage: '/reset',
  handler: async (args, context) => {
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    
    sessionManager.unload(sessionId)
    
    return '✅ 会话已重置'
  }
}
```

### /skills

**描述**：列出所有可用的技能

**用法**：`/skills`

**实现**：
```typescript
{
  name: 'skills',
  description: '列出所有可用的技能',
  usage: '/skills',
  handler: async (args, context) => {
    const skillManager = getSkillManager()
    const skills = skillManager.getEnabledSkills()
    
    if (skills.length === 0) {
      return '📭 当前没有可用的技能'
    }
    
    let output = '🎯 可用技能\n\n'
    
    for (const skill of skills) {
      output += `**${skill.metadata.name}**\n`
      if (skill.metadata.description) {
        output += `  ${skill.metadata.description}\n`
      }
      if (skill.metadata.tags && skill.metadata.tags.length > 0) {
        output += `  标签: ${skill.metadata.tags.join(', ')}\n`
      }
      output += '\n'
    }
    
    return output
  }
}
```

### /status

**描述**：显示系统状态

**用法**：`/status`

**实现**：
```typescript
{
  name: 'status',
  description: '显示系统状态',
  usage: '/status',
  handler: async (args, context) => {
    const skillManager = getSkillManager()
    const sessionManager = getSessionManager()
    
    const skills = skillManager.getEnabledSkills()
    const sessions = sessionManager.getAllSessions()
    
    let status = '📊 系统状态\n\n'
    status += `**技能数量**: ${skills.length}\n`
    status += `**会话数量**: ${sessions.length}\n`
    status += `**平台**: ${context.platform}\n`
    status += `**用户ID**: ${context.userId}\n`
    
    return status
  }
}
```

## 集成流程

### Agent 集成

```typescript
async process(context: AgentContext): Promise<string> {
  // 1. 检查是否为命令
  const commandManager = getCommandManager()
  const commandResult = await commandManager.execute(context.userMessage, context)
  
  if (commandResult !== null) {
    // 2. 如果是命令，执行并返回
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    
    sessionManager.addMessage(sessionId, 'user', context.userMessage)
    sessionManager.addMessage(sessionId, 'assistant', commandResult)
    await sessionManager.save(sessionManager.getOrCreate(sessionId))
    
    return commandResult
  }
  
  // 3. 如果不是命令，正常处理
  // ... LLM 处理流程
}
```

## 扩展性

### 添加新命令

1. 在 `src/commands/` 创建新的命令文件
2. 定义命令对象
3. 在 `src/commands/default.ts` 中添加到默认命令列表
4. 或在应用启动时手动注册

示例：
```typescript
// src/commands/custom.ts
export const customCommands: Command[] = [
  {
    name: 'weather',
    description: '查询天气',
    usage: '/weather <city>',
    handler: async (args, context) => {
      const city = args[0] || '北京'
      // 查询天气逻辑
      return `🌤️ ${city}的天气...`
    }
  }
]

// 在 index.ts 中注册
import { customCommands } from './commands/custom'
commandManager.registerMany(customCommands)
```

### 动态命令注册

```typescript
// 运行时动态注册命令
commandManager.register({
  name: 'dynamic',
  description: '动态注册的命令',
  usage: '/dynamic',
  handler: async (args, context) => {
    return '这是一个动态注册的命令'
  }
})
```

## 错误处理

### 命令不存在

```typescript
const commandManager = getCommandManager()
const result = await commandManager.execute('/unknown', context)

// 返回：未知命令: /unknown\n使用 /help 查看可用命令
```

### 命令执行错误

```typescript
// 命令处理器抛出异常时，自动捕获并返回错误信息
{
  name: 'error',
  description: '会出错的命令',
  usage: '/error',
  handler: async (args, context) => {
    throw new Error('模拟错误')
  }
}

// 返回：执行命令 /error 时出错: 模拟错误
```

## 最佳实践

### 1. 命令命名

- 使用小写字母
- 使用简短、描述性的名称
- 避免使用特殊字符

### 2. 命令描述

- 清晰说明命令的作用
- 保持简洁
- 使用用户友好的语言

### 3. 使用说明

- 提供完整的用法示例
- 说明参数的含义
- 标注可选参数

### 4. 错误处理

- 在命令处理器中捕获异常
- 提供友好的错误信息
- 记录错误日志

### 5. 上下文使用

- 使用 context 中的信息（userId, sessionId等）
- 遵循会话隔离原则
- 不要跨会话共享状态

## 性能考虑

1. **命令执行速度**：命令应该快速执行，避免长时间阻塞
2. **资源使用**：避免在命令中执行大量计算或IO操作
3. **并发安全**：确保命令处理器是线程安全的

## 安全考虑

1. **权限验证**：某些命令可能需要权限验证
2. **参数验证**：验证用户输入的参数
3. **命令隔离**：确保命令不会影响其他会话
4. **敏感操作**：敏感操作（如删除）需要二次确认

## 未来增强

1. **命令权限**：支持基于用户或角色的命令权限控制
2. **命令别名**：支持命令别名
3. **命令历史**：记录命令执行历史
4. **命令分组**：将命令按功能分组
5. **交互式命令**：支持多步骤交互式命令
6. **命令补全**：支持命令自动补全
