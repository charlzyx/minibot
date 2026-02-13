import { getConfigManager, closeConfigManager, Config } from '../config/manager'
import { getMemoryManager, closeMemoryManager, Memory } from '../memory/manager'
import { getTools } from '../tools'

interface AgentContext {
  userMessage: string
  userId: string
  platform: string
  messageId: string
  history: Array<{ role: 'user' | 'assistant', content: string, timestamp: number }>
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
  private tools: Record<string, any>

  constructor() {
    this.configManager = getConfigManager()
    this.memoryManager = getMemoryManager()
    this.tools = getTools()
  }

  // Main agent loop
  async process(context: AgentContext): Promise<string> {
    // 1. Build context
    const builtContext = await this.buildContext(context)
    
    // 2. Analyze intent
    const intent = await this.analyzeIntent(context.userMessage, builtContext)
    
    // 3. Plan tasks
    const tasks = await this.planTasks(intent, builtContext)
    
    // 4. Execute tools
    const results: ToolResult[] = []
    for (const task of tasks) {
      const result = await this.executeTool(task, builtContext)
      results.push(result)
    }
    
    // 5. Build response
    const response = await this.buildResponse(results, intent, builtContext)
    
    // 6. Update memory
    await this.updateMemory(context, intent, response, builtContext)
    
    return response
  }

  private async buildContext(context: AgentContext): Promise<Record<string, any>> {
    const config = await this.configManager.loadConfig()
    const recentMemories = await this.memoryManager.getRecent(5)
    
    return {
      userMessage: context.userMessage,
      userId: context.userId,
      platform: context.platform,
      history: context.history.slice(-10),
      recentMemories,
      config: config
    }
  }

  private async analyzeIntent(message: string, context: Record<string, any>): Promise<Intent> {
    // Simple keyword matching for demo
    const lowerMessage = message.toLowerCase()
    
    // Check for tool invocation
    if (lowerMessage.includes('搜索') || lowerMessage.includes('search') || lowerMessage.includes('找')) {
      return {
        type: 'search',
        action: 'search',
        confidence: 0.9,
        params: { query: message.replace(/搜索|search|找/g, '').trim() }
      }
    }
    
    if (lowerMessage.includes('记住') || lowerMessage.includes('保存')) {
      return {
        type: 'memory',
        action: 'store',
        confidence: 0.85,
        params: { content: message.replace(/记住|保存/g, '').trim() }
      }
    }
    
    // Check for schedule
    if (lowerMessage.includes('提醒') || lowerMessage.includes('定时')) {
      return {
        type: 'schedule',
        action: 'create_reminder',
        confidence: 0.8,
        params: { message: message }
      }
    }
    
    // Default to chat
    return {
      type: 'chat',
      action: 'generate_response',
      confidence: 0.7,
      params: { message }
    }
  }

  private async planTasks(intent: Intent, context: Record<string, any>): Promise<any[]> {
    const tasks: any[] = []
    
    switch (intent.type) {
      case 'search':
        tasks.push({
          tool: 'web',
          params: {
            url: `https://www.google.com/search?q=${encodeURIComponent(intent.params?.query || '')}`
          }
        })
        break
        
      case 'memory':
        tasks.push({
          tool: 'file',
          params: {
            path: 'memory.txt',
            action: 'append',
            content: intent.params?.content || ''
          }
        })
        break
        
      case 'schedule':
        tasks.push({
          tool: 'cron',
          params: {
            name: 'reminder',
            message: intent.params?.message || ''
          }
        })
        break
        
      case 'chat':
      default:
        // Get LLM configuration
        const config = await this.configManager.loadConfig()
        
        // Build prompt
        const prompt = this.buildPrompt({
          userMessage: context.userMessage || '',
          userId: context.userId || '',
          platform: context.platform || '',
          messageId: context.messageId || crypto.randomUUID(),
          history: context.history || [],
          metadata: context.metadata || {}
        }, config)
        
        tasks.push({
          tool: 'llm',
          params: {
            provider: config.provider.name,
            model: config.model.name,
            messages: this.buildLLMMessages({
              userMessage: context.userMessage || '',
              userId: context.userId || '',
              platform: context.platform || '',
              messageId: context.messageId || crypto.randomUUID(),
              history: context.history || [],
              metadata: context.metadata || {}
            }, prompt)
          }
        })
        break
    }
    
    return tasks
  }

