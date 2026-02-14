import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

import { getConfigManager, closeConfigManager, Config, setCustomWorkspace, getWorkspace } from './config/manager'
import { Agent } from './agent'
import { startFeishuWS, stopFeishuWS, getFeishuChannel, FeishuMessage } from './channels/feishu'
import { getSessionManager, ChatMessage } from './session'
import { getSkillManager } from './skills'
import { getCommandManager, defaultCommands } from './commands'

const args = process.argv.slice(2)
const workspaceArg = args.find(arg => arg.startsWith('--workspace='))
if (workspaceArg) {
  const workspace = workspaceArg.split('=')[1]
  setCustomWorkspace(workspace)
  console.log(`[Config] Using custom workspace: ${workspace}`)
}

const workspace = getWorkspace()
console.log(`[Config] Workspace: ${workspace}`)

if (!fs.existsSync(workspace)) {
  console.log(`[Config] Creating workspace directory: ${workspace}`)
  fs.mkdirSync(workspace, { recursive: true })
}

const sessionsDir = path.join(workspace, 'sessions')
if (!fs.existsSync(sessionsDir)) {
  console.log(`[Config] Creating sessions directory: ${sessionsDir}`)
  fs.mkdirSync(sessionsDir, { recursive: true })
}

const memoryDir = path.join(workspace, 'memory')
if (!fs.existsSync(memoryDir)) {
  console.log(`[Config] Creating memory directory: ${memoryDir}`)
  fs.mkdirSync(memoryDir, { recursive: true })
}

const workspacesDir = path.join(workspace, 'workspaces')
if (!fs.existsSync(workspacesDir)) {
  console.log(`[Config] Creating workspaces directory: ${workspacesDir}`)
  fs.mkdirSync(workspacesDir, { recursive: true })
}

const skillsDir = path.join(workspace, 'skills')
if (!fs.existsSync(skillsDir)) {
  console.log(`[Config] Creating skills directory: ${skillsDir}`)
  fs.mkdirSync(skillsDir, { recursive: true })
}

const dbDir = path.join(workspace, 'db')
if (!fs.existsSync(dbDir)) {
  console.log(`[Config] Creating db directory: ${dbDir}`)
  fs.mkdirSync(dbDir, { recursive: true })
}

const configManager = getConfigManager()

const skillManager = getSkillManager()
console.log('[SkillManager] Loading skills...')
await skillManager.loadAllSkills()
console.log(`[SkillManager] Loaded ${skillManager.getAllSkills().length} skills`)

const commandManager = getCommandManager()
commandManager.registerMany(defaultCommands)
console.log(`[CommandManager] Registered ${defaultCommands.length} commands`)

const app = new Hono()

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

app.get('/api/config', async (c) => {
  const config = await configManager.loadConfig()
  return c.json(config)
})

app.post('/api/config', async (c) => {
  const body = await c.req.json()
  await configManager.saveConfig(body)
  return c.json({ success: true })
})

app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { message, userId = 'anonymous', platform = 'web', history = [] } = body
  
  const agent = new Agent()
  
  try {
    const response = await agent.process({
      userMessage: message,
      userId,
      platform,
      messageId: crypto.randomUUID(),
      history: history.map((h: any) => ({ ...h, timestamp: h.timestamp || Date.now() })),
      metadata: {}
    })
    
    return c.json({
      response,
      success: true
    })
  } catch (error) {
    return c.json({
      response: '抱歉，我遇到了一些问题。',
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, 500)
  }
})

app.get('/api/memory', async (c) => {
  const { query, limit, tag } = c.req.query()
  
  const { getMemoryManager, closeMemoryManager } = await import('./memory/manager')
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
      const agent = new Agent()
      
      try {
        const response = await agent.process({
          userMessage: message,
          userId,
          platform,
          messageId: crypto.randomUUID(),
          history: [],
          metadata: {}
        })
        
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(response)}\n\n`))
        
        controller.close()
      } catch (error) {
        const encoder = new TextEncoder()
        controller.enqueue(encoder.encode(`event: error\ndata: ${error instanceof Error ? error.message : String(error)}\n\n`))
        controller.close()
      }
    },
  })
  
  return new Response(stream, { headers })
})

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

app.onError((err, c) => {
  console.error('Server error:', err)
  
  return c.json({
    error: err.message || 'Internal Server Error',
    success: false
  }, 500)
})

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...')
  stopFeishuWS()
  configManager?.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...')
  stopFeishuWS()
  configManager?.close()
  process.exit(0)
})

async function initializeFeishuWS() {
  try {
    const config = await configManager.loadConfig()
    console.log('[Debug] Loaded config:', JSON.stringify(config, null, 2))
    const feishuConfig = config.channels.feishu
    
    if (feishuConfig.enabled && feishuConfig.appId && feishuConfig.appSecret) {
      console.log('[Feishu] Starting WebSocket connection...')
      
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
        
        console.log('========================================')
        console.log('[Feishu] 📥 Received Message:')
        console.log(`  User ID: ${userId}`)
        console.log(`  Chat ID: ${chatId}`)
        console.log(`  Message: ${content}`)
        console.log(`  Message ID: ${messageId}`)
        console.log(`  Chat Type: ${chatType}`)
        console.log(`  Time: ${new Date().toISOString()}`)
        console.log('========================================')
        
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
            console.log('[Feishu] Getting Feishu channel...')
            const feishuChannel = getFeishuChannel({
              appId: feishuConfig.appId,
              appSecret: feishuConfig.appSecret,
              encryptKey: feishuConfig.encryptKey,
              verificationToken: feishuConfig.verificationToken,
              allowFrom: feishuConfig.allowFrom
            })
            
            console.log('[Feishu] 🤖 Processing with Agent...')
            const agent = new Agent()
            console.log('[Feishu] Agent created, starting process...')
            const response = await agent.process({
              userMessage: content,
              userId,
              platform: 'feishu',
              messageId,
              sessionId,
              history: sessionManager.getMessages(sessionId, 20),
              metadata: { chatId, chatType }
            })
            
            console.log('[Feishu] Agent response received:', response.substring(0, 100))
            console.log('[Feishu] 📤 Sending reply...')
            await feishuChannel.replyMessage(messageId, response, false)
            console.log('[Feishu] ✅ Reply sent successfully!')
          } catch (error) {
            console.error('[Feishu] ❌ Failed to reply:', error)
          }
        } else {
          console.log('[Feishu] Skipping message - userId or content missing:', { userId: !!userId, content: !!content })
        }
      })
      
      console.log('[Feishu] WebSocket initialization completed')
    } else {
      console.log('[Feishu] Not enabled or missing credentials:', {
        enabled: feishuConfig.enabled,
        appId: feishuConfig.appId,
        appSecret: feishuConfig.appSecret
      })
    }
  } catch (error) {
    console.error('[Feishu] Failed to initialize WebSocket:', error)
  }
}

const port = process.env.PORT || 18790
console.log(`🚀 Minibot server starting on port ${port}`)

if (import.meta.url === `file://${process.argv[1]}`) {
  serve({ 
    fetch: app.fetch, 
    port: Number(port) 
  })
  
  setTimeout(() => {
    initializeFeishuWS()
  }, 1000)
}

export default {
  port,
  fetch: app.fetch,
}
