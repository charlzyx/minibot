import fs from 'fs/promises'
import path from 'path'

export interface FileResult {
  status: number
  message: string
  path?: string
  data?: any
}

export class FileTool {
  async execute(params: { 
    action: 'read' | 'write' | 'delete' | 'list' | 'mkdir',
    path: string,
    content?: string,
    workspace?: string
  }): Promise<FileResult> {
    const workspacePath = params.workspace || process.env.WORKSPACE || process.cwd()
    const targetPath = path.join(workspacePath, params.path)
    
    try {
      switch (params.action) {
        case 'read':
          return await this.readFile(targetPath)
        
        case 'write':
          if (!params.content) {
            throw new Error('Content is required for write action')
          }
          return await this.writeFile(targetPath, params.content)
        
        case 'delete':
          return await this.deleteFile(targetPath)
        
        case 'list':
          return await this.listFiles(path.dirname(targetPath))
        
        case 'mkdir':
          return await this.createDirectory(targetPath)
        
        default:
          throw new Error(`Unknown action: ${params.action}`)
      }
    } catch (error) {
      return {
        status: 0,
        message: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async readFile(filePath: string): Promise<FileResult> {
    const exists = await fs.access(filePath).then(() => true, () => false)
    
    if (!exists) {
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

  private async deleteFile(filePath: string): Promise<FileResult> {
    const exists = await fs.access(filePath).then(() => true, () => false)
    
    if (!exists) {
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

  private async listFiles(dirPath: string): Promise<FileResult> {
    const exists = await fs.access(dirPath).then(() => true, () => false)
    
    if (!exists) {
      return {
        status: 404,
        message: `Directory not found: ${dirPath}`
      }
    }
    
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    
    return {
      status: 200,
      message: 'Directory listed successfully',
      path: dirPath,
      data: entries
    }
  }

  private async createDirectory(dirPath: string): Promise<FileResult> {
    const exists = await fs.access(dirPath).then(() => true, () => false)
    
    if (exists) {
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
}

export default new FileTool()
