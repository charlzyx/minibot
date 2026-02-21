import type { AgentContext, ToolResult, LLMMessage, ToolCall } from '@/types'
import { getConfigManager } from '../config/manager'
import { getMemoryManager } from '../memory/manager'
import { getTools, getToolDefinitions } from '../tools'
import { getSessionManager } from '../session'
import { getSkillManager } from '../skills'
import { getCommandManager } from '../commands'
import { createLogger, LLMError, ErrorHandler } from '@/utils'

const logger = createLogger('Agent')

const MAX_ITERATIONS = 20
const DEFAULT_SYSTEM_PROMPT = `You are an AI assistant that helps users solve problems.

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

Provide accurate and helpful responses to user requests.`

/**
 * Agent - Core intelligence unit for processing user messages
 */
export class Agent {
  private tools: Record<string, unknown>
  private toolDefinitions: ToolDefinition[]

  constructor() {
    this.tools = getTools()
    this.toolDefinitions = getToolDefinitions()
    logger.info('Agent initialized')
  }

  /**
   * Process a user message and generate a response
   */
  async process(context: AgentContext): Promise<string> {
    logger.info('Processing message', {
      userId: context.userId,
      platform: context.platform,
      messageLength: context.userMessage.length
    })

    const commandManager = getCommandManager()
    const commandResult = await commandManager.execute(context.userMessage, context)

    if (commandResult !== null) {
      logger.info('Command executed', { result: commandResult.substring(0, 100) })

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

    const config = await getConfigManager().loadConfig()
    logger.debug('Config loaded', { provider: config.provider.name, model: config.model.name })

    const messages = this.buildLLMMessages(context, config)
    logger.debug('Messages built', { count: messages.length })

    let iteration = 0
    let finalContent: string | null = null

    while (iteration < MAX_ITERATIONS) {
      iteration++
      logger.debug(`Iteration ${iteration}/${MAX_ITERATIONS}`)

      const llmResult = await this.tools.llm.execute({
        provider: config.provider.name,
        model: config.model.name,
        messages,
        tools: this.toolDefinitions
      })

      logger.debug('LLM result received', {
        toolCalls: llmResult.tool_calls?.length || 0,
        contentLength: llmResult.content?.length || 0
      })

      if (llmResult.tool_calls && llmResult.tool_calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: llmResult.content || '',
          tool_calls: llmResult.tool_calls
        })

        for (const toolCall of llmResult.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments)
          logger.debug(`Tool call: ${toolCall.function.name}`, { args })

          const result = await this.executeTool(toolCall.function.name, args, context)

          logger.debug('Tool result', {
            tool: toolCall.function.name,
            success: result.success,
            resultLength: JSON.stringify(result).length
          })

          messages.push({
            role: 'tool',
            content: JSON.stringify(result),
            tool_call_id: toolCall.id
          })
        }
      } else {
        finalContent = llmResult.content || ''
        logger.debug('Final content received', { length: finalContent.length })
        break
      }
    }

    if (finalContent === null) {
      finalContent = "I've completed processing but have no response to give."
      logger.warn('No final content, using fallback')
    }

    logger.debug('Updating session')
    sessionManager.addMessage(sessionId, 'user', context.userMessage)
    sessionManager.addMessage(sessionId, 'assistant', finalContent)
    await sessionManager.save(sessionManager.getOrCreate(sessionId))

    logger.debug('Updating memory')
    await this.updateMemory(context, finalContent)

    logger.info('Message processing complete', {
      iterations: iteration,
      responseLength: finalContent.length
    })

    return finalContent
  }

  /**
   * Execute a tool
   */
  private async executeTool(toolName: string, params: unknown, context: AgentContext): Promise<ToolResult> {
    const tool = this.tools[toolName] as { execute: (params: unknown) => Promise<ToolResult> }

    if (!tool) {
      logger.warn(`Tool not found: ${toolName}`)
      return {
        success: false,
        error: `Tool ${toolName} not found`,
        timestamp: Date.now()
      }
    }

    try {
      const result = await tool.execute(params)
      return result
    } catch (error) {
      const handled = ErrorHandler.handle(error, `Tool:${toolName}`)
      logger.error(`Tool execution error: ${toolName}`, error)

      return {
        success: false,
        error: handled.message,
        timestamp: Date.now()
      }
    }
  }

  /**
   * Build LLM messages
   */
  private buildLLMMessages(context: AgentContext, config: unknown): LLMMessage[] {
    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(config, context)
      }
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

  /**
   * Build system prompt
   */
  private buildSystemPrompt(config: { model: { name: string; maxTokens?: number } }, context: AgentContext): string {
    const sessionManager = getSessionManager()
    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    const session = sessionManager.getOrCreate(sessionId)

    let prompt = DEFAULT_SYSTEM_PROMPT

    prompt += `\n\nConfiguration:
- Model: ${config.model.name}
- Max tokens: ${config.model.maxTokens || 4096}`

    if (session.activeSkill === 'claude-code') {
      prompt += `\n\nYou are currently in Claude Code mode. Focus on programming tasks including:
- Writing high-quality code following best practices
- Debugging and fixing errors
- Refactoring and optimizing code
- Code review and improvement suggestions

IMPORTANT: Provide timely status updates during execution. Report progress and intermediate results immediately. If you encounter any errors, notify the user right away with clear error information and suggested solutions.`
    }

    return prompt
  }

  /**
   * Update memory with conversation
   */
  private async updateMemory(context: AgentContext, response: string): Promise<void> {
    try {
      const memoryManager = getMemoryManager()
      await memoryManager.store(context.userMessage, ['chat', context.userId, context.platform])
      await memoryManager.store(response, ['assistant', context.userId, context.platform])
      logger.debug('Memory updated')
    } catch (error) {
      logger.error('Failed to update memory', error)
    }
  }

  /**
   * Handle skill-creator flow
   */
  private async handleSkillCreator(
    context: AgentContext,
    session: { activeSkill?: string | null; state?: Record<string, unknown> },
    sessionManager: { save: (session: unknown) => Promise<void> }
  ): Promise<string> {
    const skillCreatorState = (session.state?.skillCreator as { step: number; skillData: Record<string, unknown> } | undefined) || { step: 1, skillData: {} }
    const { step, skillData } = skillCreatorState

    let nextStep = step
    let response = ''

    switch (step) {
      case 1:
        if (context.userMessage.trim()) {
          (skillData as Record<string, unknown>).name = context.userMessage.trim()
          nextStep = 2
          response = `Skill name set to: ${skillData.name}\n\nNow, please provide a description for the skill:`
        } else {
          response = 'Skill name cannot be empty. Please try again:'
        }
        break

      case 2:
        (skillData as Record<string, unknown>).description = context.userMessage.trim() || ''
        nextStep = 3
        response = `Skill description set.\n\nNow, please enter the skill tags (comma-separated):`
        break

      case 3:
        const tags = context.userMessage.trim()
          ? context.userMessage.split(',').map((tag: string) => tag.trim())
          : []
        (skillData as Record<string, unknown>).tags = tags
        nextStep = 4
        response = `Skill tags set to: ${tags.join(', ')}\n\nNow, please write the skill implementation code:\n\n` +
          `Skill code should export an object with an execute method, for example:\n\n` +
          '```javascript\n' +
          'module.exports = {\n' +
          '  async execute(context, args) {\n' +
          '    return "Skill execution result"\n' +
          '  }\n' +
          '}\n' +
          '```\n\n' +
          'Please enter your skill code:'
        break

      case 4:
        (skillData as Record<string, unknown>).code = context.userMessage.trim()

        try {
          const { getSkillManager } = await import('../skills')
          const skillManager = getSkillManager()

          const filePath = await skillManager.createSkill(
            skillData.name as string,
            skillData.code as string,
            {
              name: skillData.name as string,
              description: skillData.description as string,
              tags: skillData.tags as string[]
            }
          )

          session.activeSkill = null
          session.state = {
            ...session.state,
            skillCreator: null
          }
          await sessionManager.save(session)

          response = `**Skill created successfully!**\n\n` +
            `Skill name: ${skillData.name}\n` +
            `Description: ${skillData.description || 'None'}\n` +
            `Tags: ${(skillData.tags as string[]).join(', ') || 'None'}\n` +
            `File path: ${filePath}\n\n` +
            `You can use \`/skills\` command to view all available skills.`
        } catch (error) {
          logger.error('Failed to create skill', error)
          response = `Failed to create skill: ${error instanceof Error ? error.message : String(error)}\n\n` +
            `Please try again or contact administrator.`
        }
        break

      default:
        response = 'Skill creation flow error. Please start again.'
        session.activeSkill = null
        session.state = {
          ...session.state,
          skillCreator: null
        }
        await sessionManager.save(session)
        break
    }

    // Update session state
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

    const sessionId = context.sessionId || `${context.platform}:${context.userId}`
    sessionManager.addMessage(sessionId, 'user', context.userMessage)
    sessionManager.addMessage(sessionId, 'assistant', response)

    return response
  }

  /**
   * Cleanup resources
   */
  async destroy(): Promise<void> {
    logger.info('Destroying agent')
    const memoryManager = getMemoryManager()
    const configManager = getConfigManager()

    memoryManager.close()
    configManager.close()

    logger.info('Agent destroyed')
  }
}

// Type definitions
interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}
