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
const pendingMessages: FeishuMessage[] = []
let isProcessingQueue = false
let messageCounter = 0

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

  async replyMessage(messageId: string, content: string, replyInThread: boolean = false): Promise<{ message_id: string; data: any }> {
    console.log('[FeishuChannel] replyMessage called:', { messageId, contentLength: content.length, replyInThread })
    const result = await this.client.im.message.reply({
      path: {
        message_id: messageId
      },
      data: {
        content: JSON.stringify({
          text: content
        }),
        msg_type: 'text',
        reply_in_thread: replyInThread
      }
    })

    console.log('[FeishuChannel] Reply API response:', { code: result.code, msg: result.msg, messageId: result.data?.message_id })

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
  
  console.log(`[Feishu] 🕵️ Checking if message processed: ${messageId}`)
  
  if (processedMessageIds.has(messageId)) {
    const timestamp = processedMessageIds.get(messageId)!
    console.log(`[Feishu] 🕵️ Message ${messageId} was processed at ${new Date(timestamp).toISOString()}`)
    if (now - timestamp < maxAge) {
      console.log(`[Feishu] 🕵️ Duplicate message ignored: ${messageId}`)
      return true
    } else {
      console.log(`[Feishu] 🕵️ Message ${messageId} expired, reprocessing`)
    }
  }
  
  processedMessageIds.set(messageId, now)
  console.log(`[Feishu] 🕵️ Marking message ${messageId} as processed`)
  
  if (processedMessageIds.size > 5000) {
    console.log(`[Feishu] 🕵️ Cleaning up old messages, current size: ${processedMessageIds.size}`)
    for (const [id, timestamp] of processedMessageIds.entries()) {
      if (now - timestamp > maxAge) {
        processedMessageIds.delete(id)
      }
    }
    console.log(`[Feishu] 🕵️ Cleanup completed, new size: ${processedMessageIds.size}`)
  }
  
  console.log(`[Feishu] 🕵️ Message ${messageId} is new, processing`)
  return false
}

