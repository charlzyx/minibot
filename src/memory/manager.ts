import sqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { getWorkspace } from '../config/manager'

function getDBPath(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'db', 'memory.db')
}

function getMemoryDir(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'memory')
}

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
    const dbDir = path.dirname(getDBPath())
    if (!existsSync(dbDir)) {
      fs.mkdir(dbDir, { recursive: true })
    }
    this.db = new sqlite3(getDBPath())
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

  private async ensureMemoryDir() {
    const memoryDir = getMemoryDir()
    if (!existsSync(memoryDir)) {
      await fs.mkdir(memoryDir, { recursive: true })
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
    return path.join(getMemoryDir(), `${this.getTodayDate()}.md`)
  }

  async readToday(): Promise<string> {
    await this.ensureMemoryDir()
    const todayFile = this.getTodayFilePath()
    
    if (existsSync(todayFile)) {
      return await fs.readFile(todayFile, 'utf-8')
    }
    
    return ''
  }

  async appendToday(content: string): Promise<void> {
    await this.ensureMemoryDir()
    const todayFile = this.getTodayFilePath()
    
    let fileContent = ''
    if (existsSync(todayFile)) {
      fileContent = await fs.readFile(todayFile, 'utf-8')
    } else {
      const header = `# ${this.getTodayDate()}\n\n`
      fileContent = header
    }
    
    const newContent = fileContent + content + '\n'
    await fs.writeFile(todayFile, newContent, 'utf-8')
  }

  private getLongTermMemoryPath(): string {
    return path.join(getMemoryDir(), 'MEMORY.md')
  }

  async readLongTerm(): Promise<string> {
    await this.ensureMemoryDir()
    const memoryFile = this.getLongTermMemoryPath()
    
    if (existsSync(memoryFile)) {
      return await fs.readFile(memoryFile, 'utf-8')
    }
    
    return ''
  }

  async writeLongTerm(content: string): Promise<void> {
    await this.ensureMemoryDir()
    const memoryFile = this.getLongTermMemoryPath()
    await fs.writeFile(memoryFile, content, 'utf-8')
  }

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
      
      const filePath = path.join(getMemoryDir(), `${dateStr}.md`)
      
      if (existsSync(filePath)) {
        const content = await fs.readFile(filePath, 'utf-8')
        memories.push(content)
      }
    }
    
    return memories.join('\n\n---\n\n')
  }

  async getMemoryContext(): Promise<string> {
    const parts: string[] = []
    
    const longTerm = await this.readLongTerm()
    if (longTerm) {
      parts.push('## Long-term Memory\n' + longTerm)
    }
    
    const today = await this.readToday()
    if (today) {
      parts.push('## Today\'s Notes\n' + today)
    }
    
    return parts.join('\n\n')
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
