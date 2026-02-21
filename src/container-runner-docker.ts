/**
 * Docker Container Runner
 * 真正的容器隔离实现，每个 /code 命令都在独立的容器中运行
 *
 * Inspired by nanoclaw's container implementation:
 * - Sentinel markers for output parsing
 * - Real-time stdout monitoring
 * - Proper agent-runner inside containers
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getWorkspace } from './config/manager'
import { createLogger } from './utils'

const logger = createLogger('DockerContainer')

// Sentinel markers for output parsing (inspired by nanoclaw)
const OUTPUT_START_MARKER = '---MINIBOT_OUTPUT_START---'
const OUTPUT_END_MARKER = '---MINIBOT_OUTPUT_END---'

interface ContainerOutput {
  status: 'success' | 'error'
  result?: string
  error?: string
  containerId?: string
  newSessionId?: string
}

interface ContainerOptions {
  imageName?: string
  memoryLimit?: string
  cpuLimit?: string
  timeout?: number
  networkMode?: 'bridge' | 'host' | 'none'
}

interface DockerContainerConfig {
  name: string
  image: string
  cmd: string[]
  workingDir: string
  env: Record<string, string>
  binds: ReadonlyArray<{ source: string; target: string }>
  autoRemove: boolean
  networkDisabled: boolean
  memory: number
  cpuQuota: number
  cpuPeriod: number
}

interface RunContainerOptions {
  groupFolder: string
  prompt: string
  sessionId?: string
  chatJid?: string
  containerOptions?: ContainerOptions
}

/**
 * Docker Container Runner - 真正的容器隔离
 */
export class DockerContainerRunner {
  private dataDir: string
  private readonly DEFAULT_IMAGE = 'node:18-alpine'
  private readonly DEFAULT_MEMORY = '512m'
  private readonly DEFAULT_CPU_QUOTA = 50000 // 50% of 1 CPU
  private readonly DEFAULT_CPU_PERIOD = 100000

  constructor() {
    this.dataDir = getWorkspace()
    this.verifyDockerInstalled()
  }

  /**
   * 验证 Docker 是否已安装
   */
  private verifyDockerInstalled(): void {
    try {
      const result = spawn('docker', ['--version'], { stdio: 'pipe' })
      result.on('error', () => {
        throw new Error('Docker is not installed. Please install Docker first.')
      })
      result.on('close', (code) => {
        if (code !== 0) {
          throw new Error('Docker is not installed. Please install Docker first.')
        }
      })
    } catch (error) {
      logger.warn('Docker verification failed', { error })
    }
  }

