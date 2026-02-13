import { getConfigManager, closeConfigManager, Config } from '../config/manager'
import { getMemoryManager, closeMemoryManager, Memory } from '../memory/manager'
import { getTools, getToolDefinitions } from '../tools'
import { getSessionManager, ChatMessage } from '../session'
import { getSkillManager } from '../skills'
import { getCommandManager } from '../commands'

interface AgentContext {
  userMessage: string
  userId: string
  platform: string
  messageId: string
  sessionId?: string
  history: ChatMessage[]
  metadata: Record<string, any>
}

interface Intent {
  type: 'chat' | 'search' | 'tool' | 'schedule' | 'memory'
  action: string
  confidence: number
  params?: Record<string, any>
}

interface ToolResult {
  tool: string
  success: boolean
  result?: any
  error?: string
}

export class Agent {
  private configManager: ReturnType<typeof getConfigManager>
  private memoryManager: ReturnType<typeof getMemoryManager>
  private skillManager: ReturnType<typeof getSkillManager>
  private tools: Record<string, any>
  private toolDefinitions: any[]

  constructor() {
    this.configManager = getConfigManager()
    this.memoryManager = getMemoryManager()
    this.skillManager = getSkillManager()
    this.tools = getTools()
    this.toolDefinitions = getToolDefinitions()
  }

  async process(context: AgentContext): Promise<string> {
    console.log('[Agent] Starting process...')
    
    const commandManager = getCommandManager()
    const commandResult = await commandManager.execute(context.userMessage, context)
    
    if (commandResult !== null) {
      console.log('[Agent] Command executed:', commandResult)
      
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`
      sessionManager.addMessage(sessionId, 'user', context.userMessage)
      sessionManager.addMessage(sessionId, 'assistant', commandResult)
      await sessionManager.save(sessionManager.getOrCreate(sessionId))
      
      return commandResult
    }
    
    const config = await this.configManager.loadConfig()
    console.log('[Agent] Config loaded')
    
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    
    const messages = this.buildLLMMessages(context, config)
    console.log('[Agent] Messages built, count:', messages.length)
    
    const maxIterations = 20
    let iteration = 0
    let finalContent: string | null = null
    
    while (iteration < maxIterations) {
      iteration++
      console.log(`[Agent] Iteration ${iteration}/${maxIterations}`)
      
      console.log('[Agent] Calling LLM...')
      const llmResult = await this.tools.llm.execute({
        provider: config.provider.name,
        model: config.model.name,
        messages,
        tools: this.toolDefinitions
      })
      console.log('[Agent] LLM result received, tool_calls:', llmResult.tool_calls?.length || 0)
      
      if (llmResult.tool_calls && llmResult.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: llmResult.content || '',
          tool_calls: llmResult.tool_calls
        })
        
        for (const toolCall of llmResult.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments)
          console.log(`[Agent] Tool call: ${toolCall.function.name}(${JSON.stringify(args)})`)
          
          const result = await this.executeTool(toolCall.function.name, args, context)
          console.log('[Agent] Tool result:', JSON.stringify(result).substring(0, 200))
          
          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          })
        }
      } else {
        finalContent = llmResult.content || ''
        console.log('[Agent] Final content received, length:', finalContent!.length)
        break
      }
    }
    
    if (finalContent === null) {
      finalContent = 'I\'ve completed processing but have no response to give.'
      console.log('[Agent] No final content, using fallback')
    }
    
    console.log('[Agent] Updating session...')
    sessionManager.addMessage(sessionId, 'user', context.userMessage)
    sessionManager.addMessage(sessionId, 'assistant', finalContent!)
    await sessionManager.save(sessionManager.getOrCreate(sessionId))
    
    console.log('[Agent] Updating memory...')
    await this.updateMemory(context, finalContent!)
    
    return finalContent!
  }

  private async executeTool(toolName: string, params: any, context: AgentContext): Promise<ToolResult> {
    const tool = this.tools[toolName]
    
    if (!tool) {
      return {
        tool: toolName,
        success: false,
        error: `Tool ${toolName} not found`
      }
    }
    
    try {
      const result = await tool.execute(params)
      
      return {
        tool: toolName,
        success: true,
        result
      }
    } catch (error) {
      console.error(`[Agent] Tool execution error:`, error)
      
      return {
        tool: toolName,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private buildLLMMessages(context: AgentContext, config: Config): any[] {
    const messages: any[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(config)
      }
    ]
    
    for (const msg of context.history) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({
          role: msg.role,
          content: msg.content
        })
      }
    }
    
    messages.push({
      role: 'user',
      content: context.userMessage
    })
    
    return messages
  }

  private buildSystemPrompt(config: Config): string {
    const skillsPrompt = this.skillManager.getSkillsPrompt()
    
    let prompt = `You are an AI assistant that helps users solve problems.

You have access to following tools:
- shell: Execute shell commands
- web: Make HTTP requests
- file: File operations (read, write, append, delete, list)
- llm: Large language model for generating text
- memory: Memory management - store, search, get, delete, and retrieve recent memories

When a user asks you to perform an action that requires a tool (like executing a command, accessing the web, or working with files), you MUST call the appropriate tool.

For example:
- If user says "执行一下 ls", you MUST call the shell tool
- If user says "查看百度首页", you MUST call the web tool
- If user says "读取文件 test.txt", you MUST call the file tool

Always respond with the tool call format expected by the API, including the function name and arguments.

Configuration:
- Model: ${config.model.name}
- Max tokens: ${config.model.maxTokens}

Provide accurate and helpful responses to user requests.`

    if (skillsPrompt) {
      prompt += `\n\n${skillsPrompt}`
    }

    return prompt
  }

  private async updateMemory(context: AgentContext, response: string): Promise<void> {
    await this.memoryManager.store(context.userMessage, ['chat', context.userId, context.platform])
    await this.memoryManager.store(response, ['assistant', context.userId, context.platform])
  }

  async destroy() {
    this.memoryManager.close()
    this.configManager.close()
  }
}
