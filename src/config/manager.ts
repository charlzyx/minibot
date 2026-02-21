import { z } from 'zod'
import sqlite3 from 'better-sqlite3'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import dotenv from 'dotenv'
import type { Config } from '@/types'
import { ConfigurationError, createLogger } from '@/utils'

dotenv.config()

const logger = createLogger('ConfigManager')

const HOME = process.env.HOME || process.env.USERPROFILE || '/tmp'

let customWorkspace: string | null = null

export function setCustomWorkspace(workspace: string): void {
  logger.info('Setting custom workspace', { workspace })
  customWorkspace = workspace
}

export function getWorkspace(): string {
  return customWorkspace || path.join(HOME, 'minibot')
}

function getConfigFilePath(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'minibot.config.ts')
}

function getDBPath(): string {
  const workspace = getWorkspace()
  return path.join(workspace, 'db', 'config.db')
}

function getDBDir(): string {
  return path.dirname(getDBPath())
}

/**
 * Database row interface
 */
interface ConfigRow {
  id: number
  key: string
  value: string
  updatedAt: number
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Config = {
  provider: {
    name: 'zhipu',
    apiKey: '',
    apiBase: 'https://open.bigmodel.cn/api/coding/paas/v4'
  },
  model: {
    name: 'glm-4.7',
    maxTokens: 4000,
    temperature: 0.7
  },
  channels: {
    feishu: {
      enabled: false,
      appId: '',
      appSecret: '',
      encryptKey: '',
      verificationToken: '',
      allowFrom: []
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
    shell: { enabled: true },
    web: { enabled: true },
    file: { enabled: true, workspace: '' },
    llm: { enabled: true },
    memory: { enabled: true }
  },
  security: {
    restrictToWorkspace: false,
    maxSessionCache: 500
  }
}

/**
 * Configuration Manager
 */
export class ConfigManager {
  private db!: sqlite3.Database
  private initialized: boolean = false
  private dbPath: string

  constructor() {
    this.dbPath = getDBPath()
  }

  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    try {
      const dbDir = getDBDir()
      if (!existsSync(dbDir)) {
        await fs.mkdir(dbDir, { recursive: true })
        logger.debug(`Created config database directory: ${dbDir}`)
      }

      this.db = new sqlite3(this.dbPath)
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

      logger.debug('Config database initialized')
    } catch (error) {
      throw new ConfigurationError('Failed to initialize config database', { error })
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }

  /**
   * Load configuration from database and environment
   */
  async loadConfig(): Promise<Config> {
    await this.ensureInitialized()

    try {
      const rows = this.db.prepare('SELECT key, value FROM config').all() as ConfigRow[]

      const dbConfig: Record<string, unknown> = {}

      for (const row of rows) {
        try {
          dbConfig[row.key] = JSON.parse(row.value)
        } catch (error) {
          logger.warn(`Failed to parse config for key ${row.key}`, error)
        }
      }

      if (Object.keys(dbConfig).length === 0) {
        return await this.loadConfigFromFile()
      }

      // Merge with environment variables
      const mergedConfig = this.mergeWithEnv(dbConfig as Partial<Config>)
      return this.validateConfig(mergedConfig)
    } catch (error) {
      if (error instanceof ConfigurationError) {
        throw error
      }
      logger.error('Failed to load config', error)
      throw new ConfigurationError('Failed to load configuration', { error })
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfigFromFile(): Promise<Config> {
    const configFilePath = getConfigFilePath()
    let fileConfig: Partial<Config> = {}

    if (existsSync(configFilePath)) {
      try {
        // Clear require cache to reload config
        delete require.cache[require.resolve(configFilePath)]
        const loaded = require(configFilePath)
        fileConfig = loaded.default || loaded
        logger.info(`Loaded config from file: ${configFilePath}`)
      } catch (error) {
        logger.warn('Failed to load config file', { configFilePath, error })
      }
    }

    const mergedConfig = this.mergeWithEnv(fileConfig)
    return this.validateConfig(mergedConfig)
  }

  /**
   * Merge configuration with environment variables
   */
  private mergeWithEnv(config: Partial<Config>): Partial<Config> {
    const merged: Partial<Config> = { ...config }

    // Provider config from env
    if (!merged.provider) {
      merged.provider = {}
    }
    merged.provider.apiKey = process.env.ZHIPU_API_KEY ||
                            process.env.OPENAI_API_KEY ||
                            merged.provider.apiKey ||
                            ''
    merged.provider.apiBase = process.env.ZHIPU_BASE_URL ||
                             process.env.OPENAI_BASE_URL ||
                             merged.provider.apiBase ||
                             'https://open.bigmodel.cn/api/coding/paas/v4'

    // Feishu config from env
    if (!merged.channels) {
      merged.channels = {}
    }
    if (!merged.channels.feishu) {
      merged.channels.feishu = { enabled: false, appId: '', appSecret: '', allowFrom: [] }
    }
    merged.channels.feishu.enabled = !!process.env.FEISHU_APP_ID && !!process.env.FEISHU_APP_SECRET
    merged.channels.feishu.appId = process.env.FEISHU_APP_ID || merged.channels.feishu.appId || ''
    merged.channels.feishu.appSecret = process.env.FEISHU_APP_SECRET || merged.channels.feishu.appSecret || ''

    // Workspace from env
    const workspace = process.env.WORKSPACE || getWorkspace()
    if (!merged.tools) {
      merged.tools = {}
    }
    if (!merged.tools.file) {
      merged.tools.file = { enabled: true, workspace: '' }
    }
    merged.tools.file.workspace = workspace

    // Security config from env
    if (!merged.security) {
      merged.security = {}
    }
    merged.security.maxSessionCache = parseInt(process.env.MAX_SESSION_CACHE || '500', 10)

    return merged
  }

  /**
   * Validate configuration using schema
   */
  private validateConfig(config: Partial<Config>): Config {
    // Create a complete config with defaults
    const completeConfig: Config = {
      provider: {
        name: config.provider?.name || DEFAULT_CONFIG.provider.name,
        apiKey: config.provider?.apiKey || DEFAULT_CONFIG.provider.apiKey,
        apiBase: config.provider?.apiBase || DEFAULT_CONFIG.provider.apiBase
      },
      model: {
        name: config.model?.name || DEFAULT_CONFIG.model.name,
        maxTokens: config.model?.maxTokens || DEFAULT_CONFIG.model.maxTokens,
        temperature: config.model?.temperature ?? DEFAULT_CONFIG.model.temperature
      },
      channels: {
        feishu: { ...DEFAULT_CONFIG.channels.feishu, ...config.channels?.feishu },
        wechat: { ...DEFAULT_CONFIG.channels.wechat, ...config.channels?.wechat },
        dingtalk: { ...DEFAULT_CONFIG.channels.dingtalk, ...config.channels?.dingtalk },
        qq: { ...DEFAULT_CONFIG.channels.qq, ...config.channels?.qq },
        discord: { ...DEFAULT_CONFIG.channels.discord, ...config.channels?.discord },
        slack: { ...DEFAULT_CONFIG.channels.slack, ...config.channels?.slack }
      },
      tools: {
        shell: { ...DEFAULT_CONFIG.tools.shell, ...config.tools?.shell },
        web: { ...DEFAULT_CONFIG.tools.web, ...config.tools?.web },
        file: { ...DEFAULT_CONFIG.tools.file, ...config.tools?.file },
        llm: { ...DEFAULT_CONFIG.tools.llm, ...config.tools?.llm },
        memory: { ...DEFAULT_CONFIG.tools.memory, ...config.tools?.memory }
      },
      security: {
        ...DEFAULT_CONFIG.security,
        ...config.security
      }
    }

    return completeConfig
  }

  /**
   * Save configuration to database
   */
  async saveConfig(config: Partial<Config>): Promise<void> {
    await this.ensureInitialized()

    try {
      const currentConfig = await this.loadConfig()
      const mergedConfig = { ...currentConfig, ...config }
      const validatedConfig = this.validateConfig(mergedConfig)
      const now = Date.now()

      const save = (key: string, value: unknown): void => {
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

      logger.info('Configuration saved', { keys: Object.keys(config) })
    } catch (error) {
      logger.error('Failed to save config', error)
      throw new ConfigurationError('Failed to save configuration', { error })
    }
  }

  /**
   * Get a specific config value
   */
  async get<K extends keyof Config>(key: K): Promise<Config[K]> {
    const config = await this.loadConfig()
    return config[key]
  }

  /**
   * Set a specific config value
   */
  async set<K extends keyof Config>(key: K, value: Config[K]): Promise<void> {
    await this.saveConfig({ [key]: value } as Partial<Config>)
  }

  /**
   * Reset configuration to defaults
   */
  async reset(): Promise<void> {
    try {
      // Clear database
      this.db.prepare('DELETE FROM config').run()
      logger.info('Configuration reset to defaults')
    } catch (error) {
      logger.error('Failed to reset config', error)
      throw new ConfigurationError('Failed to reset configuration', { error })
    }
  }

  /**
   * Close database connection
   */
  close(): void {
    try {
      if (this.initialized) {
        this.db.close()
        this.initialized = false
        logger.debug('Config database connection closed')
      }
    } catch (error) {
      logger.error('Failed to close config database', error)
    }
  }
}

let configManager: ConfigManager | null = null

export function getConfigManager(): ConfigManager {
  if (!configManager) {
    configManager = new ConfigManager()
  }
  return configManager
}

export function closeConfigManager(): void {
  if (configManager) {
    configManager.close()
    configManager = null
    logger.info('Config manager closed')
  }
}

// Export types
export type { Config }
