import * as lark from '@larksuiteoapi/node-sdk'
import type { FeishuConfig, FeishuMessage } from '@/types'
import { createLogger } from '@/utils'

const logger = createLogger('FeishuChannel')

type MessageHandler = (message: FeishuMessage) => Promise<void>

/**
 * Message deduplication cache with TTL
 * Based on nanobot's OrderedDict approach for efficient deduplication
 */
class MessageDeduplicator {
  private processedMessages = new Map<string, number>()
  private readonly maxAge = 5 * 60 * 1000 // 5 minutes
  private readonly maxCacheSize = 1000

  /**
   * Check if message has been processed, mark as processed if not
   */
  isProcessed(messageId: string): boolean {
    const now = Date.now()

    if (this.processedMessages.has(messageId)) {
      const timestamp = this.processedMessages.get(messageId)!
      if (now - timestamp < this.maxAge) {
        return true
      }
      // Expired entry, remove it
      this.processedMessages.delete(messageId)
    }

    // Mark as processed
    this.processedMessages.set(messageId, now)
    this.cleanup()
    return false
  }

  /**
   * Clean up old entries when cache exceeds max size
   * Keeps most recent maxCacheSize / 2 entries
   */
  private cleanup(): void {
    if (this.processedMessages.size > this.maxCacheSize) {
      const now = Date.now()
      let removed = 0

      // Remove expired entries first
      for (const [id, timestamp] of this.processedMessages.entries()) {
        if (now - timestamp > this.maxAge) {
          this.processedMessages.delete(id)
          removed++
        }
      }

      // If still too many, remove oldest entries
      const targetSize = Math.floor(this.maxCacheSize / 2)
      while (this.processedMessages.size > targetSize) {
        const firstKey = this.processedMessages.keys().next().value
        this.processedMessages.delete(firstKey)
        removed++
      }

      if (removed > 0) {
        logger.debug('Cleaned up message cache', { removed, remaining: this.processedMessages.size })
      }
    }
  }

  clear(): void {
    this.processedMessages.clear()
  }

  get size(): number {
    return this.processedMessages.size
  }
}

// Global WebSocket client and handler
let wsClient: lark.WSClient | null = null
let messageHandler: MessageHandler | null = null
let messageCounter = 0

// Message deduplicator singleton
const messageDeduplicator = new MessageDeduplicator()

/**
 * Feishu Channel - Handles Feishu messaging integration
 * Based on nanobot's simplified approach with direct message handling
 */
export class FeishuChannel {
  private client: lark.Client
  private config: FeishuConfig

  constructor(config: FeishuConfig) {
    this.config = config
    this.client = new lark.Client({
      appId: config.appId,
      appSecret: config.appSecret
    })
    logger.info('FeishuChannel initialized', { appId: config.appId })
  }

  /**
   * Send a message to Feishu
   */
  async sendMessage(
    content: string,
    receiveId: string,
    parentId?: string
  ): Promise<{ message_id: string; data: Record<string, unknown> }> {
    logger.debug('Sending message', { contentLength: content.length, receiveId, parentId })

    // Determine receive_id_type based on chat_id format
    // open_id starts with "ou_", chat_id starts with "oc_"
    const receiveIdType = receiveId.startsWith('oc_') ? 'chat_id' : 'open_id'

    const result = await this.client.im.message.create({
      params: {
        receive_id_type: receiveIdType
      },
      data: {
        receive_id: receiveId,
        content: JSON.stringify({
          text: content
        }),
        msg_type: 'text'
      }
    })

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.msg}`)
    }

    if (!result.data || !result.data.message_id) {
      throw new Error('Feishu API error: no message_id returned')
    }

    logger.info('Message sent successfully', { messageId: result.data.message_id })
    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  /**
   * Reply to an existing message
   */
  async replyMessage(
    messageId: string,
    content: string,
    replyInThread: boolean = false
  ): Promise<{ message_id: string; data: Record<string, unknown> }> {
    logger.debug('Replying to message', { messageId, contentLength: content.length, replyInThread })

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

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.msg}`)
    }

    if (!result.data || !result.data.message_id) {
      throw new Error('Feishu API error: no message_id returned')
    }

    logger.info('Reply sent successfully', { messageId: result.data.message_id })
    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  /**
   * Send a card message with markdown support
   */
  async sendCardMessage(
    content: string,
    receiveId: string,
    parentId?: string
  ): Promise<{ message_id: string; data: Record<string, unknown> }> {
    logger.debug('Sending card message', { contentLength: content.length, receiveId, parentId })

    const card = {
      config: { wide_screen_mode: true },
      elements: [
        {
          tag: 'markdown',
          content: content
        }
      ]
    }

    // Determine receive_id_type based on chat_id format
    const receiveIdType = receiveId.startsWith('oc_') ? 'chat_id' : 'open_id'

    const result = await this.client.im.message.create({
      params: {
        receive_id_type: receiveIdType
      },
      data: {
        receive_id: receiveId,
        content: JSON.stringify(card),
        msg_type: 'interactive'
      }
    })

    if (result.code !== 0) {
      throw new Error(`Feishu API error: ${result.code} - ${result.msg}`)
    }

    if (!result.data || !result.data.message_id) {
      throw new Error('Feishu API error: no message_id returned')
    }

    logger.info('Card message sent successfully', { messageId: result.data.message_id })
    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  getConfig(): FeishuConfig {
    return this.config
  }
}

