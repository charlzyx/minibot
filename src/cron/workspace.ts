/**
 * 工作区隔离系统
 * 提供文件系统隔离、权限控制和资源限制
 */

import fs from 'fs'
import path from 'path'

export interface WorkspaceConfig {
  id: string
  basePath?: string
  maxFileSize?: number
  maxTotalSize?: number
  allowedCommands?: string[]
  deniedCommands?: string[]
  resourceLimits?: {
    maxCpu?: number
    maxMemory?: number
    maxProcesses?: number
  }
}

export interface WorkspaceInfo {
  id: string
  path: string
  createdAt: Date
  lastUsed: Date
  size: number
  processCount: number
}

export class WorkspaceManager {
  private static readonly DEFAULT_BASE_PATH = path.join(process.cwd(), 'workspaces')
  private static readonly METADATA_FILE = 'workspace.json'
  
  private workspaces: Map<string, WorkspaceInfo> = new Map()
  private basePath: string

  constructor(basePath?: string) {
    this.basePath = basePath || WorkspaceManager.DEFAULT_BASE_PATH
    this.loadWorkspaces()
  }

  async createWorkspace(config: WorkspaceConfig): Promise<WorkspaceInfo> {
    const workspacePath = path.join(this.basePath, config.id)
    
    if (fs.existsSync(workspacePath)) {
      throw new Error(`Workspace already exists: ${config.id}`)
    }

    fs.mkdirSync(workspacePath, { recursive: true })
    
    const workspace: WorkspaceInfo = {
      id: config.id,
      path: workspacePath,
      createdAt: new Date(),
      lastUsed: new Date(),
      size: 0,
      processCount: 0
    }

    this.workspaces.set(config.id, workspace)
    await this.saveWorkspaces()
    
    await this.createWorkspaceConfig(workspacePath, config)
    
    return workspace
  }

  async getWorkspace(id: string): Promise<WorkspaceInfo | null> {
    return this.workspaces.get(id) || null
  }

