import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

import { createLogger } from './utils'
import { getConfigManager, closeConfigManager, setCustomWorkspace, getWorkspace } from './config/manager'
import { Agent } from './agent'
import { startFeishuWS, stopFeishuWS, getFeishuChannel, type FeishuMessage } from './channels/feishu'
import { getSessionManager, type ChatMessage } from './session'
import { getSkillManager } from './skills'
import { getPluginManager } from './plugins'
import { getCommandManager, defaultCommands } from './commands'
import { GroupQueue } from './group-queue'
import { MessageProcessor } from './message-processor'
import { startSchedulerLoop } from './task-scheduler'

const logger = createLogger('Minibot')

dotenv.config()

// ============================================================================
// Workspace Setup
// ============================================================================

function setupWorkspace(customWorkspace?: string): void {
  const workspace = customWorkspace || '/tmp/minibot-workspace'
  setCustomWorkspace(workspace)

  logger.info('Workspace configured', { workspace })

  // Create workspace directory structure
  const directories = [
    path.join(workspace, 'sessions'),
    path.join(workspace, 'memory'),
    path.join(workspace, 'workspaces'),
    path.join(workspace, 'skills'),
    path.join(workspace, 'db')
  ]

  for (const dir of directories) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      logger.debug('Directory created', { dir })
    }
  }
}

// Parse workspace from command line arguments
const args = process.argv.slice(2)
const workspaceArg = args.find(arg => arg.startsWith('--workspace='))
if (workspaceArg) {
  const workspace = workspaceArg.split('=')[1]
  setupWorkspace(workspace)
} else {
  setupWorkspace()
}

const workspace = getWorkspace()

// ============================================================================
// Manager Initialization
// ============================================================================

const configManager = getConfigManager()

async function initializeManagers() {
  // Skills
  const skillManager = getSkillManager()
  logger.info('Loading skills...')
  await skillManager.loadAllSkills()
  logger.info('Skills loaded', { count: skillManager.getAllSkills().length })

  // Plugins
  const pluginManager = getPluginManager()
  logger.info('Loading plugins...')
  await pluginManager.loadAllPlugins()
  logger.info('Plugins loaded', { count: pluginManager.getAllPlugins().length })

  // Commands
  const commandManager = getCommandManager()
  commandManager.registerMany(defaultCommands)
  logger.info('Commands registered', { count: defaultCommands.length })
}

// ============================================================================
// Message Processing Setup
// ============================================================================

const queue = new GroupQueue()
const sessions: Record<string, string> = {}
const registeredGroups: Record<string, Record<string, unknown>> = {}

const messageProcessor = new MessageProcessor({
  sendMessage: async (jid, text) => {
    logger.info('Sending message', { jid, textLength: text?.length || 0 })
  },
  registeredGroups: () => registeredGroups,
  getSessions: () => sessions,
  queue,
  onProcess: (groupJid, proc, containerName, groupFolder) => {
    queue.registerProcess(groupJid, proc, containerName, groupFolder)
  }
})

// Task scheduler
const scheduler = startSchedulerLoop({
  registeredGroups: () => registeredGroups,
  getSessions: () => sessions,
  queue,
  onProcess: (groupJid, proc, containerName, groupFolder) => {
    queue.registerProcess(groupJid, proc, containerName, groupFolder)
  },
  sendMessage: async (jid, text) => {
    logger.info('Sending message from task scheduler', { jid, textLength: text?.length || 0 })
  }
})

// ============================================================================
// HTTP Server Setup
// ============================================================================

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '2.0.0',
    timestamp: new Date().toISOString()
  })
})

// Config endpoints
app.get('/api/config', async (c) => {
  const config = await configManager.loadConfig()
  return c.json(config)
})

app.post('/api/config', async (c) => {
  const body = await c.req.json()
  await configManager.saveConfig(body)
  return c.json({ success: true })
})

