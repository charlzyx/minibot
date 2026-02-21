/**
 * IPC (Inter-Process Communication) System for Minibot
 *
 * Provides per-group IPC directories for container-host communication.
 * Inspired by nanoclaw's IPC implementation.
 *
 * Directory structure:
 * ipc/{groupFolder}/
 *   messages/ - Outgoing messages from containers
 *   tasks/ - Task management requests
 *   errors/ - Failed IPC operations
 */

import fs from 'fs'
import path from 'path'
import { getWorkspace } from './config/manager'
import { createLogger } from './utils'

const logger = createLogger('IPC')

const IPC_POLL_INTERVAL = 1000 // 1 second

export interface IPCMessage {
  type: 'message'
  chatJid: string
  text: string
  timestamp?: number
}

export interface IPCTask {
  type: 'schedule_task' | 'pause_task' | 'resume_task' | 'cancel_task' | 'refresh_groups'
  taskId?: string
  prompt?: string
  schedule_type?: 'cron' | 'interval' | 'once'
  schedule_value?: string
  context_mode?: 'group' | 'isolated'
  groupFolder?: string
  chatJid?: string
  timestamp?: number
}

export class IPCManager {
  private dataDir: string
  private pollInterval: NodeJS.Timeout | null = null
  private messageHandlers: Map<string, (msg: IPCMessage) => Promise<void>> = new Map()
  private taskHandlers: Map<string, (task: IPCTask) => Promise<void>> = new Map()

  constructor() {
    this.dataDir = getWorkspace()
  }

  /**
   * Get the IPC base directory
   */
  private getIpcBaseDir(): string {
    const dir = path.join(this.dataDir, 'ipc')
    fs.mkdirSync(dir, { recursive: true })
    return dir
  }

  /**
   * Get the IPC directory for a specific group
   */
  getGroupIpcDir(groupFolder: string): string {
    const dir = path.join(this.getIpcBaseDir(), groupFolder)
    fs.mkdirSync(dir, { recursive: true })

    // Create subdirectories
    fs.mkdirSync(path.join(dir, 'messages'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'tasks'), { recursive: true })
    fs.mkdirSync(path.join(dir, 'errors'), { recursive: true })

    return dir
  }

  /**
   * Write a message to the IPC queue
   */
  writeMessage(groupFolder: string, message: IPCMessage): void {
    const messagesDir = path.join(this.getGroupIpcDir(groupFolder), 'messages')
    const filename = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    const filepath = path.join(messagesDir, filename)

    const data = {
      ...message,
      timestamp: message.timestamp || Date.now()
    }

    fs.writeFileSync(filepath, JSON.stringify(data), 'utf8')
    logger.debug('IPC message written', { groupFolder, filename })
  }

