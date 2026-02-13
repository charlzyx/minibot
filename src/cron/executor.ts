/**
 * Shell脚本执行器
 * 支持标准输入输出重定向、错误捕获和日志记录
 */

import { spawn, ChildProcess } from 'child_process'
import fs from 'fs'
import path from 'path'

export interface ShellExecutionConfig {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  timeout?: number
  maxMemory?: number
  maxCpu?: number
  redirectStdin?: string
  redirectStdout?: string
  redirectStderr?: string
}

export interface ShellExecutionResult {
  exitCode: number | null
  stdout: string
  stderr: string
  duration: number
  success: boolean
  error?: string
}

export class ShellExecutor {
  private static readonly DEFAULT_TIMEOUT = 30000
  private static readonly MAX_LOG_SIZE = 10 * 1024 * 1024

  static async execute(config: ShellExecutionConfig): Promise<ShellExecutionResult> {
    const startTime = Date.now()
    
    try {
      const result = await this.executeProcess(config)
      const duration = Date.now() - startTime
      
      return {
        ...result,
        duration,
        success: result.exitCode === 0
      }
    } catch (error) {
      const duration = Date.now() - startTime
      return {
        exitCode: -1,
        stdout: '',
        stderr: '',
        duration,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private static async executeProcess(config: ShellExecutionConfig): Promise<Omit<ShellExecutionResult, 'duration' | 'success'>> {
    return new Promise((resolve, reject) => {
      const cwd = config.cwd || process.cwd()
      const env = { ...process.env, ...config.env }
      const timeout = config.timeout || this.DEFAULT_TIMEOUT

      let stdout = ''
      let stderr = ''
      let stdoutFile: fs.WriteStream | null = null
      let stderrFile: fs.WriteStream | null = null

      try {
        if (config.redirectStdout) {
          const stdoutPath = path.resolve(cwd, config.redirectStdout)
          stdoutFile = fs.createWriteStream(stdoutPath, { flags: 'a' })
        }

        if (config.redirectStderr) {
          const stderrPath = path.resolve(cwd, config.redirectStderr)
          stderrFile = fs.createWriteStream(stderrPath, { flags: 'a' })
        }

        const child = spawn(config.command, config.args || [], {
          cwd,
          env,
          stdio: ['pipe', 'pipe', 'pipe']
        })

        let timeoutTimer: NodeJS.Timeout | null = null

        const cleanup = () => {
          if (timeoutTimer) {
            clearTimeout(timeoutTimer)
          }
          if (stdoutFile) {
            stdoutFile.end()
          }
          if (stderrFile) {
            stderrFile.end()
          }
        }

        timeoutTimer = setTimeout(() => {
          child.kill('SIGTERM')
          cleanup()
          reject(new Error(`Command timed out after ${timeout}ms`))
        }, timeout)

        child.stdout?.on('data', (data: Buffer) => {
          const chunk = data.toString('utf8')
          stdout += chunk
          
          if (stdoutFile) {
            stdoutFile.write(chunk)
          }
          
          if (stdout.length > this.MAX_LOG_SIZE) {
            stdout = stdout.slice(-this.MAX_LOG_SIZE)
          }
        })

        child.stderr?.on('data', (data: Buffer) => {
          const chunk = data.toString('utf8')
          stderr += chunk
          
          if (stderrFile) {
            stderrFile.write(chunk)
          }
          
          if (stderr.length > this.MAX_LOG_SIZE) {
            stderr = stderr.slice(-this.MAX_LOG_SIZE)
          }
        })

        child.on('error', (error) => {
          cleanup()
          reject(error)
        })

        child.on('exit', (code, signal) => {
          cleanup()
          resolve({
            exitCode: code,
            stdout,
            stderr
          })
        })

        if (config.redirectStdin) {
          const stdinPath = path.resolve(cwd, config.redirectStdin)
          if (fs.existsSync(stdinPath)) {
            const stdinContent = fs.readFileSync(stdinPath, 'utf8')
            child.stdin?.write(stdinContent)
            child.stdin?.end()
          }
        }
      } catch (error) {
        if (stdoutFile) {
          stdoutFile.end()
        }
        if (stderrFile) {
          stderrFile.end()
        }
        reject(error)
      }
    })
  }

  static async executeScript(scriptPath: string, config: Partial<ShellExecutionConfig> = {}): Promise<ShellExecutionResult> {
    const resolvedPath = path.resolve(config.cwd || process.cwd(), scriptPath)
    
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Script not found: ${resolvedPath}`)
    }

    const ext = path.extname(resolvedPath).toLowerCase()
    let command: string
    let args: string[] = []

    switch (ext) {
      case '.sh':
        command = 'bash'
        args = [resolvedPath]
        break
      case '.py':
        command = 'python3'
        args = [resolvedPath]
        break
      case '.js':
        command = 'node'
        args = [resolvedPath]
        break
      case '.ts':
        command = 'npx'
        args = ['tsx', resolvedPath]
        break
      default:
        command = resolvedPath
        args = []
    }

    return this.execute({
      ...config,
      command,
      args: [...(args || []), ...(config.args || [])]
    })
  }

  static async executeWithRetry(
    config: ShellExecutionConfig,
    maxRetries: number = 3,
    retryDelay: number = 1000
  ): Promise<ShellExecutionResult> {
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const result = await this.execute(config)
        
        if (result.success) {
          return result
        }
        
        lastError = new Error(`Command failed with exit code ${result.exitCode}`)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
      }

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay))
      }
    }

    return {
      exitCode: -1,
      stdout: '',
      stderr: '',
      duration: 0,
      success: false,
      error: lastError?.message || 'Max retries exceeded'
    }
  }
}