// Chat endpoints
app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { message, userId = 'anonymous', platform = 'web', history = [] } = body

  try {
    const response = await messageProcessor.processMessage({
      userMessage: message,
      userId,
      platform,
      messageId: crypto.randomUUID(),
      history: history.map((h: ChatMessage) => ({ ...h, timestamp: h.timestamp || Date.now() })),
      metadata: {}
    })

    return c.json({
      response: response || '消息已接收并存储为上下文',
      success: true
    })
  } catch (error) {
    logger.error('Error processing chat message', error)
    return c.json({
      response: '抱歉，我遇到了一些问题。',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

app.get('/api/chat/stream', async (c) => {
  const { message } = c.req.query()
  const { userId = 'anonymous', platform = 'web' } = c.req.query()

  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const response = await messageProcessor.processMessage({
          userMessage: message,
          userId,
          platform,
          messageId: crypto.randomUUID(),
          history: [],
          metadata: {}
        })

        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(response || '消息已接收并存储为上下文')}\n\n`))

        controller.close()
      } catch (error) {
        logger.error('Error processing streaming chat message', error)
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`event: error\ndata: ${error instanceof Error ? error.message : String(error)}\n\n`))
        controller.close()
      }
    },
  })

  return new Response(stream, { headers })
})

// Memory endpoints
app.get('/api/memory', async (c) => {
  const { query, limit, tag } = c.req.query()

  const { getMemoryManager } = await import('./memory/manager')
  const memoryManager = getMemoryManager()

  if (query) {
    const memories = await memoryManager.search(query, limit ? parseInt(limit) : 10)
    return c.json({ memories })
  } else if (tag) {
    const memories = await memoryManager.getByTag(tag, limit ? parseInt(limit) : 10)
    return c.json({ memories })
  } else {
    const memories = await memoryManager.getRecent(limit ? parseInt(limit) : 10)
    return c.json({ memories })
  }
})

app.post('/api/memory', async (c) => {
  const body = await c.req.json()
  const { getMemoryManager } = await import('./memory/manager')
  const memoryManager = getMemoryManager()

  const id = await memoryManager.store(body.content, body.tags || [])

  return c.json({
    id,
    success: true
  })
})

app.delete('/api/memory/:id', async (c) => {
  const { id } = c.req.param()
  const { getMemoryManager } = await import('./memory/manager')
  const memoryManager = getMemoryManager()

  await memoryManager.delete(parseInt(id))

  return c.json({ success: true })
})

// Tools endpoints
app.get('/api/tools', async (c) => {
  const { getTools } = await import('./tools/index')
  const tools = getTools()

  return c.json(Object.values(tools))
})

app.post('/api/tools/:name', async (c) => {
  const { name } = c.req.param()
  const body = await c.req.json()

  const { getTools } = await import('./tools/index')
  const tools = getTools()
  const tool = tools[name]

  if (!tool) {
    return c.json({ error: `Tool ${name} not found` }, 404)
  }

  try {
    const result = await tool.execute(body.params || {})

    return c.json({
      result,
      success: true
    })
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : String(error),
      success: false
    }, 500)
  }
})

// Skills endpoints
app.get('/api/skills', async (c) => {
  const { getSkillManager } = await import('./skills')
  const skillManager = getSkillManager()

  return c.json({
    skills: skillManager.getAllSkills(),
    count: skillManager.getAllSkills().length
  })
})

app.get('/api/skills/:id', async (c) => {
  const { id } = c.req.param()
  const { getSkillManager } = await import('./skills')
  const skillManager = getSkillManager()

  const skill = skillManager.getSkill(id)

  if (!skill) {
    return c.json({ error: `Skill ${id} not found` }, 404)
  }

  return c.json(skill)
})

app.post('/api/skills', async (c) => {
  const body = await c.req.json()
  const { getSkillManager } = await import('./skills')
  const skillManager = getSkillManager()

  try {
    const filePath = await skillManager.createSkill(
      body.name,
      body.content,
      body.metadata || {}
    )

    return c.json({
      success: true,
      filePath
    })
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : String(error),
      success: false
    }, 500)
  }
})

app.delete('/api/skills/:id', async (c) => {
  const { id } = c.req.param()
  const { getSkillManager } = await import('./skills')
  const skillManager = getSkillManager()

  const success = await skillManager.deleteSkill(id)

  if (!success) {
    return c.json({ error: `Skill ${id} not found` }, 404)
  }

  return c.json({ success: true })
})

// Plugin endpoints
app.get('/api/plugins', async (c) => {
  const { getPluginManager } = await import('./plugins')
  const pluginManager = getPluginManager()

  return c.json({
    plugins: pluginManager.getAllPlugins(),
    count: pluginManager.getAllPlugins().length
  })
})

app.get('/api/plugins/:id', async (c) => {
  const { id } = c.req.param()
  const { getPluginManager } = await import('./plugins')
  const pluginManager = getPluginManager()

  const plugin = pluginManager.getPlugin(id)

  if (!plugin) {
    return c.json({ error: `Plugin ${id} not found` }, 404)
  }

  return c.json(plugin)
})

app.post('/api/plugins/:id/config', async (c) => {
  const { id } = c.req.param()
  const body = await c.req.json()
  const { getPluginManager } = await import('./plugins')
  const pluginManager = getPluginManager()

  try {
    await pluginManager.savePluginConfig(id, body)

    return c.json({
      success: true
    })
  } catch (error) {
    return c.json({
      error: error instanceof Error ? error.message : String(error),
      success: false
    }, 500)
  }
})

app.post('/api/plugins/:id/enable', async (c) => {
  const { id } = c.req.param()
  const { getPluginManager } = await import('./plugins')
  const pluginManager = getPluginManager()

  const success = await pluginManager.enablePlugin(id)

  if (!success) {
    return c.json({ error: `Plugin ${id} not found` }, 404)
  }

  return c.json({ success: true })
})

app.post('/api/plugins/:id/disable', async (c) => {
  const { id } = c.req.param()
  const { getPluginManager } = await import('./plugins')
  const pluginManager = getPluginManager()

  const success = await pluginManager.disablePlugin(id)

  if (!success) {
    return c.json({ error: `Plugin ${id} not found` }, 404)
  }

  return c.json({ success: true })
})

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

app.onError((err, c) => {
  logger.error('Server error', err)
  return c.json({
    error: err.message || 'Internal Server Error',
    success: false
  }, 500)
})

// ============================================================================
// Feishu WebSocket Initialization
// ============================================================================

async function initializeFeishuWS() {
  try {
    const config = await configManager.loadConfig()
    const feishuConfig = config.channels?.feishu

    if (!feishuConfig || !feishuConfig.enabled) {
      logger.info('Feishu not enabled')
      return
    }

    if (!feishuConfig.appId || !feishuConfig.appSecret) {
      logger.warn('Feishu credentials missing', {
        hasAppId: !!feishuConfig.appId,
        hasAppSecret: !!feishuConfig.appSecret
      })
      return
    }

    logger.info('Starting Feishu WebSocket connection...')

    startFeishuWS({
      appId: feishuConfig.appId,
      appSecret: feishuConfig.appSecret,
      encryptKey: feishuConfig.encryptKey,
      verificationToken: feishuConfig.verificationToken,
      allowFrom: feishuConfig.allowFrom
    }, async (message: FeishuMessage) => {
      const userId = message.sender_id?.open_id || ''
      const content = message.content
      const messageId = message.message_id
      const chatId = message.chat_id
      const chatType = message.msg_type

      logger.info('Feishu message received', {
        userId,
        chatId,
        messageId,
        chatType,
        contentLength: content?.length || 0
      })

      const { getMemoryManager } = await import('./memory/manager')
      const memoryManager = getMemoryManager()

      await memoryManager.store(
        JSON.stringify({ userId, content, messageId }),
        ['feishu', 'message', messageId]
      )

      const sessionManager = getSessionManager()
      const sessionId = chatType === 'group' ? `feishu:${chatId}` : `feishu:${userId}`

      if (userId && content) {
        try {
          const feishuChannel = getFeishuChannel({
            appId: feishuConfig.appId,
            appSecret: feishuConfig.appSecret,
            encryptKey: feishuConfig.encryptKey,
            verificationToken: feishuConfig.verificationToken,
            allowFrom: feishuConfig.allowFrom
          })

          const response = await messageProcessor.processMessage({
            userMessage: content,
            userId,
            platform: 'feishu',
            messageId,
            sessionId,
            history: sessionManager.getMessages(sessionId, 20),
            metadata: { chatId, chatType }
          })

          if (response) {
            logger.info('Sending Feishu reply', { messageId, responseLength: response.length })
            await feishuChannel.replyMessage(messageId, response, false)
            logger.info('Feishu reply sent successfully', { messageId })
          } else {
            logger.debug('Message stored as context, no immediate reply needed', { messageId })
          }
        } catch (error) {
          logger.error('Failed to process Feishu message', error, { messageId })
        }
      } else {
        logger.debug('Skipping Feishu message - missing userId or content', { userId, hasContent: !!content })
      }
    })

    logger.info('Feishu WebSocket initialization completed')
  } catch (error) {
    logger.error('Failed to initialize Feishu WebSocket', error)
  }
}

// ============================================================================
// Shutdown Handlers
// ============================================================================

async function shutdown(signal: string) {
  logger.info('Shutting down gracefully...', { signal })

  stopFeishuWS()

  const pluginManager = getPluginManager()
  await pluginManager.shutdownAllPlugins()

  await messageProcessor.shutdown(10000)

  configManager?.close()

  logger.info('Shutdown complete')
  process.exit(0)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

// ============================================================================
// Server Startup
// ============================================================================

const port = process.env.PORT || 18791

async function start() {
  await initializeManagers()

  logger.info(`🚀 Minibot server starting on port ${port}`)

  serve({
    fetch: app.fetch,
    port: Number(port)
  })

  // Initialize Feishu after a short delay
  setTimeout(() => {
    initializeFeishuWS()
  }, 1000)
}

async function dev() {
  await initializeManagers()

  logger.info(`🚀 Minibot dev server starting on port ${port}`)

  serve({
    fetch: app.fetch,
    port: Number(port)
  })

  // Initialize Feishu after a short delay
  setTimeout(() => {
    initializeFeishuWS()
  }, 1000)
}

// Auto-start if running directly
if (import.meta.url === `file://${process.argv[1]}`) {
  start().catch(error => {
    logger.error('Failed to start server', error)
    process.exit(1)
  })
}

export { start, dev }
export default {
  port,
  fetch: app.fetch,
}
