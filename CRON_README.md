# 定时任务系统

一个功能完整的定时任务调度系统，支持基于cron表达式的任务调度、Shell脚本执行、工作区隔离、子代理架构、错误处理和重试机制。

## 功能特性

### 1. Cron表达式解析器
- 支持标准的5段和6段cron表达式
- 秒级精度的定时执行
- 自动计算下次执行时间
- 实时检查是否应该执行

### 2. Shell脚本执行器
- 支持任意Shell命令执行
- 标准输入输出重定向
- 错误捕获和日志记录
- 执行超时控制
- 自动重试机制

### 3. 工作区隔离系统
- 文件系统隔离
- 权限控制（允许/拒绝命令）
- 资源限制（CPU、内存、进程数）
- 文件大小限制
- 工作区自动清理

### 4. 子代理系统
- 任务分布式执行
- 负载均衡
- 状态监控
- 心跳检测
- 任务分发和结果回传

### 5. 错误处理和重试
- 智能错误分类
- 自动重试机制
- 指数退避策略
- 熔断器模式
- 任务优先级管理

## 项目结构

```
src/cron/
├── parser.ts           # Cron表达式解析器
├── executor.ts         # Shell脚本执行器
├── workspace.ts        # 工作区隔离系统
├── subagent.ts         # 子代理系统
├── error-handler.ts    # 错误处理和重试
├── scheduler.ts        # 定时任务调度器
└── config.ts          # 配置示例
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 基本使用

```typescript
import { CronScheduler } from './src/cron/scheduler'
import { ErrorHandler } from './src/cron/error-handler'

// 创建调度器
const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true
})

// 启动调度器
await scheduler.start()

// 添加任务
await scheduler.addJob({
  name: 'Daily Backup',
  cronExpression: '0 2 * * *',
  command: 'bash',
  args: ['scripts/backup.sh'],
  cwd: './',
  env: {
    BACKUP_DIR: './backups'
  },
  enabled: true,
  priority: ErrorHandler.getPriority('high'),
  timeout: 600000,
  maxRetries: 3
})

// 监听事件
scheduler.on('job:completed', (job, result) => {
  console.log(`Job completed: ${job.name}`)
})
```

### 运行示例

```bash
npm run build
node dist/cron-demo.js
```

## Cron表达式格式

支持标准的5段和6段cron表达式：

```
* * * * * *  (秒 分 时 日 月 周)
```

示例：
- `0 2 * * *` - 每天凌晨2点执行
- `*/5 * * * *` - 每5分钟执行一次
- `0 0 * * 0` - 每周日午夜执行
- `0 0 1 * *` - 每月1号午夜执行
- `0 9-17 * * 1-5` - 工作日9点到17点每小时执行
- `0 */30 * * * *` - 每30秒执行一次（6段表达式）

## API文档

### CronParser

```typescript
import { CronParser } from './src/cron/parser'

// 解析cron表达式
const schedule = CronParser.parse('0 2 * * *')

// 获取下次执行时间
const nextRun = CronParser.getNextRunTime(schedule)

// 检查是否应该现在执行
const shouldRun = CronParser.shouldRunNow(schedule)
```

### ShellExecutor

```typescript
import { ShellExecutor } from './src/cron/executor'

// 执行命令
const result = await ShellExecutor.execute({
  command: 'bash',
  args: ['script.sh'],
  cwd: './',
  env: { VAR: 'value' },
  timeout: 30000,
  redirectStdout: 'output.log',
  redirectStderr: 'error.log'
})

// 执行脚本
const result = await ShellExecutor.executeScript('script.sh', {
  cwd: './',
  env: { VAR: 'value' }
})

// 带重试的执行
const result = await ShellExecutor.executeWithRetry(config, 3, 1000)
```

### WorkspaceManager

```typescript
import { WorkspaceManager } from './src/cron/workspace'

// 创建工作区管理器
const workspaceManager = new WorkspaceManager('./workspaces')

// 创建工作区
const workspace = await workspaceManager.createWorkspace({
  id: 'my-workspace',
  maxFileSize: 1024 * 1024 * 1024,
  maxTotalSize: 10 * 1024 * 1024 * 1024,
  allowedCommands: ['bash', 'ls'],
  deniedCommands: ['rm'],
  resourceLimits: {
    maxCpu: 2,
    maxMemory: 2048,
    maxProcesses: 10
  }
})

// 在工作区中执行任务
const result = await workspaceManager.executeInWorkspace(
  'my-workspace',
  async (workspacePath) => {
    // 执行任务
  }
)

// 列出所有工作区
const workspaces = await workspaceManager.listWorkspaces()

// 删除工作区
await workspaceManager.deleteWorkspace('my-workspace')
```

### SubagentManager

```typescript
import { SubagentManager } from './src/cron/subagent'

// 创建子代理管理器
const subagentManager = new SubagentManager()

