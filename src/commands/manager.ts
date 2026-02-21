import type { Command, CommandContext } from '@/types'
import { createLogger } from '@/utils'

const logger = createLogger('CommandManager')

/**
 * Command Manager - Handles command registration and execution
 */
export class CommandManager {
  private commands = new Map<string, Command>()

  /**
   * Register a single command
   */
  register(command: Command): void {
    if (this.commands.has(command.name)) {
      logger.warn(`Command already registered, overwriting: ${command.name}`)
    }
    this.commands.set(command.name, command)
    logger.debug(`Command registered: ${command.name}`)
  }

  /**
   * Register multiple commands
   */
  registerMany(commands: Command[]): void {
    for (const command of commands) {
      this.register(command)
    }
  }

  /**
   * Unregister a command
   */
  unregister(name: string): boolean {
    const result = this.commands.delete(name)
    if (result) {
      logger.debug(`Command unregistered: ${name}`)
    }
    return result
  }

  /**
   * Execute a command from input string
   */
  async execute(input: string, context: CommandContext): Promise<string | null> {
    const trimmed = input.trim()

    if (!this.isCommandInput(trimmed)) {
      return null
    }

    const { prefix, commandName, args } = this.parseCommandInput(trimmed)

    const command = this.commands.get(commandName)

    if (!command) {
      logger.debug(`Unknown command`, { commandName, prefix })
      return this.formatUnknownCommand(prefix, commandName)
    }

    logger.info(`Executing command`, { command: commandName, args, context })

    try {
      const result = await command.handler(args, context)
      logger.debug(`Command executed successfully`, { command: commandName, resultLength: result.length })
      return result
    } catch (error) {
      logger.error(`Command execution failed`, error, { command: commandName })
      return this.formatCommandError(prefix, commandName, error)
    }
  }

  /**
   * Check if input is a command
   */
  private isCommandInput(input: string): boolean {
    return input.startsWith('/') || input.startsWith('@')
  }

  /**
   * Parse command input into components
   */
  private parseCommandInput(input: string): { prefix: string; commandName: string; args: string[] } {
    const parts = input.split(/\s+/)
    const prefix = parts[0][0]
    const commandName = parts[0].slice(1)
    const args = parts.slice(1)

    return { prefix, commandName, args }
  }

  /**
   * Format unknown command message
   */
  private formatUnknownCommand(prefix: string, commandName: string): string {
    return `Unknown command: ${prefix}${commandName}\nUse /help to see available commands`
  }

  /**
   * Format command error message
   */
  private formatCommandError(prefix: string, commandName: string, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return `Error executing command ${prefix}${commandName}: ${errorMessage}`
  }

  /**
   * Get all registered commands
   */
  getCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  /**
   * Get a specific command
   */
  getCommand(name: string): Command | undefined {
    return this.commands.get(name)
  }

  /**
   * Check if a command exists
   */
  hasCommand(name: string): boolean {
    return this.commands.has(name)
  }

  /**
   * Get command names
  */
  getCommandNames(): string[] {
    return Array.from(this.commands.keys())
  }

  /**
   * Generate help text
   */
  getHelpText(): string {
    const commands = this.getCommands()

    if (commands.length === 0) {
      return 'No commands available.'
    }

    let help = 'Available Commands\n\n'

    for (const command of commands) {
      help += `/${command.name} - ${command.description}\n`
      help += `  Usage: ${command.usage}\n\n`
    }

    return help
  }

  /**
   * Clear all commands
   */
  clear(): void {
    const count = this.commands.size
    this.commands.clear()
    logger.info(`Cleared all commands`, { count })
  }

  /**
   * Get command count
   */
  get size(): number {
    return this.commands.size
  }
}

// Singleton instance
let commandManagerInstance: CommandManager | null = null

export function getCommandManager(): CommandManager {
  if (!commandManagerInstance) {
    commandManagerInstance = new CommandManager()
    logger.debug('CommandManager initialized')
  }
  return commandManagerInstance
}

export function resetCommandManager(): void {
  if (commandManagerInstance) {
    commandManagerInstance.clear()
  }
  commandManagerInstance = null
  logger.debug('CommandManager reset')
}

// Export types
export type { Command, CommandContext }
