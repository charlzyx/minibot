// Import tool instances
import shellTool from './shell'
import webTool from './web'
import fileTool from './file'
import llmTool from './llm'
import memoryTool from './memory'
import type { ShellResult } from './shell'
import type { WebResult } from './web'
import type { FileResult } from './file'
import type { LLMResult } from './llm'
import type { MemoryResult } from './memory'

// Re-export all tools
export * from './shell'
export * from './web'
export * from './file'
export * from './llm'
export * from './memory'

// Tool interface
interface Tool {
  name: string
  description: string
  parameters: Record<string, any>
  execute: (params: any) => Promise<any>
}

// Tool definitions for LLM
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, any>
  }
}

// Tool registry
export function getTools(): Record<string, Tool> {
  return {
    shell: {
      name: 'shell',
      description: 'Execute shell commands',
      parameters: {
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
            description: 'Working directory'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds'
          }
        },
        required: ['command']
      },
      execute: async (params: any) => {
        if (typeof params === 'string') {
          return shellTool.execute(params)
        }
        return shellTool.execute(params.command, params.args || [])
      }
    },
    web: {
      name: 'web',
      description: 'Make HTTP requests',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL to request'
          },
          method: {
            type: 'string',
            enum: ['GET', 'POST', 'PUT', 'DELETE'],
            description: 'HTTP method'
          },
          headers: {
            type: 'object',
            description: 'Request headers'
          },
          body: {
            type: 'string',
            description: 'Request body'
          }
        },
        required: ['url', 'method']
      },
      execute: async (params: any) => {
        return webTool.execute(params)
      }
    },
    file: {
      name: 'file',
      description: 'File operations',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['read', 'write', 'append', 'delete', 'list'],
            description: 'The file operation to perform'
          },
          path: {
            type: 'string',
            description: 'File path'
          },
          content: {
            type: 'string',
            description: 'Content to write or append'
          }
        },
        required: ['action', 'path']
      },
      execute: async (params: any) => {
        return fileTool.execute(params)
      }
    },
    llm: {
      name: 'llm',
      description: 'Large language model',
      parameters: {
        type: 'object',
        properties: {
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string' },
                content: { type: 'string' }
              }
            },
            description: 'Chat messages'
          }
        },
        required: ['messages']
      },
      execute: async (params: any) => {
        return llmTool.execute(params)
      }
    },
    memory: {
      name: 'memory',
      description: 'Memory management - store, search, get, delete, and retrieve recent memories',
      parameters: {
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
      },
      execute: async (params: any) => {
        return memoryTool.execute(params)
      }
    }
  }
}

export function getToolDefinitions(): ToolDefinition[] {
  const tools = getTools()
  return Object.values(tools).map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }))
}
