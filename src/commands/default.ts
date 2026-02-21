import { Command } from './manager'
import { getSessionManager } from '../session'
import { createLogger } from '../utils'

const logger = createLogger('DefaultCommands')

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

      logger.debug('Session reset', { sessionId })
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
    description: '启动代码助手并在容器中执行任务',
    usage: '/code [任务描述]',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`

      const session = sessionManager.getOrCreate(sessionId)
      session.activeSkill = 'code-assistant'
      await sessionManager.save(session)

      logger.info('Code assistant starting', { sessionId, args: args.join(' ') })

      let response = '🤖 **代码助手已启动**\n\n'

      const task = args.length > 0 ? args.join(' ') : 'info'

      response += `📦 任务: ${task}\n\n`

      // 在独立容器中运行
      try {
        const { runCodeAssistant } = await import('../container-runner-docker')

        logger.info('Starting code assistant container', { sessionId, task })

        response += `🚀 正在启动独立容器...\n\n`

        const result = await runCodeAssistant({
          prompt: task,
          sessionId: sessionId,
          chatJid: sessionId,
          containerOptions: {
            imageName: 'node:18-alpine',
            memoryLimit: '512m',
            timeout: 60000
          },
          async onOutput(output) {
            logger.info('Container output received', { status: output.status })
            if (output.status === 'success') {
              response += `✅ 执行成功！\n\n`
              response += `📦 输出:\n\`\`\`\n${output.result}\n\`\`\`\n\n`
            } else {
              response += `❌ 执行失败: ${output.error}\n\n`
            }
          }
        })

        // 如果 onOutput 没有添加响应，添加默认响应
        if (!response.includes('执行成功') && !response.includes('执行失败')) {
          if (result.status === 'success') {
            response += `✅ 执行成功！\n\n`
            response += `📦 输出:\n\`\`\`\n${result.result}\n\`\`\`\n\n`
          } else {
            response += `❌ 执行失败: ${result.error}\n\n`
          }
        }
      } catch (error) {
        logger.error('Code assistant error', error, { sessionId })
        response += `❌ 启动容器时出错: ${error instanceof Error ? error.message : String(error)}\n\n`
        response += `💡 提示: 请确保 Docker 已安装并运行\n\n`
      }

      return response
    }
  },
  {
    name: 'skill-creator',
    description: '创建自定义技能',
    usage: '/skill-creator',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`

      const session = sessionManager.getOrCreate(sessionId)
      session.activeSkill = 'skill-creator'
      session.state = {
        ...session.state,
        skillCreator: {
          step: 1,
          skillData: {}
        }
      }
      await sessionManager.save(session)

      logger.info('Skill creator starting', { sessionId })

      return '🎨 **技能创建助手已启动**\n\n' +
        '我将帮助你创建一个自定义技能。请按照以下步骤操作：\n\n' +
        '1. 首先，告诉我技能的名称\n' +
        '2. 然后，提供技能的描述\n' +
        '3. 接着，输入技能的标签（用逗号分隔）\n' +
        '4. 最后，编写技能的实现代码\n\n' +
        '现在，请输入技能的名称：'
    }
  }
]
