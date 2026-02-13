import * as lark from '@larksuiteoapi/node-sdk'

export interface FeishuConfig {
  appId: string
  appSecret: string
  encryptKey?: string
  verificationToken?: string
  allowFrom?: string[]
}

export interface FeishuMessage {
  message_id: string
  msg_type: string
  chat_id: string
  content: string
  sender_id?: {
    open_id?: string
    user_id?: string
  }
}

type MessageHandler = (message: FeishuMessage) => Promise<void>

let wsClient: lark.WSClient | null = null
let messageHandler: MessageHandler | null = null
const processedMessageIds = new Map<string, number>()
const messageQueue: Array<() => Promise<void>> = []
let isProcessingQueue = false

export class FeishuChannel {
  private client: lark.Client
  private config: FeishuConfig

  constructor(config: FeishuConfig) {
    this.config = config
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret,
    })
  }

  async sendMessage(content: string, receiveId: string, parentId?: string): Promise<{ message_id: string; data: any }> {
    console.log('[FeishuChannel] sendMessage called:', { contentLength: content.length, receiveId, parentId })
    const result = await this.client.im.message.create({
      params: {
        receive_id_type: 'open_id'
      },
      data: {
        receive_id: receiveId,
        content: JSON.stringify({
          text: content
        }),
        msg_type: 'text',
        ...(parentId && { reply_in_thread: { message_id: parentId } })
      }
    })

    console.log('[FeishuChannel] API response:', { code: result.code, msg: result.msg, messageId: result.data?.message_id })

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.msg}`)
    }

    if (!result.data || !result.data.message_id) {
      throw new Error('Feishu API error: no message_id returned')
    }

    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  async sendCardMessage(content: string, receiveId: string, parentId?: string): Promise<{ message_id: string; data: any }> {
    const card = {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'markdown',
          content: content
        }
      ]
    }

    const result = await this.client.im.message.create({
      params: {
        receive_id_type: 'open_id'
      },
      data: {
        receive_id: receiveId,
        content: JSON.stringify(card),
        msg_type: 'interactive',
        ...(parentId && { reply_in_thread: { message_id: parentId } })
      }
    })

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.msg}`)
    }

    if (!result.data || !result.data.message_id) {
      throw new Error('Feishu API error: no message_id returned')
    }

    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  async addReaction(messageId: string, emojiType: string = 'THUMBSUP'): Promise<void> {
    try {
      // Correct API path for message reactions (using path parameter)
      const result = await this.client.im.messageReaction.create({
        path: {
          message_id: messageId
        },
        data: {
          reaction_type: {
            emoji_type: emojiType
          }
        }
      } as any)

      if (result.code !== 0) {
        console.log(`[Feishu] Failed to add reaction: ${result.msg}`)
      } else {
        console.log(`[Feishu] ✅ Added reaction ${emojiType} successfully`)
      }
    } catch (e) {
      console.log(`[Feishu] Error adding reaction:`, e)
    }
  }

  getConfig(): FeishuConfig {
    return this.config
  }
}

function isMessageProcessed(messageId: string): boolean {
  const now = Date.now()
  const maxAge = 5 * 60 * 1000 // 5 minutes
  
  if (processedMessageIds.has(messageId)) {
    const timestamp = processedMessageIds.get(messageId)!
    if (now - timestamp < maxAge) {
      return true
    }
  }
  
  processedMessageIds.set(messageId, now)
  
  if (processedMessageIds.size > 5000) {
    for (const [id, timestamp] of processedMessageIds.entries()) {
      if (now - timestamp > maxAge) {
        processedMessageIds.delete(id)
      }
    }
  }
  
  return false
}

async function processMessageQueue(): Promise<void> {
  if (isProcessingQueue || messageQueue.length === 0) {
    return
  }
  
  isProcessingQueue = true
  console.log(`[Feishu] Processing message queue, size: ${messageQueue.length}`)
  
  while (messageQueue.length > 0) {
    const task = messageQueue.shift()
    if (task) {
      try {
        await task()
      } catch (error) {
        console.error('[Feishu] Error processing queued message:', error)
      }
    }
  }
  
  isProcessingQueue = false
  console.log('[Feishu] Message queue processing completed')
}

export function startFeishuWS(
  config: FeishuConfig,
  onMessage: MessageHandler
): void {
  if (wsClient) {
    console.log('[Feishu] WebSocket already connected')
    return
  }

  messageHandler = onMessage

  const feishuChannel = new FeishuChannel(config)

  const eventDispatcher = new lark.EventDispatcher({})

  eventDispatcher.register({
    'im.message.receive_v1': async (data: any) => {
      try {
        console.log('[Feishu] ✅ Event matched: im.message.receive_v1')

        const message = data.message
        if (!message) {
          console.log('[Feishu] No message in event data')
          return
        }

        const messageId = message.message_id
        
        if (isMessageProcessed(messageId)) {
          console.log(`[Feishu] Duplicate message ignored: ${messageId}`)
          return
        }

        const chatId = message.chat_id
        const content = message.content
        const msgType = message.message_type
        const chatType = message.chat_type

        let userOpenId = ''
        if (data.sender && data.sender.sender_id) {
          userOpenId = data.sender.sender_id.open_id || ''
        }

        const senderType = data.sender?.sender_type || ''
        if (senderType === 'bot') {
          console.log('[Feishu] Ignoring bot message')
          return
        }

        await feishuChannel.addReaction(messageId, 'THUMBSUP')
        console.log('[Feishu] Added THUMBSUP reaction')

        if (msgType === 'text' && content && userOpenId) {
          try {
            const textContent = JSON.parse(content).text
            console.log('[Feishu] Message:', { userOpenId, textContent, messageId, chatType })

            if (messageHandler) {
              console.log('[Feishu] Queuing message handler...')
              
              const replyTo = chatType === 'group' ? chatId : userOpenId
              
              messageQueue.push(async () => {
                try {
                  await messageHandler!({
                    message_id: messageId,
                    msg_type: msgType,
                    chat_id: chatId,
                    content: textContent,
                    sender_id: {
                      open_id: userOpenId
                    }
                  })
                  console.log('[Feishu] Message handler completed')
                } catch (error) {
                  console.error('[Feishu] Message handler error:', error)
                }
              })
              
              processMessageQueue()
            } else {
              console.log('[Feishu] No message handler registered')
            }
          } catch (e) {
            console.error('[Feishu] Failed to parse message content:', e)
          }
        } else {
          console.log(`[Feishu] Unsupported message type: ${msgType}, content: ${content ? 'exists' : 'missing'}, userOpenId: ${userOpenId}`)
        }
      } catch (error) {
        console.error('[Feishu] Error processing message:', error)
      }
    }
  })

  wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.debug,
  })

  wsClient.start({
    eventDispatcher
  })

  console.log('[Feishu] WebSocket client started, connecting to Feishu server...')
}

export function stopFeishuWS(): void {
  if (wsClient) {
    wsClient.close()
    wsClient = null
    console.log('[Feishu] WebSocket client stopped')
  }
}

export function getFeishuChannel(config: FeishuConfig): FeishuChannel {
  return new FeishuChannel(config)
}
