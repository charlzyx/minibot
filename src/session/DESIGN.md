# Session Module Design

## Overview

The Session module provides conversation history management with isolation and persistence capabilities. It follows the design principles from nanobot, using JSONL files for storage with in-memory caching for performance.

## Architecture

```
┌────────────────────────────────────────────────┐
│              Session Manager                  │
│         (Singleton Pattern)                  │
└────────────────────────────────────────────────┘
                      │
          ┌───────────┴───────────┐
          │                       │
          ▼                       ▼
    ┌─────────┐           ┌─────────┐
    │  Cache  │           │ Storage │
    │ (Map)   │           │ (JSONL) │
    └─────────┘           └─────────┘
```

## Core Components

### 1. SessionManager

The main class that manages all sessions.

**Responsibilities**:
- Session creation and retrieval
- Message history management
- Session persistence
- Cache management
- Session cleanup

**Key Methods**:
- `getOrCreate(key: string): Session` - Get or create session by key
- `addMessage(key: string, role: string, content: string)` - Add message to session
- `getMessages(key: string, maxMessages?: number): ChatMessage[]` - Get message history
- `save(session: Session)` - Save session to disk
- `clear(key: string)` - Clear session messages
- `unload(key: string)` - Unload session from cache
- `getAllSessions(): Session[]` - Get all cached sessions
- `delete(key: string)` - Delete session
- `listSessions()` - List all sessions
- `cleanup(maxAge: number)` - Cleanup expired sessions

### 2. Session

Represents a single conversation session.

**Properties**:
```typescript
interface Session {
  key: string              // Unique session identifier
  messages: SessionMessage[]  // Message history
  metadata: SessionMetadata   // Session metadata
  created_at: number          // Creation timestamp
  updated_at: number          // Last update timestamp
}
```

### 3. SessionMessage

Represents a single message in a session.

**Properties**:
```typescript
interface SessionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}
```

### 4. ChatMessage

Filtered message type for LLM context (excludes system messages).

**Properties**:
```typescript
interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}
```

## Session Key Format

Sessions are identified by keys that include platform and chat information:

### Private Chat
```
{platform}:{userId}
```
Example: `feishu:oc_xxxxxxxxxxxxx`

### Group Chat
```
{platform}:{chatId}
```
Example: `feishu:oc_xxxxxxxxxxxxx`

This ensures:
- Each conversation has its own context
- Group chats are isolated from private chats
- Multiple platforms can coexist

## Storage Format

### JSONL Structure

Each session is stored as a JSONL file:
```
sessions/{key}.jsonl
```

Each line contains:
```json
{"type":"metadata","data":{"created_at":1234567890,"updated_at":1234567890}}
{"type":"message","data":{"role":"user","content":"Hello","timestamp":1234567890}}
{"type":"message","data":{"role":"assistant","content":"Hi there!","timestamp":1234567891}}
```

### Advantages of JSONL

- **Append-only**: Easy to add new messages
- **Line-based**: Simple to parse and read
- **Human-readable**: Easy to inspect manually
- **Efficient**: Only read what you need

## Caching Strategy

### Cache Implementation

```typescript
private cache: Map<string, Session>
```

### Cache Behavior

1. **First Access**: Load from disk and cache
2. **Subsequent Access**: Return from cache
3. **Updates**: Update cache and mark for save
4. **Persistence**: Save on explicit `save()` call

### Cache Benefits

- **Performance**: Avoid disk I/O for frequent access
- **Consistency**: Single source of truth in memory
- **Simplicity**: No complex cache invalidation

## Message History Management

### Message Retrieval

```typescript
getMessages(key: string, maxMessages: number = 20): ChatMessage[]
```

- Retrieves last N messages
- Filters out system messages
- Returns in chronological order

### Message Addition

```typescript
addMessage(key: string, role: string, content: string): void
```

- Appends message to session
- Updates timestamp
- Marks session as modified

## Session Lifecycle

### Creation

```typescript
const session = sessionManager.getOrCreate('feishu:oc_xxx')
```

- Check cache first
- Load from disk if not cached
- Create new if doesn't exist

### Usage

