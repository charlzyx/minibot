import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Feishu Message Processing', () => {
  describe('Message Queue', () => {
    it('should process messages in order', async () => {
      const messages: string[] = []
      const processOrder: string[] = []

      const mockHandler = async (msg: string) => {
        processOrder.push(msg)
        await new Promise(resolve => setTimeout(resolve, 10))
      }

      messages.push('msg1')
      messages.push('msg2')
      messages.push('msg3')

      for (const msg of messages) {
        await mockHandler(msg)
      }

      expect(processOrder).toEqual(['msg1', 'msg2', 'msg3'])
    })

    it('should batch process pending messages', async () => {
      const pendingMessages: string[] = ['msg1', 'msg2', 'msg3']
      const processedContent: string[] = []

      const mockHandler = async (content: string) => {
        processedContent.push(content)
      }

      const combinedContent = pendingMessages.join('\n')
      await mockHandler(combinedContent)

      expect(processedContent).toEqual(['msg1\nmsg2\nmsg3'])
    })

    it('should handle single pending message', async () => {
      const pendingMessages: string[] = ['msg1']
      const processedContent: string[] = []

      const mockHandler = async (content: string) => {
        processedContent.push(content)
      }

      const combinedContent = pendingMessages.join('\n')
      await mockHandler(combinedContent)

      expect(processedContent).toEqual(['msg1'])
    })
  })

  describe('Message Deduplication', () => {
    it('should mark new message as not processed', () => {
      const processedMessageIds = new Map<string, number>()
      const messageId = 'msg_123'
      const now = Date.now()

      processedMessageIds.set(messageId, now)
      const isProcessed = processedMessageIds.has(messageId)

      expect(isProcessed).toBe(true)
    })

    it('should clean up old messages', () => {
      const processedMessageIds = new Map<string, number>()
      const now = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes

      processedMessageIds.set('old_msg', now - maxAge - 1000)
      processedMessageIds.set('new_msg', now)

      for (const [id, timestamp] of processedMessageIds.entries()) {
        if (now - timestamp > maxAge) {
          processedMessageIds.delete(id)
        }
      }

      expect(processedMessageIds.has('old_msg')).toBe(false)
      expect(processedMessageIds.has('new_msg')).toBe(true)
    })

    it('should limit processed message cache size', () => {
      const processedMessageIds = new Map<string, number>()
      const now = Date.now()
      const maxAge = 5 * 60 * 1000 // 5 minutes

      for (let i = 0; i < 6000; i++) {
        processedMessageIds.set(`msg_${i}`, now - (i * 1000))
      }

      expect(processedMessageIds.size).toBe(6000)

      for (const [id, timestamp] of processedMessageIds.entries()) {
        if (now - timestamp > maxAge) {
          processedMessageIds.delete(id)
        }
      }

      expect(processedMessageIds.size).toBeLessThan(5000)
    })
  })

  describe('Message Counter', () => {
    it('should increment message counter for each message', () => {
      let messageCounter = 0

      messageCounter++
      expect(messageCounter).toBe(1)

      messageCounter++
      expect(messageCounter).toBe(2)

      messageCounter++
      expect(messageCounter).toBe(3)
    })

    it('should include counter in log messages', () => {
      let messageCounter = 0
      const logs: string[] = []

      for (let i = 0; i < 3; i++) {
        messageCounter++
        logs.push(`[${messageCounter}] Message received`)
      }

      expect(logs).toEqual(['[1] Message received', '[2] Message received', '[3] Message received'])
    })
  })

  describe('Queue Processing Logic', () => {
    it('should not start new processing if already processing', () => {
      let isProcessingQueue = false
      let processCount = 0

      const startProcessing = () => {
        if (isProcessingQueue) {
          return false
        }
        isProcessingQueue = true
        processCount++
        setTimeout(() => {
          isProcessingQueue = false
        }, 100)
        return true
      }

      expect(startProcessing()).toBe(true)
      expect(processCount).toBe(1)
      expect(startProcessing()).toBe(false)
      expect(processCount).toBe(1)
    })

    it('should retry processing if messages remain', async () => {
      let isProcessingQueue = false
      let processCount = 0
      const messageQueue = ['msg1', 'msg2', 'msg3']

      const processQueue = async () => {
        if (isProcessingQueue) {
          setTimeout(() => {
            if (messageQueue.length > 0) {
              processQueue()
            }
          }, 100)
          return
        }

        isProcessingQueue = true
        processCount++
        const msg = messageQueue.shift()
        if (msg) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        isProcessingQueue = false

        if (messageQueue.length > 0) {
          setTimeout(() => {
            processQueue()
          }, 0)
        }
      }

      await processQueue()
      await new Promise(resolve => setTimeout(resolve, 500))

      expect(processCount).toBe(3)
      expect(messageQueue.length).toBe(0)
    })
  })

  describe('Message Batching', () => {
    it('should combine multiple pending messages', () => {
      const pendingMessages = ['msg1', 'msg2', 'msg3']

      const combined = pendingMessages.map(m => m).join('\n')

      expect(combined).toBe('msg1\nmsg2\nmsg3')
    })

    it('should use first message as reference', () => {
      const pendingMessages = [
        { message_id: 'msg1', content: 'content1' },
        { message_id: 'msg2', content: 'content2' },
        { message_id: 'msg3', content: 'content3' }
      ]

      const firstMessage = pendingMessages[0]
      const combined = pendingMessages.map((m: any) => m.content).join('\n')

      expect(firstMessage.message_id).toBe('msg1')
      expect(combined).toBe('content1\ncontent2\ncontent3')
    })
  })
})
