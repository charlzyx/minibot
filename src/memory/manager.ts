import sqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import type { Memory } from '@/types'
import { MemoryError, createLogger } from '@/utils'
import { getWorkspace } from '../config/manager'

const logger = createLogger('MemoryManager')

/**
 * Database row interface
 */
interface MemoryRow {
  id: number
  content: string
  embedding?: Buffer
  tags: string
  createdAt: number
  updatedAt: number
}

/**
 * Memory Manager - Handles persistent memory storage
 */
export class MemoryManager {
  private db: sqlite3.Database
  private dbPath: string
  private memoryDir: string

  constructor() {
    const workspace = getWorkspace()
    this.dbPath = path.join(workspace, 'db', 'memory.db')
    this.memoryDir = path.join(workspace, 'memory')

    this.initialize()
    this.db = new sqlite3(this.dbPath)
    this.setupDatabase()
  }

  private initialize(): void {
    const dbDir = path.dirname(this.dbPath)
    if (!existsSync(dbDir)) {
      try {
        fs.mkdir(dbDir, { recursive: true })
        logger.info(`Created database directory: ${dbDir}`)
      } catch (error) {
        throw new MemoryError('Failed to create database directory', { dbDir, error })
      }
    }
  }

  private setupDatabase(): void {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS memory (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          content TEXT NOT NULL,
          embedding BLOB,
          tags TEXT NOT NULL DEFAULT '[]',
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL
        )
      `)
      this.db.pragma('journal_mode = WAL')
      logger.debug('Database initialized')
    } catch (error) {
      throw new MemoryError('Failed to initialize database', { error })
    }
  }

  /**
   * Store a memory entry
   */
  async store(content: string, tags: string[] = [], embedding?: number[]): Promise<number> {
    if (!content || content.trim().length === 0) {
      throw new MemoryError('Content cannot be empty')
    }

    try {
      const now = Date.now()
      const tagsJson = JSON.stringify(tags)
      const embeddingBlob = embedding && embedding.length > 0
        ? new Uint8Array(new Float64Array(embedding).buffer)
        : null

      const stmt = this.db.prepare(
        'INSERT INTO memory (content, embedding, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
      )
      const result = stmt.run(content, embeddingBlob, tagsJson, now, now)

      const id = result.lastInsertRowid as number
      logger.debug('Memory stored', { id, contentLength: content.length, tags })
      return id
    } catch (error) {
      logger.error('Failed to store memory', error)
      throw new MemoryError('Failed to store memory', { error })
    }
  }

  /**
   * Get memory by ID
   */
  async getById(id: number): Promise<Memory | null> {
    try {
      const row = this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as MemoryRow | undefined
      if (!row) {
        logger.debug('Memory not found', { id })
        return null
      }

      return this.rowToMemory(row)
    } catch (error) {
      logger.error('Failed to get memory by ID', error, { id })
      throw new MemoryError('Failed to get memory', { id, error })
    }
  }

  /**
   * Search memories by content
   */
  async search(query: string, limit: number = 10): Promise<Memory[]> {
    if (!query || query.trim().length === 0) {
      return []
    }

    try {
      const rows = this.db.prepare(
        'SELECT * FROM memory WHERE content LIKE ? ORDER BY updatedAt DESC LIMIT ?'
      ).all(`%${query}%`, limit) as MemoryRow[]

      logger.debug('Memory search completed', { query, resultCount: rows.length })
      return rows.map(row => this.rowToMemory(row))
    } catch (error) {
      logger.error('Failed to search memories', error, { query })
      throw new MemoryError('Failed to search memories', { query, error })
    }
  }

  /**
   * Get memories by tag
   */
  async getByTag(tag: string, limit: number = 10): Promise<Memory[]> {
    if (!tag || tag.trim().length === 0) {
      return []
    }

    try {
      const rows = this.db.prepare(
        'SELECT * FROM memory WHERE tags LIKE ? ORDER BY updatedAt DESC LIMIT ?'
      ).all(`%${tag}%`, limit) as MemoryRow[]

      logger.debug('Memories retrieved by tag', { tag, resultCount: rows.length })
      return rows.map(row => this.rowToMemory(row))
    } catch (error) {
      logger.error('Failed to get memories by tag', error, { tag })
      throw new MemoryError('Failed to get memories by tag', { tag, error })
    }
  }

  /**
   * Get recent memories
   */
  async getRecent(limit: number = 10): Promise<Memory[]> {
    try {
      const rows = this.db.prepare(
        'SELECT * FROM memory ORDER BY updatedAt DESC LIMIT ?'
      ).all(limit) as MemoryRow[]

      logger.debug('Recent memories retrieved', { count: rows.length })
      return rows.map(row => this.rowToMemory(row))
    } catch (error) {
      logger.error('Failed to get recent memories', error)
      throw new MemoryError('Failed to get recent memories', { error })
    }
  }

  /**
   * Update memory
   */
  async update(id: number, content?: string, tags?: string[]): Promise<void> {
    try {
      const existing = await this.getById(id)
      if (!existing) {
        throw new MemoryError(`Memory with ID ${id} not found`, { id })
      }

      const updates: string[] = []
      const values: unknown[] = []
      const now = Date.now()

      if (content !== undefined) {
        if (content.trim().length === 0) {
          throw new MemoryError('Content cannot be empty')
        }
        updates.push('content = ?')
        values.push(content)
      }

      if (tags !== undefined) {
        updates.push('tags = ?')
        values.push(JSON.stringify(tags))
      }

      if (updates.length === 0) {
        logger.debug('No updates provided', { id })
        return
      }

      updates.push('updatedAt = ?')
      values.push(...updates.map(() => '?'), now)

      const sql = `UPDATE memory SET ${updates.join(', ')} WHERE id = ?`
      this.db.prepare(sql).run(...values, id)

      logger.debug('Memory updated', { id, updates })
    } catch (error) {
      if (error instanceof MemoryError) {
        throw error
      }
      logger.error('Failed to update memory', error, { id })
      throw new MemoryError('Failed to update memory', { id, error })
    }
  }

  /**
   * Delete memory
   */
  async delete(id: number): Promise<void> {
    try {
      const result = this.db.prepare('DELETE FROM memory WHERE id = ?').run(id)

      if (result.changes === 0) {
        logger.debug('Memory not found for deletion', { id })
      } else {
        logger.debug('Memory deleted', { id })
      }
    } catch (error) {
      logger.error('Failed to delete memory', error, { id })
      throw new MemoryError('Failed to delete memory', { id, error })
    }
  }

  /**
   * Convert database row to Memory object
   */
  private rowToMemory(row: MemoryRow): Memory {
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }
  }

  /**
   * Deserialize embedding from buffer
   */
  private deserializeEmbedding(blob: Buffer): number[] {
    const float64Array = new Float64Array(blob.buffer)
    return Array.from(float64Array)
  }

  /**
   * Serialize embedding to buffer
   */
  private serializeEmbedding(embedding: number[]): Buffer {
    const float64Array = new Float64Array(embedding)
    return Buffer.from(float64Array.buffer)
  }

  /**
   * Ensure memory directory exists
   */
  private async ensureMemoryDir(): Promise<void> {
    if (!existsSync(this.memoryDir)) {
      try {
        await fs.mkdir(this.memoryDir, { recursive: true })
        logger.debug(`Created memory directory: ${this.memoryDir}`)
      } catch (error) {
        throw new MemoryError('Failed to create memory directory', { memoryDir: this.memoryDir, error })
      }
    }
  }

  private getTodayDate(): string {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  private getTodayFilePath(): string {
    return path.join(this.memoryDir, `${this.getTodayDate()}.md`)
  }

  /**
   * Read today's memory notes
   */
  async readToday(): Promise<string> {
    await this.ensureMemoryDir()
    const todayFile = this.getTodayFilePath()

    if (existsSync(todayFile)) {
      try {
        return await fs.readFile(todayFile, 'utf-8')
      } catch (error) {
        logger.error('Failed to read today memory file', error, { todayFile })
        throw new MemoryError('Failed to read today memory', { todayFile, error })
      }
    }

    return ''
  }

  /**
   * Append content to today's memory notes
   */
  async appendToday(content: string): Promise<void> {
    await this.ensureMemoryDir()
    const todayFile = this.getTodayFilePath()

    try {
      let fileContent = ''
      if (existsSync(todayFile)) {
        fileContent = await fs.readFile(todayFile, 'utf-8')
      } else {
        fileContent = `# ${this.getTodayDate()}\n\n`
      }