/**
 * Process a single Feishu message
 * Simplified approach based on nanobot - handle each message independently
 */
async function processFeishuMessage(data: any, msgNum: number): Promise<void> {
  const message = data.message
  if (!message) {
    logger.warn('No message in event data', { msgNum, data })
    return
  }

  const messageId = message.message_id
  if (!messageId) {
    logger.warn('No message_id in message', { msgNum })
    return
  }

  // Deduplication check
  if (messageDeduplicator.isProcessed(messageId)) {
    logger.debug('Duplicate message ignored', { messageId, msgNum })
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
    logger.debug('Ignoring bot message', { msgNum })
    return
  }

  logger.info('Message received', {
    msgNum,
    messageId,
    userOpenId,
    chatId,
    chatType,
    msgType,
    senderType
  })

  // Parse text message content
  if (msgType === 'text' && content && userOpenId) {
    try {
      const textContent = JSON.parse(content).text || ''

      logger.debug('Text message content parsed', {
        msgNum,
        userOpenId,
        contentLength: textContent.length,
        messageId
      })

      if (messageHandler && textContent) {
        const feishuMessage: FeishuMessage = {
          message_id: messageId,
          msg_type: msgType,
          chat_id: chatId,
          content: textContent,
          sender_id: {
            open_id: userOpenId
          }
        }

        // Handle message independently - no queue needed
        await messageHandler(feishuMessage)
        logger.info('Message handled', { messageId, msgNum })
      }
    } catch (error) {
      logger.error('Failed to parse message content', error, { msgNum, content })
    }
  } else {
    logger.debug('Unsupported message type or empty content', { msgType, msgNum, hasContent: !!content })
  }
}

/**
 * Start Feishu WebSocket connection
 * Simplified approach - no complex queue logic
 */
export function startFeishuWS(
  config: FeishuConfig,
  onMessage: MessageHandler
): void {
  if (wsClient) {
    logger.warn('WebSocket already connected')
    return
  }

  messageHandler = onMessage
  const eventDispatcher = new lark.EventDispatcher({})

  // Register message event handler
  eventDispatcher.register({
    'im.message.receive_v1': async (data: any) => {
      try {
        messageCounter++
        const msgNum = messageCounter

        logger.debug('Event received', {
          msgNum,
          eventType: 'im.message.receive_v1',
          messageId: data?.message?.message_id,
          senderId: data?.sender?.sender_id?.open_id
        })

        // Process message independently - no queue
        await processFeishuMessage(data, msgNum)
      } catch (error) {
        logger.error('Error processing message event', error)
      }
    }
  })

  // Create and start WebSocket client
  wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.warn // Reduce noise from lark SDK
  })

  logger.info('WebSocket client created', { appId: config.appId })

  wsClient.start({
    eventDispatcher
  })

  logger.info('WebSocket connection started')
}

/**
 * Stop Feishu WebSocket connection
 */
export function stopFeishuWS(): void {
  if (wsClient) {
    try {
      wsClient.close()
    } catch (error) {
      logger.warn('Error closing WebSocket', error)
    }
    wsClient = null
    logger.info('WebSocket client stopped')
  }

  // Clear message handler and deduplicator
  messageHandler = null
  messageDeduplicator.clear()
}

/**
 * Get a new Feishu channel instance
 */
export function getFeishuChannel(config: FeishuConfig): FeishuChannel {
  return new FeishuChannel(config)
}

/**
 * Get deduplicator stats for testing
 */
export function getDeduplicatorStats(): { size: number } {
  return {
    size: messageDeduplicator.size
  }
}

/**
 * Clear deduplicator for testing
 */
export function clearDeduplicator(): void {
  messageDeduplicator.clear()
}
