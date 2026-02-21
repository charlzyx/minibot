import { Command } from './manager'
import { getSessionManager } from '../session'
import { ChildProcess } from 'child_process'

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
    description: '启动代码助手并在容器中执行任务',
    usage: '/code [任务描述]',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`

      const session = sessionManager.getOrCreate(sessionId)
      session.activeSkill = 'code-assistant'
      await sessionManager.save(session)

      let response = '🤖 **代码助手已启动**\n\n'

      if (args.length > 0) {
        const task = args.join(' ')
        response += `任务: ${task}\n\n`
      }

      // 在容器中运行
      try {
        const { runContainerAgent } = await import('../container-runner')

        const group = {
          folder: 'workspace',
          name: 'Code Assistant Container'
        }

        const params = {
          prompt: args.length > 0 ? args.join(' ') : '准备就绪，等待指令',
          sessionId: sessionId,
          groupFolder: 'workspace',
          chatJid: sessionId,
          isMain: true
        }

        const onRegisterProcess = (proc: ChildProcess, containerName: string, groupFolder: string) => {
          console.log(`[Container] 注册进程: ${containerName}`)
        }

        const onOutput = async (output: any) => {
          console.log(`[Container] 输出: ${JSON.stringify(output)}`)
        }

        response += `🚀 正在启动容器...\n\n`

        const result = await runContainerAgent(
          group,
          params,
          onRegisterProcess,
          onOutput
        )

        if (result.status === 'success') {
          response += `✅ 容器启动成功！\n\n`
          response += `📦 容器输出: ${result.result}\n\n`
        } else {
          response += `❌ 容器启动失败: ${result.error}\n\n`
        }
      } catch (error) {
        response += `❌ 启动容器时出错: ${error instanceof Error ? error.message : String(error)}\n\n`
      }

      response += `我现在可以帮助你完成以下任务：\n\n`
      response += `- 💻 编写和调试代码\n`
      response += `- 🐳 在容器中运行代码\n`
      response += `- 🔧 代码审查和重构\n\n`
      response += `我会及时反馈执行状态，遇到问题立即通知。\n\n`
      response += `请告诉我你需要什么帮助！`

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
