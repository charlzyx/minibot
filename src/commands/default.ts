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
    name: 'monitor',
    description: '显示详细监控信息',
    usage: '/monitor',
    handler: async (_args, context) => {
      const { getMonitoringManager } = await import('../monitoring')
      const monitoringManager = getMonitoringManager()

      return monitoringManager.formatMetrics()
    }
  },
  {
    name: 'health',
    description: '检查系统健康状态',
    usage: '/health',
    handler: async (_args, _context) => {
      const { getMonitoringManager } = await import('../monitoring')
      const monitoringManager = getMonitoringManager()

      const health = monitoringManager.getHealthStatus()
      const checks = Object.entries(health.checks)

      let output = `🏥 系统健康检查\n\n`
      output += `状态: ${health.status === 'healthy' ? '✅ 健康' : health.status === 'degraded' ? '⚠️ 降级' : '❌ 不健康'}\n\n`
      output += `检查项:\n`

      for (const [name, passed] of checks) {
        output += `  ${passed ? '✅' : '❌'} ${name}\n`
      }

      return output
    }
  },
  {
    name: 'code',
    description: '启动 Claude Code 代码助手并在容器中执行任务',
    usage: '/code <任务描述>',
    handler: async (args, context) => {
      const sessionManager = getSessionManager()
      const sessionId = context.sessionId || `${context.platform}:${context.userId}`

      const session = sessionManager.getOrCreate(sessionId)
      session.activeSkill = 'code-assistant'
      await sessionManager.save(session)

      logger.info('Claude Code assistant starting', { sessionId, args: args.join(' ') })

      const task = args.length > 0 ? args.join(' ') : ''

      if (!task) {
        return `🤖 **Claude Code 代码助手**

在隔离的 Docker 容器中运行 Claude Code，执行复杂的代码工程任务。

**用法:**
\`\`\`
/code <任务描述>
\`\`\`

**示例:**
- \`/code 帮我重构 src/utils.ts 文件\`
- \`/code 添加单元测试\`
- \`/code 代码审查并优化性能\`

**功能:**
- 🔒 完全隔离的容器环境
- 📝 支持项目目录挂载
- ⏱️ 可配置超时时间
- 💾 支持会话持久化

**注意:** 首次使用需要构建容器镜像，请确保 Docker 已安装并运行。`
      }

      let response = '🤖 **Claude Code 代码助手已启动**\n\n'
      response += `📦 任务: ${task}\n\n`
      response += `🚀 正在启动 Claude Code 容器...\n\n`

      try {
        const { runClaudeCode } = await import('../container/claude-runner')

        const result = await runClaudeCode({
          task,
          sessionId,
          options: {
            apiKey: process.env.ANTHROPIC_API_KEY,
            timeout: 300000 // 5 minutes
          }
        })

        logger.info('Claude Code completed', { sessionId, status: result.status })

        if (result.status === 'success') {
          response += `✅ 执行成功！\n\n`
          if (result.output) {
            response += `📦 输出:\n\`\`\`\n${result.output}\n\`\`\`\n\n`
          }
        } else if (result.status === 'timeout') {
          response += `⏱️ 执行超时\n\n`
          response += `💡 提示: 可以使用更长的超时时间或简化任务\n\n`
        } else {
          response += `❌ 执行失败\n\n`
          if (result.error) {
            response += `错误: ${result.error}\n\n`
          }
        }
      } catch (error) {
        logger.error('Claude Code error', error, { sessionId })
        response += `❌ 启动容器时出错: ${error instanceof Error ? error.message : String(error)}\n\n`
        response += `💡 提示:\n`
        response += `- 请确保 Docker 已安装并运行\n`
        response += `- 请确保已设置 ANTHROPIC_API_KEY 环境变量\n`
        response += `- 使用 \`minibot container build\` 构建容器镜像\n\n`
      }

      return response
    }
  },
  {
  },
  {
    name: 'mounts',
    description: '显示挂载安全状态',
    usage: '/mounts',
    handler: async (_args, _context) => {
      const { loadMountAllowlist, MOUNT_ALLOWLIST_PATH, initializeMountAllowlist } = await import('../mount-security')

      const allowlist = loadMountAllowlist()

      if (!allowlist) {
        return `🔒 **挂载安全状态**\n\n` +
          `❌ 未找到挂载允许列表\n\n` +
          `位置: \`${MOUNT_ALLOWLIST_PATH}\`\n\n` +
          `请创建允许列表以启用额外挂载。`
      }

      let output = `🔒 **挂载安全状态**\n\n`
      output += `✅ 允许列表已加载\n\n`
      output += `**允许的根目录**:\n`

      for (const root of allowlist.allowedRoots) {
        output += `  - ${root.path}`
        if (root.description) {
          output += ` (${root.description})`
        }
        output += root.allowReadWrite ? ` [读写]` : ` [只读]`
        output += `\n`
      }

      output += `\n**阻止的模式**: ${allowlist.blockedPatterns.join(', ')}\n`
      output += `**非主组只读**: ${allowlist.nonMainReadOnly ? '是' : '否'}\n`

      return output
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
