/**
 * Container Orchestration Layer for Minibot
 *
 * Manages container lifecycle, integrates with IPC, mount security, and snapshots.
 * Inspired by nanoclaw's orchestration approach.
 *
 * Features:
 * - Container lifecycle management
 * - Integration with mount security
 * - IPC communication
 * - Snapshot updates
 * - Queue management
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getWorkspace } from './config/index'
import { createLogger } from './utils/index'
import { validateMount, AdditionalMount, initializeMountAllowlist } from './mount-security'
import { writeGroupsSnapshot, writeTasksSnapshot } from './snapshot'
import { getIPCManager, IPCMessage } from './ipc'
import { GroupQueue } from './group-queue'

const logger = createLogger('ContainerOrchestrator')

export interface GroupInfo {
  jid: string
  name: string
  folder: string
  isMain: boolean
  registeredJid?: string
}

export interface ContainerTask {
  id: string
  groupFolder: string
  prompt: string
  sessionId?: string
  chatJid?: string
  isScheduledTask?: boolean
  priority?: number
}

export interface ContainerOrchestrationOptions {
  maxConcurrent?: number
  containerTimeout?: number
  enableMountSecurity?: boolean
  enableSnapshots?: boolean
  enableIPC?: boolean
}

/**
 * Container Orchestrator
 */
export class ContainerOrchestrator {
  private dataDir: string
  private queueManager = new GroupQueue()
  private ipcManager = getIPCManager()
  private options: Required<ContainerOrchestrationOptions>

  constructor(options: ContainerOrchestrationOptions = {}) {
    this.dataDir = getWorkspace()
    this.options = {
      maxConcurrent: options.maxConcurrent || 3,
      containerTimeout: options.containerTimeout || 60000,
      enableMountSecurity: options.enableMountSecurity !== false,
      enableSnapshots: options.enableSnapshots !== false,
      enableIPC: options.enableIPC !== false
    }

    // Initialize mount security if enabled
    if (this.options.enableMountSecurity) {
      try {
        initializeMountAllowlist()
      } catch (err) {
        logger.warn('Failed to initialize mount allowlist', { error: err })
      }
    }

    // Start IPC if enabled
    if (this.options.enableIPC) {
      this.ipcManager.start()
    }

    logger.info('Container orchestrator initialized', this.options)
  }

