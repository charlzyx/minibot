import { z } from 'zod'
import Database from 'better-sqlite3'
import { open } from 'better-sqlite3'
import path from 'path'
import { ConfigSchema, Config } from './schema'

const DB_PATH = path.join(process.cwd(), 'db', 'memory.db')

interface ConfigRow {
  id: number
  key: string
  value: string
  updatedAt: number
}

export class ConfigManager {
  private db: Database

  constructor() {
    this.db = new Database(DB_PATH)
    this.initialize()
  }

  private async initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)
    this.db.pragma('journal_mode = WAL')
  }

  async loadConfig(): Promise<Config> {
    const rows = this.db.prepare('SELECT key, value FROM config').all() as ConfigRow[]
    
    const config: any = {}
    
    for (const row of rows) {
      try {
        config[row.key] = JSON.parse(row.value)
      } catch (e) {
        console.warn(`Failed to parse config for key ${row.key}:`, e)
      }
    }
    
    // Merge with defaults
    return ConfigSchema.parse(config)
  }

  async saveConfig(config: Partial<Config>): Promise<void> {
    const currentConfig = await this.loadConfig()
    const mergedConfig = { ...currentConfig, ...config }
    
    const validatedConfig = ConfigSchema.parse(mergedConfig)
    const now = Date.now()
    
    const save = (key: string, value: any) => {
      const jsonString = JSON.stringify(value)
      const stmt = this.db.prepare(
        `INSERT INTO config (key, value, updatedAt) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value = ?, updatedAt = ?`
      )
      stmt.run(jsonString, now)
      stmt.finalize()
    }
    
    for (const [key, value] of Object.entries(validatedConfig)) {
      save(key, value)
    }
  }

  async get<K extends keyof Config>(key: K): Promise<Config[K]> {
    const config = await this.loadConfig()
    return config[key]
  }

  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    await this.saveConfig({ [key]: value })
  }

  async reset(): Promise<void> {
    const defaultConfig = ConfigSchema.parse({})
    await this.saveConfig(defaultConfig)
  }

  close() {
    this.db.close()
  }
}

let configManager: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager()
  }
  return configManager
}

export function closeConfigManager() {
  if (configManager) {
    configManager.close()
    configManager = null
  }
}
