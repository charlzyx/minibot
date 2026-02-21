# 命令系统

Minibot 提供了一组内置命令，可以通过 `/command` 语法调用。

## 内置命令

### /help

显示可用命令列表。

```
/help
```

### /reset

重置当前会话。

```
/reset
```

### /skills

列出所有可用的技能。

```
/skills
```

### /status

显示系统状态。

```
/status
```

### /monitor

显示详细监控信息。

```
/monitor
```

### /health

检查系统健康状态。

```
/health
```

### /code

启动代码助手并在容器中执行任务。

```
/code [任务描述]
```

示例：

```
/code 帮我重构这个文件
/code 添加单元测试
/code --project ./src 优化性能
```

### /mounts

显示挂载安全状态。

```
/mounts
```

### /skill-creator

创建自定义技能。

```
/skill-creator
```

## 注册自定义命令

```typescript
import { getCommandManager } from '@/commands'

const commandManager = getCommandManager()

commandManager.register({
  name: 'my-command',
  description: 'My custom command',
  usage: '/my-command [args]',
  handler: async (args, context) => {
    return `执行结果: ${args.join(' ')}`
  }
})
```

## 命令上下文

```typescript
interface CommandContext {
  platform: string
  userId: string
  sessionId: string
  metadata?: Record<string, any>
}
```

## 相关文档

- [Agent 模块](/api/agent)
- [快速开始](/guide/getting-started)
