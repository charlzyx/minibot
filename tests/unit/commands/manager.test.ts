import { describe, it, expect, beforeEach } from 'vitest'
import { getCommandManager, resetCommandManager } from '@/commands/manager'
import type { Command } from '@/types'

describe('CommandManager', () => {
  beforeEach(() => {
    resetCommandManager()
  })

  describe('command registration', () => {
    it('should register a command', () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'test',
        description: 'Test command',
        usage: '/test',
        handler: async () => 'Test result'
      }

      manager.register(command)

      expect(manager.hasCommand('test')).toBe(true)
      expect(manager.getCommand('test')).toEqual(command)
    })

    it('should register multiple commands', () => {
      const manager = getCommandManager()
      const commands: Command[] = [
        {
          name: 'cmd1',
          description: 'Command 1',
          usage: '/cmd1',
          handler: async () => 'Result 1'
        },
        {
          name: 'cmd2',
          description: 'Command 2',
          usage: '/cmd2',
          handler: async () => 'Result 2'
        }
      ]

      manager.registerMany(commands)

      expect(manager.size).toBe(2)
      expect(manager.hasCommand('cmd1')).toBe(true)
      expect(manager.hasCommand('cmd2')).toBe(true)
    })

    it('should unregister a command', () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'test',
        description: 'Test command',
        usage: '/test',
        handler: async () => 'Result'
      }

      manager.register(command)
      expect(manager.hasCommand('test')).toBe(true)

      const result = manager.unregister('test')
      expect(result).toBe(true)
      expect(manager.hasCommand('test')).toBe(false)
    })

    it('should return false when unregistering non-existent command', () => {
      const manager = getCommandManager()
      const result = manager.unregister('nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('command execution', () => {
    it('should execute a registered command', async () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'echo',
        description: 'Echo command',
        usage: '/echo [message]',
        handler: async (args) => `Echo: ${args.join(' ')}`
      }

      manager.register(command)

      const result = await manager.execute('/echo hello world', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(result).toBe('Echo: hello world')
    })

    it('should return null for non-command input', async () => {
      const manager = getCommandManager()

      const result = await manager.execute('This is not a command', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(result).toBeNull()
    })

    it('should handle command execution errors', async () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'error',
        description: 'Error command',
        usage: '/error',
        handler: async () => {
          throw new Error('Command failed')
        }
      }

      manager.register(command)

      const result = await manager.execute('/error', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(result).toContain('Error executing command')
      expect(result).toContain('Command failed')
    })

    it('should return error message for unknown command', async () => {
      const manager = getCommandManager()

      const result = await manager.execute('/unknown', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(result).toContain('Unknown command')
      expect(result).toContain('/unknown')
    })

    it('should support @ prefix for commands', async () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'test',
        description: 'Test command',
        usage: '@test',
        handler: async () => 'At-command result'
      }

      manager.register(command)

      const result = await manager.execute('@test', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(result).toBe('At-command result')
    })

    it('should parse command arguments correctly', async () => {
      const manager = getCommandManager()
      let receivedArgs: string[] = []

      const command: Command = {
        name: 'args',
        description: 'Args command',
        usage: '/args arg1 arg2 arg3',
        handler: async (args) => {
          receivedArgs = args
          return `Received ${args.length} args`
        }
      }

      manager.register(command)

      await manager.execute('/args first second third', {
        sessionId: 'test',
        userId: 'user1',
        platform: 'test',
        messageId: 'msg1',
        metadata: {}
      })

      expect(receivedArgs).toEqual(['first', 'second', 'third'])
    })
  })

  describe('help text', () => {
    it('should generate help text', () => {
      const manager = getCommandManager()
      const commands: Command[] = [
        {
          name: 'help',
          description: 'Show help',
          usage: '/help',
          handler: async () => 'Help text'
        },
        {
          name: 'status',
          description: 'Show status',
          usage: '/status',
          handler: async () => 'Status info'
        }
      ]

      manager.registerMany(commands)

      const helpText = manager.getHelpText()

      expect(helpText).toContain('/help')
      expect(helpText).toContain('Show help')
      expect(helpText).toContain('/status')
      expect(helpText).toContain('Show status')
    })

    it('should return no commands message when empty', () => {
      const manager = getCommandManager()

      const helpText = manager.getHelpText()

      expect(helpText).toContain('No commands available')
    })
  })

  describe('utility methods', () => {
    it('should get all commands', () => {
      const manager = getCommandManager()
      const commands: Command[] = [
        {
          name: 'cmd1',
          description: 'Command 1',
          usage: '/cmd1',
          handler: async () => 'Result 1'
        },
        {
          name: 'cmd2',
          description: 'Command 2',
          usage: '/cmd2',
          handler: async () => 'Result 2'
        }
      ]

      manager.registerMany(commands)

      const allCommands = manager.getCommands()

      expect(allCommands).toHaveLength(2)
      expect(allCommands[0].name).toBe('cmd1')
      expect(allCommands[1].name).toBe('cmd2')
    })

    it('should get command names', () => {
      const manager = getCommandManager()
      const commands: Command[] = [
        {
          name: 'alpha',
          description: 'Alpha',
          usage: '/alpha',
          handler: async () => 'A'
        },
        {
          name: 'beta',
          description: 'Beta',
          usage: '/beta',
          handler: async () => 'B'
        }
      ]

      manager.registerMany(commands)

      const names = manager.getCommandNames()

      expect(names).toContain('alpha')
      expect(names).toContain('beta')
      expect(names).toHaveLength(2)
    })

    it('should clear all commands', () => {
      const manager = getCommandManager()
      const command: Command = {
        name: 'test',
        description: 'Test',
        usage: '/test',
        handler: async () => 'Result'
      }

      manager.register(command)
      expect(manager.size).toBe(1)

      manager.clear()
      expect(manager.size).toBe(0)
    })
  })
})
