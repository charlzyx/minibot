import fs from 'fs'
import path from 'path'
import { getWorkspace } from '../config/manager'
import { createLogger } from '../utils'
import type { PluginConfig, PluginMetadata } from '@/types'

const logger = createLogger('PluginManager')

export interface Plugin {
  id: string
  metadata: PluginMetadata
  config: PluginConfig
  enabled: boolean
  initialize?: () => Promise<void>
  shutdown?: () => Promise<void>
}

export class PluginManager {
  private plugins: Plugin[] = []
  private pluginsDir: string
  private configDir: string

  constructor() {
    this.pluginsDir = path.join(getWorkspace(), 'plugins')
    this.configDir = path.join(getWorkspace(), 'config', 'plugins')
    logger.debug('PluginManager initialized', {
      pluginsDir: this.pluginsDir,
      configDir: this.configDir
    })
  }

  async loadAllPlugins(): Promise<void> {
    try {
      this.ensureDirectoriesExist()

      const files = fs.readdirSync(this.pluginsDir)
      const pluginFiles = files.filter(file => file.endsWith('.js') || file.endsWith('.ts'))

      logger.info('Loading plugins', { count: pluginFiles.length })

      for (const file of pluginFiles) {
        await this.loadPlugin(file)
      }

      logger.info('Plugins loaded', { total: this.plugins.length, enabled: this.getEnabledPlugins().length })
    } catch (error) {
      logger.error('Failed to load plugins', error)
    }
  }

  private async loadPlugin(file: string): Promise<void> {
    const filePath = path.join(this.pluginsDir, file)
    const pluginId = path.basename(file, path.extname(file))

    try {
      const pluginModule = await import(filePath)
      const pluginExports = pluginModule.default || pluginModule

      const config = this.loadPluginConfig(pluginId)

      const plugin: Plugin = {
        id: pluginId,
        metadata: pluginExports.metadata || {
          name: pluginId,
          version: '1.0.0'
        },
        config,
        enabled: true,
        initialize: pluginExports.initialize,
        shutdown: pluginExports.shutdown
      }

      if (plugin.initialize) {
        await plugin.initialize()
      }

      this.plugins.push(plugin)
      logger.info('Plugin loaded', {
        id: pluginId,
        name: plugin.metadata.name,
        version: plugin.metadata.version
      })
    } catch (error) {
      logger.error('Failed to load plugin', error, { pluginId, file })
    }
  }

  private ensureDirectoriesExist(): void {
    if (!fs.existsSync(this.pluginsDir)) {
      fs.mkdirSync(this.pluginsDir, { recursive: true })
      logger.debug('Created plugins directory', { path: this.pluginsDir })
    }

    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true })
      logger.debug('Created plugin config directory', { path: this.configDir })
    }
  }

  private loadPluginConfig(pluginId: string): PluginConfig {
    const configPath = path.join(this.configDir, `${pluginId}.json`)

    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8')
        const config = JSON.parse(configContent) as PluginConfig
        logger.debug('Plugin config loaded', { pluginId })
        return config
      }
    } catch (error) {
      logger.error('Failed to load plugin config', error, { pluginId })
    }

    return {}
  }

  async savePluginConfig(pluginId: string, config: PluginConfig): Promise<void> {
    const configPath = path.join(this.configDir, `${pluginId}.json`)

    try {
      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true })
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2))

      const plugin = this.getPlugin(pluginId)
      if (plugin) {
        plugin.config = config
      }

      logger.info('Plugin config saved', { pluginId })
    } catch (error) {
      logger.error('Failed to save plugin config', error, { pluginId })
      throw error
    }
  }

  getAllPlugins(): Plugin[] {
    return this.plugins
  }

  getEnabledPlugins(): Plugin[] {
    return this.plugins.filter(plugin => plugin.enabled)
  }

  getPlugin(id: string): Plugin | undefined {
    return this.plugins.find(plugin => plugin.id === id)
  }

  async enablePlugin(id: string): Promise<boolean> {
    const plugin = this.getPlugin(id)
    if (!plugin) {
      logger.warn('Plugin not found', { id })
      return false
    }

    plugin.enabled = true
    logger.info('Plugin enabled', { id })
    return true
  }

  async disablePlugin(id: string): Promise<boolean> {
    const plugin = this.getPlugin(id)
    if (!plugin) {
      logger.warn('Plugin not found', { id })
      return false
    }

    plugin.enabled = false
    logger.info('Plugin disabled', { id })
    return true
  }

  async shutdownAllPlugins(): Promise<void> {
    logger.info('Shutting down all plugins', { count: this.plugins.length })

    for (const plugin of this.plugins) {
      if (plugin.shutdown) {
        try {
          await plugin.shutdown()
          logger.debug('Plugin shutdown', { id: plugin.id })
        } catch (error) {
          logger.error('Error shutting down plugin', error, { id: plugin.id })
        }
      }
    }

    logger.info('All plugins shutdown complete')
  }

  getStats(): {
    total: number
    enabled: number
    disabled: number
  } {
    return {
      total: this.plugins.length,
      enabled: this.getEnabledPlugins().length,
      disabled: this.plugins.filter(p => !p.enabled).length
    }
  }
}
