import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import dotenv from 'dotenv'

dotenv.config()

import { getConfigManager, closeConfigManager, Config } from './config/manager'
import { Agent } from './agent'
import { startFeishuWS, stopFeishuWS, getFeishuChannel, FeishuMessage } from './channels/feishu'

const configManager = getConfigManager()

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
        
        console.log('========================================')
        console.log('[Feishu] 📥 Received Message:')
        console.log(`  User ID: ${userId}`)
        console.log(`  Chat ID: ${chatId}`)
        console.log(`  Message: ${content}`)
        console.log(`  Message ID: ${messageId}`)
        console.log(`  Time: ${new Date().toISOString()}`)
        console.log('========================================')
        
        const { getMemoryManager } = await import('./memory/manager')
        const memoryManager = getMemoryManager()
        
        await memoryManager.store(
          JSON.stringify({ userId, content, messageId }),
          ['feishu', 'message', messageId]
        )
        
        if (userId && content) {
          try {
            const feishuChannel = getFeishuChannel({
              appId: feishuConfig.appId,
              appSecret: feishuConfig.appSecret,
              encryptKey: feishuConfig.encryptKey,
              verificationToken: feishuConfig.verificationToken,
              allowFrom: feishuConfig.allowFrom
            })
            
            console.log('[Feishu] 🤖 Processing with Agent...')
            const agent = new Agent()
            const response = await agent.process({
              userMessage: content,
              userId,
              platform: 'feishu',
              messageId,
              history: [],
              metadata: {}
            })
            
            console.log('[Feishu] 📤 Sending reply...')
            await feishuChannel.sendCardMessage(response, userId, messageId)
            console.log('[Feishu] ✅ Reply sent successfully!')
          } catch (error) {
            console.error('[Feishu] ❌ Failed to reply:', error)
          }
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
