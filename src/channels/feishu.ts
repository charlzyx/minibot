import * as lark from '@larksuiteoapi/node-sdk'
import type { FeishuConfig, FeishuMessage } from '@/types'
import { createLogger } from '@/utils'

const logger = createLogger('FeishuChannel')

type MessageHandler = (message: FeishuMessage) => Promise<void>

/**
 * Message deduplication cache with TTL
 */
class MessageDeduplicator {
  private processedMessages = new Map<string, number>()
  private readonly maxAge = 5 * 60 * 1000 // 5 minutes
  private readonly maxCacheSize = 10000

  isProcessed(messageId: string): boolean {
    const now = Date.now()

    if (this.processedMessages.has(messageId)) {
      const timestamp = this.processedMessages.get(messageId)!

      if (now - timestamp < this.maxAge) {
        logger.debug('Duplicate message ignored', { messageId })
        return true
      }
    }

    this.processedMessages.set(messageId, now)
    this.cleanup()

    return false
  }

  private cleanup(): void {
    if (this.processedMessages.size > this.maxCacheSize) {
      const now = Date.now()
      for (const [id, timestamp] of this.processedMessages.entries()) {
        if (now - timestamp > this.maxAge) {
          this.processedMessages.delete(id)
        }
      }
      logger.debug('Cleaned up old message IDs', { remaining: this.processedMessages.size })
    }
  }

  clear(): void {
    this.processedMessages.clear()
  }
}

/**
 * Message queue for batched processing
 */
class MessageQueue {
  private mainQueue: Array<() => Promise<void>> = []
  private pendingMessages: FeishuMessage[] = []
  private processing = false

  get isEmpty(): boolean {
    return this.mainQueue.length === 0 && this.pendingMessages.length === 0
  }

  get size(): number {
    return this.mainQueue.length + this.pendingMessages.length
  }

  enqueue(task: () => Promise<void>): void {
    this.mainQueue.push(task)
  }

  enqueuePending(message: FeishuMessage): void {
    this.pendingMessages.push(message)
  }

  isProcessing(): boolean {
    return this.processing
  }

  setProcessing(processing: boolean): void {
    this.processing = processing
  }

  getPending(): FeishuMessage[] {
    return this.pendingMessages
  }

  shiftTask(): (() => Promise<void>) | undefined {
    return this.mainQueue.shift()
  }

  clearPending(): FeishuMessage[] {
    const messages = this.pendingMessages.splice(0, this.pendingMessages.length)
    return messages
  }
}

let wsClient: lark.WSClient | null = null
let messageHandler: MessageHandler | null = null
const messageDeduplicator = new MessageDeduplicator()
const messageQueue = new MessageQueue()
let messageCounter = 0

/**
 * Feishu Channel - Handles Feishu messaging integration
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
   * Send a card message
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

    logger.info('Card message sent successfully', { messageId: result.data.message_id })
    return {
      message_id: result.data.message_id,
      data: {}
    }
  }

  /**
   * Add reaction to a message
   */
  async addReaction(messageId: string, emojiType: string = 'THUMBSUP'): Promise<void> {
    try {
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
        logger.warn('Failed to add reaction', { messageId, emojiType, error: result.msg })
      } else {
        logger.debug('Added reaction successfully', { messageId, emojiType })
      }
    } catch (error) {
      logger.error('Error adding reaction', error, { messageId, emojiType })
    }
  }

  getConfig(): FeishuConfig {
    return this.config
  }
}

/**
 * Check if a message has been processed (deduplication)
 */
function isMessageProcessed(messageId: string): boolean {
  return messageDeduplicator.isProcessed(messageId)
}

/**
 * Process the message queue
 */
