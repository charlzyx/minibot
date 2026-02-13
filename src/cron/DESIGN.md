# Cron 模块设计说明

## 概述

Cron 模块是一个功能完整的定时任务调度系统，支持基于 cron 表达式的任务调度、Shell 脚本执行、工作区隔离、子代理架构等功能。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   Cron Scheduler                       │
│  ┌───────────────────────────────────────────────────┐  │
│  │  任务调度                                       │  │
│  │  - Cron 表达式解析                              │  │
│  │  - 任务队列管理                                  │  │
│  │  - 触发器管理                                    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │ Executor │        │Workspace │        │Subagent  │
    │  Shell   │        │ Isolation│        │ Manager  │
    └─────────┘        └─────────┘        └─────────┘
         │                    │                    │
         └────────────────────┴────────────────────┘
                              │
                              ▼
                       ┌─────────────┐
                       │Error Handler│
                       │  & Retry    │
                       └─────────────┘
```

## 核心模块

### 1. CronParser

负责解析和验证 cron 表达式。

**功能**：
- 支持 5 段和 6 段 cron 表达式
- 秒级精度
- 自动计算下次执行时间
- 实时检查是否应该执行

**示例**：
```typescript
const schedule = CronParser.parse('0 2 * * *')
const nextRun = CronParser.getNextRunTime(schedule)
const shouldRun = CronParser.shouldRunNow(schedule)
```

### 2. ShellExecutor

负责执行 Shell 命令和脚本。

**功能**：
- 支持任意 Shell 命令
- 标准输入输出重定向
- 错误捕获和日志记录
- 执行超时控制
- 自动重试机制

**示例**：
```typescript
const result = await ShellExecutor.execute({
  command: 'bash',
  args: ['script.sh'],
  cwd: './',
  env: { VAR: 'value' },
  timeout: 30000
})
```

### 3. WorkspaceManager

负责工作区隔离和资源管理。

**功能**：
- 文件系统隔离
- 权限控制（允许/拒绝命令）
- 资源限制（CPU、内存、进程数）
- 文件大小限制
- 工作区自动清理

**示例**：
```typescript
await workspaceManager.createWorkspace({
  id: 'my-workspace',
  maxFileSize: 1024 * 1024,
  allowedCommands: ['bash', 'ls'],
  resourceLimits: {
    maxCpu: 2,
    maxMemory: 2048
  }
})
```

### 4. SubagentManager

负责任务的分布式执行和负载均衡。

**功能**：
- 任务分布式执行
- 负载均衡
- 状态监控
- 心跳检测
- 任务分发和结果回传

**示例**：
```typescript
subagentManager.registerSubagent({
  id: 'subagent-1',
  name: 'Primary Subagent',
  capabilities: ['shell', 'file'],
  maxConcurrentTasks: 5
})

const taskId = subagentManager.submitTask({
  type: 'shell',
  payload: { command: 'bash', args: ['script.sh'] },
  priority: 100,
  timeout: 600000
})
```

### 5. ErrorHandler

负责错误处理和重试机制。

**功能**：
- 智能错误分类
- 自动重试机制
- 指数退避策略
- 熔断器模式
- 任务优先级管理

**示例**：
```typescript
const result = await ErrorHandler.executeWithRetry(
  async () => {
    // 执行操作
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2
  }
)
```

### 6. CronScheduler

核心调度器，整合所有模块。

**功能**：
- 任务管理（添加、更新、删除、启用、禁用）
- 自动调度执行
- 事件系统
- 统计信息

**示例**：
```typescript
const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true
})

await scheduler.start()

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

## Cron 表达式格式

支持标准的 5 段和 6 段 cron 表达式：

```
* * * * * *  (秒 分 时 日 月 周)
```

示例：
- `0 2 * * *` - 每天凌晨 2 点执行
- `*/5 * * * *` - 每 5 分钟执行一次
- `0 0 * * 0` - 每周日午夜执行
- `0 0 1 * *` - 每月 1 号午夜执行
- `0 9-17 * * 1-5` - 工作日 9 点到 17 点每小时执行
- `0 */30 * * * *` - 每 30 秒执行一次（6 段表达式）

## 事件系统

### CronScheduler 事件

- `scheduler:started` - 调度器启动
- `scheduler:running` - 调度器运行中
- `scheduler:stopped` - 调度器停止
- `job:added` - 任务添加
- `job:updated` - 任务更新
- `job:deleted` - 任务删除
- `job:started` - 任务开始执行
- `job:completed` - 任务完成
- `job:failed` - 任务失败

### SubagentManager 事件

- `subagent:registered` - 子代理注册
- `subagent:unregistered` - 子代理注销
- `subagent:online` - 子代理上线
- `subagent:offline` - 子代理离线
- `subagent:status:changed` - 子代理状态改变
- `task:submitted` - 任务提交
- `task:assigned` - 任务分配
- `task:completed` - 任务完成
- `task:failed` - 任务失败
- `system:load:balanced` - 系统负载均衡

## 设计原则

1. **模块化**：每个模块独立，易于测试和维护
2. **可扩展**：支持添加新的功能模块
3. **容错性**：完善的错误处理和重试机制
4. **可观测性**：丰富的事件系统和统计信息

## 使用场景

- 定时备份
- 日志清理
- 健康检查
- 数据同步
- 报告生成
- 定时任务调度

## 未来扩展

- 支持更多 cron 表达式变体
- 任务依赖管理
- 任务执行历史
- 任务执行日志
- Web UI 管理界面
- 分布式调度
