// Import tool instances
import shellTool from './shell'
import webTool from './web'
import fileTool from './file'
import llmTool from './llm'
import type { ShellResult } from './shell'
import type { WebResult } from './web'
import type { FileResult } from './file'
import type { LLMResult } from './llm'

// Re-export all tools
export * from './shell'
export * from './web'
export * from './file'
export * from './llm'

// Tool interface
interface Tool {
  name: string
  description: string
  execute: (params: any) => Promise<any>
}

// Tool registry
export function getTools(): Record<string, Tool> {
  return {
    shell: {
      name: 'shell',
      description: 'Execute shell commands',
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
      execute: async (params: any) => {
        return webTool.execute(params)
      }
    },
    file: {
      name: 'file',
      description: 'File operations',
      execute: async (params: any) => {
        return fileTool.execute(params)
      }
    },
    llm: {
      name: 'llm',
      description: 'Large language model',
      execute: async (params: any) => {
        return llmTool.execute(params)
      }
    }
  }
}
