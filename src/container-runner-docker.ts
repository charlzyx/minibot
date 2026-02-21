/**
 * Docker Container Runner
 * 真正的容器隔离实现，每个 /code 命令都在独立的容器中运行
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'
import { getWorkspace } from './config/manager'
import { createLogger } from './utils'

const logger = createLogger('DockerContainer')

interface ContainerOutput {
  status: 'success' | 'error'
  result?: string
  error?: string
  containerId?: string
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

    try {
      // 拉取镜像（如果不存在）
      await this.ensureImageExists(config.image)

      // 启动容器
      const containerId = await this.createAndStartContainer(config)
      logger.info('Container started', { containerId, containerName })

      // 等待容器完成
      const result = await this.waitForContainer(containerId, outputDataDir, containerOptions?.timeout || 60000)

      logger.info('Container finished', { containerId, status: result.status })
      return result
    } catch (error) {
      logger.error('Container execution failed', error, { containerName })
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      }
    } finally {
      // 清理容器
      await this.cleanupContainer(containerName)
    }
  }

  /**
   * 构建 Docker 配置
   */
  private buildDockerConfig(
    containerName: string,
    workspaceDir: string,
    inputDataDir: string,
    outputDataDir: string,
    options: ContainerOptions
  ): DockerContainerConfig {
    const imageName = options.imageName || this.DEFAULT_IMAGE
    const memoryLimit = parseInt(options.memoryLimit || this.DEFAULT_MEMORY) * 1024 * 1024
    const cpuQuota = options.cpuLimit ? parseInt(options.cpuLimit) * 10000 : this.DEFAULT_CPU_QUOTA

    // 准备容器内的代码执行脚本
    const scriptPath = path.join(inputDataDir, 'script.js')
    fs.writeFileSync(scriptPath, this.generateContainerScript(inputDataDir, outputDataDir))

    return {
      name: containerName,
      image: imageName,
      cmd: ['node', '/workspace/script.js'],
      workingDir: '/workspace',
      env: {
        NODE_ENV: 'production',
        TASK: JSON.stringify({ prompt: options.prompt }),
        SESSION_ID: options.sessionId || '',
        CHAT_JID: options.chatJid || ''
      },
      binds: [
        `${inputDataDir}:/workspace/input:ro`,
        `${outputDataDir}:/workspace/output:rw`
      ],
      autoRemove: true,
      networkDisabled: options.networkMode !== 'host',
      memory: memoryLimit,
      cpuQuota,
      cpuPeriod: this.DEFAULT_CPU_PERIOD
    }
  }

  /**
   * 生成容器内执行脚本
   */
  private generateContainerScript(inputDir: string, outputDir: string): string {
    return `
const fs = require('fs');
const path = require('path');

// 读取任务
const inputFile = path.join('/workspace/input', 'task.json');
const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

console.log('Task:', input.prompt.substring(0, 100));

// 模拟代码助手处理
const result = {
  status: 'success',
  result: 'Here is your code assistant response for: ' + input.prompt,
  timestamp: new Date().toISOString()
};

// 写入输出
const outputFile = path.join('/workspace/output', 'result.json');
fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

console.log('Task completed');
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
   */
  private async createAndStartContainer(config: DockerContainerConfig): Promise<string> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['create', this.buildDockerCreateArgs(config)], { stdio: 'pipe' })

      let output = ''
      let errorOutput = ''

      docker.stdout.on('data', (data) => { output += data.toString() })
      docker.stderr.on('data', (data) => { errorOutput += data.toString() })

      docker.on('close', (code) => {
        if (code !== 0) {
          logger.error('Docker create failed', { code, output, error: errorOutput })
          reject(new Error(\`Docker create failed: \${errorOutput}\`))
          return
        }

        const containerId = output.trim()
        logger.debug('Container created', { containerId })

        // 启动容器
        const startDocker = spawn('docker', ['start', containerId], { stdio: 'pipe' })

        startDocker.on('close', (startCode) => {
          if (startCode !== 0) {
            reject(new Error(\`Docker start failed: \${containerId}\`))
          } else {
            resolve(containerId)
          }
        })

        startDocker.on('error', (error) => {
          reject(error)
        })
      })

      docker.on('error', (error) => {
        reject(error)
      })
    })
  }

  /**
   * 等待容器完成执行
   */
  private async waitForContainer(
    containerId: string,
    outputDir: string,
    timeout: number
  ): Promise<ContainerOutput> {
    return new Promise((resolve) => {
      const outputFile = path.join(outputDir, 'result.json')
      let attempts = 0
      const maxAttempts = Math.ceil(timeout / 500)

      const checkInterval = setInterval(() => {
        if (fs.existsSync(outputFile)) {
          clearInterval(checkInterval)
          try {
            const content = fs.readFileSync(outputFile, 'utf8')
            const result = JSON.parse(content) as ContainerOutput
            resolve(result)
          } catch (error) {
            resolve({
              status: 'error',
              error: \`Failed to parse output: \${error}\`
            })
          }
        }

        attempts++
        if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          resolve({
            status: 'error',
            error: 'Container execution timeout'
          })
        }
      }, 500)

      // 监控容器状态
      this.monitorContainerStatus(containerId).catch(() => {
        // 容器可能已经正常结束
      })
    })
  }

  /**
   * 监控容器状态
   */
  private async monitorContainerStatus(containerId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const docker = spawn('docker', ['wait', containerId], { stdio: 'pipe' })

      docker.on('close', (code) => {
        if (code !== 0 && code !== 127) {
          logger.warn('Container exited with non-zero code', { containerId, code })
        }
        resolve()
      })

      docker.on('error', (error) => {
        reject(error)
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
      args.push('--mount', \`type=bind,source=\${bind.source},target=\${bind.target}\${bind.source.endsWith(':ro') ? ',readonly' : ''}\`)
    }

    // 工作目录
    args.push('-w', config.workingDir)

    // 环境变量
    for (const [key, value] of Object.entries(config.env)) {
      args.push('-e', \`\${key}=\${value}\`)
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
          })
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
          const containers = output.trim().split('\\n').filter(Boolean)
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
          reject(new Error(\`Failed to stop container: \${containerIdOrName}\`))
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
  onRegisterProcess?: (containerId: string, containerName: string) => void
  onOutput?: (output: ContainerOutput) => Promise<void>
}

export async function runCodeAssistant(options: RunCodeAssistantOptions): Promise<ContainerOutput> {
  const {
    prompt,
    sessionId,
    chatJid,
    containerOptions = {},
    onRegisterProcess,
    onOutput
  } = options

  const runner = new DockerContainerRunner()
  const groupFolder = \`code-\${Date.now()}\`

  // 包装 onRegisterProcess 以传递容器 ID
  const wrappedOnRegisterProcess = (containerId: string, containerName: string) => {
    logger.info('Container registered', { containerId, containerName })
    if (onRegisterProcess) {
      onRegisterProcess(containerId, containerName)
    }
  }

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

export { DockerContainerRunner }
