/**
 * 定时任务系统配置示例
 */

import { CronScheduler } from './scheduler'
import { ErrorHandler } from './error-handler'
import type { TaskPriority } from './error-handler'
import type { RetryConfig } from './error-handler'

export const cronSchedulerConfig = {
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
    },
    {
      id: 'subagent-2',
      name: 'Secondary Subagent',
      capabilities: ['shell', 'file'],
      maxConcurrentTasks: 3,
      priority: 50
    }
  ]
}

export const exampleJobs: Array<{
  name: string
  cronExpression: string
  command: string
  args: string[]
  cwd: string
  env: Record<string, string>
  enabled: boolean
  priority: TaskPriority
  retryConfig?: Partial<RetryConfig>
  timeout: number
  maxRetries: number
}> = [
  {
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
    retryConfig: {
      maxRetries: 3,
      initialDelay: 5000,
      maxDelay: 60000,
      backoffMultiplier: 2
    },
    timeout: 600000,
    maxRetries: 3
  },
  {
    name: 'Log Cleanup',
    cronExpression: '0 */6 * * *',
    command: 'bash',
    args: ['scripts/cleanup-logs.sh'],
    cwd: './',
    env: {
      LOG_DIR: './logs',
      MAX_DAYS: '30'
    },
    enabled: true,
    priority: ErrorHandler.getPriority('normal'),
    timeout: 300000,
    maxRetries: 2
  },
  {
    name: 'Health Check',
    cronExpression: '*/5 * * * *',
    command: 'bash',
    args: ['scripts/health-check.sh'],
    cwd: './',
    env: {},
    enabled: true,
    priority: ErrorHandler.getPriority('critical'),
    timeout: 30000,
    maxRetries: 1
  },
  {
    name: 'Data Sync',
    cronExpression: '0 3 * * *',
    command: 'bash',
    args: ['scripts/sync-data.sh'],
    cwd: './',
    env: {
      SYNC_SOURCE: 'remote-server',
      SYNC_DEST: './data'
    },
    enabled: true,
    priority: ErrorHandler.getPriority('high'),
    retryConfig: {
      maxRetries: 5,
      initialDelay: 10000,
      maxDelay: 120000,
      backoffMultiplier: 2
    },
    timeout: 900000,
    maxRetries: 5
  },
  {
    name: 'Report Generation',
    cronExpression: '0 8 * * 1',
    command: 'bash',
    args: ['scripts/generate-report.sh'],
    cwd: './',
    env: {
      REPORT_DIR: './reports',
      REPORT_TYPE: 'weekly'
    },
    enabled: true,
    priority: ErrorHandler.getPriority('normal'),
    timeout: 600000,
    maxRetries: 2
  }
]

export const workspaceConfigs = [
  {
    id: 'backup-workspace',
    basePath: './workspaces',
    maxFileSize: 1024 * 1024 * 1024,
    maxTotalSize: 10 * 1024 * 1024 * 1024,
    allowedCommands: ['bash', 'rsync', 'tar', 'gzip'],
    deniedCommands: ['rm', 'del', 'format'],
    resourceLimits: {
      maxCpu: 2,
      maxMemory: 2048,
      maxProcesses: 10
    }
  },
  {
    id: 'sync-workspace',
    basePath: './workspaces',
    maxFileSize: 512 * 1024 * 1024,
    maxTotalSize: 5 * 1024 * 1024 * 1024,
    allowedCommands: ['bash', 'rsync', 'curl', 'wget'],
    resourceLimits: {
      maxCpu: 1,
      maxMemory: 1024,
      maxProcesses: 5
    }
  }
]

export async function setupScheduler(): Promise<CronScheduler> {
  const { CronScheduler } = await import('./scheduler')
  
  const scheduler = new CronScheduler(cronSchedulerConfig)
  
  await scheduler.start()
  
  for (const jobConfig of exampleJobs) {
    await scheduler.addJob(jobConfig)
  }
  
  return scheduler
}
