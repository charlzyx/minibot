# Changelog

All notable changes to Minibot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-02-21

### Major Refactoring

This release includes a comprehensive refactoring of the codebase to improve type safety, security, and maintainability.

### Added

- **Type System**
  - Centralized type definitions in `src/types/index.ts`
  - Strict TypeScript configuration with path aliases
  - Type-safe tool interfaces and parameters
  - Added `FeishuMessage`, `PluginMetadata`, `PluginConfig` types

- **Error Handling**
  - Custom error class hierarchy (`MinibotError`, `ValidationError`, `ToolExecutionError`, `LLMError`, `SecurityError`, etc.)
  - Centralized error handler with retry detection
  - Consistent error formatting

- **Logging System**
  - Enhanced `pino`-based logging with context support
  - `ContextLogger` class for module-specific logging
  - Dual output: console (pretty) + file (JSON)
  - Replaced all `console.log` calls with structured logging

- **Tool System**
  - Abstract `ToolBase` class for consistent tool implementation
  - `ToolRegistry` for centralized tool management
  - Built-in parameter validation and error handling
  - Type-safe tool definitions

- **Caching**
  - `LRUCache` implementation with TTL support
  - Session manager now uses LRU cache with auto-save on eviction
  - Configurable cache size via `MAX_SESSION_CACHE` env var

- **Security**
  - Shell tool command whitelist validation
  - Dangerous pattern detection (fork bombs, privilege escalation, etc.)
  - File tool path traversal protection
  - Web tool URL validation and response size limits

- **Testing Infrastructure**
  - Vitest configuration with coverage reporting
  - Unit tests for LRU cache, Shell tool, File tool
  - Unit tests for Session, Memory, and Commands modules
  - Test directory structure (`tests/unit/`, `tests/integration/`)

- **Documentation**
  - CONTRIBUTING.md with contribution guidelines
  - Enhanced code documentation with JSDoc comments
  - Type definitions for all major modules

### Changed

- **Breaking Changes**
  - Tool execution now returns `ToolResult<T>` with `{ success, data, error, timestamp }`
  - Session manager uses LRU cache instead of unlimited Map
  - Logger import changed to `createLogger` from `@/utils`
  - Tool base class requires extending `ToolBase<TParams, TResult>`

- **Agent Module**
  - Replaced all `console.log` with structured logging
  - Improved error handling with custom error types
  - Better context tracking throughout message processing

- **Session Module**
  - Implemented LRU cache with configurable max size
  - Added TTL-based session expiration (30 minutes default)
  - Auto-save sessions on cache eviction
  - Added `getCacheStats()` method

- **Tools**
  - All tools now extend `ToolBase` class
  - Consistent parameter validation
  - Standardized error handling
  - Type-safe return values

- **Memory Module**
  - Added `MemoryError` for proper error handling
  - Structured logging throughout
  - Input validation for empty content
  - Type-safe interfaces

- **Config Module**
  - Replaced `console.log/warn` with structured logging
  - Removed `any` types
  - Added `ConfigurationError` usage
  - DEFAULT_CONFIG constant with proper typing

- **Commands Module**
  - Added `CommandContext` interface for type safety
  - Structured logging
  - Better error formatting
  - Type-safe command execution

- **Feishu Channel**
  - Created `MessageDeduplicator` class with TTL (5 minutes)
  - Created `MessageQueue` class for batched processing
  - Replaced all `console.log` with structured logging
  - Improved code structure and type safety

- **Plugins Module**
  - Replaced all `console.log/error` with structured logging
  - Added proper type imports from `@/types`
  - Added `getStats()` method for plugin statistics
  - Improved error handling with detailed logging

- **Cron Module**
  - Replaced all `console.log` with structured logging
  - Simplified `CronJob` interface to match types in `@/types`
  - Better error tracking with `errorCount` field
  - Improved job execution logging

### Fixed

- Memory leak in session manager (unlimited cache growth)
- Missing input validation in shell tool
- Path traversal vulnerability in file tool
- Inconsistent error handling across modules
- Missing timeout handling in web requests

### Security

- Shell command whitelist to prevent arbitrary command execution
- Dangerous pattern detection (sudo, eval, fork bombs, etc.)
- Path traversal protection in file operations
- URL validation and response size limits in web tool
- Production mode blocks access to internal network addresses

### Performance

- LRU cache prevents unbounded memory growth
- Lazy loading of sessions from disk
- Connection pooling considerations for future improvements

### Developer Experience

- Path aliases (`@/types`, `@/utils`) for cleaner imports
- Strict TypeScript mode catches more errors at compile time
- Comprehensive test coverage for critical components
- Clear contribution guidelines

### Removed

- **NanoClaw References**
  - Removed hardcoded NanoClaw references from `/code` command
  - Changed command description from "学习 NanoClaw 并在容器中运行" to "启动代码助手并在容器中执行任务"
  - Updated documentation to remove NanoClaw-specific examples
  - Project structure no longer includes `nanoclaw/` directory reference

### Migration Guide

#### Tool Development

Old way:
```typescript
export class MyTool {
  async execute(params: any) {
    // ...
  }
}
```

New way:
```typescript
import { ToolBase } from '@/tools/base'
import type { ToolResult } from '@/types'

export class MyTool extends ToolBase<{ param: string }, string> {
  readonly name = 'mytool'
  readonly description = 'My tool description'
  readonly parameters = {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter' }
    },
    required: ['param']
  } as const

  protected async executeImpl(params: { param: string }): Promise<string> {
    return params.param
  }
}
```

#### Logging

Old way:
```typescript
console.log('Processing message')
console.error('Error occurred', error)
```

New way:
```typescript
import { createLogger } from '@/utils'

const logger = createLogger('MyModule')
logger.info('Processing message')
logger.error('Error occurred', error)
```

#### Error Handling

Old way:
```typescript
throw new Error('Something went wrong')
```

New way:
```typescript
import { ValidationError } from '@/errors'

throw new ValidationError('Invalid parameter', { param: 'userId' })
```

## [1.0.0] - Previous Release

### Features

- Multi-platform messaging (Feishu, WeChat, DingTalk, QQ, Discord, Slack)
- LLM integration (Zhipu, OpenAI, DeepSeek, Dashscope, Qwen)
- Tool system (File, Shell, Web, LLM, Memory)
- Session and memory management
- Scheduled tasks with cron expressions
- Skill and plugin systems
- NanoClaw integration

### Architecture

- Hono framework for HTTP/WebSocket
- SQLite + Markdown hybrid storage
- JSONL-based session persistence
- Container-based execution environment

[2.0.0]: https://github.com/charlzyx/minibot/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/charlzyx/minibot/releases/tag/v1.0.0
