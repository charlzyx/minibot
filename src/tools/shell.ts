import { spawn } from 'child_process'

export interface ShellResult {
  stdout: string
  stderr: string
  code: number | null
}

export class ShellTool {
  async execute(command: string, args: string[] = []): Promise<ShellResult> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, {
        cwd: process.env.WORKSPACE || process.cwd(),
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      proc.on('close', (code) => {
        resolve({
          stdout,
          stderr,
          code: code !== null ? code : null
        })
      })

      proc.on('error', (error) => {
        reject(error)
      })
    })
  }
}

export default new ShellTool()
