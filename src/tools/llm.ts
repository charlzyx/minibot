import type { LLMMessage, LLMResponse, ToolDefinition, ToolResult } from '@/types'
import { ToolBase } from './base'
import { LLMError, createLogger } from '@/utils'

const logger = createLogger('LLMTool')

/**
 * Default model configuration
 */
const DEFAULT_MODEL = 'glm-4.7'
const DEFAULT_MAX_TOKENS = 4096
const DEFAULT_TEMPERATURE = 0.7

/**
 * LLM tool for calling language models
 */
export class LLMTool extends ToolBase<
  {
    provider?: string
    model?: string
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    maxTokens?: number
    temperature?: number
  },
  LLMResponse
> {
  readonly name = 'llm'
  readonly description = 'Call Large Language Model APIs for text generation'
  readonly parameters = {
    type: 'object',
    properties: {
      provider: {
        type: 'string',
        description: 'LLM provider name (default: from config)'
      },
      model: {
        type: 'string',
        description: 'Model name'
      },
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
      },
      tools: {
        type: 'array',
        description: 'Tool definitions for function calling'
      },
      maxTokens: {
        type: 'number',
        description: 'Maximum tokens to generate'
      },
      temperature: {
        type: 'number',
        description: 'Sampling temperature (0-1)'
      }
    },
    required: ['messages']
  } as const

  /**
   * Build API request body
   */
  private buildRequestBody(params: {
    messages: LLMMessage[]
    tools?: ToolDefinition[]
    maxTokens?: number
    temperature?: number
  }): object {
    const { messages, tools, maxTokens, temperature } = params

    const body: Record<string, unknown> = {
      model: DEFAULT_MODEL,
      messages: messages.map(msg => {
        const result: Record<string, unknown> = {
          role: msg.role,
          content: msg.content
        }

        if (msg.toolCalls && msg.toolCalls.length > 0) {
          result.tool_calls = msg.toolCalls
        }

        return result
      })
    }

    if (tools && tools.length > 0) {
      body.tools = tools
    }

    if (maxTokens !== undefined) {
      body.max_tokens = maxTokens
    }

    if (temperature !== undefined) {
      body.temperature = temperature
    }

    return body
  }

  /**
   * Execute LLM request
   */
  protected async executeImpl(
    params: {
      provider?: string
      model?: string
      messages: LLMMessage[]
      tools?: ToolDefinition[]
      maxTokens?: number
      temperature?: number
    },
    context?: unknown
  ): Promise<LLMResponse> {
    // Get configuration from environment
    const apiKey = process.env.ZHIPU_API_KEY || process.env.OPENAI_API_KEY
    const apiBase = process.env.ZHIPU_BASE_URL || process.env.OPENAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4'
    const provider = params.provider || 'zhipu'
    const model = params.model || DEFAULT_MODEL

    if (!apiKey) {
      throw new LLMError('API key not configured', provider)
    }

    logger.info(`Calling LLM: ${model}`, {
      provider,
      messageCount: params.messages.length,
      hasTools: !!params.tools?.length
    })

    const body = this.buildRequestBody(params)

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 60000)

    try {
      const url = `${apiBase}/chat/completions`

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new LLMError(
          `LLM API error: ${response.status} ${response.statusText}`,
          provider,
          { status: response.status, error: errorText }
        )
      }

      const data = await response.json() as LLMAPIResponse

      const choice = data.choices[0]
      if (!choice) {
        throw new LLMError('No response choices returned', provider)
      }

      const result: LLMResponse = {
        content: choice.message.content || '',
        model: data.model,
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        finishReason: choice.finish_reason
      }

      if (choice.message.tool_calls) {
        result.toolCalls = choice.message.tool_calls
      }

      logger.info(`LLM response received`, {
        model: result.model,
        finishReason: result.finishReason,
        usage: result.usage
      })

      return result
    } catch (error) {
      if (error instanceof LLMError) {
        throw error
      }

      if (error instanceof Error && error.name === 'AbortError') {
        throw new LLMError('LLM request timeout', provider)
      }

      throw new LLMError(
        error instanceof Error ? error.message : String(error),
        provider
      )
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

/**
 * LLM API response shape
 */
interface LLMAPIResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content?: string
      tool_calls?: Array<{
        id: string
        type: string
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: string
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// Export singleton instance
export const llmTool = new LLMTool()

export default llmTool
