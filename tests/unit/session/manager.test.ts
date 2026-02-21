import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { rm } from 'fs/promises'
import { getSessionManager, closeSessionManager } from '@/session/manager'
import type { Session } from '@/types'

describe('SessionManager', () => {
  const testWorkspace = `/tmp/minibot-session-test-${Date.now()}`

  beforeEach(() => {
    // Set test workspace
    process.env.WORKSPACE = testWorkspace
    closeSessionManager()
  })

  afterEach(async () => {
    closeSessionManager()
    await rm(testWorkspace, { recursive: true, force: true })
  })

  describe('session lifecycle', () => {
    it('should create a new session', () => {
      const manager = getSessionManager()
      const session = manager.getOrCreate('test:key')

      expect(session.key).toBe('test:key')
      expect(session.messages).toEqual([])
      expect(session.createdAt).toBeGreaterThan(0)
    })

    it('should reuse existing session from cache', () => {
      const manager = getSessionManager()
      const session1 = manager.getOrCreate('test:key')
      const session2 = manager.getOrCreate('test:key')

      expect(session1).toBe(session2)
      expect(session1.createdAt).toBe(session2.createdAt)
    })
  })

  describe('message management', () => {
    it('should add messages to session', () => {
      const manager = getSessionManager()
      const sessionId = 'test:messages'

      manager.addMessage(sessionId, 'user', 'Hello')
      manager.addMessage(sessionId, 'assistant', 'Hi there!')

      const session = manager.getOrCreate(sessionId)
      expect(session.messages).toHaveLength(2)
      expect(session.messages[0].content).toBe('Hello')
      expect(session.messages[1].content).toBe('Hi there!')
    })

    it('should get chat messages only', () => {
      const manager = getSessionManager()
      const sessionId = 'test:filter'

      manager.addMessage(sessionId, 'user', 'Hello')
      manager.addMessage(sessionId, 'system', 'System message')
      manager.addMessage(sessionId, 'assistant', 'Response')

      const messages = manager.getMessages(sessionId, 10)
      expect(messages).toHaveLength(2)
      expect(messages[0].role).toBe('user')
      expect(messages[1].role).toBe('assistant')
    })

    it('should limit message history', () => {
      const manager = getSessionManager()
      const sessionId = 'test:limit'

      for (let i = 0; i < 30; i++) {
        manager.addMessage(sessionId, 'user', `Message ${i}`)
      }

      const messages = manager.getMessages(sessionId, 10)
      expect(messages).toHaveLength(10)
    })

    it('should get messages since timestamp', () => {
      const manager = getSessionManager()
      const sessionId = 'test:since'

      const timestamp = Date.now()
      manager.addMessage(sessionId, 'user', 'Before')
      await new Promise(resolve => setTimeout(resolve, 10))
      const after = Date.now()
      manager.addMessage(sessionId, 'user', 'After')

      const messages = manager.getMessagesSince(sessionId, after)
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toBe('After')
    })

    it('should get last timestamp', () => {
      const manager = getSessionManager()
      const sessionId = 'test:timestamp'

      expect(manager.getLastTimestamp(sessionId)).toBe(0)

      manager.addMessage(sessionId, 'user', 'Test')
      const lastTimestamp = manager.getLastTimestamp(sessionId)

      expect(lastTimestamp).toBeGreaterThan(0)
    })
  })

  describe('session operations', () => {
    it('should clear session messages', () => {
      const manager = getSessionManager()
      const sessionId = 'test:clear'

      manager.addMessage(sessionId, 'user', 'Message 1')
      manager.addMessage(sessionId, 'user', 'Message 2')
      manager.clear(sessionId)

      const session = manager.getOrCreate(sessionId)
      expect(session.messages).toEqual([])
    })

    it('should delete session', async () => {
      const manager = getSessionManager()
      const sessionId = 'test:delete'

      manager.addMessage(sessionId, 'user', 'Test message')
      await manager.save(manager.getOrCreate(sessionId))

      const deleted = await manager.delete(sessionId)
      expect(deleted).toBe(true)

      const session = manager.getOrCreate(sessionId)
      expect(session.messages).toEqual([])
    })

    it('should unload session from cache', () => {
      const manager = getSessionManager()
      const sessionId = 'test:unload'

      manager.addMessage(sessionId, 'user', 'Test')
      manager.unload(sessionId)

      const session = manager.getOrCreate(sessionId)
      // After unload, getOrCreate should create a new session
      expect(session.messages).toEqual([])
    })
  })

  describe('session listing', () => {
    it('should list all sessions', async () => {
      const manager = getSessionManager()

      manager.addMessage('test:1', 'user', 'Message 1')
      manager.addMessage('test:2', 'user', 'Message 2')
      await manager.save(manager.getOrCreate('test:1'))
      await manager.save(manager.getOrCreate('test:2'))

      const sessions = await manager.listSessions()
      expect(sessions.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('cache statistics', () => {
    it('should return cache stats', () => {
      const manager = getSessionManager()

      manager.addMessage('test:stats', 'user', 'Test')
      const stats = manager.getCacheStats()

      expect(stats.size).toBeGreaterThan(0)
      expect(stats.maxSize).toBeGreaterThan(0)
      expect(Array.isArray(stats.keys)).toBe(true)
    })
  })
})
