import * as cron from 'cron-parser'
import { logger } from './logger'
import { getContainerOrchestrator, GroupInfo } from './container-orchestrator'

interface Task {
  id: string
  groupFolder: string
  prompt: string
  schedule_type: 'cron' | 'interval' | 'once'
  schedule_value: string
  context_mode?: 'group' | 'isolated'
  status: 'active' | 'paused'
  next_run: number
  last_run?: number
  run_count?: number
}

interface SchedulerOptions {
  registeredGroups: () => Record<string, any>
  getSessions: () => Record<string, string>
  queue: any
  onProcess: (groupJid: string, proc: any, containerName: string, groupFolder: string) => void
  sendMessage: (jid: string, text: string) => Promise<void>
  timezone?: string
}

/**
 * Task Scheduler - Manages scheduled tasks with cron expressions
 */
export class TaskScheduler {
  private options: SchedulerOptions
  private tasks: Task[] = []
  private running = false
  private interval: NodeJS.Timeout | null = null
  private readonly CHECK_INTERVAL = 60000 // 1 minute

  constructor(options: SchedulerOptions) {
    this.options = options
  }

  start(): void {
    if (this.running) {
      return
    }

    this.running = true
    this.interval = setInterval(() => {
      this.checkTasks()
    }, this.CHECK_INTERVAL)

    logger.info('Task scheduler started')
  }

  stop(): void {
    if (!this.running) {
      return
    }

    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }

    this.running = false
    logger.info('Task scheduler stopped')
  }

  addTask(task: Omit<Task, 'id' | 'status' | 'next_run'>): Task {
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'active',
      next_run: this.calculateNextRun(task.schedule_type, task.schedule_value),
      run_count: 0
    }

    this.tasks.push(newTask)
    logger.info({ taskId: newTask.id, schedule_type: newTask.schedule_type, schedule_value: newTask.schedule_value }, 'Task added')
    return newTask
  }

  removeTask(taskId: string): boolean {
    const index = this.tasks.findIndex(task => task.id === taskId)
    if (index === -1) {
      return false
    }

    this.tasks.splice(index, 1)
    logger.info({ taskId }, 'Task removed')
    return true
  }

  pauseTask(taskId: string): boolean {
    const task = this.tasks.find(task => task.id === taskId)
    if (!task) {
      return false
    }

    task.status = 'paused'
    logger.info({ taskId }, 'Task paused')
    return true
  }

  resumeTask(taskId: string): boolean {
    const task = this.tasks.find(task => task.id === taskId)
    if (!task) {
      return false
    }

    task.status = 'active'
    task.next_run = this.calculateNextRun(task.schedule_type, task.schedule_value)
    logger.info({ taskId }, 'Task resumed')
    return true
  }

  getTask(taskId: string): Task | undefined {
    return this.tasks.find(task => task.id === taskId)
  }

  getAllTasks(): Task[] {
    return this.tasks
  }

  /**
   * Check for tasks that need to run
   */
  private async checkTasks(): Promise<void> {
    const now = Date.now()
    const tasksToRun = this.tasks.filter(task =>
      task.status === 'active' && task.next_run <= now
    )

    if (tasksToRun.length > 0) {
      logger.info({ count: tasksToRun.length }, 'Running scheduled tasks')
    }

    for (const task of tasksToRun) {
      await this.runTask(task)
    }
  }

  /**
   * Run a scheduled task
   */
  private async runTask(task: Task): Promise<void> {
    logger.info({ taskId: task.id, groupFolder: task.groupFolder }, 'Running scheduled task')

    try {
      // Find the corresponding group
      const registeredGroups = this.options.registeredGroups()
      const groupEntry = Object.entries(registeredGroups).find(
        ([, g]) => g.folder === task.groupFolder
      )

      if (!groupEntry) {
        logger.error({ taskId: task.id, groupFolder: task.groupFolder }, 'Group not found for task')
        return
      }

      const [groupJid, group] = groupEntry

      // Update last run time
      task.last_run = Date.now()
      task.run_count = (task.run_count || 0) + 1

      // Try to use container orchestrator if available
      try {
        const orchestrator = getContainerOrchestrator()
        const groupInfo: GroupInfo = {
          jid: groupJid,
          name: group.name,
          folder: group.folder,
          isMain: group.isMain || false
        }

        const result = await orchestrator.executeTask(
          {
            id: task.id,
            groupFolder: task.groupFolder,
            prompt: `[SCHEDULED TASK]\n\n${task.prompt}`,
            isScheduledTask: true,
            priority: 3 // Lower priority than interactive tasks
          },
          groupInfo
        )

        if (result.status === 'success') {
          logger.info({ taskId: task.id }, 'Scheduled task completed successfully')

          // Send result message
          if (result.result) {
            await this.options.sendMessage(groupJid, `✅ Task completed:\n\n${result.result}`)
          }
        } else {
          logger.error({ taskId: task.id, error: result.error }, 'Scheduled task failed')
          await this.options.sendMessage(groupJid, `❌ Task failed: ${result.error}`)
        }
      } catch (containerError) {
        // Fallback to queue-based execution
        logger.debug('Container orchestrator not available, using queue')
        this.options.queue.enqueueTask(groupJid, task.id, async () => {
          try {
            await this.options.sendMessage(groupJid, `📋 Scheduled task: ${task.prompt}`)
            logger.info({ taskId: task.id }, 'Task executed successfully via queue')
          } catch (error) {
            logger.error({ taskId: task.id, error }, 'Error executing task via queue')
          }
        })
      }

      // Calculate next run time
      task.next_run = this.calculateNextRun(task.schedule_type, task.schedule_value)
    } catch (error) {
      logger.error({ taskId: task.id, error }, 'Error running task')
    }
  }

  /**
   * Calculate next run time based on schedule
   */
  private calculateNextRun(scheduleType: 'cron' | 'interval' | 'once', scheduleValue: string): number {
    try {
      if (scheduleType === 'cron') {
        // Parse cron expression
        const interval = cron.parse(scheduleValue, {
          tz: this.options.timezone || 'UTC'
        })
        return interval.next().getTime()
      } else if (scheduleType === 'interval') {
        // Interval format: number + unit (e.g., 5m, 1h, 1d)
        const match = scheduleValue.match(/^(\d+)([mhd])$/)
        if (!match) {
          throw new Error(`Invalid interval format: ${scheduleValue}`)
        }

        const [, value, unit] = match
        const numValue = parseInt(value, 10)

        switch (unit) {
          case 'm':
            return Date.now() + numValue * 60 * 1000
          case 'h':
            return Date.now() + numValue * 60 * 60 * 1000
          case 'd':
            return Date.now() + numValue * 24 * 60 * 60 * 1000
          default:
            throw new Error(`Invalid interval unit: ${unit}`)
        }
      } else if (scheduleType === 'once') {
        // One-time execution at specified timestamp
        const timestamp = parseInt(scheduleValue, 10)
        if (isNaN(timestamp)) {
          throw new Error(`Invalid timestamp: ${scheduleValue}`)
        }
        return timestamp
      } else {
        throw new Error(`Unknown schedule type: ${scheduleType}`)
      }
    } catch (error) {
      logger.error({ scheduleType, scheduleValue, error }, 'Failed to calculate next run, using default')
      // Default to 24 hours later
      return Date.now() + 24 * 60 * 60 * 1000
    }
  }
}

// 导出函数
export function startSchedulerLoop(options: SchedulerOptions): TaskScheduler {
  const scheduler = new TaskScheduler(options);
  scheduler.start();
  return scheduler;
}
