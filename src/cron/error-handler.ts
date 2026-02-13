/**
 * 错误处理和重试机制
 * 支持任务优先级管理和错误恢复
 */

export interface RetryConfig {
  maxRetries: number
  initialDelay: number
  maxDelay: number
  backoffMultiplier: number
  retryableErrors?: (error: Error) => boolean
}

export interface TaskPriority {
  level: 'critical' | 'high' | 'normal' | 'low'
  weight: number
}

export class ErrorHandler {
  private static readonly DEFAULT_RETRY_CONFIG: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryableErrors: (error: Error) => {
      const retryablePatterns = [
        /ETIMEDOUT/i,
        /ECONNRESET/i,
        /ECONNREFUSED/i,
        /EHOSTUNREACH/i,
        /ENOTFOUND/i,
        /ENETUNREACH/i,
        /EAI_AGAIN/i,
        /EWOULDBLOCK/i,
        /EINTR/i,
        /timeout/i,
        /network/i,
        /temporary/i,
        /rate limit/i,
        /too many requests/i
      ]
      
      return retryablePatterns.some(pattern => pattern.test(error.message))
    }
  }

  private static readonly PRIORITY_WEIGHTS: Record<TaskPriority['level'], number> = {
    critical: 1000,
    high: 100,
    normal: 10,
    low: 1
  }

  static async executeWithRetry<T>(
    fn: () => Promise<T>,
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const finalConfig = { ...this.DEFAULT_RETRY_CONFIG, ...config }
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        
        const shouldRetry = finalConfig.retryableErrors 
          ? finalConfig.retryableErrors(lastError)
          : this.DEFAULT_RETRY_CONFIG.retryableErrors!(lastError)

        if (!shouldRetry || attempt === finalConfig.maxRetries) {
          throw lastError
        }

        const delay = Math.min(
          finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt),
          finalConfig.maxDelay
        )

        await this.sleep(delay)
      }
    }

    throw lastError || new Error('Unknown error')
  }

  static async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
    timeoutError?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) => {
        setTimeout(() => {
          reject(new Error(timeoutError || `Operation timed out after ${timeout}ms`))
        }, timeout)
      })
    ])
  }

  static async executeWithCircuitBreaker<T>(
    fn: () => Promise<T>,
    options: {
      failureThreshold?: number
      recoveryTimeout?: number
      onOpen?: () => void
      onClose?: () => void
    } = {}
  ): Promise<T> {
    const {
      failureThreshold = 5,
      recoveryTimeout = 60000,
      onOpen,
      onClose
    } = options

    let failureCount = 0
    let isOpen = false
    let recoveryTimer: NodeJS.Timeout | null = null

    const resetFailureCount = () => {
      failureCount = 0
      if (recoveryTimer) {
        clearTimeout(recoveryTimer)
        recoveryTimer = null
      }
    }

    return new Promise<T>((resolve, reject) => {
      const execute = async () => {
        if (isOpen) {
          reject(new Error('Circuit breaker is open'))
          return
        }

        try {
          const result = await fn()
          resetFailureCount()
          
          if (isOpen) {
            isOpen = false
            onClose?.()
          }
          
          resolve(result)
        } catch (error) {
          failureCount++
          
          if (failureCount >= failureThreshold) {
            isOpen = true
            onOpen?.()
            
            if (recoveryTimer) {
              clearTimeout(recoveryTimer)
            }
            
            recoveryTimer = setTimeout(() => {
              isOpen = false
              resetFailureCount()
              onClose?.()
              execute()
            }, recoveryTimeout)
          } else {
            execute()
          }
        }
      }

      execute()
    })
  }

  static getPriority(level: TaskPriority['level']): TaskPriority {
    return {
      level,
      weight: this.PRIORITY_WEIGHTS[level]
    }
  }

  static comparePriorities(a: TaskPriority, b: TaskPriority): number {
    return b.weight - a.weight
  }

  static sortPriorities<T extends { priority: TaskPriority }>(
    items: T[]
  ): T[] {
    return [...items].sort((a, b) => this.comparePriorities(a.priority, b.priority))
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  static classifyError(error: Error): {
    type: 'network' | 'timeout' | 'permission' | 'not_found' | 'validation' | 'runtime' | 'unknown'
    severity: 'critical' | 'high' | 'medium' | 'low'
    retryable: boolean
  } {
    const message = error.message.toLowerCase()

    let type: 'network' | 'timeout' | 'permission' | 'not_found' | 'validation' | 'runtime' | 'unknown' = 'unknown'
    let severity: 'critical' | 'high' | 'medium' | 'low' = 'medium'
    let retryable = false

    if (/network|connection|socket|dns|econn|eaddr/i.test(message)) {
      type = 'network'
      severity = 'high'
      retryable = true
    } else if (/timeout|timed out/i.test(message)) {
      type = 'timeout'
      severity = 'medium'
      retryable = true
    } else if (/permission|access|denied|forbidden|unauthorized/i.test(message)) {
      type = 'permission'
      severity = 'critical'
      retryable = false
    } else if (/not found|no such|does not exist|enoent/i.test(message)) {
      type = 'not_found'
      severity = 'high'
      retryable = false
    } else if (/validation|invalid|malformed|bad request/i.test(message)) {
      type = 'validation'
      severity = 'medium'
      retryable = false
    } else if (/runtime|execution|exception|error/i.test(message)) {
      type = 'runtime'
      severity = 'high'
      retryable = true
    }

    return { type, severity, retryable }
  }

  static createErrorLog(error: Error, context?: Record<string, any>): {
    timestamp: string
    error: string
    type: string
    severity: string
    retryable: boolean
    context?: Record<string, any>
  } {
    const classification = this.classifyError(error)
    
    return {
      timestamp: new Date().toISOString(),
      error: error.message,
      type: classification.type,
      severity: classification.severity,
      retryable: classification.retryable,
      context
    }
  }
}
