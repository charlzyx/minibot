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
import { createLogger } from '../utils'
import type { CronJob } from '@/types'

const logger = createLogger('CronScheduler')

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
      logger.debug('Subagent manager initialized')
    }

    logger.info('CronScheduler created', {
      checkInterval: config.checkInterval || this.DEFAULT_CHECK_INTERVAL,
      workspaceBasePath: config.workspaceBasePath,
      enableSubagent: config.enableSubagent
    })
  }

  async start(): Promise<void> {
    if (this.running) {
      logger.warn('Scheduler is already running')
      throw new Error('Scheduler is already running')
    }

    this.running = true
    logger.info('Scheduler starting')

    this.checkInterval = setInterval(() => {
      this.checkJobs().catch(error => {
        logger.error('Error checking jobs', error)
      })
    }, this.DEFAULT_CHECK_INTERVAL)

    logger.info('Scheduler started')
    this.emit('scheduler:running')
  }

  async stop(): Promise<void> {
    if (!this.running) {
      logger.debug('Scheduler is not running')
      return
    }

    logger.info('Scheduler stopping')
    this.running = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    if (this.subagentManager) {
      this.subagentManager.stop()
      logger.debug('Subagent manager stopped')
    }

    await this.workspaceManager.close()

    logger.info('Scheduler stopped')
    this.emit('scheduler:stopped')
  }

  async addJob(config: CronJobConfig): Promise<CronJob> {
    const schedule = CronParser.parse(config.cronExpression)
    const nextRun = CronParser.getNextRunTime(schedule)

    const job: CronJob = {
      id: config.id || this.generateJobId(),
      name: config.name,
      cronExpression: config.cronExpression,
      command: config.command,
      args: config.args,
      cwd: config.cwd,
      env: config.env,
      enabled: config.enabled ?? true,
      priority: config.priority || ErrorHandler.getPriority('normal'),
      timeout: config.timeout,
      maxRetries: config.maxRetries,
      nextRun: nextRun ? nextRun.getTime() : undefined,
      runCount: 0,
      errorCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    this.jobs.set(job.id, job)
    logger.info('Job added', {
      id: job.id,
      name: job.name,
      cronExpression: job.cronExpression,
      nextRun: job.nextRun
    })
    this.emit('job:added', job)

    return job
  }

  async updateJob(id: string, updates: Partial<CronJobConfig>): Promise<CronJob> {
    const job = this.jobs.get(id)

    if (!job) {
      logger.warn('Job not found', { id })
      throw new Error(`Job not found: ${id}`)
    }

    if (updates.cronExpression) {
      const schedule = CronParser.parse(updates.cronExpression)
      const nextRun = CronParser.getNextRunTime(schedule)
      job.cronExpression = updates.cronExpression
      job.nextRun = nextRun ? nextRun.getTime() : undefined
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
    if (updates.workspaceId !== undefined) {
      job.workspaceId = updates.workspaceId
    }
    if (updates.timeout !== undefined) {
      job.timeout = updates.timeout
    }
    if (updates.maxRetries !== undefined) {
      job.maxRetries = updates.maxRetries
    }

    job.updatedAt = Date.now()
    logger.info('Job updated', { id, name: job.name })
    this.emit('job:updated', job)

    return job
  }

  async deleteJob(id: string): Promise<void> {
    const job = this.jobs.get(id)

    if (!job) {
      logger.warn('Job not found', { id })
      throw new Error(`Job not found: ${id}`)
    }

    this.jobs.delete(id)
    logger.info('Job deleted', { id, name: job.name })
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
      logger.warn('Job not found', { id })
      throw new Error(`Job not found: ${id}`)
    }

    logger.info('Running job', { id, name: job.name })

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
      logger.debug('Executing job with retry', { jobId: job.id, maxRetries })
      return ErrorHandler.executeWithRetry(
        () => ShellExecutor.execute(config),
        job.retryConfig
      )
    } else {
      logger.debug('Executing job without retry', { jobId: job.id })
      return ShellExecutor.execute(config)
    }
  }

  private async checkJobs(): Promise<void> {
    const now = Date.now()
    const enabledJobs = this.getEnabledJobs()

    let jobsExecuted = 0

    for (const job of enabledJobs) {
      if (job.nextRun && job.nextRun <= now) {
        await this.executeJob(job)
        jobsExecuted++

        const schedule = CronParser.parse(job.cronExpression)
        const nextRun = CronParser.getNextRunTime(schedule, new Date(now))
        job.nextRun = nextRun ? nextRun.getTime() : undefined
        job.updatedAt = Date.now()
      }
    }

    if (jobsExecuted > 0) {
      logger.debug('Jobs executed in check cycle', { count: jobsExecuted })
    }
  }

  private async executeJob(job: CronJob): Promise<void> {
    logger.info('Executing job', { id: job.id, name: job.name })
    this.emit('job:started', job)

    try {
      const result = await this.runJob(job.id)

      job.lastRun = Date.now()
      job.runCount++

      if (result.success) {
        logger.info('Job completed successfully', {
          id: job.id,
          name: job.name,
          duration: result.duration
        })
        this.emit('job:completed', job, result)
      } else {
        job.errorCount++
        logger.warn('Job failed', {
          id: job.id,
          name: job.name,
          exitCode: result.exitCode,
          error: result.error
        })
        this.emit('job:failed', job, result)
      }
    } catch (error) {
      job.lastRun = Date.now()
      job.runCount++
      job.errorCount++

      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error('Job execution error', error, { id: job.id, name: job.name })

      const errorResult: ShellExecutionResult = {
        exitCode: -1,
        stdout: '',
        stderr: '',
        duration: 0,
        success: false,
        error: errorMessage
      }

      this.emit('job:failed', job, errorResult)
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
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
    const totalFailures = jobs.reduce((sum, j) => sum + (j.errorCount || 0), 0)
    const totalSuccesses = totalRuns - totalFailures
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
