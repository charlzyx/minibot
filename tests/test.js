import { getSessionManager } from '../src/session'
import { getMemoryManager } from '../src/memory/manager'

// Test setup
const sessionManager = getSessionManager()
const memoryManager = getMemoryManager()

// Test functions
async function testSessionManager() {
  console.log('Testing SessionManager...')
  
  // Test session creation
  const session = sessionManager.getOrCreate('test:user1')
  console.log('Created session:', session.key)
  
  // Test message addition
  sessionManager.addMessage('test:user1', 'user', 'Hello')
  sessionManager.addMessage('test:user1', 'assistant', 'Hi!')
  console.log('Added messages')
  
  // Test message retrieval
  const messages = sessionManager.getMessages('test:user1')
  console.log('Retrieved messages:', messages.length)
  
  // Test session saving
  await sessionManager.save(session)
  console.log('Saved session')
  
  console.log('SessionManager test completed!')
}

async function testMemoryManager() {
  console.log('Testing MemoryManager...')
  
  // Test SQLite storage
  const id = await memoryManager.store('Test memory', ['test', 'memory'])
  console.log('Stored memory with id:', id)
  
  // Test search
  const results = await memoryManager.search('Test')
  console.log('Search results:', results.length)
  
  // Test markdown storage
  await memoryManager.appendToday('Test daily note')
  console.log('Added daily note')
  
  const today = await memoryManager.readToday()
  console.log('Today\'s note:', today.length > 0 ? 'Found' : 'Empty')
  
  await memoryManager.writeLongTerm('Test long term memory')
  console.log('Wrote long term memory')
  
  const longTerm = await memoryManager.readLongTerm()
  console.log('Long term memory:', longTerm.length > 0 ? 'Found' : 'Empty')
  
  // Test memory context
  const context = await memoryManager.getMemoryContext()
  console.log('Memory context length:', context.length)
  
  console.log('MemoryManager test completed!')
}

// Run tests
async function runTests() {
  try {
    await testSessionManager()
    await testMemoryManager()
    console.log('All tests passed!')
  } catch (error) {
    console.error('Test failed:', error)
  } finally {
    await memoryManager.close()
  }
}

runTests()
