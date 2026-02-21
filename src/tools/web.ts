import type { HttpMethod, WebRequestOptions, WebResult, ToolResult } from '@/types'
import { ToolBase } from './base'
import { createLogger } from '@/utils'

const logger = createLogger('WebTool')

/**
 * Default request timeout
 */
const DEFAULT_TIMEOUT = 30000

/**
 * Maximum response size (10MB)
 */
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024

/**
 * Web tool for making HTTP requests
 */
export class WebTool extends ToolBase<
  { url: string; method?: HttpMethod; headers?: Record<string, string>; body?: unknown; timeout?: number },
  WebResult
> {
  readonly name = 'web'
  readonly description = 'Make HTTP requests (GET, POST, PUT, DELETE, PATCH)'
  readonly parameters = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'The URL to request'
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
        description: 'HTTP method'
      },
      headers: {
        type: 'object',
        description: 'Request headers'
      },
      body: {
        type: 'string',
        description: 'Request body (for POST, PUT, PATCH)'
      },
      timeout: {
        type: 'number',
        description: 'Timeout in milliseconds'
      }
    },
    required: ['url']
  } as const

  /**
   * Validate URL
   */
  private validateUrl(url: string): void {
    try {
      const parsed = new URL(url)

      // Only allow http and https protocols
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error(`Unsupported protocol: ${parsed.protocol}`)
      }

      // Block private/local network addresses in production
      if (process.env.NODE_ENV === 'production') {
        const hostname = parsed.hostname
        const blockedPatterns = [
          /^localhost$/,
          /^127\.\d+\.\d+\.\d+$/,
          /^10\.\d+\.\d+\.\d+$/,
          /^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/,
          /^192\.168\.\d+\.\d+$/,
          /^::1$/,
          /^fe80:/i
        ]

        for (const pattern of blockedPatterns) {
          if (pattern.test(hostname)) {
            throw new Error(`Blocked hostname: ${hostname}`)
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('Unsupported protocol')) {
        throw error
      }
      throw new Error(`Invalid URL: ${url}`)
    }
  }

  /**
   * Execute HTTP request
   */
  protected async executeImpl(
    params: { url: string; method?: HttpMethod; headers?: Record<string, string>; body?: unknown; timeout?: number },
    context?: unknown
  ): Promise<WebResult> {
    const { url, method = 'GET', headers = {}, body, timeout = DEFAULT_TIMEOUT } = params

    // Validate URL
    this.validateUrl(url)

    logger.info(`HTTP ${method} request`, { url, timeout })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'Minibot/1.0.0',
        ...headers
      }

      // Set Content-Type for POST/PUT/PATCH if body exists
      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        requestHeaders['Content-Type'] = requestHeaders['Content-Type'] || 'application/json'
      }

      const response = await fetch(url, {
        method,
        headers: requestHeaders,
        body: ['POST', 'PUT', 'PATCH'].includes(method) && body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      })

      // Check response size
      const contentLength = response.headers.get('content-length')
      if (contentLength && parseInt(contentLength) > MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large: ${contentLength} bytes`)
      }

      // Get response text
      const responseText = await response.text()

      // Check size after receiving
      if (responseText.length > MAX_RESPONSE_SIZE) {
        throw new Error(`Response too large: ${responseText.length} bytes`)
      }

      // Try to parse as JSON
      let data: unknown
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        try {
          data = JSON.parse(responseText)
        } catch {
          data = responseText
        }
      } else {
        data = responseText
      }

      // Collect headers
      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      const result: WebResult = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        data
      }

      logger.info(`HTTP ${method} response`, {
        url,
        status: response.status,
        statusText: response.statusText
      })

      return result
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`)
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
}

// Export singleton instance
export const webTool = new WebTool()

export default webTool
