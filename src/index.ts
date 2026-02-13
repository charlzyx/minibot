import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { getConfigManager, closeConfigManager } from './config/manager'
import { Agent } from './agent'

// Initialize managers
const configManager = getConfigManager()

const app = new Hono({
  middleware: [
    cors({
      origin: '*',
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowHeaders: ['Content-Type', 'Authorization'],
    }),
  ],
})

// Health check endpoint
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  })
})

// Config API
app.get('/api/config', async (c) => {
  const config = await configManager.loadConfig()
  return c.json(config)
})

app.post('/api/config', async (c) => {
  const body = await c.req.json()
  await configManager.saveConfig(body)
  return c.json({ success: true })
})

// Chat API
app.post('/api/chat', async (c) => {
  const body = await c.req.json()
  const { message, userId = 'anonymous', platform = 'web', sessionId, history = [] } = body
  
  const agent = new Agent()
  
  try {
    const response = await agent.process({
      userMessage: message,
      userId,
      platform,
      sessionId,
      history
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

// Memory API
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

// Tools API
app.get('/api/tools', async (c) => {
  const { getTools } = await import('./tools/index')
  const tools = getTools()
  
  return c.json(Object.keys(tools).map(key => ({
    name: key,
    ...tools[key]
  })))
})

app.post('/api/tools/:name', async (c) => {
  const { name } = c.req.param()
  const { body } = await c.req.json()
  
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

// SSE Chat endpoint for streaming responses
app.get('/api/chat/stream', async (c) => {
  const { message } = c.req.query()
  const { userId = 'anonymous', platform = 'web' } = c.req.query()
  
  // Return a stream if configured
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
          sessionId: c.req.header('x-session-id') || crypto.randomUUID(),
          history: []
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

// Feishu webhook endpoint (if configured)
app.post('/webhooks/feishu', async (c) => {
  const { getMemoryManager } = await import('./memory/manager')
  const memoryManager = getMemoryManager()
  const body = await c.req.json()
  
  // Store message
  await memoryManager.store(JSON.stringify(body), ['webhook', 'feishu', body.event?.message_id || Date.now().toString()])
  
  return c.json({ success: true })
})

// WeChat webhook endpoint (if configured)
app.post('/webhooks/wechat', async (c) => {
  const body = await c.req.json()
  
  // Store message
  const { getMemoryManager } = await import('./memory/manager')
  const memoryManager = getMemoryManager()
  await memoryManager.store(JSON.stringify(body), ['webhook', 'wechat', body.msgid || Date.now().toString()])
  
  return c.json({ success: true })
})

// WeChat Push webhook
app.get('/webhooks/wechat', (c) => {
  // WeChat server verification endpoint
  return c.text('success')
})

// 404 handler
app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404)
})

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err)
  
  return c.json({
    error: err.message || 'Internal Server Error',
    success: false
  }, 500)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...')
  configManager?.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\nShutting down gracefully...')
  configManager?.close()
  process.exit(0)
})

// Start server
const port = process.env.PORT || 18790
console.log(`🚀 Minibot server starting on port ${port}`)

export default {
  port,
  fetch: app.fetch,
}
