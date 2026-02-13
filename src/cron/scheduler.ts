/**
 * 定时任务调度器
 * 整合所有模块，提供完整的定时任务调度功能
 */

import { CronParser, CronSchedule } from './parser'
import { ShellExecutor, ShellExecutionConfig, ShellExecutionResult } from './executor'
import { WorkspaceManager, WorkspaceConfig } from './workspace'
import { SubagentManager, Task, SubagentConfig } from './subagent'
import { ErrorHandler, RetryConfig, TaskPriority } from './error-handler'
import { EventEmitter } from 'events'

export interface CronJob {
  id: string
  name: string
  cronExpression: string
  schedule: CronSchedule
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  enabled: boolean
  priority: TaskPriority
  retryConfig?: Partial<RetryConfig>
  workspaceId?: string
  timeout?: number
  maxRetries?: number
  lastRun?: Date
  nextRun?: Date
  runCount: number
  successCount: number
  failureCount: number
  createdAt: Date
  updatedAt: Date
}

export interface CronJobConfig {
  id?: string
  name: string
  cronExpression: string
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  enabled?: boolean
  priority?: TaskPriority
  retryConfig?: Partial<RetryConfig>
  workspaceId?: string
  timeout?: number
  maxRetries?: number
}

export interface CronSchedulerConfig {
  checkInterval?: number
  workspaceBasePath?: string
  enableSubagent?: boolean
  subagentConfigs?: SubagentConfig[]
}

export class CronScheduler extends EventEmitter {
  private jobs: Map<string, CronJob> = new Map()
  private workspaceManager: WorkspaceManager
  private subagentManager: SubagentManager | null = null
  private checkInterval: NodeJS.Timeout | null = null
  private running = false
  private readonly DEFAULT_CHECK_INTERVAL = 1000

