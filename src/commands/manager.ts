export interface Command {
  name: string
  description: string
  usage: string
  handler: (args: string[], context: any) => Promise<string>
}

export class CommandManager {
  private commands: Map<string, Command> = new Map()

  register(command: Command): void {
    this.commands.set(command.name, command)
  }

  registerMany(commands: Command[]): void {
    for (const command of commands) {
      this.register(command)
    }
  }

  async execute(input: string, context: any): Promise<string | null> {
    const trimmed = input.trim()
    
    if (!trimmed.startsWith('/')) {
      return null
    }

    const parts = trimmed.split(/\s+/)
    const commandName = parts[0].slice(1)
    const args = parts.slice(1)

    const command = this.commands.get(commandName)
    
    if (!command) {
      return `未知命令: /${commandName}\n使用 /help 查看可用命令`
    }

    try {
      return await command.handler(args, context)
    } catch (error) {
      return `执行命令 /${commandName} 时出错: ${error instanceof Error ? error.message : String(error)}`
    }
  }

  getCommands(): Command[] {
    return Array.from(this.commands.values())
  }

  getHelpText(): string {
    const commands = this.getCommands()
    
    let help = '📋 可用命令\n\n'
    
    for (const command of commands) {
      help += `**/${command.name}** - ${command.description}\n`
      help += `  用法: ${command.usage}\n\n`
    }
    
    return help
  }
}

let commandManagerInstance: CommandManager | null = null

export function getCommandManager(): CommandManager {
  if (!commandManagerInstance) {
    commandManagerInstance = new CommandManager()
  }
  return commandManagerInstance
}

export function resetCommandManager(): void {
  commandManagerInstance = null
}
