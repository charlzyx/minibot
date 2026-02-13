import { z } from 'zod'
import sqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { ConfigSchema } from './schema'
import type { Config } from './schema'
import dotenv from 'dotenv'

dotenv.config()

export type { Config }

const HOME = process.env.HOME || process.env.USERPROFILE || '/tmp'

let customWorkspace: string | null = null

export function setCustomWorkspace(workspace: string) {
  customWorkspace = workspace
}

export function getWorkspace(): string {
  return customWorkspace || HOME + '/minibot'
}

function getConfigFilePath(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'minibot.config.ts')
}

function getDBPath(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'db', 'memory.db')
}

function getDBDir(): string {
  return path.dirname(getDBPath())
}

interface ConfigRow {
  id: number
  key: string
  value: string
  updatedAt: number
}

export class ConfigManager {
  private db!: sqlite3.Database
  private initialized: boolean = false

  constructor() {
  }

  private async initialize() {
    if (this.initialized) {
      return
    }
    
    const dbDir = getDBDir()
    if (!existsSync(dbDir)) {
      await fs.mkdir(dbDir, { recursive: true })
    }
    this.db = new sqlite3(getDBPath())
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `)
    this.db.pragma('journal_mode = WAL')
    this.initialized = true
  }

  private async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  async loadConfig(): Promise<Config> {
    await this.ensureInitialized()
    
    const rows = this.db.prepare('SELECT key, value FROM config').all() as ConfigRow[]
    
    const config: any = {}
    
    for (const row of rows) {
      try {
        config[row.key] = JSON.parse(row.value)
      } catch (e) {
        console.warn(`Failed to parse config for key ${row.key}:`, e)
      }
    }
    
    if (Object.keys(config).length === 0) {
      let fileConfig: any = {}
      
      const configFilePath = getConfigFilePath()
      if (existsSync(configFilePath)) {
        try {
          delete require.cache[require.resolve(configFilePath)]
          fileConfig = require(configFilePath)
          console.log(`[Config] Loaded config from ${configFilePath}`)
        } catch (e) {
          console.warn(`[Config] Failed to load config file:`, e)
        }
      }
      
      return {
        provider: {
          name: 'zhipu',
          apiKey: process.env.ZHIPU_API_KEY || fileConfig.provider?.apiKey || '',
          apiBase: process.env.ZHIPU_BASE_URL || fileConfig.provider?.apiBase || 'https://open.bigmodel.cn/api/coding/paas/v4'
        },
        model: {
          name: 'glm-4.7',
          maxTokens: 4000,
          temperature: 0.7
        },
        channels: {
          feishu: {
            enabled: !!process.env.FEISHU_APP_ID && !!process.env.FEISHU_APP_SECRET,
            appId: process.env.FEISHU_APP_ID || fileConfig.channels?.feishu?.appId || '',
            appSecret: process.env.FEISHU_APP_SECRET || fileConfig.channels?.feishu?.appSecret || '',
            encryptKey: fileConfig.channels?.feishu?.encryptKey || '',
            verificationToken: fileConfig.channels?.feishu?.verificationToken || '',
            allowFrom: fileConfig.channels?.feishu?.allowFrom || []
          },
          wechat: {
            enabled: false,
            appId: '',
            appSecret: ''
          },
          dingtalk: {
            enabled: false,
            clientId: '',
            clientSecret: '',
            allowFrom: []
          },
          qq: {
            enabled: false,
            appId: '',
            secret: '',
            allowFrom: []
          },
          discord: {
            enabled: false,
            botToken: '',
            appToken: '',
            groupPolicy: 'mention'
          },
          slack: {
            enabled: false,
            botToken: '',
            appToken: '',
            groupPolicy: 'mention'
          }
        },
        tools: {
          shell: {
            enabled: true
          },
          web: {
            enabled: true
          },
          file: {
            enabled: true,
            workspace: process.env.HOME + '/minibot'
          }
        },
        security: {
          restrictToWorkspace: false
        }
      }
    }
    
    return ConfigSchema.parse(config)
  }

  async saveConfig(config: Partial<Config>): Promise<void> {
    await this.ensureInitialized()
    
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
      stmt.run(key, jsonString, now, jsonString, now)
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
