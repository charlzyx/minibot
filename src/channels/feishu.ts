import type { Context } from 'hono'

export interface FeishuMessage {
  message_id: string
  msg_type: string
  content: {
    text: string
  } | {
    post_at: number
  }
  }
}

export interface FeishuConfig {
  appId: string
  appSecret: string
  encryptKey?: string
  verificationToken?: string
  allowFrom?: string[]
}

export class FeishuChannel {
  private config: FeishuConfig
  private apiUrl: string

  constructor(config: FeishuConfig) {
    this.config = config
    this.apiUrl = config.appId.startsWith('cli_')
      ? `https://open.feishu.cn/open-apis/bot/v2/app/${config.appId}`
      : `https://open.feishu.cn/open-apis/bot/v2/app/${config.appId}`
  }

  /**
   * Send message via Feishu API
   */
  async sendMessage(content: string): Promise<{ message_id: string; data: FeishuMessage['content'] }> {
    const url = `${this.apiUrl}/im/message/send`
    
    const body = {
      msg_type: 'text',
      content: {
        text: content
      },
      receive_id: crypto.randomUUID(),
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.appSecret}`,
      'X-3-App-Extra-Info': JSON.stringify({
        process_id: crypto.randomUUID(),
        trace_id: crypto.randomUUID(),
      }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Feishu API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json() as {
      message_id: string
      code: number
      data: FeishuMessage['content']
    }

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.message || 'Unknown error'}`)
    }

    return result.data
  }

  /**
   * Create message with card
   */
  async sendCardMessage(title: string, content: string): Promise<{ message_id: string; data: FeishuMessage['content'] }> {
    const url = `${this.apiUrl}/im/message/send`
    
    const body = {
      msg_type: 'interactive',
      content: {
        card: {
          elements: [
            {
              tag: 'text',
              text: content,
            },
            {
              tag: 'title',
              text: title,
            },
          ],
        },
      },
      receive_id: crypto.randomUUID(),
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.appSecret}`,
        'X-3-App-Extra-Info': JSON.stringify({
          process_id: crypto.randomUUID(),
          trace_id: crypto.randomUUID(),
        }),
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Feishu API error: ${response.status} - ${errorText}`)
    }

    const result = await response.json()
    return result.data
  }
}
