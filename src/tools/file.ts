import fs from 'fs/promises'
import path from 'path'
import { existsSync } from 'fs'
import type { FileAction, FileParams, FileResult, ToolResult } from '@/types'
import { ToolBase } from './base'
import { createLogger } from '@/utils'

const logger = createLogger('FileTool')

/**
 * File tool for file system operations
 */
export class FileTool extends ToolBase<FileParams, FileResult> {
  readonly name = 'file'
  readonly description = 'File operations: read, write, delete, list, mkdir, append'
  readonly parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'delete', 'list', 'mkdir', 'append'],
        description: 'The file operation to perform'
      },
      path: {
        type: 'string',
        description: 'File or directory path (relative to workspace)'
      },
      content: {
        type: 'string',
        description: 'Content for write/append operations'
      },
      workspace: {
        type: 'string',
        description: 'Workspace directory (defaults to env.WORKSPACE or cwd)'
      }
    },
    required: ['action', 'path']
  } as const

  /**
   * Resolve full path within workspace
   */
  private resolvePath(inputPath: string, workspace: string): string {
    // Prevent path traversal attacks
    const normalizedPath = path.normalize(inputPath).replace(/^(\.\.(\/|\\|$))+/, '')
    return path.join(workspace, normalizedPath)
  }

  /**
   * Validate path is within workspace
   */
  private validatePath(fullPath: string, workspace: string): void {
    const resolvedWorkspace = path.resolve(workspace)
    const resolvedPath = path.resolve(fullPath)

    if (!resolvedPath.startsWith(resolvedWorkspace)) {
      throw new Error(`Path traversal detected: ${fullPath} is outside workspace`)
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Read file content
   */
  private async readFile(filePath: string): Promise<FileResult> {
    if (!(await this.fileExists(filePath))) {
      return {
        status: 404,
        message: `File not found: ${filePath}`
      }
    }

    const content = await fs.readFile(filePath, 'utf-8')

    return {
      status: 200,
      message: 'File read successfully',
      path: filePath,
      data: content
    }
  }

  /**
   * Write file content
   */
  private async writeFile(filePath: string, content: string): Promise<FileResult> {
    const dir = path.dirname(filePath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })

    await fs.writeFile(filePath, content, 'utf-8')

    return {
      status: 200,
      message: 'File written successfully',
      path: filePath
    }
  }

  /**
   * Append content to file
   */
  private async appendFile(filePath: string, content: string): Promise<FileResult> {
    const dir = path.dirname(filePath)

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })

    await fs.appendFile(filePath, content, 'utf-8')

    return {
      status: 200,
      message: 'Content appended successfully',
      path: filePath
    }
  }

  /**
   * Delete file
   */
  private async deleteFile(filePath: string): Promise<FileResult> {
    if (!(await this.fileExists(filePath))) {
      return {
        status: 404,
        message: `File not found: ${filePath}`
      }
    }

    await fs.unlink(filePath)

    return {
      status: 200,
      message: 'File deleted successfully',
      path: filePath
    }
  }

  /**
   * List directory contents
   */
  private async listDirectory(dirPath: string): Promise<FileResult> {
    if (!(await this.fileExists(dirPath))) {
      return {
        status: 404,
        message: `Directory not found: ${dirPath}`
      }
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true })

    const data = entries.map(entry => ({
      name: entry.name,
      type: entry.isDirectory() ? 'directory' : 'file'
    }))

    return {
      status: 200,
      message: 'Directory listed successfully',
      path: dirPath,
      data
    }
  }

  /**
   * Create directory
   */
  private async createDirectory(dirPath: string): Promise<FileResult> {
    if (await this.fileExists(dirPath)) {
      return {
        status: 409,
        message: `Directory already exists: ${dirPath}`
      }
    }

    await fs.mkdir(dirPath, { recursive: true })

    return {
      status: 201,
      message: 'Directory created successfully',
      path: dirPath
    }
  }

  /**
   * Execute file operation
   */
  protected async executeImpl(
    params: FileParams,
    context?: unknown
  ): Promise<FileResult> {
    const { action, path: inputPath, content, workspace } = params

    const workspacePath = workspace || process.env.WORKSPACE || process.cwd()
    const fullPath = this.resolvePath(inputPath, workspacePath)

    // Validate path is within workspace
    this.validatePath(fullPath, workspacePath)

    logger.info(`File operation: ${action}`, { path: fullPath })

    switch (action) {
      case 'read':
        return await this.readFile(fullPath)

      case 'write':
        if (!content) {
          throw new Error('Content is required for write operation')
        }
        return await this.writeFile(fullPath, content)

      case 'append':
        if (!content) {
          throw new Error('Content is required for append operation')
        }
        return await this.appendFile(fullPath, content)

      case 'delete':
        return await this.deleteFile(fullPath)

      case 'list':
        return await this.listDirectory(fullPath)

      case 'mkdir':
        return await this.createDirectory(fullPath)

      default:
        throw new Error(`Unknown action: ${action}`)
    }
  }
}

// Export singleton instance
export const fileTool = new FileTool()

export default fileTool
