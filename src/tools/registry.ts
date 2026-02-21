import type { BaseTool, ToolDefinition } from '@/types'
import { createLogger } from '@/utils'

const logger = createLogger('ToolRegistry')

/**
 * Centralized tool registry
 */
export class ToolRegistry {
  private tools = new Map<string, BaseTool>()

  /**
   * Register a tool
   */
  register(tool: BaseTool): void {
    if (this.tools.has(tool.name)) {
      logger.warn(`Tool ${tool.name} already registered, overwriting`)
    }

    this.tools.set(tool.name, tool)
    logger.info(`Registered tool: ${tool.name}`)
  }

  /**
   * Register multiple tools
   */
  registerMany(tools: BaseTool[]): void {
    for (const tool of tools) {
      this.register(tool)
    }
  }

  /**
   * Get a tool by name
   */
  get(name: string): BaseTool | undefined {
    return this.tools.get(name)
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name)
  }

  /**
   * Get all registered tools
   */
  getAll(): BaseTool[] {
    return Array.from(this.tools.values())
  }

  /**
   * Get tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys())
  }

  /**
   * Get tool definitions for LLM
   */
  getDefinitions(): ToolDefinition[] {
    return this.getAll().map(tool => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters
      }
    }))
  }

  /**
   * Get tools as a record (for backward compatibility)
   */
  toRecord(): Record<string, BaseTool> {
    return Object.fromEntries(
      Array.from(this.tools.entries())
    )
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear()
    logger.info('Tool registry cleared')
  }

  /**
   * Get registry size
   */
  get size(): number {
    return this.tools.size
  }
}

// Global registry instance
let globalRegistry: ToolRegistry | null = null

/**
 * Get the global tool registry
 */
export function getToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry()
  }
  return globalRegistry
}

/**
 * Reset the global tool registry (mainly for testing)
 */
export function resetToolRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear()
  }
  globalRegistry = null
}