  private async executeTool(task: any, context: Record<string, any>): Promise<ToolResult> {
    const tool = this.tools[task.tool]
    
    if (!tool) {
      return {
        tool: task.tool,
        success: false,
        error: `Tool ${task.tool} not found`
      }
    }
    
    try {
      const result = await tool.execute(task.params, context)
      
      return {
        tool: task.tool,
        success: true,
        result
      }
    } catch (error) {
      console.error(`Tool execution error:`, error)
      
      return {
        tool: task.tool,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private async buildResponse(
    results: ToolResult[],
    intent: Intent,
    context: Record<string, any>
  ): Promise<string> {
    const successResults = results.filter(r => r.success)
    const failedResults = results.filter(r => !r.success)
    
    let response = ''
    
    switch (intent.type) {
      case 'search':
        response = this.formatSearchResponse(successResults)
        break
        
      case 'memory':
        response = '已保存到记忆中'
        break
        
      case 'schedule':
        response = '已创建提醒'
        break
        
      case 'chat':
        if (successResults.length > 0 && successResults[0].tool === 'llm') {
          const llmResult = successResults[0].result
          response = this.formatLLMResponse(llmResult)
        }
        break
    }
    
    // Add failed results info
    if (failedResults.length > 0) {
      response += '\n\n部分操作失败：' + failedResults.map(r => r.error).join(', ')
    }
    
    return response
  }

  private formatSearchResponse(results: ToolResult[]): string {
    if (results.length === 0) {
      return '未找到结果'
    }
    
    const searchResult = results[0].result
    return `找到 ${searchResult.count} 条结果：\n${searchResult.items?.slice(0, 5).map((item: any) => item.title).join('\n') || ''}`
  }

  private formatLLMResponse(result: any): string {
    if (result.content) {
      return result.content
    }
    
    return result.text || result.message || '抱歉，我没有相关信息。'
  }

  private buildPrompt(context: AgentContext, config: Config): string {
    const recentMemories = ''
    
    return `你是一个 AI 助手，帮助用户解决问题。
    
当前对话上下文：
${context.history.map(m => `${m.role === 'user' ? '用户' : '助手'}: ${m.content}`).join('\n')}

相关记忆：
${recentMemories}

配置信息：
- 模型: ${config.model.name}
- 最大 tokens: ${config.model.maxTokens}

请根据用户的消息，提供准确、有用的回复。`
  }

  private buildLLMMessages(context: AgentContext, systemPrompt: string): any[] {
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ]
    
    for (const msg of context.history) {
      messages.push({
        role: msg.role,
        content: msg.content
      })
    }
    
    messages.push({
      role: 'user',
      content: context.userMessage
    })
    
    return messages
  }

  private async updateMemory(
    context: AgentContext,
    intent: Intent,
    response: string,
    builtContext: Record<string, any>
  ): Promise<void> {
    if (intent.type === 'chat') {
      // Store conversation turn
      await this.memoryManager.store(context.userMessage, ['chat', context.userId, context.platform])
      await this.memoryManager.store(response, ['assistant', context.userId, context.platform])
    } else if (intent.type === 'memory' && intent.params?.content) {
      // Store explicit memory
      await this.memoryManager.store(intent.params.content, ['explicit', context.userId])
    }
  }

  // Cleanup
  async destroy() {
    this.memoryManager.close()
    this.configManager.close()
  }
}