async function processMessageQueue(): Promise<void> {
  if (messageQueue.isProcessing()) {
    logger.debug('Queue already being processed, will check later')
    setTimeout(() => {
      if (!messageQueue.isEmpty) {
        processMessageQueue()
      }
    }, 100)
    return
  }

  messageQueue.setProcessing(true)
  logger.info('Starting queue processing', { queueSize: messageQueue.size })

  try {
    let processedCount = 0

    while (!messageQueue.isEmpty) {
      const task = messageQueue.shiftTask()
      if (task) {
        try {
          await task()
          processedCount++
          logger.debug('Processed main queue message', { count: processedCount })
        } catch (error) {
          logger.error('Error processing main queue message', error)
        }
      }
    }

    if (messageQueue.shiftTask() !== undefined && messageQueue.getPending().length > 0) {
      logger.info('Processing pending messages', { count: messageQueue.getPending().length })

      const messagesToProcess = messageQueue.clearPending()

      if (messagesToProcess.length > 0 && messageHandler) {
        try {
          const firstMessage = messagesToProcess[0]
          const userOpenId = firstMessage.sender_id?.open_id || ''

          if (messagesToProcess.length === 1) {
            logger.debug('Processing single pending message')
            await messageHandler(firstMessage)
            processedCount++
          } else {
            const combinedContent = messagesToProcess.map(m => m.content).join('\n')
            logger.debug(`Processing ${messagesToProcess.length} pending messages combined`)

            await messageHandler({
              message_id: firstMessage.message_id,
              msg_type: firstMessage.msg_type,
              chat_id: firstMessage.chat_id,
              content: combinedContent,
              sender_id: firstMessage.sender_id
            })
            processedCount++
          }

          logger.info('Processed pending messages', { count: processedCount })
        } catch (error) {
          logger.error('Error processing pending messages', error)
        }
      }
    }

    logger.info('Queue processing completed', { processedCount })
  } finally {
    messageQueue.setProcessing(false)

    if (!messageQueue.isEmpty) {
      logger.debug('New messages in queue, processing again...')
      setTimeout(processMessageQueue, 0)
    } else {
      logger.debug('All queues are empty, waiting for new messages')
    }
  }
}

/**
 * Start Feishu WebSocket connection
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
  const feishuChannel = new FeishuChannel(config)
  const eventDispatcher = new lark.EventDispatcher({})

  eventDispatcher.register({
    'im.message.receive_v1': async (data: any) => {
      let msgNum = 0
      try {
        messageCounter++
        msgNum = messageCounter

        logger.debug('Event received', {
          msgNum,
          eventType: 'im.message.receive_v1',
          messageId: data?.message?.message_id,
          senderId: data?.sender?.sender_id?.open_id
        })

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

        if (isMessageProcessed(messageId)) {
          logger.info('Duplicate message ignored', { messageId, msgNum })
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

        if (msgType === 'text' && content && userOpenId) {
          try {
            const textContent = JSON.parse(content).text

            logger.debug('Text message content parsed', {
              msgNum,
              userOpenId,
              contentLength: textContent.length,
              messageId
            })

            if (messageHandler) {
              const replyTo = chatType === 'group' ? chatId : userOpenId

              // Note: 'GET' is not a valid emoji_type, removed
              logger.debug('Processing message', { messageId })

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
                  await feishuChannel.addReaction(messageId, 'THUMBSUP')
                  logger.debug('Added THUMBSUP reaction', { messageId })

                  logger.info('Processing message handler', { messageId, msgNum })
                  await messageHandler!(feishuMessage)
                  logger.info('Message handler completed', { messageId, msgNum })
                } catch (error) {
                  logger.error('Message handler error', error, { messageId, msgNum })
                }
              }

              if (messageQueue.isProcessing()) {
                messageQueue.enqueuePending(feishuMessage)
                logger.debug('Message added to pending queue', {
                  messageId,
                  pendingCount: messageQueue.getPending().length
                })

                await feishuChannel.addReaction(messageId, 'CLOCK')
                logger.debug('Added CLOCK reaction', { messageId })
              } else {
                messageQueue.enqueue(task)
                logger.debug('Message added to main queue', {
                  messageId,
                  queueSize: messageQueue.size
                })
              }

              setTimeout(() => {
                processMessageQueue()
              }, 0)
            }
          } catch (error) {
            logger.error('Failed to parse message content', error, { msgNum, content })
          }
        } else {
          logger.warn('Unsupported message type', { msgType, hasContent: !!content, userOpenId })
        }
      } catch (error) {
        logger.error('Error processing message', error, { msgNum })
      }
    }
  })

  wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    loggerLevel: lark.LoggerLevel.debug
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
    wsClient.close()
    wsClient = null
    logger.info('WebSocket client stopped')
  }

  // Clear deduplicator
  messageDeduplicator.clear()
}

/**
 * Get a new Feishu channel instance
 */
export function getFeishuChannel(config: FeishuConfig): FeishuChannel {
  return new FeishuChannel(config)
}
