import path from 'path'
import fs from 'fs/promises'
import * as syncFs from 'fs'
import type { Session, SessionMessage, ChatMessage } from '@/types'
import { LRUCache } from '@/utils/lru-cache'
import { createLogger } from '@/utils'

const logger = createLogger('SessionManager')

/**
 * Default maximum cache size
 */
const DEFAULT_MAX_CACHE_SIZE = 500

/**
 * Session cache entry with metadata
 */
interface SessionCacheEntry {
  session: Session
  lastAccess: number
  dirty: boolean
}

/**
 * Session manager with LRU cache
 */
class SessionManager {
  private sessionsDir: string
  private cache: LRUCache<string, Session>
  private maxCacheSize: number

  constructor(maxCacheSize: number = DEFAULT_MAX_CACHE_SIZE) {
    const workspace = process.env.WORKSPACE || '/tmp/minibot-workspace'
    this.sessionsDir = path.join(workspace, 'sessions')
    this.maxCacheSize = maxCacheSize
    this.cache = new LRUCache<string, Session>({
      maxSize: this.maxCacheSize,
      ttl: 30 * 60 * 1000, // 30 minutes TTL
      onEvict: (key, session) => {
        logger.debug(`Session evicted from cache: ${key}`)
        // Auto-save on eviction
        this.save(session).catch(err => {
          logger.error(`Failed to save evicted session: ${key}`, err)
        })
      }
    })

    this.initialize()
  }

  private async initialize() {
    try {
      if (!syncFs.existsSync(this.sessionsDir)) {
        await fs.mkdir(this.sessionsDir, { recursive: true })
        logger.info(`Created sessions directory: ${this.sessionsDir}`)
      }
    } catch (error) {
      logger.error('Failed to initialize sessions directory', error)
    }
  }

