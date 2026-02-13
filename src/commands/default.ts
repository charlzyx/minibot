import { Command } from './manager'
import { getSessionManager } from '../session'

export const defaultCommands: Command[] = [
  {
    name: 'help',
    description: '显示可用命令列表',
    usage: '/help',
    handler: async (args, context) => {
      const { getCommandManager } = await import('./manager')
      const commandManager = getCommandManager()
      return commandManager.getHelpText()
    }
  },
  {
    name: 'reset',
    description: '重置当前会话',
    usage: '/reset',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`
      
      sessionManager.unload(sessionId)
      
      return '✅ 会话已重置'
    }
  },
  {
    name: 'skills',
    description: '列出所有可用的技能',
    usage: '/skills',
    handler: async (args, context) => {
      const { getSkillManager } = await import('../skills')
      const skillManager = getSkillManager()
      const skills = skillManager.getEnabledSkills()
      
      if (skills.length === 0) {
        return '📭 当前没有可用的技能'
      }
      
      let output = '🎯 可用技能\n\n'
      
      for (const skill of skills) {
        output += `**${skill.metadata.name}**\n`
        if (skill.metadata.description) {
          output += `  ${skill.metadata.description}\n`
        }
        if (skill.metadata.tags && skill.metadata.tags.length > 0) {
          output += `  标签: ${skill.metadata.tags.join(', ')}\n`
        }
        output += '\n'
      }
      
      return output
    }
  },
  {
    name: 'status',
    description: '显示系统状态',
    usage: '/status',
    handler: async (args, context) => {
      const { getSkillManager } = await import('../skills')
      const skillManager = getSkillManager()
      const sessionManager = getSessionManager()
      
      const skills = skillManager.getEnabledSkills()
      const sessions = sessionManager.getAllSessions()
      
      let status = '📊 系统状态\n\n'
      status += `**技能数量**: ${skills.length}\n`
      status += `**会话数量**: ${sessions.length}\n`
      status += `**平台**: ${context.platform}\n`
      status += `**用户ID**: ${context.userId}\n`
      
      return status
    }
  },
  {
    name: 'code',
    description: '启动 Claude Code 编程助手',
    usage: '/code [任务描述]',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`
      
      const session = sessionManager.getOrCreate(sessionId)
      session.activeSkill = 'claude-code'
      await sessionManager.save(session)
      
      let response = '🤖 **Claude Code 助手已启动**\n\n'
      
      if (args.length > 0) {
        const task = args.join(' ')
        response += `任务: ${task}\n\n`
      }
      
      response += `我现在可以帮助你完成以下编程任务：\n\n`
      response += `- 📝 代码编写\n`
      response += `- 🐛 代码调试\n`
      response += `- ♻️ 代码重构\n`
      response += `- 🔍 代码审查\n\n`
      response += `我会及时反馈执行状态，遇到问题立即通知。\n\n`
      response += `请告诉我你需要什么帮助！`
      
      return response
    }
  }
]