  /**
   * Execute a task in a container
   */
  async executeTask(task: ContainerTask, group: GroupInfo): Promise<{
    status: 'success' | 'error'
    result?: string
    error?: string
    newSessionId?: string
  }> {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    logger.info('Executing container task', {
      taskId,
      groupFolder: task.groupFolder,
      prompt: task.prompt?.substring(0, 100)
    })

    // Enqueue task
    const queueId = this.queueManager.enqueue({
      id: taskId,
      groupFolder: task.groupFolder,
      prompt: task.prompt,
      sessionId: task.sessionId,
      chatJid: task.chatJid,
      timestamp: Date.now(),
      priority: task.priority || 5,
      retryCount: 0,
      maxRetries: 2
    })

    // Wait for queue processing
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const process = this.queueManager.getProcess(queueId)

        if (process) {
          clearInterval(checkInterval)

          // Wait for process to complete
          this.waitForCompletion(process).then((result) => {
            this.queueManager.unregisterProcess(queueId)
            resolve(result)
          })
        }
      }, 100)

      // Timeout fallback
      setTimeout(() => {
        clearInterval(checkInterval)
        this.queueManager.unregisterProcess(queueId)
        resolve({
          status: 'error',
          error: 'Container task timeout'
        })
      }, this.options.containerTimeout)
    })
  }

  /**
   * Wait for container process completion
   */
  private async waitForCompletion(process: ProcessInfo): Promise<{
    status: 'success' | 'error'
    result?: string
    error?: string
  }> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''

      process.process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.process.on('close', (code) => {
        logger.debug('Container process completed', {
          containerName: process.containerName,
          exitCode: code
        })

        if (code === 0) {
          resolve({
            status: 'success',
            result: stdout || 'Container completed successfully'
          })
        } else {
          resolve({
            status: 'error',
            error: stderr || `Container exited with code ${code}`
          })
        }
      })

      process.process.on('error', (error) => {
        logger.error('Container process error', {
          containerName: process.containerName,
          error
        })
        resolve({
          status: 'error',
          error: error.message
        })
      })
    })
  }

  /**
   * Prepare container configuration
   */
  prepareContainerConfig(
    group: GroupInfo,
    additionalMounts?: AdditionalMount[]
  ): {
    binds: Array<{ source: string; target: string }>
    env: Record<string, string>
  } {
    const binds: Array<{ source: string; target: string }> = []
    const env: Record<string, string> = {}

    // Add workspace bind
    const workspaceDir = path.join(this.dataDir, 'containers', group.folder)
    fs.mkdirSync(workspaceDir, { recursive: true })

    binds.push({
      source: path.join(workspaceDir, 'workspace'),
      target: '/workspace/workspace:rw'
    })

    // Validate and add additional mounts
    if (additionalMounts && this.options.enableMountSecurity) {
      for (const mount of additionalMounts) {
        const validation = validateMount(mount, group.isMain)

        if (validation.allowed) {
          binds.push({
            source: validation.realHostPath!,
            target: `/workspace/extra/${mount.containerPath}${validation.effectiveReadonly ? ':ro' : ':rw'}`
          })
          logger.info('Mount validated', {
            hostPath: mount.hostPath,
            containerPath: mount.containerPath,
            readonly: validation.effectiveReadonly
          })
        } else {
          logger.warn('Mount rejected', {
            hostPath: mount.hostPath,
            reason: validation.reason
          })
        }
      }
    }

    // Set environment variables
    env = {
      MINIBOT_CONTAINER: 'true',
      GROUP_FOLDER: group.folder,
      IS_MAIN: group.isMain.toString(),
      NODE_ENV: 'production'
    }

    return { binds, env }
  }

  /**
   * Update snapshots for a group
   */
  updateSnapshots(
    group: GroupInfo,
    availableGroups?: GroupInfo[],
    tasks?: any[]
  ): void {
    if (!this.options.enableSnapshots) {
      return
    }

    if (availableGroups && group.isMain) {
      writeGroupsSnapshot(
        group.folder,
        group.isMain,
        availableGroups.map(g => ({
          jid: g.jid,
          name: g.name,
          lastActivity: Date.now(),
          isRegistered: true
        })),
        new Set([group.jid])
      )
    }

    if (tasks) {
      writeTasksSnapshot(group.folder, group.isMain, tasks)
    }

    logger.debug('Snapshots updated', { groupFolder: group.folder })
  }

  /**
   * Send IPC message to a group
   */
  sendIPCMessage(groupFolder: string, message: IPCMessage): void {
    if (!this.options.enableIPC) {
      logger.warn('IPC not enabled, cannot send message')
      return
    }

    this.ipcManager.writeMessage(groupFolder, message)
    logger.debug('IPC message sent', { groupFolder, type: message.type })
  }

  /**
   * Get queue statistics
   */
  getQueueStats() {
    return this.queueManager.getStats()
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    logger.info('Shutting down container orchestrator')

    // Stop IPC
    if (this.options.enableIPC) {
      this.ipcManager.stop()
    }

    // Clear queue
    this.queueManager.clear()

    logger.info('Container orchestrator shut down')
  }
}

// Global orchestrator instance
let orchestrator: ContainerOrchestrator | null = null

/**
 * Get the global container orchestrator instance
 */
export function getContainerOrchestrator(
  options?: ContainerOrchestrationOptions
): ContainerOrchestrator {
  if (!orchestrator) {
    orchestrator = new ContainerOrchestrator(options)
  }
  return orchestrator
}

/**
 * Reset the global orchestrator (for testing)
 */
export function resetContainerOrchestrator(): void {
  if (orchestrator) {
    orchestrator.destroy().catch(err => {
      logger.error('Failed to destroy orchestrator', { error: err })
    })
  }
  orchestrator = null
}