  private getSessionPath(key: string): string {
    const safeKey = key.replace(/:/g, '_').replace(/\//g, '_')
    return path.join(this.sessionsDir, `${safeKey}.jsonl`)
  }

  /**
   * Get or create a session
   */
  getOrCreate(key: string): Session {
    const cached = this.cache.get(key)
    if (cached) {
      logger.debug(`Session cache hit: ${key}`)
      return cached
    }

    logger.debug(`Session cache miss: ${key}`)
    const session = this.load(key) || this.create(key)
    this.cache.set(key, session)
    return session
  }

  private create(key: string): Session {
    logger.info(`Creating new session: ${key}`)
    return {
      key,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {}
    }
  }

  private load(key: string): Session | null {
    const sessionPath = this.getSessionPath(key)

    if (!syncFs.existsSync(sessionPath)) {
      return null
    }

    try {
      const content = syncFs.readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter((line: string) => line.trim())

      let messages: SessionMessage[] = []
      let metadata = {
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {}
      }

      for (const line of lines) {
        const data = JSON.parse(line) as SessionMessage | { _type: 'metadata' } & typeof metadata

        if ('_type' in data && data._type === 'metadata') {
          metadata = {
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            metadata: data.metadata || {}
          }
        } else {
          messages.push(data as SessionMessage)
        }
      }

      logger.info(`Loaded session: ${key} with ${messages.length} messages`)

      return {
        key,
        messages,
        createdAt: metadata.createdAt,
        updatedAt: metadata.updatedAt,
        metadata: metadata.metadata
      }
    } catch (error) {
      logger.error(`Failed to load session ${key}`, error)
      return null
    }
  }

  /**
   * Save a session to disk
   */
  async save(session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(session.key)

    logger.debug(`Saving session: ${session.key}`)

    try {
      const lines: string[] = []

      // Metadata line
      lines.push(JSON.stringify({
        _type: 'metadata',
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        metadata: session.metadata
      }))

      // Message lines
      for (const msg of session.messages) {
        lines.push(JSON.stringify(msg))
      }

      await fs.writeFile(sessionPath, lines.join('\n') + '\n', 'utf-8')

      // Update cache
      this.cache.set(session.key, session)

      logger.debug(`Session saved: ${session.key}`)
    } catch (error) {
      logger.error(`Failed to save session ${session.key}`, error)
      throw error
    }
  }

  /**
   * Add a message to a session
   */
  addMessage(key: string, role: 'user' | 'assistant' | 'system' | 'tool', content: string, toolCallId?: string, toolCalls?: unknown[]): void {
    const session = this.getOrCreate(key)

    const message: SessionMessage = {
      role,
      content,
      timestamp: Date.now()
    }

    if (toolCallId) {
      message.toolCallId = toolCallId
    }

    if (toolCalls) {
      message.toolCalls = toolCalls as SessionMessage['toolCalls']
    }

    session.messages.push(message)
    session.updatedAt = Date.now()

    this.cache.set(key, session)
  }

  /**
   * Get messages from a session
   */
  getMessages(key: string, maxMessages: number = 20): ChatMessage[] {
    const session = this.getOrCreate(key)
    const messages = session.messages.slice(-maxMessages)

    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }))
  }

  /**
   * Get messages since a timestamp
   */
  getMessagesSince(key: string, timestamp: number): ChatMessage[] {
    const session = this.getOrCreate(key)
    const messages = session.messages.filter(msg => msg.timestamp > timestamp)

    return messages
      .filter(msg => msg.role === 'user' || msg.role === 'assistant')
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        timestamp: msg.timestamp
      }))
  }

  /**
   * Get the last message timestamp
   */
  getLastTimestamp(key: string): number {
    const session = this.getOrCreate(key)
    if (session.messages.length === 0) {
      return 0
    }
    return session.messages[session.messages.length - 1].timestamp
  }

  /**
   * Clear all messages in a session
   */
  clear(key: string): void {
    const session = this.getOrCreate(key)
    session.messages = []
    session.updatedAt = Date.now()
    this.cache.set(key, session)
    logger.info(`Cleared session: ${key}`)
  }

  /**
   * Unload a session from cache
   */
  unload(key: string): void {
    this.cache.delete(key)
    logger.debug(`Unloaded session from cache: ${key}`)
  }

  /**
   * Get all cached sessions
   */
  getAllSessions(): Session[] {
    return this.cache.values()
  }

  /**
   * Delete a session
   */
  async delete(key: string): Promise<boolean> {
    this.cache.delete(key)
    const sessionPath = this.getSessionPath(key)

    if (syncFs.existsSync(sessionPath)) {
      await fs.unlink(sessionPath)
      logger.info(`Deleted session: ${key}`)
      return true
    }

    return false
  }

  /**
   * List all sessions
   */
  async listSessions(): Promise<Array<{ key: string; createdAt: number; updatedAt: number }>> {
    const files = await fs.readdir(this.sessionsDir)
    const sessions: Array<{ key: string; createdAt: number; updatedAt: number }> = []

    for (const file of files) {
      if (file.endsWith('.jsonl')) {
        const sessionPath = path.join(this.sessionsDir, file)
        try {
          const content = await fs.readFile(sessionPath, 'utf-8')
          const firstLine = content.split('\n')[0]

          if (firstLine) {
            const data = JSON.parse(firstLine)
            if (data._type === 'metadata') {
              sessions.push({
                key: file.replace('.jsonl', '').replace(/_/g, ':'),
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
              })
            }
          }
        } catch (error) {
          logger.error(`Failed to read session ${file}`, error)
        }
      }
    }

    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const sessions = await this.listSessions()
    const now = Date.now()
    let deleted = 0

    for (const session of sessions) {
      if (now - session.updatedAt > maxAge) {
        await this.delete(session.key)
        deleted++
      }
    }

    // Also cleanup cache
    this.cache.cleanup()

    logger.info(`Cleaned up ${deleted} expired sessions`)
    return deleted
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: this.cache.keys()
    }
  }
}

let sessionManager: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    const maxCacheSize = parseInt(process.env.MAX_SESSION_CACHE || '500', 10)
    sessionManager = new SessionManager(maxCacheSize)
  }
  return sessionManager
}

export function closeSessionManager() {
  if (sessionManager) {
    logger.info('Closing session manager')
    sessionManager = null
  }
}

// Export types
export type { Session, SessionMessage, ChatMessage }
