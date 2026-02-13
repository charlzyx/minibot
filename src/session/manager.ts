import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { getWorkspace } from '../config/manager'

export interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface SessionMetadata {
  created_at: number
  updated_at: number
  metadata: Record<string, any>
}

export interface Session {
  key: string
  messages: SessionMessage[]
  created_at: number
  updated_at: number
  metadata: Record<string, any>
}

class SessionManager {
  private sessionsDir: string
  private cache: Map<string, Session>

  constructor() {
    const workspace = getWorkspace()
    this.sessionsDir = path.join(workspace, 'sessions')
    this.cache = new Map()
    this.initialize()
  }

  private async initialize() {
    if (!existsSync(this.sessionsDir)) {
      await fs.mkdir(this.sessionsDir, { recursive: true })
    }
  }

  private getSessionPath(key: string): string {
    const safeKey = key.replace(/:/g, '_').replace(/\//g, '_')
    return path.join(this.sessionsDir, `${safeKey}.jsonl`)
  }

  getOrCreate(key: string): Session {
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }

    const session = this.load(key) || this.create(key)
    this.cache.set(key, session)
    return session
  }

  private create(key: string): Session {
    return {
      key,
      messages: [],
      created_at: Date.now(),
      updated_at: Date.now(),
      metadata: {}
    }
  }

  private load(key: string): Session | null {
    const sessionPath = this.getSessionPath(key)
    
    if (!existsSync(sessionPath)) {
      return null
    }

    try {
      const content = require('fs').readFileSync(sessionPath, 'utf-8')
      const lines = content.split('\n').filter((line: string) => line.trim())
      
      let messages: SessionMessage[] = []
      let metadata: SessionMetadata = {
        created_at: Date.now(),
        updated_at: Date.now(),
        metadata: {}
      }

      for (const line of lines) {
        const data: any = JSON.parse(line)
        
        if (data._type === 'metadata') {
          metadata = {
            created_at: data.created_at,
            updated_at: data.updated_at,
            metadata: data.metadata || {}
          }
        } else {
          messages.push(data)
        }
      }

      return {
        key,
        messages,
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        metadata: metadata.metadata
      }
    } catch (error) {
      console.error(`[SessionManager] Failed to load session ${key}:`, error)
      return null
    }
  }

  async save(session: Session): Promise<void> {
    const sessionPath = this.getSessionPath(session.key)
    const lines: string[] = []

    const metadataLine = JSON.stringify({
      _type: 'metadata',
      created_at: session.created_at,
      updated_at: session.updated_at,
      metadata: session.metadata
    })
    lines.push(metadataLine)

    for (const msg of session.messages) {
      lines.push(JSON.stringify(msg))
    }

    await fs.writeFile(sessionPath, lines.join('\n') + '\n', 'utf-8')
    this.cache.set(session.key, session)
  }

  addMessage(key: string, role: 'user' | 'assistant' | 'system', content: string): void {
    const session = this.getOrCreate(key)
    session.messages.push({
      role,
      content,
      timestamp: Date.now()
    })
    session.updated_at = Date.now()
  }

  getMessages(key: string, maxMessages: number = 20): ChatMessage[] {
    const session = this.getOrCreate(key)
    const messages = session.messages.slice(-maxMessages)
    const filtered = messages.filter(msg => msg.role === 'user' || msg.role === 'assistant')
    return filtered.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: msg.timestamp
    }))
  }

  clear(key: string): void {
    const session = this.getOrCreate(key)
    session.messages = []
    session.updated_at = Date.now()
    this.cache.set(key, session)
  }

  unload(key: string): void {
    this.cache.delete(key)
  }

  getAllSessions(): Session[] {
    return Array.from(this.cache.values())
  }

  async delete(key: string): Promise<boolean> {
    this.cache.delete(key)
    const sessionPath = this.getSessionPath(key)
    
    if (existsSync(sessionPath)) {
      await fs.unlink(sessionPath)
      return true
    }
    
    return false
  }

  async listSessions(): Promise<Array<{ key: string; created_at: number; updated_at: number }>> {
    const files = await fs.readdir(this.sessionsDir)
    const sessions: Array<{ key: string; created_at: number; updated_at: number }> = []

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
                created_at: data.created_at,
                updated_at: data.updated_at
              })
            }
          }
        } catch (error) {
          console.error(`[SessionManager] Failed to read session ${file}:`, error)
        }
      }
    }

    return sessions.sort((a, b) => b.updated_at - a.updated_at)
  }

  async cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
    const sessions = await this.listSessions()
    const now = Date.now()
    let deleted = 0

    for (const session of sessions) {
      if (now - session.updated_at > maxAge) {
        await this.delete(session.key)
        deleted++
      }
    }

    return deleted
  }
}

let sessionManager: SessionManager | null = null

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager()
  }
  return sessionManager
}

export function closeSessionManager() {
  sessionManager = null
}