  constructor(config: CronSchedulerConfig = {}) {
    super()
    
    this.workspaceManager = new WorkspaceManager(config.workspaceBasePath)
    
    if (config.enableSubagent) {
      this.subagentManager = new SubagentManager()
      
      if (config.subagentConfigs) {
        for (const subagentConfig of config.subagentConfigs) {
          this.subagentManager.registerSubagent(subagentConfig)
        }
      }
    }
  }

  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Scheduler is already running')
    }

    this.running = true
    this.emit('scheduler:started')

    this.checkInterval = setInterval(() => {
      this.checkJobs()
    }, this.DEFAULT_CHECK_INTERVAL)

    this.emit('scheduler:running')
  }

  async stop(): Promise<void> {
    if (!this.running) {
      return
    }

    this.running = false
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    if (this.subagentManager) {
      this.subagentManager.stop()
    }

    await this.workspaceManager.close()
    this.emit('scheduler:stopped')
  }

  async addJob(config: CronJobConfig): Promise<CronJob> {
    const schedule = CronParser.parse(config.cronExpression)
    const nextRun = CronParser.getNextRunTime(schedule)
    
    const job: CronJob = {
      id: config.id || this.generateJobId(),
      name: config.name,
      cronExpression: config.cronExpression,
      schedule,
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      enabled: config.enabled ?? true,
      priority: config.priority || ErrorHandler.getPriority('normal'),
      retryConfig: config.retryConfig,
      workspaceId: config.workspaceId,
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      nextRun,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      createdAt: new Date(),
      updatedAt: new Date()
    }

    this.jobs.set(job.id, job)
    this.emit('job:added', job)
    
    return job
  }

  async updateJob(id: string, updates: Partial<CronJobConfig>): Promise<CronJob> {
    const job = this.jobs.get(id)
    
    if (!job) {
      throw new Error(`Job not found: ${id}`)
    }

    if (updates.cronExpression) {
      job.schedule = CronParser.parse(updates.cronExpression)
      job.cronExpression = updates.cronExpression
      job.nextRun = CronParser.getNextRunTime(job.schedule)
    }

    if (updates.name !== undefined) {
      job.name = updates.name
    }
    if (updates.command !== undefined) {
      job.command = updates.command
    }
    if (updates.args !== undefined) {
      job.args = updates.args
    }
    if (updates.cwd !== undefined) {
      job.cwd = updates.cwd
    }
    if (updates.env !== undefined) {
      job.env = updates.env
    }
    if (updates.enabled !== undefined) {
      job.enabled = updates.enabled
    }
    if (updates.priority !== undefined) {
      job.priority = updates.priority
    }
    if (updates.retryConfig !== undefined) {
      job.retryConfig = updates.retryConfig
    }
    if (updates.workspaceId !== undefined) {
      job.workspaceId = updates.workspaceId
    }
    if (updates.timeout !== undefined) {
      job.timeout = updates.timeout
    }
    if (updates.maxRetries !== undefined) {
      job.maxRetries = updates.maxRetries
    }

    job.updatedAt = new Date()
    this.emit('job:updated', job)
    
    return job
  }

  async deleteJob(id: string): Promise<void> {
    const job = this.jobs.get(id)
    
    if (!job) {
      throw new Error(`Job not found: ${id}`)
    }

    this.jobs.delete(id)
    this.emit('job:deleted', job)
  }

  async enableJob(id: string): Promise<CronJob> {
    return this.updateJob(id, { enabled: true })
  }

  async disableJob(id: string): Promise<CronJob> {
    return this.updateJob(id, { enabled: false })
  }

  getJob(id: string): CronJob | null {
    return this.jobs.get(id) || null
  }

  getAllJobs(): CronJob[] {
    return Array.from(this.jobs.values())
  }

  getEnabledJobs(): CronJob[] {
    return Array.from(this.jobs.values()).filter(job => job.enabled)
  }

  async runJob(id: string): Promise<ShellExecutionResult> {
    const job = this.jobs.get(id)
    
    if (!job) {
      throw new Error(`Job not found: ${id}`)
    }

    const executionConfig: ShellExecutionConfig = {
      command: job.command,
      args: job.args,
      cwd: job.cwd,
      env: job.env,
      timeout: job.timeout
    }

    if (job.workspaceId) {
      return this.workspaceManager.executeInWorkspace(
        job.workspaceId,
        async (workspacePath) => {
          return this.executeJobWithRetry(job, {
            ...executionConfig,
            cwd: workspacePath
          })
        }
      )
    } else {
      return this.executeJobWithRetry(job, executionConfig)
    }
  }

  private async executeJobWithRetry(
    job: CronJob,
    config: ShellExecutionConfig
  ): Promise<ShellExecutionResult> {
    const maxRetries = job.maxRetries || 0
    
    if (maxRetries > 0 && job.retryConfig) {
      return ErrorHandler.executeWithRetry(
        () => ShellExecutor.execute(config),
        job.retryConfig
      )
    } else {
      return ShellExecutor.execute(config)
    }
  }

  private async checkJobs(): Promise<void> {
    const now = new Date()
    const enabledJobs = this.getEnabledJobs()

    for (const job of enabledJobs) {
      if (job.nextRun && job.nextRun <= now) {
        await this.executeJob(job)
        
        job.nextRun = CronParser.getNextRunTime(job.schedule, now)
        job.updatedAt = new Date()
      }
    }
  }

  private async executeJob(job: CronJob): Promise<void> {
    this.emit('job:started', job)
    
    try {
      const result = await this.runJob(job.id)
      
      job.lastRun = new Date()
      job.runCount++
      
      if (result.success) {
        job.successCount++
        this.emit('job:completed', job, result)
      } else {
        job.failureCount++
        this.emit('job:failed', job, result)
      }
    } catch (error) {
      job.lastRun = new Date()
      job.runCount++
      job.failureCount++
      
      const errorResult: ShellExecutionResult = {
        exitCode: -1,
        stdout: '',
        stderr: '',
        duration: 0,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
      
      this.emit('job:failed', job, errorResult)
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getWorkspaceManager(): WorkspaceManager {
    return this.workspaceManager
  }

  getSubagentManager(): SubagentManager | null {
    return this.subagentManager
  }

  getStats(): {
    totalJobs: number
    enabledJobs: number
    disabledJobs: number
    totalRuns: number
    totalSuccesses: number
    totalFailures: number
    successRate: number
  } {
    const jobs = this.getAllJobs()
    const enabledJobs = jobs.filter(j => j.enabled).length
    const disabledJobs = jobs.filter(j => !j.enabled).length
    const totalRuns = jobs.reduce((sum, j) => sum + j.runCount, 0)
    const totalSuccesses = jobs.reduce((sum, j) => sum + j.successCount, 0)
    const totalFailures = jobs.reduce((sum, j) => sum + j.failureCount, 0)
    const successRate = totalRuns > 0 ? totalSuccesses / totalRuns : 0

    return {
      totalJobs: jobs.length,
      enabledJobs,
      disabledJobs,
      totalRuns,
      totalSuccesses,
      totalFailures,
      successRate
    }
  }
}
