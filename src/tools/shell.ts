import { spawn } from 'child_process'
import type { ShellOptions, ShellResult, ToolResult } from '@/types'
import { ToolBase } from './base'
import { SecurityError, ValidationError, createLogger } from '@/utils'

const logger = createLogger('ShellTool')

/**
 * Default allowed shell commands
 */
const DEFAULT_ALLOWED_COMMANDS = new Set([
  // File operations
  'ls', 'pwd', 'cd', 'cat', 'head', 'tail', 'less', 'more',
  'find', 'grep', 'awk', 'sed', 'sort', 'uniq', 'wc',

  // File management
  'cp', 'mv', 'mkdir', 'rmdir', 'touch', 'rm',

  // Development tools
  'npm', 'pnpm', 'yarn', 'node', 'python', 'python3', 'pip',
  'git', 'docker', 'docker-compose', 'make', 'cmake',

  // Network tools
  'curl', 'wget', 'ping', 'traceroute', 'nslookup', 'ssh',

  // System tools
  'ps', 'top', 'htop', 'df', 'du', 'free', 'uname', 'date',
  'echo', 'printf', 'xargs', 'tee', 'tar', 'zip', 'unzip',

  // Text editors
  'nano', 'vim', 'vi', 'code'
])

/**
 * Dangerous command patterns to detect
 */
const DANGEROUS_PATTERNS = [
  // Destructive operations
  /rm\s+-rf\s+\//,
  /rm\s+-rf\s+\./,
  />?\s*\/dev\/[a-z]+/, // Writing to devices
  /:\s*\(\s*\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/, // Fork bomb

  // Command chaining exploits
  /;\s*rm/,
  /\|\s*rm/,
  /&&\s*rm/,
  /\|\|\s*rm/,

  // Privilege escalation
  /sudo\s+/,
  /su\s+/,

  // Data exfiltration
  /curl.*\|.*sh/,
  /wget.*\|.*sh/,
  /eval\s+/,
  /exec\s+/,

  // History manipulation
  /history\s+-c/,
  /history\s+-d/
]

/**
 * Shell tool for executing commands
 */
export class ShellTool extends ToolBase<
  { command: string; args?: string[]; cwd?: string; timeout?: number },
  ShellResult
> {
  readonly name = 'shell'
  readonly description = 'Execute shell commands with safety validation'
  readonly parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute'
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Command arguments'
      },
      cwd: {
        type: 'string',
        description: 'Working directory for command execution'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds (default: 30000)'
      }
    },
    required: ['command']
  } as const

  private allowedCommands: Set<string>

  constructor(allowedCommands?: string[]) {
    super()
    this.allowedCommands = allowedCommands
      ? new Set(allowedCommands)
      : DEFAULT_ALLOWED_COMMANDS
  }

  /**
   * Validate command safety
   */
  private validateCommand(command: string): void {
    const baseCommand = command.split(' ')[0]

    if (!this.allowedCommands.has(baseCommand)) {
      throw new SecurityError(
        `Command not allowed: ${baseCommand}`,
        {
          command: baseCommand,
          allowedCommands: Array.from(this.allowedCommands)
        }
      )
    }

    // Check for dangerous patterns in the full command
    const fullCommandCheck = `${command}`.toLowerCase()
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(fullCommandCheck)) {
        throw new SecurityError(
          'Dangerous command pattern detected',
          { command, pattern: pattern.source }
        )
      }
    }

    logger.debug(`Command validated: ${baseCommand}`)
  }

  /**
   * Execute the shell command
   */
  protected async executeImpl(
    params: { command: string; args?: string[]; cwd?: string; timeout?: number },
    context?: unknown
  ): Promise<ShellResult> {
    const { command, args = [], cwd, timeout = 30000 } = params

    // Validate command safety
    this.validateCommand(command)

    logger.info(`Executing command: ${command}`, { args, cwd })

    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: cwd || process.env.WORKSPACE || process.cwd(),
        timeout,
        env: {
          ...process.env,
          PATH: process.env.PATH
        }
      })

      let stdout = ''
      let stderr = ''

      proc.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        const success = code === 0
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          code,
          success
        })
      })

      proc.on('error', (error) => {
        reject(error)
      })
    })
  }
}

// Export singleton instance
export const shellTool = new ShellTool()

export default shellTool