  /**
   * Write a task to the IPC queue
   */
  writeTask(groupFolder: string, task: IPCTask): void {
    const tasksDir = path.join(this.getGroupIpcDir(groupFolder), 'tasks')
    const filename = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`
    const filepath = path.join(tasksDir, filename)

    const data = {
      ...task,
      timestamp: task.timestamp || Date.now()
    }

    fs.writeFileSync(filepath, JSON.stringify(data), 'utf8')
    logger.debug('IPC task written', { groupFolder, filename, type: task.type })
  }

  /**
   * Read all pending messages for a group
   */
  readMessages(groupFolder: string): IPCMessage[] {
    const messagesDir = path.join(this.getGroupIpcDir(groupFolder), 'messages')
    const messages: IPCMessage[] = []

    try {
      const files = fs.readdirSync(messagesDir).filter(f => f.endsWith('.json'))

      for (const file of files) {
        try {
          const filepath = path.join(messagesDir, file)
          const content = fs.readFileSync(filepath, 'utf8')
          const message = JSON.parse(content) as IPCMessage
          messages.push(message)

          // Remove after reading
          fs.unlinkSync(filepath)
        } catch (err) {
          logger.error('Failed to read IPC message', { file, error: err })
        }
      }
    } catch (err) {
      logger.error('Failed to read IPC messages directory', { groupFolder, error: err })
    }

    return messages
  }

  /**
   * Read all pending tasks for a group
   */
  readTasks(groupFolder: string): IPCTask[] {
    const tasksDir = path.join(this.getGroupIpcDir(groupFolder), 'tasks')
    const tasks: IPCTask[] = []

    try {
      const files = fs.readdirSync(tasksDir).filter(f => f.endsWith('.json'))

      for (const file of files) {
        try {
          const filepath = path.join(tasksDir, file)
          const content = fs.readFileSync(filepath, 'utf8')
          const task = JSON.parse(content) as IPCTask
          tasks.push(task)

          // Remove after reading
          fs.unlinkSync(filepath)
        } catch (err) {
          logger.error('Failed to read IPC task', { file, error: err })
        }
      }
    } catch (err) {
      logger.error('Failed to read IPC tasks directory', { groupFolder, error: err })
    }

    return tasks
  }

  /**
   * Move a failed IPC file to errors directory
   */
  moveToErrors(groupFolder: string, filename: string, error: string): void {
    const errorsDir = path.join(this.getIpcBaseDir(), 'errors')
    fs.mkdirSync(errorsDir, { recursive: true })

    const sourcePath = path.join(this.getGroupIpcDir(groupFolder), filename)
    const destPath = path.join(errorsDir, `${groupFolder}-${filename}`)

    try {
      fs.renameSync(sourcePath, destPath)
      logger.warn('IPC file moved to errors', { groupFolder, filename, error })
    } catch (err) {
      logger.error('Failed to move IPC file to errors', { groupFolder, filename, error: err })
    }
  }

  /**
   * Register a message handler for a group
   */
  onMessage(groupFolder: string, handler: (msg: IPCMessage) => Promise<void>): void {
    this.messageHandlers.set(groupFolder, handler)
  }

  /**
   * Register a task handler for a group
   */
  onTask(groupFolder: string, handler: (task: IPCTask) => Promise<void>): void {
    this.taskHandlers.set(groupFolder, handler)
  }

  /**
   * Start polling for IPC messages
   */
  start(): void {
    if (this.pollInterval) {
      return
    }

    const poll = async () => {
      const ipcBaseDir = this.getIpcBaseDir()

      // Get all group directories
      let groupFolders: string[]
      try {
        groupFolders = fs.readdirSync(ipcBaseDir).filter(f => {
          const stat = fs.statSync(path.join(ipcBaseDir, f))
          return stat.isDirectory() && f !== 'errors'
        })
      } catch (err) {
        logger.error('Error reading IPC base directory', { error: err })
        this.pollInterval = setTimeout(poll, IPC_POLL_INTERVAL) as unknown as NodeJS.Timeout
        return
      }

      // Process each group's IPC
      for (const groupFolder of groupFolders) {
        // Process messages
        try {
          const messages = this.readMessages(groupFolder)
          const handler = this.messageHandlers.get(groupFolder)

          if (handler && messages.length > 0) {
            for (const message of messages) {
              try {
                await handler(message)
              } catch (err) {
                logger.error('Error handling IPC message', { groupFolder, message, error: err })
              }
            }
          }
        } catch (err) {
          logger.error('Error reading IPC messages', { groupFolder, error: err })
        }

        // Process tasks
        try {
          const tasks = this.readTasks(groupFolder)
          const handler = this.taskHandlers.get(groupFolder)

          if (handler && tasks.length > 0) {
            for (const task of tasks) {
              try {
                await handler(task)
              } catch (err) {
                logger.error('Error handling IPC task', { groupFolder, task, error: err })
              }
            }
          }
        } catch (err) {
          logger.error('Error reading IPC tasks', { groupFolder, error: err })
        }
      }

      this.pollInterval = setTimeout(poll, IPC_POLL_INTERVAL) as unknown as NodeJS.Timeout
    }

    poll()
    logger.info('IPC watcher started')
  }

  /**
   * Stop polling for IPC messages
   */
  stop(): void {
    if (this.pollInterval) {
      clearTimeout(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Clean up old IPC files
   */
  cleanup(maxAge: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now()
    const ipcBaseDir = this.getIpcBaseDir()

    const cleanDirectory = (dir: string) => {
      try {
        const files = fs.readdirSync(dir)
        for (const file of files) {
          const filepath = path.join(dir, file)
          const stat = fs.statSync(filepath)

          if (stat.isFile() && now - stat.mtimeMs > maxAge) {
            fs.unlinkSync(filepath)
            logger.debug('Cleaned up old IPC file', { filepath })
          }
        }
      } catch (err) {
        logger.error('Error cleaning IPC directory', { dir, error: err })
      }
    }

    // Clean all group directories
    try {
      const groupFolders = fs.readdirSync(ipcBaseDir).filter(f => {
        const stat = fs.statSync(path.join(ipcBaseDir, f))
        return stat.isDirectory() && f !== 'errors'
      })

      for (const groupFolder of groupFolders) {
        const groupDir = path.join(ipcBaseDir, groupFolder)
        cleanDirectory(path.join(groupDir, 'messages'))
        cleanDirectory(path.join(groupDir, 'tasks'))
      }

      // Clean errors directory
      cleanDirectory(path.join(ipcBaseDir, 'errors'))
    } catch (err) {
      logger.error('Error cleaning IPC directories', { error: err })
    }
  }
}

// Global IPC manager instance
let ipcManager: IPCManager | null = null

/**
 * Get the global IPC manager instance
 */
export function getIPCManager(): IPCManager {
  if (!ipcManager) {
    ipcManager = new IPCManager()
  }
  return ipcManager
}
