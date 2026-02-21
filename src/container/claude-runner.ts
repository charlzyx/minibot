/**
 * Claude Code Container Runner
 *
 * Runs Claude Code in an isolated Docker container for complex code engineering tasks.
 * This is a true implementation that mounts project directories and runs actual Claude Code CLI.
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getWorkspace } from '../config/manager'
import { createLogger } from '../utils'

const logger = createLogger('ClaudeContainer')

// Output markers for parsing Claude Code results
const OUTPUT_START_MARKER = '///MINIBOT_CLAUDE_OUTPUT_START///'
const OUTPUT_END_MARKER = '///MINIBOT_CLAUDE_OUTPUT_END///'

export interface ClaudeCodeOptions {
  projectPath?: string
  apiKey?: string
  model?: string
  timeout?: number
  memoryLimit?: string
  persistSession?: boolean
}

export interface ClaudeCodeResult {
  status: 'success' | 'error' | 'timeout'
  output?: string
  error?: string
  exitCode?: number
  sessionId?: string
}

export interface ClaudeCodeRequest {
  task: string
  projectPath?: string
  sessionId?: string
  options?: ClaudeCodeOptions
}

/**
 * Claude Code Container Runner
 *
 * Manages Docker containers running Claude Code for code engineering tasks.
 */
export class ClaudeCodeRunner {
  private workspaceDir: string
  private containersDir: string
  private readonly IMAGE_NAME = 'minibot-claude-code:latest'
  private readonly DEFAULT_TIMEOUT = 300000 // 5 minutes
  private readonly DEFAULT_MEMORY = '2g'

  constructor() {
    this.workspaceDir = getWorkspace()
    this.containersDir = path.join(this.workspaceDir, 'claude-containers')
    fs.mkdirSync(this.containersDir, { recursive: true })
    this.verifyDockerInstalled()
  }

  /**
   * Verify Docker is installed and running
   */
  private verifyDockerInstalled(): void {
    try {
      spawn('docker', ['--version'], { stdio: 'pipe' })
        .on('error', () => {
          throw new Error('Docker is not installed. Please install Docker first.')
        })
    } catch (error) {
      logger.warn('Docker verification failed', { error })
    }
  }

