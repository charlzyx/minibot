import fs from 'fs'
import path from 'path'
import { getWorkspace } from '../config/manager'

export interface PluginMetadata {
  name: string
  description?: string
  version?: string
  author?: string
  dependencies?: string[]
}

export interface PluginConfig {
  [key: string]: any
}

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
  }

  async loadAllPlugins(): Promise<void> {
    try {
      if (!fs.existsSync(this.pluginsDir)) {
        fs.mkdirSync(this.pluginsDir, { recursive: true })
        return
      }

      if (!fs.existsSync(this.configDir)) {
        fs.mkdirSync(this.configDir, { recursive: true })
      }

      const files = fs.readdirSync(this.pluginsDir)
      const pluginFiles = files.filter(file => file.endsWith('.js') || file.endsWith('.ts'))

      for (const file of pluginFiles) {
        const filePath = path.join(this.pluginsDir, file)
        const pluginId = path.basename(file, path.extname(file))
        
        try {
          // 动态导入插件
          const pluginModule = await import(filePath)
          const pluginExports = pluginModule.default || pluginModule

          // 加载插件配置
          const config = this.loadPluginConfig(pluginId)

          // 构建插件对象
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

          // 初始化插件
          if (plugin.initialize) {
            await plugin.initialize()
          }

          this.plugins.push(plugin)
          console.log(`[PluginManager] Loaded plugin: ${plugin.metadata.name}`)
        } catch (error) {
          console.error(`[PluginManager] Failed to load plugin ${pluginId}:`, error)
        }
      }
    } catch (error) {
      console.error('[PluginManager] Failed to load plugins:', error)
    }
  }

  private loadPluginConfig(pluginId: string): PluginConfig {
    const configPath = path.join(this.configDir, `${pluginId}.json`)
    
    try {
      if (fs.existsSync(configPath)) {
        const configContent = fs.readFileSync(configPath, 'utf8')
        return JSON.parse(configContent)
      }
    } catch (error) {
      console.error(`[PluginManager] Failed to load config for plugin ${pluginId}:`, error)
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
      
      // 更新内存中的插件配置
      const plugin = this.getPlugin(pluginId)
      if (plugin) {
        plugin.config = config
      }
    } catch (error) {
      console.error(`[PluginManager] Failed to save config for plugin ${pluginId}:`, error)
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
      return false
    }

    plugin.enabled = true
    return true
  }

  async disablePlugin(id: string): Promise<boolean> {
    const plugin = this.getPlugin(id)
    if (!plugin) {
      return false
    }

    plugin.enabled = false
    return true
  }

  async shutdownAllPlugins(): Promise<void> {
    for (const plugin of this.plugins) {
      if (plugin.shutdown) {
        try {
          await plugin.shutdown()
        } catch (error) {
          console.error(`[PluginManager] Error shutting down plugin ${plugin.id}:`, error)
        }
      }
    }
  }
}
