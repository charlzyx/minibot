/**
 * Tools module - Centralized tool registry and exports
 */

import { getToolRegistry } from './registry'
import { shellTool } from './shell'
import { fileTool } from './file'
import { webTool } from './web'
import { llmTool } from './llm'
import { memoryTool } from './memory'

// Get the global registry
const registry = getToolRegistry()

// Register all tools
registry.registerMany([
  shellTool,
  fileTool,
  webTool,
  llmTool,
  memoryTool
])

/**
 * Get all registered tools as a record
 */
export function getTools(): Record<string, unknown> {
  return registry.toRecord()
}

/**
 * Get tool definitions for LLM
 */
export function getToolDefinitions() {
  return registry.getDefinitions()
}

/**
 * Get the tool registry
 */
export { getToolRegistry, ToolRegistry, resetToolRegistry } from './registry'

/**
 * Export tool base class
 */
export { ToolBase } from './base'

/**
 * Export individual tools
 */
export { shellTool, ShellTool } from './shell'
export { fileTool, FileTool } from './file'
export { webTool, WebTool } from './web'
export { llmTool, LLMTool } from './llm'
export { memoryTool, MemoryTool } from './memory'

/**
 * Export types
 */
export * from '@/types'
