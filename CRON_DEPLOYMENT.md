# 定时任务系统部署说明

## 系统概述

本定时任务系统是一个功能完整的任务调度解决方案，支持以下核心功能：

1. **基于cron表达式的定时任务调度** - 支持标准的5段和6段cron语法，秒级精度
2. **Shell脚本执行** - 支持脚本参数传递和环境变量配置
3. **工作区隔离** - 为不同任务提供独立的执行环境，防止资源冲突
4. **子代理架构** - 支持任务的分布式执行和负载均衡
5. **错误处理和重试** - 智能错误分类和自动重试机制
6. **任务优先级管理** - 支持critical、high、normal、low四个优先级

## 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                    CronScheduler (调度器)                      │
│  - Cron表达式解析                                         │
│  - 任务队列管理                                           │
│  - 触发器管理                                           │
└────────────────┬────────────────────────────────────────────────┘
                 │
                 ├─► TaskExecutor (任务执行器)
                 │   - Shell脚本执行
                 │   - 输出重定向
                 │   - 错误捕获
                 │   - 日志记录
                 │
                 ├─► WorkspaceManager (工作区管理器)
                 │   - 文件系统隔离
                 │   - 权限控制
                 │   - 资源限制
                 │
                 └─► SubagentManager (子代理管理器)
                     - 状态监控
                     - 任务分发
                     - 结果回传
```

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件并配置必要的环境变量：

```env
# 基础配置
NODE_ENV=production
PORT=18790

# 工作区配置
WORKSPACE_BASE_PATH=./workspaces
WORKSPACE_MAX_SIZE=10737418240

# 子代理配置
ENABLE_SUBAGENT=true
SUBAGENT_HEARTBEAT_TIMEOUT=30000
SUBAGENT_LOAD_BALANCE_INTERVAL=5000

# 日志配置
LOG_LEVEL=info
LOG_DIR=./logs
```

### 3. 创建必要的目录

```bash
mkdir -p workspaces logs scripts
```

### 4. 创建示例脚本

创建 `scripts/backup.sh`:

```bash
#!/bin/bash
echo "Starting backup at $(date)"
tar -czf "${BACKUP_DIR}/backup-$(date +%Y%m%d-%H%M%S).tar.gz" ./data
echo "Backup completed at $(date)"
```

创建 `scripts/cleanup-logs.sh`:

```bash
#!/bin/bash
echo "Cleaning up logs older than ${MAX_DAYS} days"
find "${LOG_DIR}" -name "*.log" -mtime +${MAX_DAYS} -delete
echo "Log cleanup completed"
```

创建 `scripts/health-check.sh`:

```bash
#!/bin/bash
echo "Performing health check"
# 添加你的健康检查逻辑
echo "Health check passed"
exit 0
```

### 5. 设置脚本权限

```bash
chmod +x scripts/*.sh
```

## 使用方法

### 基本使用

```typescript
import { CronScheduler } from './cron/scheduler'
import { ErrorHandler } from './cron/error-handler'

// 创建调度器
const scheduler = new CronScheduler({
  checkInterval: 1000,
  workspaceBasePath: './workspaces',
  enableSubagent: true,
  subagentConfigs: [
    {
      id: 'subagent-1',
      name: 'Primary Subagent',
      capabilities: ['shell', 'file', 'web'],
      maxConcurrentTasks: 5,
      priority: 100
    }
  ]
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
    BACKUP_DIR: './backups',
    RETENTION_DAYS: '7'
  },
  enabled: true,
  priority: ErrorHandler.getPriority('high'),
  timeout: 600000,
  maxRetries: 3
})

// 监听事件
scheduler.on('job:started', (job) => {
  console.log(`Job started: ${job.name}`)
})

scheduler.on('job:completed', (job, result) => {
  console.log(`Job completed: ${job.name}`)
})

scheduler.on('job:failed', (job, error) => {
  console.error(`Job failed: ${job.name}`, error)
})
```

### Cron表达式格式

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

### 工作区配置

```typescript
import { WorkspaceManager } from './cron/workspace'

const workspaceManager = new WorkspaceManager('./workspaces')

// 创建工作区
await workspaceManager.createWorkspace({
  id: 'backup-workspace',
  maxFileSize: 1024 * 1024 * 1024,
  maxTotalSize: 10 * 1024 * 1024 * 1024,
  allowedCommands: ['bash', 'rsync', 'tar', 'gzip'],
  deniedCommands: ['rm', 'del', 'format'],
  resourceLimits: {
    maxCpu: 2,
    maxMemory: 2048,
    maxProcesses: 10
  }
})

// 在工作区中执行任务
const result = await workspaceManager.executeInWorkspace(
  'backup-workspace',
  async (workspacePath) => {
    // 执行任务
  }
)
```

### 子代理管理

```typescript
import { SubagentManager } from './cron/subagent'

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
    args: ['scripts/backup.sh']
  },
  priority: 100,
  timeout: 600000,
  retries: 3
})

// 监听任务事件
subagentManager.on('task:completed', (task) => {
  console.log(`Task completed: ${task.id}`)
})

subagentManager.on('task:failed', (task, error) => {
  console.error(`Task failed: ${task.id}`, error)
})
```

## 部署选项

### Docker部署

创建 `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN mkdir -p workspaces logs scripts

CMD ["node", "dist/index.js"]
```

创建 `docker-compose.yml`:

```yaml
version: '3.8'

services:
  cron-scheduler:
    build: .
    ports:
      - "18790:18790"
    volumes:
      - ./workspaces:/app/workspaces
      - ./logs:/app/logs
      - ./scripts:/app/scripts
    environment:
      - NODE_ENV=production
      - WORKSPACE_BASE_PATH=/app/workspaces
    restart: unless-stopped
```

运行：

```bash
docker-compose up -d
```

### Systemd服务

创建 `/etc/systemd/system/cron-scheduler.service`:

```ini
[Unit]
Description=Cron Scheduler Service
After=network.target

[Service]
Type=simple
User=your-user
WorkingDirectory=/path/to/minibot
ExecStart=/usr/bin/node /path/to/minibot/dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=WORKSPACE_BASE_PATH=/path/to/minibot/workspaces

[Install]
WantedBy=multi-user.target
```

启动服务：

```bash
sudo systemctl daemon-reload
sudo systemctl enable cron-scheduler
sudo systemctl start cron-scheduler
```

## 监控和日志

### 日志位置

- 应用日志: `./logs/app.log`
- 任务日志: `./logs/tasks.log`
- 错误日志: `./logs/error.log`

### 监控指标

调度器提供以下监控指标：

```typescript
const stats = scheduler.getStats()

console.log('Total jobs:', stats.totalJobs)
console.log('Enabled jobs:', stats.enabledJobs)
console.log('Total runs:', stats.totalRuns)
console.log('Success rate:', stats.successRate)
```

子代理系统提供以下监控指标：

```typescript
const load = subagentManager.getSystemLoad()

console.log('Total subagents:', load.totalSubagents)
console.log('Idle subagents:', load.idleSubagents)
console.log('Busy subagents:', load.busySubagents)
console.log('Average load:', load.averageLoad)
```

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