      const newContent = fileContent + content + '\n'
      await fs.writeFile(todayFile, newContent, 'utf-8')

      logger.debug('Content appended to today memory', { contentLength: content.length })
    } catch (error) {
      logger.error('Failed to append to today memory', error, { todayFile })
      throw new MemoryError('Failed to append to today memory', { todayFile, error })
    }
  }

  private getLongTermMemoryPath(): string {
    return path.join(this.memoryDir, 'MEMORY.md')
  }

  /**
   * Read long-term memory
   */
  async readLongTerm(): Promise<string> {
    await this.ensureMemoryDir()
    const memoryFile = this.getLongTermMemoryPath()

    if (existsSync(memoryFile)) {
      try {
        return await fs.readFile(memoryFile, 'utf-8')
      } catch (error) {
        logger.error('Failed to read long-term memory file', error, { memoryFile })
        throw new MemoryError('Failed to read long-term memory', { memoryFile, error })
      }
    }

    return ''
  }

  /**
   * Write long-term memory
   */
  async writeLongTerm(content: string): Promise<void> {
    await this.ensureMemoryDir()
    const memoryFile = this.getLongTermMemoryPath()

    try {
      await fs.writeFile(memoryFile, content, 'utf-8')
      logger.debug('Long-term memory written', { contentLength: content.length })
    } catch (error) {
      logger.error('Failed to write long-term memory', error, { memoryFile })
      throw new MemoryError('Failed to write long-term memory', { memoryFile, error })
    }
  }

  /**
   * Get recent memory notes from markdown files
   */
  async getRecentMemories(days: number = 7): Promise<string> {
    await this.ensureMemoryDir()
    const memories: string[] = []
    const now = new Date()

    for (let i = 0; i < days; i++) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)

      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const dateStr = `${year}-${month}-${day}`

      const filePath = path.join(this.memoryDir, `${dateStr}.md`)

      if (existsSync(filePath)) {
        try {
          const content = await fs.readFile(filePath, 'utf-8')
          memories.push(content)
        } catch (error) {
          logger.warn('Failed to read memory file', { filePath, error })
        }
      }
    }

    logger.debug('Recent memories retrieved from files', { days, count: memories.length })
    return memories.join('\n\n---\n\n')
  }

  /**
   * Get memory context for LLM
   */
  async getMemoryContext(): Promise<string> {
    const parts: string[] = []

    const longTerm = await this.readLongTerm()
    if (longTerm) {
      parts.push('## Long-term Memory\n' + longTerm)
    }

    const today = await this.readToday()
    if (today) {
      parts.push("## Today's Notes\n" + today)
    }

    return parts.join('\n\n')
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      this.db.close()
      logger.debug('Database connection closed')
    } catch (error) {
      logger.error('Failed to close database connection', error)
    }
  }
}

let memoryManager: MemoryManager | null = null

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager()
  }
  return memoryManager
}

export function closeMemoryManager(): void {
  if (memoryManager) {
    memoryManager.close()
    memoryManager = null
    logger.info('Memory manager closed')
  }
}

// Export types
export type { Memory }
