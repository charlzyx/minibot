import * as cron from 'cron-parser';
import { logger } from './logger';

interface Task {
  id: string;
  groupFolder: string;
  prompt: string;
  schedule_type: 'cron' | 'interval';
  schedule_value: string;
  status: 'active' | 'paused';
  next_run: number;
}

interface SchedulerOptions {
  registeredGroups: () => Record<string, any>;
  getSessions: () => Record<string, string>;
  queue: any;
  onProcess: (groupJid: string, proc: any, containerName: string, groupFolder: string) => void;
  sendMessage: (jid: string, text: string) => Promise<void>;
}

export class TaskScheduler {
  private options: SchedulerOptions;
  private tasks: Task[] = [];
  private running = false;
  private interval: NodeJS.Timeout | null = null;

  constructor(options: SchedulerOptions) {
    this.options = options;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.interval = setInterval(() => {
      this.checkTasks();
    }, 60000); // 每分钟检查一次

    logger.info('Task scheduler started');
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.running = false;
    logger.info('Task scheduler stopped');
  }

  addTask(task: Omit<Task, 'id' | 'status' | 'next_run'>): Task {
    const newTask: Task = {
      ...task,
      id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      status: 'active',
      next_run: this.calculateNextRun(task.schedule_type, task.schedule_value)
    };

    this.tasks.push(newTask);
    logger.info({ taskId: newTask.id }, 'Task added');
    return newTask;
  }

  removeTask(taskId: string): boolean {
    const index = this.tasks.findIndex(task => task.id === taskId);
    if (index === -1) {
      return false;
    }

    this.tasks.splice(index, 1);
    logger.info({ taskId }, 'Task removed');
    return true;
  }

  pauseTask(taskId: string): boolean {
    const task = this.tasks.find(task => task.id === taskId);
    if (!task) {
      return false;
    }

    task.status = 'paused';
    logger.info({ taskId }, 'Task paused');
    return true;
  }

  resumeTask(taskId: string): boolean {
    const task = this.tasks.find(task => task.id === taskId);
    if (!task) {
      return false;
    }

    task.status = 'active';
    task.next_run = this.calculateNextRun(task.schedule_type, task.schedule_value);
    logger.info({ taskId }, 'Task resumed');
    return true;
  }

  getAllTasks(): Task[] {
    return this.tasks;
  }

  private async checkTasks(): Promise<void> {
    const now = Date.now();
    const tasksToRun = this.tasks.filter(task => 
      task.status === 'active' && task.next_run <= now
    );

    for (const task of tasksToRun) {
      await this.runTask(task);
      task.next_run = this.calculateNextRun(task.schedule_type, task.schedule_value);
    }
  }

  private async runTask(task: Task): Promise<void> {
    logger.info({ taskId: task.id, groupFolder: task.groupFolder }, 'Running task');

    try {
      // 找到对应的群组
      const registeredGroups = this.options.registeredGroups();
      const group = Object.values(registeredGroups).find(g => g.folder === task.groupFolder);

      if (!group) {
        logger.error({ taskId: task.id, groupFolder: task.groupFolder }, 'Group not found for task');
        return;
      }

      // 使用队列处理任务
      this.options.queue.enqueueTask(group.jid, task.id, async () => {
        try {
          // 这里可以调用容器运行器来处理任务
          // 暂时直接发送消息
          await this.options.sendMessage(group.jid, `Task executed: ${task.prompt}`);
          logger.info({ taskId: task.id }, 'Task executed successfully');
        } catch (error) {
          logger.error({ taskId: task.id, error }, 'Error executing task');
        }
      });
    } catch (error) {
      logger.error({ taskId: task.id, error }, 'Error running task');
    }
  }

  private calculateNextRun(scheduleType: 'cron' | 'interval', scheduleValue: string): number {
    if (scheduleType === 'cron') {
      try {
        // 使用简单的日期计算代替 cron-parser
        // 这里只是一个简单的实现，实际项目中可能需要更复杂的 cron 解析
        return Date.now() + 86400000; // 默认24小时后
      } catch (error) {
        logger.error({ scheduleValue, error }, 'Invalid cron expression');
        return Date.now() + 86400000; // 默认24小时后
      }
    } else {
      // interval 格式: 数字 + 单位 (如: 5m, 1h, 1d)
      const match = scheduleValue.match(/^(\d+)([mhd])$/);
      if (!match) {
        logger.error({ scheduleValue }, 'Invalid interval format');
        return Date.now() + 86400000; // 默认24小时后
      }

      const [, value, unit] = match;
      const numValue = parseInt(value, 10);

      switch (unit) {
        case 'm':
          return Date.now() + numValue * 60 * 1000;
        case 'h':
          return Date.now() + numValue * 60 * 60 * 1000;
        case 'd':
          return Date.now() + numValue * 24 * 60 * 60 * 1000;
        default:
          return Date.now() + 86400000; // 默认24小时后
      }
    }
  }
}

// 导出函数
export function startSchedulerLoop(options: SchedulerOptions): TaskScheduler {
  const scheduler = new TaskScheduler(options);
  scheduler.start();
  return scheduler;
}
