import { getMemoryManager } from '../memory/manager'
import type { ToolResult } from '@/types'
import { ToolBase } from './base'
import { createLogger } from '@/utils'

const logger = createLogger('MemoryTool')

/**
 * Memory tool parameters
 */
interface MemoryStoreParams {
  action: 'store'
  content: string
  tags?: string[]
}

interface MemorySearchParams {
  action: 'search'
  query: string
  limit?: number
}

interface MemoryGetParams {
  action: 'get'
  id: number
}

interface MemoryDeleteParams {
  action: 'delete'
  id: number
}

interface MemoryRecentParams {
  action: 'recent'
  limit?: number
}

type MemoryToolParams =
  | MemoryStoreParams
  | MemorySearchParams
  | MemoryGetParams
  | MemoryDeleteParams
  | MemoryRecentParams

/**
 * Memory tool for memory management
 */
export class MemoryTool extends ToolBase<MemoryToolParams, unknown> {
  readonly name = 'memory'
  readonly description = 'Memory management: store, search, get, delete, and retrieve recent memories'
  readonly parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['store', 'search', 'get', 'delete', 'recent'],
        description: 'The memory operation to perform'
      },
      content: {
        type: 'string',
        description: 'Content to store (required for store action)'
      },
      query: {
        type: 'string',
        description: 'Search query (required for search action)'
      },
      id: {
        type: 'number',
        description: 'Memory ID (required for get and delete actions)'
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
        description: 'Tags for categorization (optional for store action)'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results (optional for search and recent actions)'
      }
    },
    required: ['action']
  } as const

  /**
   * Execute memory operation
   */
  protected async executeImpl(
    params: MemoryToolParams,
    context?: unknown
  ): Promise<unknown> {
    const memoryManager = getMemoryManager()

    switch (params.action) {
      case 'store':
        return await this.handleStore(memoryManager, params as MemoryStoreParams)

      case 'search':
        return await this.handleSearch(memoryManager, params as MemorySearchParams)

      case 'get':
        return await this.handleGet(memoryManager, params as MemoryGetParams)

      case 'delete':
        return await this.handleDelete(memoryManager, params as MemoryDeleteParams)

      case 'recent':
        return await this.handleRecent(memoryManager, params as MemoryRecentParams)

      default:
        throw new Error(`Unknown action: ${(params as { action: string }).action}`)
    }
  }

  /**
   * Handle store action
   */
  private async handleStore(
    memoryManager: Awaited<ReturnType<typeof getMemoryManager>>,
    params: MemoryStoreParams
  ): Promise<{ id: number; message: string }> {
    const { content, tags = [] } = params

    logger.debug(`Storing memory`, { contentLength: content.length, tags })

    const id = await memoryManager.store(content, tags)

    logger.info(`Memory stored`, { id })

    return {
      id,
      message: `Memory stored successfully with ID: ${id}`
    }
  }

  /**
   * Handle search action
   */
  private async handleSearch(
    memoryManager: Awaited<ReturnType<typeof getMemoryManager>>,
    params: MemorySearchParams
  ): Promise<{ results: Array<{ id: number; content: string; tags: string[] }> }> {
    const { query, limit = 10 } = params

    logger.debug(`Searching memories`, { query, limit })

    const memories = await memoryManager.search(query, limit)

    logger.info(`Memory search complete`, { query, resultCount: memories.length })

    const results = memories.map(m => ({
      id: m.id,
      content: m.content,
      tags: m.tags
    }))

    return { results }
  }

  /**
   * Handle get action
   */
  private async handleGet(
    memoryManager: Awaited<ReturnType<typeof getMemoryManager>>,
    params: MemoryGetParams
  ): Promise<{ id: number; content: string; tags: string[] } | null> {
    const { id } = params

    logger.debug(`Getting memory`, { id })

    const memory = await memoryManager.getById(id)

    if (!memory) {
      logger.warn(`Memory not found`, { id })
      return null
    }

    return {
      id: memory.id,
      content: memory.content,
      tags: memory.tags
    }
  }

  /**
   * Handle delete action
   */
  private async handleDelete(
    memoryManager: Awaited<ReturnType<typeof getMemoryManager>>,
    params: MemoryDeleteParams
  ): Promise<{ message: string }> {
    const { id } = params

    logger.debug(`Deleting memory`, { id })

    await memoryManager.delete(id)

    logger.info(`Memory deleted`, { id })

    return { message: `Memory ${id} deleted successfully` }
  }

  /**
   * Handle recent action
   */
  private async handleRecent(
    memoryManager: Awaited<ReturnType<typeof getMemoryManager>>,
    params: MemoryRecentParams
  ): Promise<{ results: Array<{ id: number; content: string; tags: string[] }> }> {
    const { limit = 10 } = params

    logger.debug(`Getting recent memories`, { limit })

    const memories = await memoryManager.getRecent(limit)

    logger.info(`Recent memories retrieved`, { count: memories.length })

    const results = memories.map(m => ({
      id: m.id,
      content: m.content,
      tags: m.tags
    }))

    return { results }
  }
}

// Export singleton instance
export const memoryTool = new MemoryTool()

export default memoryTool
