import sqlite3 from 'better-sqlite3'
import path from 'path'

const DB_PATH = path.join(process.cwd(), 'db', 'memory.db')

interface MemoryRow {
  id: number
  content: string
  embedding?: Buffer
  tags: string
  createdAt: number
  updatedAt: number
}

export interface Memory {
  id: number
  content: string
  embedding?: number[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export class MemoryManager {
  private db: sqlite3.Database

  constructor() {
    this.db = new sqlite3(DB_PATH)
    this.initialize()
  }

  private async initialize() {
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
  }

  // Store a memory entry
  async store(content: string, tags: string[] = [], embedding?: number[]): Promise<number> {
    const now = Date.now()
    const tagsJson = JSON.stringify(tags)
    const embeddingBlob = embedding && embedding.length > 0 ? new Uint8Array(new Float64Array(embedding).buffer) : null
    
    const stmt = this.db.prepare(
      'INSERT INTO memory (content, embedding, tags, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)'
    )
    const result = stmt.run(content, embeddingBlob, tagsJson, now, now)
    
    return result.lastInsertRowid as number
  }

  // Get memory by ID
  async getById(id: number): Promise<Memory | null> {
    const row = this.db.prepare('SELECT * FROM memory WHERE id = ?').get(id) as MemoryRow | undefined
    if (!row) return null
    
    return {
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }
  }

  // Search memories by content (contains)
  async search(query: string, limit: number = 10): Promise<Memory[]> {
    const rows = this.db.prepare('SELECT * FROM memory WHERE content LIKE ? ORDER BY updatedAt DESC LIMIT ?').all(`%${query}%`, limit) as MemoryRow[]
    
    return rows.map((row: MemoryRow) => ({
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }))
  }

  // Get memories by tag
  async getByTag(tag: string, limit: number = 10): Promise<Memory[]> {
    const rows = this.db.prepare('SELECT * FROM memory WHERE tags LIKE ? ORDER BY updatedAt DESC LIMIT ?').all(`%${tag}%`, limit) as MemoryRow[]
    
    return rows.map((row: MemoryRow) => ({
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }))
  }

  // Get recent memories
  async getRecent(limit: number = 10): Promise<Memory[]> {
    const rows = this.db.prepare('SELECT * FROM memory ORDER BY updatedAt DESC LIMIT ?').all(limit) as MemoryRow[]
    
    return rows.map((row: MemoryRow) => ({
      id: row.id,
      content: row.content,
      embedding: row.embedding ? this.deserializeEmbedding(row.embedding) : undefined,
      tags: JSON.parse(row.tags),
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    }))
  }

  // Update memory
  async update(id: number, content?: string, tags?: string[]): Promise<void> {
    const updates: string[] = []
    const now = Date.now()
    
    if (content !== undefined) {
      updates.push('content = ?')
    }
    
    if (tags !== undefined) {
      updates.push('tags = ?')
    }
    
    updates.push('updatedAt = ?')
    
    this.db.prepare(`UPDATE memory SET ${updates.join(', ')} WHERE id = ?`).run(...updates, now)
  }

  // Delete memory
  async delete(id: number): Promise<void> {
    this.db.prepare('DELETE FROM memory WHERE id = ?').run(id)
  }

  // Helper to deserialize embedding
  private deserializeEmbedding(blob: Buffer): number[] {
    const float64Array = new Float64Array(blob.buffer)
    return Array.from(float64Array)
  }

  // Helper to serialize embedding
  private serializeEmbedding(embedding: number[]): Buffer {
    const float64Array = new Float64Array(embedding)
    return Buffer.from(float64Array.buffer)
  }

  close() {
    this.db.close()
  }
}

let memoryManager: MemoryManager | null = null

export function getMemoryManager(): MemoryManager {
  if (!memoryManager) {
    memoryManager = new MemoryManager()
  }
  return memoryManager
}

export function closeMemoryManager() {
  if (memoryManager) {
    memoryManager.close()
    memoryManager = null
  }
}
