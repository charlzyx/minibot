/**
 * Async utility functions for Minibot
 */

/**
 * Sleep for a specified duration
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number
    baseDelay?: number
    maxDelay?: number
    backoffMultiplier?: number
    shouldRetry?: (error: unknown) => boolean
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    shouldRetry = () => true
  } = options

  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === maxAttempts || !shouldRetry(error)) {
        throw error
      }

      const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay)
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Execute multiple promises concurrently with a limit
 */
export async function parallel<T, R>(
  items: T[],
  fn: (item: T, index: number) => Promise<R>,
  limit: number = 5
): Promise<R[]> {
  const results: R[] = []
  const executing: Promise<void>[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const promise = fn(item, i).then(result => {
      results[i] = result
    })

    executing.push(promise)

    if (executing.length >= limit) {
      await Promise.race(executing)
      executing.splice(
        executing.findIndex(p => p === promise),
        1
      )
    }
  }

  await Promise.all(executing)
  return results
}

/**
 * Timeout a promise
 */
export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutError = new Error('Operation timed out')
): Promise<T> {
  return Promise.race([
    promise,
    sleep(timeoutMs).then(() => {
      throw timeoutError
    })
  ])
}

/**
 * Create a debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      fn(...args)
      timeoutId = null
    }, delay)
  }
}

/**
 * Create a throttled function
 */
export function throttle<T extends (...args: any[]) => any>(
  fn: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false

  return function (...args: Parameters<T>) {
    if (!inThrottle) {
      fn(...args)
      inThrottle = true
      setTimeout(() => {
        inThrottle = false
      }, limit)
    }
  }
}

/**
 * Create a memoized function
 */
export function memoize<T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T {
  const cache = new Map<string, ReturnType<T>>()

  return function (...args: Parameters<T>): ReturnType<T> {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)

    if (!cache.has(key)) {
      cache.set(key, fn(...args))
    }

    return cache.get(key)!
  }
}

/**
 * Poll until a condition is met
 */
export async function poll(
  condition: () => boolean | Promise<boolean>,
  options: {
    interval?: number
    timeout?: number
    timeoutMessage?: string
  } = {}
): Promise<void> {
  const {
    interval = 1000,
    timeout = 30000,
    timeoutMessage = 'Polling timed out'
  } = options

  const startTime = Date.now()

  while (true) {
    if (await condition()) {
      return
    }

    if (Date.now() - startTime > timeout) {
      throw new Error(timeoutMessage)
    }

    await sleep(interval)
  }
}

/**
 * Batch an array of items
 */
export function batch<T>(
  items: T[],
  batchSize: number
): T[][] {
  const batches: T[][] = []

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize))
  }

  return batches
}

/**
 * Create a simple queue
 */
export class Queue<T> {
  private items: T[] = []

  enqueue(item: T): void {
    this.items.push(item)
  }

  dequeue(): T | undefined {
    return this.items.shift()
  }

  peek(): T | undefined {
    return this.items[0]
  }

  get size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  clear(): void {
    this.items = []
  }

  toArray(): T[] {
    return [...this.items]
  }
}

/**
 * Create a stack
 */
export class Stack<T> {
  private items: T[] = []

  push(item: T): void {
    this.items.push(item)
  }

  pop(): T | undefined {
    return this.items.pop()
  }

  peek(): T | undefined {
    return this.items[this.items.length - 1]
  }

  get size(): number {
    return this.items.length
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  clear(): void {
    this.items = []
  }

  toArray(): T[] {
    return [...this.items]
  }
}
