import type { BaseTool, ToolExecutionContext, ToolParameterSchema, ToolResult } from '@/types'
import { ToolExecutionError, createLogger } from '@/utils'

const logger = createLogger('BaseTool')

/**
 * Abstract base class for all tools
 */
export abstract class ToolBase<TParams = unknown, TResult = unknown> implements BaseTool<TParams, TResult> {
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly parameters: ToolParameterSchema

  /**
   * Execute the tool with error handling
   */
  async execute(params: TParams, context?: ToolExecutionContext): Promise<ToolResult<TResult>> {
    const startTime = Date.now()

    try {
      logger.debug(`Executing tool: ${this.name}`, { params, context })

      // Validate parameters
      await this.validateParams(params)

      // Execute the tool
      const result = await this.executeImpl(params, context)

      const duration = Date.now() - startTime
      logger.info(`Tool ${this.name} completed`, { duration })

      return {
        success: true,
        data: result,
        timestamp: Date.now()
      }
    } catch (error) {
      const duration = Date.now() - startTime

      logger.error(`Tool ${this.name} failed`, error, { params, context, duration })

      if (error instanceof ToolExecutionError) {
        return {
          success: false,
          error: error.message,
          timestamp: Date.now()
        }
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now()
      }
    }
  }

  /**
   * Validate parameters before execution
   */
  protected async validateParams(params: TParams): Promise<void> {
    const required = this.parameters.required || []
    const properties = (this.parameters.properties || {}) as Record<string, unknown>

    for (const field of required) {
      if (!(field in params) || params[field as keyof TParams] === undefined) {
        throw new ToolExecutionError(
          this.name,
          new Error(`Missing required parameter: ${field}`),
          { params }
        )
      }
    }

    // Type validation for known types
    if (properties && typeof params === 'object') {
      for (const [key, schema] of Object.entries(properties)) {
        const value = params[key as keyof TParams]
        if (value !== undefined) {
          this.validateType(key, value, schema as Record<string, unknown>)
        }
      }
    }
  }

  /**
   * Validate a single parameter type
   */
  private validateType(key: string, value: unknown, schema: Record<string, unknown>): void {
    const type = schema.type as string

    switch (type) {
      case 'string':
        if (typeof value !== 'string') {
          throw new ToolExecutionError(
            this.name,
            new Error(`Parameter ${key} must be a string`)
          )
        }
        break

      case 'number':
        if (typeof value !== 'number') {
          throw new ToolExecutionError(
            this.name,
            new Error(`Parameter ${key} must be a number`)
          )
        }
        break

      case 'boolean':
        if (typeof value !== 'boolean') {
          throw new ToolExecutionError(
            this.name,
            new Error(`Parameter ${key} must be a boolean`)
          )
        }
        break

      case 'array':
        if (!Array.isArray(value)) {
          throw new ToolExecutionError(
            this.name,
            new Error(`Parameter ${key} must be an array`)
          )
        }
        break

      case 'object':
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          throw new ToolExecutionError(
            this.name,
            new Error(`Parameter ${key} must be an object`)
          )
        }
        break
    }

    // Validate enum values
    if (schema.enum && Array.isArray(schema.enum)) {
      if (!schema.enum.includes(value)) {
        throw new ToolExecutionError(
          this.name,
          new Error(`Parameter ${key} must be one of: ${schema.enum.join(', ')}`)
        )
      }
    }
  }

  /**
   * Implementation of the tool logic - must be implemented by subclasses
   */
  protected abstract executeImpl(params: TParams, context?: ToolExecutionContext): Promise<TResult>
}
