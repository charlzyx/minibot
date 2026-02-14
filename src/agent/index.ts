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
    
    // Handle skill-creator flow
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    const session = sessionManager.getOrCreate(sessionId)
    
    if (session.activeSkill === 'skill-creator') {
      return await this.handleSkillCreator(context, session, sessionManager)
    }
    
    const config = await this.configManager.loadConfig()
    console.log('[Agent] Config loaded')
    
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
        content: this.buildSystemPrompt(config, context)
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

  private buildSystemPrompt(config: Config, context: AgentContext): string {
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    const session = sessionManager.getOrCreate(sessionId)
    
    const skillsPrompt = ''
    
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

    if (session.activeSkill === 'claude-code') {
      prompt += `\n\nYou are currently in Claude Code mode. Focus on programming tasks including:
- Writing high-quality code following best practices
- Debugging and fixing errors
- Refactoring and optimizing code
- Code review and improvement suggestions

IMPORTANT: Provide timely status updates during execution. Report progress and intermediate results immediately. If you encounter any errors, notify the user right away with clear error information and suggested solutions.`
    }

    if (skillsPrompt) {
      prompt += `\n\n${skillsPrompt}`
    }

    return prompt
  }

  private async updateMemory(context: AgentContext, response: string): Promise<void> {
    await this.memoryManager.store(context.userMessage, ['chat', context.userId, context.platform])
    await this.memoryManager.store(response, ['assistant', context.userId, context.platform])
  }

  private async handleSkillCreator(context: AgentContext, session: any, sessionManager: any): Promise<string> {
    const skillCreatorState = session.state?.skillCreator || { step: 1, skillData: {} }
    const { step, skillData } = skillCreatorState
    
    let nextStep = step
    let response = ''
    
    switch (step) {
      case 1:
        // 处理技能名称
        if (context.userMessage.trim()) {
          skillData.name = context.userMessage.trim()
          nextStep = 2
          response = `✅ 技能名称已设置为: ${skillData.name}\n\n` +
            '现在，请提供技能的描述：'
        } else {
          response = '❌ 技能名称不能为空，请重新输入：'
        }
        break
        
      case 2:
        // 处理技能描述
        skillData.description = context.userMessage.trim() || ''
        nextStep = 3
        response = `✅ 技能描述已设置\n\n` +
          '现在，请输入技能的标签（用逗号分隔）：'
        break
        
      case 3:
        // 处理技能标签
        const tags = context.userMessage.trim()
          ? context.userMessage.split(',').map((tag: string) => tag.trim())
          : []
        skillData.tags = tags
        nextStep = 4
        response = `✅ 技能标签已设置为: ${tags.join(', ')}\n\n` +
          '现在，请编写技能的实现代码：\n\n' +
          '技能代码应该导出一个包含 execute 方法的对象，例如：\n\n' +
          '```javascript\n' +
          'module.exports = {\n' +
          '  async execute(context, args) {\n' +
          '    return "技能执行结果"\n' +
          '  }\n' +
          '}\n' +
          '```\n\n' +
          '请输入你的技能代码：'
        break
        
      case 4:
        // 处理技能代码
        skillData.code = context.userMessage.trim()
        
        // 创建技能
        try {
          const { getSkillManager } = await import('../skills')
          const skillManager = getSkillManager()
          
          const filePath = await skillManager.createSkill(
            skillData.name,
            skillData.code,
            {
              name: skillData.name,
              description: skillData.description,
              tags: skillData.tags
            }
          )
          
          // 重置会话状态
          session.activeSkill = null
          session.state = {
            ...session.state,
            skillCreator: null
          }
          await sessionManager.save(session)
          
          response = `🎉 **技能创建成功！**\n\n` +
            `技能名称: ${skillData.name}\n` +
            `描述: ${skillData.description || '无'}\n` +
            `标签: ${skillData.tags.join(', ') || '无'}\n` +
            `文件路径: ${filePath}\n\n` +
            '你可以使用 `/skills` 命令查看所有可用的技能。'
        } catch (error) {
          console.error('[Agent] Failed to create skill:', error)
          response = `❌ 技能创建失败：${error instanceof Error ? error.message : String(error)}\n\n` +
            '请重试或联系管理员。'
        }
        break
        
      default:
        response = '❌ 技能创建流程出错，请重新开始。'
        session.activeSkill = null
        session.state = {
          ...session.state,
          skillCreator: null
        }
        await sessionManager.save(session)
        break
    }
    
    // 更新会话状态
    if (nextStep <= 4) {
      session.state = {
        ...session.state,
        skillCreator: {
          step: nextStep,
          skillData
        }
      }
      await sessionManager.save(session)
    }
    
    // 保存消息记录
    sessionManager.addMessage(context.sessionId || `${context.platform}:${context.userId}`, 'user', context.userMessage)
    sessionManager.addMessage(context.sessionId || `${context.platform}:${context.userId}`, 'assistant', response)
    
    return response
  }

  async destroy() {
    this.memoryManager.close()
    this.configManager.close()
  }
}
