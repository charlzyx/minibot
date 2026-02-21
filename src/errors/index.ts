/**
 * Custom error classes for Minibot
 */

export class MinibotError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown
  ) {
    super(message)
    this.name = 'MinibotError'
    Error.captureStackTrace(this, this.constructor)
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      statusCode: this.statusCode,
      details: this.details
    }
  }
}

export class ValidationError extends MinibotError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400, details)
    this.name = 'ValidationError'
  }
}

export class ToolExecutionError extends MinibotError {
  constructor(
    toolName: string,
    originalError: Error | unknown,
    details?: unknown
  ) {
    super(
      `Tool execution failed: ${toolName}`,
      'TOOL_EXECUTION_ERROR',
      500,
      {
        toolName,
        originalError: originalError instanceof Error ? {
          name: originalError.name,
          message: originalError.message,
          stack: originalError.stack
        } : originalError,
        ...details
      }
    )
    this.name = 'ToolExecutionError'
  }
}

export class ConfigurationError extends MinibotError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIGURATION_ERROR', 500, details)
    this.name = 'ConfigurationError'
  }
}

export class SessionError extends MinibotError {
  constructor(message: string, sessionId?: string, details?: unknown) {
    super(
      message,
      'SESSION_ERROR',
      500,
      { sessionId, ...details }
    )
    this.name = 'SessionError'
  }
}

export class MemoryError extends MinibotError {
  constructor(message: string, details?: unknown) {
    super(message, 'MEMORY_ERROR', 500, details)
    this.name = 'MemoryError'
  }
}

export class SecurityError extends MinibotError {
  constructor(message: string, details?: unknown) {
    super(message, 'SECURITY_ERROR', 403, details)
    this.name = 'SecurityError'
  }
}

export class LLMError extends MinibotError {
  constructor(
    message: string,
    provider: string,
    details?: unknown
  ) {
    super(
      message,
      'LLM_ERROR',
      500,
      { provider, ...details }
    )
    this.name = 'LLMError'
  }
}

/**
 * Error handler utility
 */
export class ErrorHandler {
  static handle(error: unknown, context: string): MinibotError {
    if (error instanceof MinibotError) {
      return error
    }

    if (error instanceof Error) {
      return new MinibotError(
        error.message,
        'UNKNOWN_ERROR',
        500,
        { originalError: error.name, context }
      )
    }

    return new MinibotError(
      String(error),
      'UNKNOWN_ERROR',
      500,
      { context }
    )
  }

  static isRetryable(error: MinibotError): boolean {
    const retryableCodes = [
      'LLM_ERROR',
      'NETWORK_ERROR',
      'TIMEOUT_ERROR'
    ]
    return retryableCodes.includes(error.code)
  }
}
