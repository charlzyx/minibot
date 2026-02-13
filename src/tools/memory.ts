import { getMemoryManager } from '../memory/manager'

interface MemoryParams {
  action: 'store' | 'search' | 'get' | 'delete' | 'recent'
  content?: string
  query?: string
  id?: number
  tags?: string[]
  limit?: number
}

export interface MemoryResult {
  success: boolean
  action: string
  data?: any
  error?: string
}

class MemoryTool {
  async execute(params: MemoryParams): Promise<MemoryResult> {
    const memoryManager = getMemoryManager()
    
    try {
      switch (params.action) {
        case 'store':
          return this.store(memoryManager, params)
        case 'search':
          return this.search(memoryManager, params)
        case 'get':
          return this.get(memoryManager, params)
        case 'delete':
          return this.delete(memoryManager, params)
        case 'recent':
          return this.recent(memoryManager, params)
        default:
          return {
            success: false,
            action: params.action,
            error: `Unknown action: ${params.action}`
          }
      }
    } catch (error) {
      return {
        success: false,
        action: params.action,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async store(memoryManager: any, params: MemoryParams): Promise<MemoryResult> {
    if (!params.content) {
      return {
        success: false,
        action: 'store',
        error: 'Content is required for store action'
      }
    }

    const id = await memoryManager.store(params.content, params.tags || [])
    
    return {
      success: true,
      action: 'store',
      data: {
        id,
        content: params.content,
        tags: params.tags || []
      }
    }
  }

  private async search(memoryManager: any, params: MemoryParams): Promise<MemoryResult> {
    if (!params.query) {
      return {
        success: false,
        action: 'search',
        error: 'Query is required for search action'
      }
    }

    const limit = params.limit || 10
    const results = await memoryManager.search(params.query, limit)
    
    return {
      success: true,
      action: 'search',
      data: {
        query: params.query,
        count: results.length,
        results: results
      }
    }
  }

  private async get(memoryManager: any, params: MemoryParams): Promise<MemoryResult> {
    if (!params.id) {
      return {
        success: false,
        action: 'get',
        error: 'ID is required for get action'
      }
    }

    const result = await memoryManager.getById(params.id)
    
    if (!result) {
      return {
        success: false,
        action: 'get',
        error: `Memory with ID ${params.id} not found`
      }
    }

    return {
      success: true,
      action: 'get',
      data: result
    }
  }

  private async delete(memoryManager: any, params: MemoryParams): Promise<MemoryResult> {
    if (!params.id) {
      return {
        success: false,
        action: 'delete',
        error: 'ID is required for delete action'
      }
    }

    await memoryManager.delete(params.id)
    
    return {
      success: true,
      action: 'delete',
      data: {
        id: params.id,
        message: 'Memory deleted successfully'
      }
    }
  }

  private async recent(memoryManager: any, params: MemoryParams): Promise<MemoryResult> {
    const limit = params.limit || 10
    const results = await memoryManager.getRecent(limit)
    
    return {
      success: true,
      action: 'recent',
      data: {
        count: results.length,
        results: results
      }
    }
  }
}

const memoryTool = new MemoryTool()
export default memoryTool