  /**
   * 运行代码助手容器
   * 每次调用都会创建一个全新的独立容器
   * 使用 stdout 监控和 sentinel markers 解析输出
   */
  async runCodeAssistant(options: RunContainerOptions): Promise<ContainerOutput> {
    const { groupFolder, prompt, sessionId, chatJid, containerOptions = {} } = options

    logger.info('Starting code assistant container', { groupFolder, sessionId })

    // 创建工作目录
    const workspaceDir = path.join(this.dataDir, 'containers', groupFolder)
    const inputDataDir = path.join(workspaceDir, 'input')
    const outputDataDir = path.join(workspaceDir, 'output')
    fs.mkdirSync(inputDataDir, { recursive: true })
    fs.mkdirSync(outputDataDir, { recursive: true })

    // 写入输入文件
    const inputFile = path.join(inputDataDir, 'task.json')
    fs.writeFileSync(inputFile, JSON.stringify({
      prompt,
      sessionId,
      chatJid,
      timestamp: Date.now()
    }))

    // 生成容器名称（确保唯一性）
    const containerName = `minibot-code-${groupFolder}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    // 准备容器配置
    const config = this.buildDockerConfig(containerName, workspaceDir, inputDataDir, outputDataDir, containerOptions)

    logger.info('Container config prepared', {
      name: containerName,
      image: config.image,
      memory: config.memory,
      workingDir: config.workingDir
    })

    let containerId = ''
    let containerProc: ChildProcess | null = null

    try {
      // 拉取镜像（如果不存在）
      await this.ensureImageExists(config.image)

      // 启动容器（返回进程用于 stdout 监控）
      const result = await this.createAndStartContainer(config)
      containerId = result.containerId
      containerProc = result.process

      logger.info('Container started', { containerId, containerName })

      // 等待容器完成（监控 stdout）
      const output = await this.waitForContainer(
        containerProc,
        containerId,
        containerOptions?.timeout || 60000
      )

      logger.info('Container finished', { containerId, status: output.status })
      return output
    } catch (error) {
      logger.error('Container execution failed', error, { containerName })
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      // 清理容器
      if (containerId) {
        await this.cleanupContainer(containerId)
      }
    }
  }

  /**
   * 构建 Docker 配置
   */
  private buildDockerConfig(
    containerName: string,
    workspaceDir: string,
    inputDataDir: string,
    _outputDataDir: string,
    options: ContainerOptions
  ): DockerContainerConfig {
    const imageName = options.imageName || this.DEFAULT_IMAGE
    const memoryLimit = parseInt(options.memoryLimit || this.DEFAULT_MEMORY) * 1024 * 1024
    const cpuQuota = options.cpuLimit ? parseInt(options.cpuLimit) * 10000 : this.DEFAULT_CPU_QUOTA

    // Create workspace directory
    fs.mkdirSync(path.join(workspaceDir, 'workspace'), { recursive: true })

    // 准备容器内的代码执行脚本
    const scriptPath = path.join(inputDataDir, 'script.js')
    fs.writeFileSync(scriptPath, this.generateContainerScript())

    const binds: { source: string; target: string }[] = [
      { source: inputDataDir, target: '/workspace/input:ro' },
      { source: path.join(workspaceDir, 'workspace'), target: '/workspace/workspace:rw' }
    ]

    return {
      name: containerName,
      image: imageName,
      cmd: ['node', '/workspace/input/script.js'],
      workingDir: '/workspace',
      env: {
        NODE_ENV: 'production',
        MINIBOT_CONTAINER: 'true',
        CONTAINER_NAME: containerName,
        WORKSPACE_DIR: '/workspace/workspace'
      },
      binds,
      autoRemove: true,
      networkDisabled: options.networkMode !== 'host',
      memory: memoryLimit,
      cpuQuota,
      cpuPeriod: this.DEFAULT_CPU_PERIOD
    }
  }

  /**
   * 生成容器内执行脚本
   * 使用 stdout 输出和 sentinel markers（参考 nanoclaw）
   *
   * 功能：执行简单的代码任务并返回结果
   */
  private generateContainerScript(): string {
    return `
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Sentinel markers for output parsing
const OUTPUT_START_MARKER = '${OUTPUT_START_MARKER}';
const OUTPUT_END_MARKER = '${OUTPUT_END_MARKER}';

function log(message) {
  console.error('[agent-runner] ' + message);
}

function writeOutput(output) {
  console.log(OUTPUT_START_MARKER);
  console.log(JSON.stringify(output));
  console.log(OUTPUT_END_MARKER);
}

/**
 * Execute a shell command and return the result
 */
function executeCommand(command, args = [], cwd = '/workspace') {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    const timeout = 30000; // 30 seconds

    const proc = spawn(command, args, {
      cwd,
      stdio: 'pipe',
      timeout
    });

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim()
      });
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Analyze the prompt and determine what action to take
 */
function analyzePrompt(prompt) {
  const lowerPrompt = prompt.toLowerCase();

  // Check if it's a code execution request
  if (lowerPrompt.includes('run') || lowerPrompt.includes('execute') || lowerPrompt.includes('exec')) {
    // Extract command (simple heuristic)
    const match = prompt.match(/(?:run|execute|exec)\\s+(.+)/i);
    if (match) {
      return { type: 'execute', command: match[1] };
    }
  }

  // Check if it's a file operation
  if (lowerPrompt.includes('create') || lowerPrompt.includes('write') || lowerPrompt.includes('save')) {
    const match = prompt.match(/(?:create|write|save)\\s+(?:file\\s+)?(.+?)\\s+(?:with|content)?\\s*(.+)/i);
    if (match) {
      return { type: 'write', filename: match[1], content: match[2] };
    }
  }

  // Check if it's a read operation
  if (lowerPrompt.includes('read') || lowerPrompt.includes('show') || lowerPrompt.includes('cat')) {
    const match = prompt.match(/(?:read|show|cat)\\s+(.+)/i);
    if (match) {
      return { type: 'read', filename: match[1] };
    }
  }

  // Default to informational response
  return { type: 'info' };
}

/**
 * Execute the analyzed action
 */
async function executeAction(action, prompt) {
  const workspaceDir = '/workspace';

  switch (action.type) {
    case 'execute': {
      log('Executing command: ' + action.command);
      const parts = action.command.split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      const result = await executeCommand(cmd, args, workspaceDir);
      return {
        status: result.exitCode === 0 ? 'success' : 'error',
        result: result.stdout || 'Command executed',
        error: result.stderr || (result.exitCode !== 0 ? \`Exit code: \${result.exitCode}\` : undefined)
      };
    }

    case 'write': {
      log('Writing file: ' + action.filename);
      const filepath = path.join(workspaceDir, action.filename);
      fs.writeFileSync(filepath, action.content, 'utf8');
      return {
        status: 'success',
        result: \`File \${action.filename} created successfully\`
      };
    }

    case 'read': {
      log('Reading file: ' + action.filename);
      const filepath = path.join(workspaceDir, action.filename);

      if (!fs.existsSync(filepath)) {
        return {
          status: 'error',
          error: \`File not found: \${action.filename}\`
        };
      }

      const content = fs.readFileSync(filepath, 'utf8');
      return {
        status: 'success',
        result: content
      };
    }

    case 'info': {
      // List workspace contents
      const files = fs.readdirSync(workspaceDir).filter(f => {
        const stat = fs.statSync(path.join(workspaceDir, f));
        return stat.isFile()
      });

      return {
        status: 'success',
        result: \`Minibot Code Assistant\\n\\nWorkspace: \${workspaceDir}\\nFiles: \${files.length}\\n\\nAvailable commands:\\n- run <command>\\n- create file <filename> with <content>\\n- read <filename>\\n\\nYour request: \${prompt}\`
      };
    }

    default:
      return {
        status: 'error',
        error: 'Unknown action type'
      };
  }
}

async function main() {
  let input;

  try {
    // 读取任务
    const inputFile = path.join('/workspace/input', 'task.json');
    const inputContent = fs.readFileSync(inputFile, 'utf8');
    input = JSON.parse(inputContent);
    log('Received prompt: ' + input.prompt.substring(0, 100));
  } catch (err) {
    writeOutput({
      status: 'error',
      error: 'Failed to read input: ' + (err?.message || String(err))
    });
    process.exit(1);
  }

  try {
    // Create workspace directory
    const workspaceDir = '/workspace';
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }

    // Analyze the prompt
    const action = analyzePrompt(input.prompt);
    log('Action type: ' + action.type);

    // Execute the action
    const result = await executeAction(action, input.prompt);

    log('Task completed: ' + result.status);
    writeOutput({
      status: result.status,
      result: result.result,
      error: result.error,
      newSessionId: 'session-' + Date.now()
    });
  } catch (err) {
    const errorMessage = err?.message || String(err);
    log('Task error: ' + errorMessage);
    writeOutput({
      status: 'error',
      error: errorMessage,
      newSessionId: input.sessionId
    });
    process.exit(1);
  }
}

main().catch(err => {
  log('Fatal error: ' + (err?.message || String(err)));
  writeOutput({
    status: 'error',
    error: 'Fatal error: ' + (err?.message || String(err))
  });
  process.exit(1);
});
`
  }

  /**
   * 确保 Docker 镜像存在
   */
  private async ensureImageExists(imageName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['pull', imageName], { stdio: 'pipe' })

      let output = ''
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.on('close', (code) => {
        if (code === 0) {
          logger.debug('Docker image pulled successfully', { imageName })
          resolve()
        } else {
          // 镜像可能已经存在
          logger.debug('Docker pull result', { code, output })
          resolve()
        }
      })

      docker.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * 创建并启动容器
   * 返回容器 ID 和进程（用于 stdout 监控）
   */
  private async createAndStartContainer(config: DockerContainerConfig): Promise<{ containerId: string; process: ChildProcess }> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['create', ...this.buildDockerCreateArgs(config)], { stdio: 'pipe' })

      let output = ''
      let errorOutput = ''

      docker.stdout?.on('data', (data) => { output += data.toString() })
      docker.stderr?.on('data', (data) => { errorOutput += data.toString() })

      docker.on('close', (code) => {
        if (code !== 0) {
          logger.error('Docker create failed', { code, output, error: errorOutput })
          reject(new Error(`Docker create failed: ${errorOutput}`))
          return
        }

        const containerId = output.trim()
        logger.debug('Container created', { containerId })

        // 启动容器并附加 stdout 以获取实时输出
        const startDocker = spawn('docker', ['start', '-a', containerId], { stdio: 'pipe' })

        startDocker.on('close', (startCode) => {
          if (startCode !== 0) {
            logger.warn('Docker start exited with non-zero code', { containerId, code: startCode })
          }
        })

        startDocker.on('error', (error) => {
          reject(error)
        })

        // 立即返回，让调用方监控输出
        resolve({ containerId, process: startDocker })
      })

      docker.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * 等待容器完成执行
   * 使用 stdout 监控和 sentinel markers 解析输出（参考 nanoclaw）
   */
  private async waitForContainer(
    containerProc: ChildProcess,
    containerId: string,
    timeout: number
  ): Promise<ContainerOutput> {
    return new Promise((resolve) => {
      let stdout = ''
      let stderr = ''
      let timeoutHandle: NodeJS.Timeout | null = null
      let resolved = false

      const doResolve = (output: ContainerOutput) => {
        if (resolved) return
        resolved = true
        if (timeoutHandle) clearTimeout(timeoutHandle)
        resolve(output)
      }

      // 设置超时
      timeoutHandle = setTimeout(() => {
        logger.warn('Container execution timeout', { containerId, timeout })
        containerProc.kill()
        doResolve({
          status: 'error',
          error: 'Container execution timeout'
        })
      }, timeout)

      // 收集 stdout
      containerProc.stdout?.on('data', (data) => {
        stdout += data.toString()

        // 检查是否包含完整的输出标记
        const startIndex = stdout.indexOf(OUTPUT_START_MARKER)
        const endIndex = stdout.indexOf(OUTPUT_END_MARKER)

        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          // 提取标记之间的 JSON
          const jsonStart = startIndex + OUTPUT_START_MARKER.length
          const jsonStr = stdout.substring(jsonStart, endIndex).trim()

          try {
            const output = JSON.parse(jsonStr) as ContainerOutput
            logger.info('Container output parsed successfully', { containerId, status: output.status })
            doResolve(output)
          } catch (error) {
            logger.error('Failed to parse container output', { error, jsonStr })
            doResolve({
              status: 'error',
              error: `Failed to parse output: \${error}`
            })
          }
        }
      })

      // 收集 stderr（用于调试）
      containerProc.stderr?.on('data', (data) => {
        stderr += data.toString()
        logger.debug('Container stderr', { containerId, message: data.toString() })
      })

      // 监控进程退出
      containerProc.on('close', (code) => {
        if (!resolved) {
          logger.info('Container process closed', { containerId, exitCode: code })

          // 如果已经通过 stdout 解析了输出，就不需要再处理
          if (stdout.includes(OUTPUT_START_MARKER) && stdout.includes(OUTPUT_END_MARKER)) {
            return
          }

          // 否则返回错误
          doResolve({
            status: 'error',
            error: `Container exited with code \${code} without producing output`
          })
        }
      })

      containerProc.on('error', (error) => {
        if (!resolved) {
          logger.error('Container process error', { containerId, error })
          doResolve({
            status: 'error',
            error: `Container process error: \${error.message}`
          })
        }
      })
    })
  }

  /**
   * 清理容器
   */
  private async cleanupContainer(containerName: string): Promise<void> {
    try {
      // 容器设置了 autoRemove，但为了保险起见显式删除
      const docker = spawn('docker', ['rm', '-f', containerName], { stdio: 'pipe' })
      docker.on('close', (code) => {
        if (code === 0) {
          logger.debug('Container cleaned up', { containerName })
        }
      })
    } catch (error) {
      logger.warn('Container cleanup failed', { error, containerName })
    }
  }

  /**
   * 构建 docker create 命令参数
   */
  private buildDockerCreateArgs(config: DockerContainerConfig): string[] {
    const args = ['create', '--name', config.name]

    // 资源限制
    args.push('--memory', config.memory.toString())
    args.push('--memory-swap', config.memory.toString())
    args.push('--cpu-quota', config.cpuQuota.toString())
    args.push('--cpu-period', config.cpuPeriod.toString())

    // 网络配置
    if (config.networkDisabled) {
      args.push('--network=none')
    }

    // 只读文件系统
    args.push('--read-only')

    // 移除容器
    args.push('--rm')

    // 挂载卷
    for (const bind of config.binds) {
      args.push('--mount', `type=bind,source=${bind.source},target=${bind.target}${bind.source.endsWith(':ro') ? ',readonly' : ''}`)
    }

    // 工作目录
    args.push('-w', config.workingDir)

    // 环境变量
    for (const [key, value] of Object.entries(config.env)) {
      args.push('-e', `${key}=${value}`)
    }

    // 镜像和命令
    args.push(config.image)
    args.push(...config.cmd)

    return args
  }

  /**
   * 获取容器统计信息
   */
  async getContainerStats(containerId: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['stats', containerId, '--no-stream', '--format', '{{json}}'], { stdio: 'pipe' })

      let output = ''
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.on('close', (code) => {
        if (code === 0) {
          try {
            resolve(JSON.parse(output))
          } catch {
            resolve({})
          }
        } else {
          resolve({})
        }
      })

      docker.on('error', reject)
    })
  }

  /**
   * 列出所有运行中的 Minibot 容器
   */
  async listMinibotContainers(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['ps', '--filter', 'name=minibot-code-', '--format', '{{.Names}}'], { stdio: 'pipe' })

      let output = ''
      docker.stdout.on('data', (data) => {
        output += data.toString()
      })

      docker.on('close', (code) => {
        if (code === 0) {
          const containers = output.trim().split('\n').filter(Boolean)
          resolve(containers)
        } else {
          resolve([])
        }
      })

      docker.on('error', reject)
    })
  }

  /**
   * 强制停止所有 Minibot 容器
   */
  async stopAllContainers(): Promise<void> {
    const containers = await this.listMinibotContainers()

    for (const container of containers) {
      try {
        await this.forceStopContainer(container)
        logger.info('Stopped container', { container })
      } catch (error) {
        logger.warn('Failed to stop container', { error, container })
      }
    }
  }

  /**
   * 强制停止指定容器
   */
  async forceStopContainer(containerIdOrName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['rm', '-f', containerIdOrName], { stdio: 'pipe' })

      docker.on('close', (code) => {
        if (code === 0) {
          logger.info('Container force stopped', { container: containerIdOrName })
          resolve()
        } else {
          reject(new Error(`Failed to stop container: ${containerIdOrName}`))
        }
      })

      docker.on('error', reject)
    })
  }
}

// ============================================================================
// 导出接口
// ============================================================================

export interface RunCodeAssistantOptions {
  prompt: string
  sessionId?: string
  chatJid?: string
  containerOptions?: ContainerOptions
  onOutput?: (output: ContainerOutput) => Promise<void>
}

export async function runCodeAssistant(options: RunCodeAssistantOptions): Promise<ContainerOutput> {
  const {
    prompt,
    sessionId,
    chatJid,
    containerOptions = {},
    onOutput
  } = options

  const runner = new DockerContainerRunner()
  const groupFolder = `code-${Date.now()}`

  const result = await runner.runCodeAssistant({
    groupFolder,
    prompt,
    sessionId,
    chatJid,
    containerOptions
  })

  if (onOutput) {
    await onOutput(result)
  }

  return result
}

export async function cleanupCodeContainers(): Promise<void> {
  const runner = new DockerContainerRunner()
  await runner.stopAllContainers()
}