```typescript
sessionManager.addMessage('feishu:oc_xxx', 'user', 'Hello')
const history = sessionManager.getMessages('feishu:oc_xxx', 20)
```

- Add messages during conversation
- Retrieve history for context

### Persistence

```typescript
await sessionManager.save(session)
```

- Write to JSONL file
- Update metadata timestamps

### Cleanup

```typescript
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)
```

- Remove sessions older than maxAge
- Free up disk space
- Clear cache entries

## Integration with Agent

### Session Context

The Agent uses session history to provide context:

```typescript
const sessionId = chatType === 'group' ? `feishu:${chatId}` : `feishu:${userId}`
const history = sessionManager.getMessages(sessionId, 20)

const response = await agent.process({
  userMessage: content,
  userId,
  platform: 'feishu',
  messageId,
  sessionId,
  history,
  metadata: { chatId, chatType }
})
```

### Message Saving

After processing, save messages to session:

```typescript
sessionManager.addMessage(sessionId, 'user', context.userMessage)
sessionManager.addMessage(sessionId, 'assistant', finalContent)
await sessionManager.save(sessionManager.getOrCreate(sessionId))
```

## Performance Considerations

### Optimization Strategies

1. **In-Memory Cache**: Fast access for active sessions
2. **Lazy Loading**: Load sessions on demand
3. **Message Limiting**: Limit history size (default 20)
4. **Async Persistence**: Non-blocking saves
5. **Periodic Cleanup**: Remove old sessions

### Memory Usage

- **Cache Size**: Proportional to active sessions
- **Message Limit**: Configurable (default 20)
- **Cleanup**: Automatic based on age

## Security Considerations

### Session Isolation

- Each session is isolated by key
- No cross-session data access
- Platform-based separation

### Data Privacy

- Messages stored locally
- No external transmission
- User-controlled cleanup

## Comparison with nanobot

| Feature | nanobot | minibot |
|---------|----------|----------|
| Storage | JSONL files | JSONL files + Cache |
| Session Key | Custom | Platform:ChatId |
| Message Limit | Configurable | Configurable (20) |
| Cleanup | Manual | Automatic |
| Type Safety | Dynamic | Static (TS) |

## Future Enhancements

### Planned Features

1. **Compression**: Compress old messages
2. **Summarization**: Summarize long conversations
3. **Search**: Search across sessions
4. **Analytics**: Session statistics and insights
5. **Export**: Export sessions to various formats

### Potential Improvements

1. **Database Backend**: Optional SQLite backend
2. **Distributed Storage**: Support for cloud storage
3. **Encryption**: Encrypt sensitive sessions
4. **Backup**: Automatic backup system

## Usage Examples

### Basic Usage

```typescript
import { getSessionManager } from './session'

const sessionManager = getSessionManager()

// Get or create session
const session = sessionManager.getOrCreate('feishu:oc_xxx')

// Add messages
sessionManager.addMessage('feishu:oc_xxx', 'user', 'Hello')
sessionManager.addMessage('feishu:oc_xxx', 'assistant', 'Hi!')

// Get history
const history = sessionManager.getMessages('feishu:oc_xxx', 20)

// Save
await sessionManager.save(session)
```

### Advanced Usage

```typescript
// List all sessions
const sessions = await sessionManager.listSessions()
console.log(`Total sessions: ${sessions.length}`)

// Cleanup old sessions
await sessionManager.cleanup(7 * 24 * 60 * 60 * 1000)

// Clear specific session
sessionManager.clear('feishu:oc_xxx')

// Delete session
await sessionManager.delete('feishu:oc_xxx')
```

## Testing

### Test Scenarios

1. **Session Creation**: Verify new sessions are created
2. **Message Addition**: Test message addition and retrieval
3. **Persistence**: Verify sessions persist across restarts
4. **Cache**: Test cache behavior
5. **Cleanup**: Verify old sessions are removed

### Test Commands

```bash
npm run test:session
```

## Conclusion

The Session module provides a robust, efficient, and type-safe solution for conversation history management. It combines the simplicity of JSONL storage with the performance of in-memory caching, following the proven design patterns from nanobot while adding TypeScript type safety and modern architecture.