// 注册子代理
subagentManager.registerSubagent({
  id: 'subagent-1',
  name: 'Primary Subagent',
  capabilities: ['shell', 'file', 'web'],
  maxConcurrentTasks: 5,
  priority: 100
})

// 提交任务
const taskId = subagentManager.submitTask({
  type: 'shell',
  payload: {
    command: 'bash',
    args: ['script.sh']
  },
  priority: 100,
  timeout: 600000,
  retries: 3
})

// 更新心跳
subagentManager.updateHeartbeat('subagent-1')

// 获取系统负载
const load = subagentManager.getSystemLoad()
```

### CronScheduler

```typescript
import { CronScheduler } from './src/cron/scheduler'
import { ErrorHandler } from './src/cron/error-handler'

// 创建调度器
const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true,
  subagentConfigs: [...]
})

// 启动调度器
await scheduler.start()

// 添加任务
const job = await scheduler.addJob({
  name: 'My Task',
  cronExpression: '0 2 * * *',
  command: 'bash',
  args: ['script.sh'],
  enabled: true,
  priority: ErrorHandler.getPriority('high'),
  timeout: 600000,
  maxRetries: 3
})

// 更新任务
await scheduler.updateJob(job.id, { enabled: false })

// 删除任务
await scheduler.deleteJob(job.id)

// 手动执行任务
const result = await scheduler.runJob(job.id)

// 获取统计信息
const stats = scheduler.getStats()

// 停止调度器
await scheduler.stop()
```

### ErrorHandler

```typescript
import { ErrorHandler } from './src/cron/error-handler'

// 带重试的执行
const result = await ErrorHandler.executeWithRetry(
  async () => {
    // 执行操作
  },
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2
  }
)

// 带超时的执行
const result = await ErrorHandler.executeWithTimeout(
  async () => {
    // 执行操作
  },
  5000,
  'Operation timed out'
)

// 带熔断器的执行
const result = await ErrorHandler.executeWithCircuitBreaker(
  async () => {
    // 执行操作
  },
  {
    failureThreshold: 5,
    recoveryTimeout: 60000
  }
)

// 获取优先级
const priority = ErrorHandler.getPriority('high')

// 错误分类
const classification = ErrorHandler.classifyError(error)
```

## 事件系统

### CronScheduler事件

- `scheduler:started` - 调度器启动
- `scheduler:running` - 调度器运行中
- `scheduler:stopped` - 调度器停止
- `job:added` - 任务添加
- `job:updated` - 任务更新
- `job:deleted` - 任务删除
- `job:started` - 任务开始执行
- `job:completed` - 任务完成
- `job:failed` - 任务失败

### SubagentManager事件

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

## 部署

详细的部署说明请参考 [CRON_DEPLOYMENT.md](./CRON_DEPLOYMENT.md)

### Docker部署

```bash
docker-compose up -d
```

### Systemd服务

```bash
sudo systemctl enable cron-scheduler
sudo systemctl start cron-scheduler
```

## 监控

### 调度器统计

```typescript
const stats = scheduler.getStats()

console.log('Total jobs:', stats.totalJobs)
console.log('Enabled jobs:', stats.enabledJobs)
console.log('Total runs:', stats.totalRuns)
console.log('Success rate:', stats.successRate)
```

### 子代理负载

```typescript
const load = subagentManager.getSystemLoad()

console.log('Total subagents:', load.totalSubagents)
console.log('Idle subagents:', load.idleSubagents)
console.log('Average load:', load.averageLoad)
```

## 最佳实践

1. **任务设计**
   - 将长时间运行的任务拆分为多个小任务
   - 使用工作区隔离防止资源冲突
   - 设置合理的超时时间

2. **错误处理**
   - 配置适当的重试策略
   - 监控任务失败率
   - 设置告警通知

3. **资源管理**
   - 限制工作区大小
   - 设置资源限制
   - 定期清理过期工作区

4. **监控**
   - 定期检查系统负载
   - 监控任务执行情况
   - 设置告警规则

## 安全建议

1. 限制工作区可执行的命令
2. 使用环境变量存储敏感信息
3. 定期更新依赖包
4. 限制文件系统访问权限
5. 启用日志审计

## 性能优化

1. 使用子代理实现负载均衡
2. 合理设置任务优先级
3. 优化脚本执行时间
4. 使用缓存减少重复计算
5. 定期清理日志和临时文件

## 故障排除

### 任务未执行

1. 检查cron表达式是否正确
2. 确认任务是否已启用
3. 查看日志文件获取错误信息

### 工作区权限错误

1. 检查工作区目录权限
2. 确认allowedCommands配置
3. 验证资源限制设置

### 子代理离线

1. 检查心跳超时设置
2. 确认网络连接
3. 查看子代理日志

## 许可证

MIT

## 贡献

欢迎提交Issue和Pull Request！
