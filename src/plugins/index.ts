import { Plugin, PluginManager } from './manager'

let pluginManagerInstance: PluginManager | null = null

export function getPluginManager(): PluginManager {
  if (!pluginManagerInstance) {
    pluginManagerInstance = new PluginManager()
  }
  return pluginManagerInstance
}

export type { Plugin }
export { PluginManager }
