/**
 * Custom error classes for Minibot
 *
 * Enhanced with error classification, retry mechanisms, and recovery strategies.
 * Inspired by nanoclaw's error handling implementation.
 */

export enum ErrorCategory {
  // Transient errors that can be retried
  NETWORK = 'network',
  TIMEOUT = 'timeout',
  RATE_LIMIT = 'rate_limit',
  TEMPORARY = 'temporary',

  // Permanent errors that should not be retried
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  VALIDATION = 'validation',
  NOT_FOUND = 'not_found',

  // Container-specific errors
  CONTAINER_START_FAILED = 'container_start_failed',
  CONTAINER_TIMEOUT = 'container_timeout',
  CONTAINER_OOM = 'container_oom',

  // Unknown errors
  UNKNOWN = 'unknown'
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorHandlerConfig {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffMultiplier: number
}

const DEFAULT_ERROR_HANDLER_CONFIG: ErrorHandlerConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2
}

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
        ...(details ? { details } : {})
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
      { sessionId, ...(details ? { details } : {}) }
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
      { provider, ...(details ? { details } : {}) }
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
      'TIMEOUT_ERROR',
      'CONTAINER_TIMEOUT'
    ]
    return retryableCodes.includes(error.code)
  }

  /**
   * Classify an error based on its code and message
   */
  static classify(error: MinibotError): { category: ErrorCategory; severity: ErrorSeverity } {
    const codeToCategory: Record<string, { category: ErrorCategory; severity: ErrorSeverity }> = {
      'VALIDATION_ERROR': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.LOW },
      'TOOL_EXECUTION_ERROR': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
      'CONFIGURATION_ERROR': { category: ErrorCategory.VALIDATION, severity: ErrorSeverity.HIGH },
      'SESSION_ERROR': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
      'MEMORY_ERROR': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
      'SECURITY_ERROR': { category: ErrorCategory.AUTHORIZATION, severity: ErrorSeverity.HIGH },
      'LLM_ERROR': { category: ErrorCategory.TEMPORARY, severity: ErrorSeverity.MEDIUM },
      'NETWORK_ERROR': { category: ErrorCategory.NETWORK, severity: ErrorSeverity.MEDIUM },
      'TIMEOUT_ERROR': { category: ErrorCategory.TIMEOUT, severity: ErrorSeverity.MEDIUM },
      'UNKNOWN_ERROR': { category: ErrorCategory.UNKNOWN, severity: ErrorSeverity.MEDIUM }
    }

    const result = codeToCategory[error.code] || {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM
    }

    // Check for container-specific errors in the message
    if (error.message.includes('Container start failed') || error.message.includes('Docker is not installed')) {
      return { category: ErrorCategory.CONTAINER_START_FAILED, severity: ErrorSeverity.HIGH }
    }
    if (error.message.includes('Container execution timeout')) {
      return { category: ErrorCategory.CONTAINER_TIMEOUT, severity: ErrorSeverity.MEDIUM }
    }
    if (error.message.includes('OOM') || error.message.includes('Out of memory')) {
      return { category: ErrorCategory.CONTAINER_OOM, severity: ErrorSeverity.HIGH }
    }

    return result
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  static calculateRetryDelay(
    retryCount: number,
    config: ErrorHandlerConfig = DEFAULT_ERROR_HANDLER_CONFIG
  ): number {
    const delay = Math.min(
      config.baseDelay * Math.pow(config.backoffMultiplier, retryCount),
      config.maxDelay
    )

    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.3 * delay
    return Math.floor(delay + jitter)
  }

  /**
   * Execute a function with retry logic
   */
  static async withRetry<T>(
    fn: () => Promise<T>,
    context?: string,
    config: ErrorHandlerConfig = DEFAULT_ERROR_HANDLER_CONFIG
  ): Promise<T> {
    let retryCount = 0
    let lastError: MinibotError | null = null

    while (retryCount <= config.maxRetries) {
      try {
        return await fn()
      } catch (error) {
        lastError = this.handle(error, context || 'withRetry')

        if (!this.isRetryable(lastError) || retryCount >= config.maxRetries) {
          throw lastError
        }

        const delay = this.calculateRetryDelay(retryCount, config)
        await new Promise(resolve => setTimeout(resolve, delay))
        retryCount++
      }
    }

    throw lastError
  }

  /**
   * Get priority for error handling
   */
  static getPriority(error: MinibotError): number {
    const { severity } = this.classify(error)

    switch (severity) {
      case ErrorSeverity.CRITICAL:
        return 10
      case ErrorSeverity.HIGH:
        return 8
      case ErrorSeverity.MEDIUM:
        return 5
      case ErrorSeverity.LOW:
        return 1
      default:
        return 5
    }
  }

  /**
   * Get user-friendly error message
   */
  static getUserMessage(error: MinibotError): string {
    const { category } = this.classify(error)

    switch (category) {
      case ErrorCategory.NETWORK:
        return `网络错误: ${error.message}`
      case ErrorCategory.TIMEOUT:
        return `请求超时，请稍后重试`
      case ErrorCategory.RATE_LIMIT:
        return `请求过于频繁，请稍后再试`
      case ErrorCategory.AUTHENTICATION:
        return `认证失败，请检查 API 密钥`
      case ErrorCategory.AUTHORIZATION:
        return `权限不足`
      case ErrorCategory.VALIDATION:
        return `输入验证失败: ${error.message}`
      case ErrorCategory.NOT_FOUND:
        return `资源未找到: ${error.message}`
      case ErrorCategory.CONTAINER_START_FAILED:
        return `容器启动失败: ${error.message}`
      case ErrorCategory.CONTAINER_TIMEOUT:
        return `容器执行超时`
      case ErrorCategory.CONTAINER_OOM:
        return `容器内存不足`
      default:
        return error.message
    }
  }
}
