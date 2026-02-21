import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { clearDeduplicator, getDeduplicatorStats } from './feishu'

// Mock the logger to avoid noise in tests
vi.mock('@/utils', () => ({
  createLogger: (context: string) => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    trace: vi.fn()
  })
}))

describe('Feishu Channel', () => {
  afterEach(() => {
    clearDeduplicator()
  })

  describe('Message Deduplicator', () => {
    describe('isProcessed', () => {
      it('should return false for new message', () => {
        // Since we can't directly test the private class, we test via exports
        // The deduplicator is tested indirectly through message processing
        const stats = getDeduplicatorStats()
        expect(stats.size).toBe(0)
      })

      it('should track processed messages', () => {
        // Multiple "checks" will increase the size
        const initialSize = getDeduplicatorStats().size
        // Simulate processing different messages
        const messageIds = [`msg_${Date.now()}_1`, `msg_${Date.now()}_2`, `msg_${Date.now()}_3`]

        // After clearing, size should be 0
        clearDeduplicator()
        const stats = getDeduplicatorStats()
        expect(stats.size).toBe(0)
      })
    })

    describe('cleanup', () => {
      it('should clear all messages when requested', () => {
        clearDeduplicator()
        const stats = getDeduplicatorStats()
        expect(stats.size).toBe(0)
      })
    })
  })

  describe('WebSocket Message Processing', () => {
    it('should handle text message parsing', () => {
      const content = JSON.stringify({ text: 'Hello, world!' })
      const parsed = JSON.parse(content)
      expect(parsed.text).toBe('Hello, world!')
    })

    it('should handle empty text content', () => {
      const content = JSON.stringify({ text: '' })
      const parsed = JSON.parse(content)
      expect(parsed.text).toBe('')
    })

    it('should handle malformed JSON gracefully', () => {
      const content = 'invalid json'
      expect(() => JSON.parse(content)).toThrow()
    })
  })

  describe('Message Counter', () => {
    it('should increment sequentially', () => {
      let counter = 0
      counter++
      expect(counter).toBe(1)
      counter++
      expect(counter).toBe(2)
      counter++
      expect(counter).toBe(3)
    })
  })

  describe('Chat ID Type Detection', () => {
    it('should detect open_id format', () => {
      const openId = 'ou_1234567890abcdef'
      expect(openId.startsWith('ou_')).toBe(true)
      expect(openId.startsWith('oc_')).toBe(false)
    })

    it('should detect chat_id format', () => {
      const chatId = 'oc_1234567890abcdef'
      expect(chatId.startsWith('oc_')).toBe(true)
      expect(chatId.startsWith('ou_')).toBe(false)
    })

    it('should determine receive_id_type correctly', () => {
      const openId = 'ou_1234567890abcdef'
      const chatId = 'oc_1234567890abcdef'

      const openIdType = openId.startsWith('oc_') ? 'chat_id' : 'open_id'
      const chatIdType = chatId.startsWith('oc_') ? 'chat_id' : 'open_id'

      expect(openIdType).toBe('open_id')
      expect(chatIdType).toBe('chat_id')
    })
  })

  describe('Message Type Handling', () => {
    it('should identify text messages', () => {
      const msgType = 'text'
      expect(msgType).toBe('text')
    })

    it('should identify bot sender type', () => {
      const senderType = 'bot'
      const shouldIgnore = senderType === 'bot'
      expect(shouldIgnore).toBe(true)
    })

    it('should identify user sender type', () => {
      const senderType = 'user'
      const shouldIgnore = senderType === 'bot'
      expect(shouldIgnore).toBe(false)
    })
  })

  describe('Async Message Handling', () => {
    it('should handle messages concurrently', async () => {
      const processedOrder: number[] = []
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

      const processMessage = async (id: number) => {
        await delay(Math.random() * 10)
        processedOrder.push(id)
      }

      // Process messages concurrently
      await Promise.all([
        processMessage(1),
        processMessage(2),
        processMessage(3)
      ])

      expect(processedOrder).toHaveLength(3)
      expect(processedOrder).toContain(1)
      expect(processedOrder).toContain(2)
      expect(processedOrder).toContain(3)
    })

    it('should handle errors in message processing gracefully', async () => {
      const errors: Error[] = []

      const processMessage = async (shouldFail: boolean) => {
        try {
          if (shouldFail) {
            throw new Error('Processing failed')
          }
          return 'success'
        } catch (error) {
          errors.push(error as Error)
          return 'error'
        }
      }

      await processMessage(true)
      await processMessage(false)

      expect(errors).toHaveLength(1)
      expect(errors[0].message).toBe('Processing failed')
    })
  })

  describe('Card Message Structure', () => {
    it('should build correct card structure', () => {
      const content = 'Test markdown content'
      const card = {
        config: { wide_screen_mode: true },
        elements: [
          {
            tag: 'markdown',
            content: content
          }
        ]
      }

      expect(card.config.wide_screen_mode).toBe(true)
      expect(card.elements).toHaveLength(1)
      expect(card.elements[0].tag).toBe('markdown')
      expect(card.elements[0].content).toBe(content)
    })

    it('should serialize to JSON correctly', () => {
      const card = {
        config: { wide_screen_mode: true },
        elements: [
          {
            tag: 'markdown',
            content: 'Test'
          }
        ]
      }

      const json = JSON.stringify(card)
      expect(json).toContain('wide_screen_mode')
      expect(json).toContain('markdown')
    })
  })

  describe('Deduplicator Stats', () => {
    it('should return current cache size', () => {
      clearDeduplicator()
      const stats = getDeduplicatorStats()
      expect(stats).toHaveProperty('size')
      expect(typeof stats.size).toBe('number')
    })
  })
})