  /**
   * Build the Claude Code container image if not exists
   */
  async ensureImageExists(): Promise<boolean> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['images', '-q', this.IMAGE_NAME], { stdio: 'pipe' })

      let output = ''
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.on('close', async (code) => {
        if (output.trim()) {
          logger.info('Claude Code image already exists', { image: this.IMAGE_NAME })
          resolve(true)
          return
        }

        // Build the image
        logger.info('Building Claude Code container image...')
        const dockerfilePath = path.join(this.workspaceDir, '..', 'container', 'Dockerfile.claude')

        if (!fs.existsSync(dockerfilePath)) {
          logger.error('Dockerfile not found', { path: dockerfilePath })
          resolve(false)
          return
        }

        const buildProc = spawn('docker', ['build', '-t', this.IMAGE_NAME, '-f', dockerfilePath, path.dirname(dockerfilePath)], {
          stdio: 'inherit'
        })

        buildProc.on('close', (buildCode) => {
          if (buildCode === 0) {
            logger.info('Claude Code image built successfully')
            resolve(true)
          } else {
            logger.error('Failed to build Claude Code image', { code: buildCode })
            resolve(false)
          }
        })
      })

      docker.on('error', () => resolve(false))
    })
  }

  /**
   * Run Claude Code in a container
   */
  async run(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
    const { task, projectPath, sessionId, options = {} } = request

    logger.info('Starting Claude Code container', {
      task: task.substring(0, 100),
      sessionId,
      projectPath
    })

    // Ensure image exists
    const imageExists = await this.ensureImageExists()
    if (!imageExists) {
      return {
        status: 'error',
        error: 'Failed to prepare Claude Code container image'
      }
    }

    // Prepare container environment
    const containerName = `claude-code-${sessionId || 'anon'}-${Date.now()}`
    const sessionDir = path.join(this.containersDir, sessionId || `temp-${Date.now()}`)
    fs.mkdirSync(sessionDir, { recursive: true })

    // Determine project mount path
    const effectiveProjectPath = projectPath || sessionDir
    if (!fs.existsSync(effectiveProjectPath)) {
      fs.mkdirSync(effectiveProjectPath, { recursive: true })
    }

    // Prepare the task input
    const taskFile = path.join(sessionDir, 'task.txt')
    fs.writeFileSync(taskFile, task)

    // Build docker run command
    const dockerArgs = this.buildDockerRunArgs({
      containerName,
      projectPath: effectiveProjectPath,
      sessionDir,
      apiKey: options.apiKey || process.env.ANTHROPIC_API_KEY,
      model: options.model,
      taskFile
    })

    logger.debug('Docker args prepared', { args: dockerArgs.join(' ') })

    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timeoutHandle: NodeJS.Timeout | null = null

      const containerProc = spawn('docker', dockerArgs, { stdio: 'pipe' })

      const timeout = options.timeout || this.DEFAULT_TIMEOUT

      const doResolve = (result: ClaudeCodeResult) => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        resolve(result)
      }

      // Set timeout
      timeoutHandle = setTimeout(() => {
        logger.warn('Claude Code container timeout', { containerName, timeout })
        containerProc.kill('SIGTERM')
        doResolve({
          status: 'timeout',
          error: 'Claude Code execution timeout',
          sessionId
        })
      }, timeout)

      // Collect stdout
      containerProc.stdout?.on('data', (data) => {
        const chunk = data.toString()
        stdout += chunk
        logger.debug('Claude Code stdout', { chunk: chunk.substring(0, 200) })

        // Check for output markers
        if (stdout.includes(OUTPUT_START_MARKER) && stdout.includes(OUTPUT_END_MARKER)) {
          const startIdx = stdout.indexOf(OUTPUT_START_MARKER)
          const endIdx = stdout.indexOf(OUTPUT_END_MARKER)
          const output = stdout.substring(startIdx + OUTPUT_START_MARKER.length, endIdx).trim()

          doResolve({
            status: 'success',
            output,
            sessionId
          })
        }
      })

      // Collect stderr
      containerProc.stderr?.on('data', (data) => {
        stderr += data.toString()
        logger.debug('Claude Code stderr', { message: data.toString() })
      })

      // Handle container exit
      containerProc.on('close', (code) => {
        if (timeoutHandle) clearTimeout(timeoutHandle)

        logger.info('Claude Code container exited', { containerName, exitCode: code })

        // If we already resolved via markers, don't resolve again
        if (stdout.includes(OUTPUT_START_MARKER)) {
          return
        }

        // Otherwise, return the raw output
        doResolve({
          status: code === 0 ? 'success' : 'error',
          output: stdout || undefined,
          error: stderr || `Exit code: ${code}`,
          exitCode: code,
          sessionId
        })
      })

      containerProc.on('error', (error) => {
        if (timeoutHandle) clearTimeout(timeoutHandle)
        logger.error('Claude Code container error', { error, containerName })
        doResolve({
          status: 'error',
          error: error.message,
          sessionId
        })
      })
    })
  }

  /**
   * Build docker run command arguments
   */
  private buildDockerRunArgs(config: {
    containerName: string
    projectPath: string
    sessionDir: string
    apiKey?: string
    model?: string
    taskFile: string
  }): string[] {
    const args = [
      'run',
      '--rm',
      '--name', config.containerName,
      '--memory', this.DEFAULT_MEMORY,
      '--cpus', '2',
      '--network', 'host'  // Allow API access
    ]

    // Mount project directory
    args.push('--mount', `type=bind,source=${config.projectPath},target=/project`)

    // Mount task file
    args.push('--mount', `type=bind,source=${config.taskFile},target=/task.txt,readonly`)

    // Environment variables
    if (config.apiKey) {
      args.push('-e', `ANTHROPIC_API_KEY=${config.apiKey}`)
    }

    if (config.model) {
      args.push('-e', `CLAUDE_MODEL=${config.model}`)
    }

    args.push('-e', 'CLAUDE_CONTAINER=true')
    args.push('-e', 'TASK_PATH=/task.txt')

    // Working directory
    args.push('-w', '/project')

    // Image and command
    args.push(this.IMAGE_NAME)

    // Run Claude Code with the task
    args.push('prompt', '--file', '/task.txt')

    return args
  }

  /**
   * List all running Claude Code containers
   */
  async listContainers(): Promise<string[]> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['ps', '--filter', 'name=claude-code-', '--format', '{{.Names}}'], {
        stdio: 'pipe'
      })

      let output = ''
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.on('close', () => {
        resolve(output.trim().split('\n').filter(Boolean))
      })

      docker.on('error', () => resolve([]))
    })
  }

  /**
   * Stop all running Claude Code containers
   */
  async stopAllContainers(): Promise<void> {
    const containers = await this.listContainers()

    for (const container of containers) {
      await this.stopContainer(container)
    }
  }

  /**
   * Stop a specific container
   */
  async stopContainer(containerName: string): Promise<void> {
    return new Promise((resolve) => {
      const docker = spawn('docker', ['stop', containerName], { stdio: 'pipe' })

      docker.on('close', (code) => {
        if (code === 0) {
          logger.info('Container stopped', { container: containerName })
        } else {
          logger.warn('Failed to stop container', { container: containerName, code })
        }
        resolve()
      })

      docker.on('error', () => resolve())
    })
  }
}

// Global instance
let runner: ClaudeCodeRunner | null = null

export function getClaudeCodeRunner(): ClaudeCodeRunner {
  if (!runner) {
    runner = new ClaudeCodeRunner()
  }
  return runner
}

/**
 * Convenience function to run Claude Code
 */
export async function runClaudeCode(request: ClaudeCodeRequest): Promise<ClaudeCodeResult> {
  const runner = getClaudeCodeRunner()
  return runner.run(request)
}

/**
 * Cleanup all Claude Code containers
 */
export async function cleanupClaudeCodeContainers(): Promise<void> {
  const runner = getClaudeCodeRunner()
  await runner.stopAllContainers()
}
