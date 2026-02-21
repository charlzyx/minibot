# Contributing to Minibot

Thank you for your interest in contributing to Minibot! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git

### Setup Development Environment

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/minibot.git
   cd minibot
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Code Style

We use the following conventions:

- **TypeScript**: Strict mode enabled
- **Indentation**: 2 spaces
- **Semicolons**: Required
- **Quotes**: Single quotes for strings, double quotes for JSON

### Type Safety

- Avoid using `any` type
- Define proper interfaces for data structures
- Use type guards for runtime type checking

Example:
```typescript
// Good
interface User {
  id: string
  name: string
  email: string
}

function getUserById(id: string): User | null {
  // ...
}

// Bad
function getUserById(id: any): any {
  // ...
}
```

### Logging

Use the centralized logging system:

```typescript
import { createLogger } from '@/utils'

const logger = createLogger('MyModule')

logger.info('Information message', { data: 'value' })
logger.error('Error message', error)
logger.debug('Debug message')
```

### Error Handling

Use custom error classes:

```typescript
import { ValidationError, LLMError } from '@/errors'

// Throw specific errors
throw new ValidationError('Invalid parameter', { param: 'userId' })
throw new LLMError('API call failed', 'zhipu', { status: 500 })
```

### Testing

Write tests for new functionality:

```typescript
import { describe, it, expect } from 'vitest'
import { myFunction } from '@/module'

describe('myFunction', () => {
  it('should return expected result', () => {
    const result = myFunction('input')
    expect(result).toBe('expected')
  })
})
```

Run tests:
```bash
npm test              # Run all tests
npm run test:unit     # Run unit tests only
npm run test:coverage # Run with coverage report
```

## Making Changes

### Small Changes

For small fixes or improvements:
1. Create a feature branch
2. Make your changes
3. Add tests if applicable
4. Run tests to ensure nothing breaks
5. Commit your changes
6. Push and create a pull request

### Larger Features

For significant new features:
1. Open an issue to discuss the feature first
2. Get feedback from maintainers
3. Implement the feature in a feature branch
4. Write comprehensive tests
5. Update documentation
6. Submit a pull request

## Commit Messages

Follow conventional commits format:

```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(tools): add database tool implementation

fix(session): resolve memory leak in session cache

docs(readme): update installation instructions
```

## Pull Request Process

1. Update the CHANGELOG.md with your changes
2. Ensure all tests pass
3. Update documentation if needed
4. Your PR should have a clear title and description
5. Wait for code review and address feedback

### PR Title Format

```
[Type] Brief description of changes
```

Examples:
```
[Feat] Add support for WeChat integration
[Fix] Resolve session cleanup issue
[Docs] Update API documentation
```

## Project Structure

```
minibot/
├── src/
│   ├── agent/         # Agent core logic
│   ├── channels/      # Messaging platforms
│   ├── commands/      # Command system
│   ├── config/        # Configuration management
│   ├── cron/          # Scheduled tasks
│   ├── errors/        # Custom error classes
│   ├── memory/        # Memory management
│   ├── plugins/       # Plugin system
│   ├── session/       # Session management
│   ├── skills/        # Skills system
│   ├── tools/         # Tool implementations
│   ├── types/         # TypeScript type definitions
│   ├── utils/         # Utility functions
│   └── index.ts       # Main entry point
├── tests/
│   ├── unit/          # Unit tests
│   └── integration/   # Integration tests
└── docs/              # Documentation
```

## Adding New Tools

1. Create tool class extending `ToolBase`:
   ```typescript
   import { ToolBase } from '@/tools/base'
   import type { ToolResult } from '@/types'

   export class MyTool extends ToolBase<Params, Result> {
     readonly name = 'mytool'
     readonly description = 'Tool description'
     readonly parameters = { /* ... */ }

     protected async executeImpl(params: Params, context?: unknown): Promise<Result> {
       // Implementation
     }
   }
   ```

2. Register the tool in `src/tools/index.ts`

3. Add tests in `tests/unit/tools/mytool.test.ts`

4. Update `src/tools/DESIGN.md`

## Adding New Channels

1. Create channel class in `src/channels/`
2. Implement message receiving and sending
3. Integrate with message router
4. Add tests
5. Update documentation

## Questions?

- Open an issue for bugs or feature requests
- Start a discussion for questions
- Check existing issues and discussions

Thank you for contributing to Minibot!