async function processMessageQueue(): Promise<void> {
  if (isProcessingQueue) {
    console.log('[Feishu] 🚶 Queue already being processed, will check later')
    setTimeout(() => {
      if (messageQueue.length > 0 || pendingMessages.length > 0) {
        processMessageQueue()
      }
    }, 100)
    return
  }
  
  isProcessingQueue = true
  console.log(`[Feishu] 📋 Starting queue processing, queue: ${messageQueue.length}, pending: ${pendingMessages.length}`)
  
  try {
    let processedCount = 0
    
    while (messageQueue.length > 0) {
      console.log(`[Feishu] 📋 Processing main queue message, remaining: ${messageQueue.length}`)
      const task = messageQueue.shift()
      if (task) {
        try {
          await task()
          processedCount++
          console.log(`[Feishu] ✅ Processed main queue message, count: ${processedCount}`)
        } catch (error) {
          console.error('[Feishu] ❌ Error processing main queue message:', error)
        }
      }
    }
    
    if (messageQueue.length === 0 && pendingMessages.length > 0) {
      console.log(`[Feishu] 📋 Batch processing pending messages, size: ${pendingMessages.length}`)
      
      const messagesToProcess = pendingMessages.splice(0, pendingMessages.length)
      console.log(`[Feishu] 📋 Moved ${messagesToProcess.length} messages from pending to processing`)
      
      if (messagesToProcess.length > 0 && messageHandler) {
        try {
          const firstMessage = messagesToProcess[0]
          const userOpenId = firstMessage.sender_id?.open_id || ''
          
          if (messagesToProcess.length === 1) {
            console.log('[Feishu] 📋 Processing single pending message')
            await messageHandler(firstMessage)
            processedCount++
          } else {
            const combinedContent = messagesToProcess.map(m => m.content).join('\n')
            console.log(`[Feishu] 📋 Processing ${messagesToProcess.length} pending messages combined`)
            
            await messageHandler({
              message_id: firstMessage.message_id,
              msg_type: firstMessage.msg_type,
              chat_id: firstMessage.chat_id,
              content: combinedContent,
              sender_id: firstMessage.sender_id
            })
            processedCount++
          }
          
          console.log(`[Feishu] ✅ Processed pending messages, count: ${processedCount}`)
        } catch (error) {
          console.error('[Feishu] ❌ Error processing pending messages:', error)
        }
      }
    }
    
    console.log(`[Feishu] 🎉 Queue processing completed, processed: ${processedCount}`)
  } finally {
    isProcessingQueue = false
    console.log(`[Feishu] 📋 Queue processing finished, queue: ${messageQueue.length}, pending: ${pendingMessages.length}`)
    
    if (messageQueue.length > 0 || pendingMessages.length > 0) {
      console.log(`[Feishu] 🔄 New messages in queues, processing again...`)
      setTimeout(processMessageQueue, 0)
    } else {
      console.log('[Feishu] 📋 All queues are empty, waiting for new messages')
    }
  }
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
      let msgNum = 0
      try {
        messageCounter++
        msgNum = messageCounter
        console.log(`[Feishu] 🔔 [${msgNum}] ========== RAW EVENT RECEIVED ==========`)
        console.log(`[Feishu] 🔔 [${msgNum}] Event type: im.message.receive_v1`)
        console.log(`[Feishu] 🔔 [${msgNum}] Full event data:`, JSON.stringify(data, null, 2))
        console.log(`[Feishu] 🔔 [${msgNum}] Event header:`, data?.header)
        console.log(`[Feishu] 🔔 [${msgNum}] Event message:`, data?.message)
        console.log(`[Feishu] 🔔 [${msgNum}] Event sender:`, data?.sender)
        console.log(`[Feishu] 🔔 [${msgNum}] Event timestamp:`, new Date().toISOString())
        console.log(`[Feishu] 🔔 [${msgNum}] ==========================================`)

        const message = data.message
        if (!message) {
          console.log(`[Feishu] ❌ [${msgNum}] No message in event data`)
          console.log(`[Feishu] ❌ [${msgNum}] Full event data:`, data)
          return
        }

        const messageId = message.message_id
        if (!messageId) {
          console.log(`[Feishu] ❌ [${msgNum}] No message_id in message`)
          console.log(`[Feishu] ❌ [${msgNum}] Message data:`, message)
          return
        }
        
        console.log(`[Feishu] 📍 [${msgNum}] Processing message:`, messageId)
        
        if (isMessageProcessed(messageId)) {
          console.log(`[Feishu] ⚠️  [${msgNum}] Duplicate message ignored: ${messageId}`)
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
          console.log(`[Feishu] ❌ [${msgNum}] Ignoring bot message`)
          return
        }

        console.log(`[Feishu] 📥 [${msgNum}] Received event:`, {
          eventName: 'im.message.receive_v1',
          messageId: messageId,
          userOpenId: userOpenId,
          chatId: chatId,
          chatType: chatType,
          msgType: msgType,
          senderType: senderType,
          timestamp: new Date().toISOString()
        })

        if (msgType === 'text' && content && userOpenId) {
          try {
            const textContent = JSON.parse(content).text
            console.log(`[Feishu] 📝 [${msgNum}] Message content:`, {
              userOpenId: userOpenId,
              textContent: textContent,
              messageId: messageId,
              chatType: chatType,
              timestamp: new Date().toISOString()
            })

            if (messageHandler) {
              console.log(`[Feishu] 📋 [${msgNum}] Queuing message handler...`)
              console.log(`[Feishu] 📋 [${msgNum}] Current queue size:`, messageQueue.length)
              console.log(`[Feishu] 📋 [${msgNum}] Current pending size:`, pendingMessages.length)
              console.log(`[Feishu] 📋 [${msgNum}] Is processing:`, isProcessingQueue)
              
              const replyTo = chatType === 'group' ? chatId : userOpenId
              
              console.log(`[Feishu] 🚀 [${msgNum}] Adding GET reaction for:`, messageId)
              await feishuChannel.addReaction(messageId, 'GET')
              console.log(`[Feishu] ✅ [${msgNum}] Added GET reaction for:`, messageId)
              
              const feishuMessage: FeishuMessage = {
                message_id: messageId,
                msg_type: msgType,
                chat_id: chatId,
                content: textContent,
                sender_id: {
                  open_id: userOpenId
                }
              }
              
              const task = async () => {
                try {
                  console.log(`[Feishu] 🚀 [${msgNum}] Adding PROCESSING reaction for:`, messageId)
                  await feishuChannel.addReaction(messageId, 'THUMBSUP')
                  console.log(`[Feishu] ✅ [${msgNum}] Added PROCESSING reaction for:`, messageId)
                  
                  console.log(`[Feishu] 🚀 [${msgNum}] Processing queued message:`, messageId)
                  await messageHandler!(feishuMessage)
                  console.log(`[Feishu] 🎉 [${msgNum}] Message handler completed:`, messageId)
                } catch (error) {
                  console.error(`[Feishu] ❌ [${msgNum}] Message handler error:`, error)
                }
              }
              
              if (isProcessingQueue) {
                pendingMessages.push(feishuMessage)
                console.log(`[Feishu] 📋 [${msgNum}] Message added to pending queue, new size:`, pendingMessages.length)
                
                console.log(`[Feishu] 🚀 [${msgNum}] Adding WAITING reaction for:`, messageId)
                await feishuChannel.addReaction(messageId, 'CLOCK')
                console.log(`[Feishu] ✅ [${msgNum}] Added WAITING reaction for:`, messageId)
              } else {
                messageQueue.push(task)
                console.log(`[Feishu] 📋 [${msgNum}] Message added to main queue, new size:`, messageQueue.length)
              }
              
              setTimeout(() => {
                processMessageQueue()
              }, 0)
            } else {
              console.log(`[Feishu] ❌ [${msgNum}] No message handler registered`)
            }
          } catch (e) {
            console.error(`[Feishu] ❌ [${msgNum}] Failed to parse message content:`, e)
          }
        } else {
          console.log(`[Feishu] ❌ [${msgNum}] Unsupported message type: ${msgType}, content: ${content ? 'exists' : 'missing'}, userOpenId: ${userOpenId}`)
        }
      } catch (error) {
        console.error(`[Feishu] ❌ [${msgNum}] Error processing message:`, error)
      }
    }
  })

  wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.debug,
  })

  console.log('[Feishu] 🔌 WebSocket client created, appId:', config.appId)
  console.log('[Feishu] 🔌 Starting WebSocket connection...')
  console.log('[Feishu] 🔌 Logger level: debug')

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
