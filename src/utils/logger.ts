import pino from 'pino'
import path from 'path'

const logDir = process.env.LOG_DIR || '/tmp/minibot-logs'

const baseLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
          singleLine: false
        }
      },
      {
        target: 'pino/file',
        options: {
          destination: path.join(logDir, 'app.log'),
          mkdir: true
        }
      }
    ]
  }
})

export { baseLogger as logger }

/**
 * Context-aware logger for structured logging
 */
export class ContextLogger {
  constructor(private readonly context: string) {}

  private formatMessage(message: string, data?: Record<string, unknown>): object {
    return {
      context: this.context,
      ...data,
      msg: message
    }
  }

  info(message: string, data?: Record<string, unknown>): void {
    baseLogger.info(this.formatMessage(message, data))
  }

  error(message: string, error?: Error | unknown, data?: Record<string, unknown>): void {
    baseLogger.error(
      this.formatMessage(message, {
        ...data,
        error: error instanceof Error ? {
          name: error.name,
          message: error.message,
          stack: error.stack
        } : error
      })
    )
  }

  warn(message: string, data?: Record<string, unknown>): void {
    baseLogger.warn(this.formatMessage(message, data))
  }

  debug(message: string, data?: Record<string, unknown>): void {
    baseLogger.debug(this.formatMessage(message, data))
  }

  trace(message: string, data?: Record<string, unknown>): void {
    baseLogger.trace(this.formatMessage(message, data))
  }
}

/**
 * Create a new context logger
 */
export function createLogger(context: string): ContextLogger {
  return new ContextLogger(context)
}
