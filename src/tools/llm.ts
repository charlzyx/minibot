import { getConfigManager } from '../config/manager'

interface LLMParams {
  provider?: string
  model?: string
  messages?: Array<{
    role: 'system' | 'user' | 'assistant' | 'tool'
    content: string
    tool_call_id?: string
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: {
        name: string
        arguments: string
      }
    }>
  }>
  prompt?: string
  tools?: Array<{
    type: 'function'
    function: {
      name: string
      description: string
      parameters: Record<string, any>
    }
  }>
}

export interface LLMResult {
  content: string
  model: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
  finish_reason?: string
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: {
      name: string
      arguments: string
    }
  }>
}

interface ChatResponse {
  choices: Array<{
    message: {
      content?: string
      tool_calls?: Array<{
        id: string
        type: 'function'
        function: {
          name: string
          arguments: string
        }
      }>
    }
    finish_reason: string
  }>
  model: string
  usage?: {
    input_tokens: number
    output_tokens: number
  }
}

class LLMError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LLMError'
  }
}

class LLM {
  private configManager = getConfigManager()

  async execute(params: LLMParams): Promise<LLMResult> {
    try {
      const config = await this.configManager.loadConfig()
      
      const provider = params.provider || config.provider.name
      const model = params.model || config.model.name
      const messages = params.messages || []
      const tools = params.tools
      
      console.log(`[LLM] Executing with provider: ${provider}, model: ${model}`)
      
      switch (provider.toLowerCase()) {
        case 'zhipu':
        case 'zhipuai':
          return this.executeZhipu(model, messages, config, tools)
        case 'openai':
          return this.executeOpenAI(model, messages, config, tools)
        default:
          throw new LLMError(`Unsupported provider: ${provider}`)
      }
    } catch (error) {
      console.error('[LLM] Execution error:', error)
      throw error
    }
  }

  private async executeZhipu(model: string, messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }>, config: any, tools?: any[]): Promise<LLMResult> {
    const zhipuConfig = config.provider
    const apiKey = zhipuConfig.apiKey
    const baseURL = zhipuConfig.apiBase || 'https://open.bigmodel.cn/api/coding/paas/v4'
    
    if (!apiKey) {
      throw new LLMError('Zhipu API key not configured')
    }
    
    console.log('[LLM] Using Zhipu API:', baseURL)
    console.log('[LLM] API Key:', apiKey)
    
    if (apiKey === 'test') {
      console.log('[LLM] WARNING: Using test API Key!')
    }
    
    const requestBody: any = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: config.model.maxTokens || 1024
    }
    
    if (tools && tools.length > 0) {
      requestBody.tools = tools
    }
    
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new LLMError(`Zhipu API error: ${response.status} ${errorText}`)
    }
    
    const data = await response.json() as ChatResponse
    
    if (!data.choices || data.choices.length === 0) {
      throw new LLMError('No response from Zhipu API')
    }
    
    const choice = data.choices[0]
    
    return {
      content: choice.message?.content || '',
      model: data.model || model,
      usage: data.usage,
      finish_reason: choice.finish_reason,
      tool_calls: choice.message?.tool_calls
    }
  }

  private async executeOpenAI(model: string, messages: Array<{ role: string; content: string; tool_call_id?: string; tool_calls?: any[] }>, config: any, tools?: any[]): Promise<LLMResult> {
    const openaiConfig = config.provider
    const apiKey = openaiConfig.apiKey
    const baseURL = openaiConfig.baseURL || 'https://api.openai.com/v1'
    
    if (!apiKey) {
      throw new LLMError('OpenAI API key not configured')
    }
    
    console.log('[LLM] Using OpenAI API:', baseURL)
    
    const requestBody: any = {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: config.model.maxTokens || 1024
    }
    
    if (tools && tools.length > 0) {
      requestBody.tools = tools
    }
    
    const response = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(requestBody)
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new LLMError(`OpenAI API error: ${response.status} ${errorText}`)
    }
    
    const data = await response.json() as ChatResponse
    
    if (!data.choices || data.choices.length === 0) {
      throw new LLMError('No response from OpenAI API')
    }
    
    const choice = data.choices[0]
    
    return {
      content: choice.message?.content || '',
      model: data.model || model,
      usage: data.usage,
      finish_reason: choice.finish_reason,
      tool_calls: choice.message?.tool_calls
    }
  }
}

const llm = new LLM()
export default llm