  async deleteWorkspace(id: string): Promise<void> {
    const workspace = this.workspaces.get(id)
    
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`)
    }

    if (workspace.processCount > 0) {
      throw new Error(`Workspace has active processes: ${id}`)
    }

    const workspacePath = path.join(this.basePath, id)
    
    await this.deleteDirectory(workspacePath)
    this.workspaces.delete(id)
    await this.saveWorkspaces()
  }

  async executeInWorkspace<T>(
    id: string,
    fn: (workspacePath: string) => Promise<T>
  ): Promise<T> {
    const workspace = this.workspaces.get(id)
    
    if (!workspace) {
      throw new Error(`Workspace not found: ${id}`)
    }

    workspace.processCount++
    workspace.lastUsed = new Date()
    await this.saveWorkspaces()

    try {
      const result = await fn(workspace.path)
      return result
    } finally {
      workspace.processCount--
      await this.saveWorkspaces()
    }
  }

  async checkCommandPermission(workspaceId: string, command: string): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId)
    
    if (!workspace) {
      return false
    }

    const config = await this.loadWorkspaceConfig(workspace.path)
    
    if (config.deniedCommands && config.deniedCommands.some(cmd => command.startsWith(cmd))) {
      return false
    }

    if (config.allowedCommands && !config.allowedCommands.some(cmd => command.startsWith(cmd))) {
      return false
    }

    return true
  }

  async checkFileSize(workspaceId: string, filePath: string, size: number): Promise<boolean> {
    const workspace = this.workspaces.get(workspaceId)
    
    if (!workspace) {
      return false
    }

    const config = await this.loadWorkspaceConfig(workspace.path)
    const maxFileSize = config.maxFileSize || Infinity

    if (size > maxFileSize) {
      return false
    }

    const workspaceSize = await this.calculateWorkspaceSize(workspace.path)
    const maxTotalSize = config.maxTotalSize || Infinity

    if (workspaceSize + size > maxTotalSize) {
      return false
    }

    return true
  }

  async getResourceLimits(workspaceId: string): Promise<WorkspaceConfig['resourceLimits']> {
    const workspace = this.workspaces.get(workspaceId)
    
    if (!workspace) {
      throw new Error(`Workspace not found: ${workspaceId}`)
    }

    const config = await this.loadWorkspaceConfig(workspace.path)
    return config.resourceLimits
  }

  async listWorkspaces(): Promise<WorkspaceInfo[]> {
    return Array.from(this.workspaces.values())
  }

  async cleanupInactiveWorkspaces(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    const now = Date.now()
    const toDelete: string[] = []

    for (const [id, workspace] of this.workspaces) {
      const age = now - workspace.lastUsed.getTime()
      
      if (age > maxAge && workspace.processCount === 0) {
        toDelete.push(id)
      }
    }

    for (const id of toDelete) {
      await this.deleteWorkspace(id)
    }
  }

  private async createWorkspaceConfig(workspacePath: string, config: WorkspaceConfig): Promise<void> {
    const configPath = path.join(workspacePath, WorkspaceManager.METADATA_FILE)
    const configContent = JSON.stringify(config, null, 2)
    fs.writeFileSync(configPath, configContent, 'utf8')
  }

  private async loadWorkspaceConfig(workspacePath: string): Promise<WorkspaceConfig> {
    const configPath = path.join(workspacePath, WorkspaceManager.METADATA_FILE)
    
    if (!fs.existsSync(configPath)) {
      return { id: path.basename(workspacePath) }
    }

    const content = fs.readFileSync(configPath, 'utf8')
    return JSON.parse(content)
  }

  private async calculateWorkspaceSize(workspacePath: string): Promise<number> {
    let totalSize = 0

    const calculateSize = (dirPath: string): void => {
      const items = fs.readdirSync(dirPath)
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item)
        const stats = fs.statSync(itemPath)
        
        if (stats.isDirectory()) {
          calculateSize(itemPath)
        } else {
          totalSize += stats.size
        }
      }
    }

    calculateSize(workspacePath)
    return totalSize
  }

  private async deleteDirectory(dirPath: string): Promise<void> {
    const items = fs.readdirSync(dirPath)
    
    for (const item of items) {
      const itemPath = path.join(dirPath, item)
      const stats = fs.statSync(itemPath)
      
      if (stats.isDirectory()) {
        await this.deleteDirectory(itemPath)
      } else {
        fs.unlinkSync(itemPath)
      }
    }

    fs.rmdirSync(dirPath)
  }

  private async loadWorkspaces(): Promise<void> {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true })
      return
    }

    const items = fs.readdirSync(this.basePath)
    
    for (const item of items) {
      const workspacePath = path.join(this.basePath, item)
      const stats = fs.statSync(workspacePath)
      
      if (stats.isDirectory()) {
        const configPath = path.join(workspacePath, WorkspaceManager.METADATA_FILE)
        
        if (fs.existsSync(configPath)) {
          const config = await this.loadWorkspaceConfig(workspacePath)
          const size = await this.calculateWorkspaceSize(workspacePath)
          
          this.workspaces.set(item, {
            id: item,
            path: workspacePath,
            createdAt: new Date(stats.birthtimeMs),
            lastUsed: new Date(stats.mtimeMs),
            size,
            processCount: 0
          })
        }
      }
    }
  }

  private async saveWorkspaces(): Promise<void> {
    const metadataPath = path.join(this.basePath, 'workspaces.json')
    const data = Array.from(this.workspaces.entries()).map(([id, info]) => ({
      id,
      path: info.path,
      createdAt: info.createdAt.toISOString(),
      lastUsed: info.lastUsed.toISOString(),
      size: info.size,
      processCount: info.processCount
    }))
    
    fs.writeFileSync(metadataPath, JSON.stringify(data, null, 2), 'utf8')
  }

  async close(): Promise<void> {
    await this.saveWorkspaces()
  }
}
