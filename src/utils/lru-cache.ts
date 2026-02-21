/**
 * LRU (Least Recently Used) Cache implementation
 */

export interface LRUCacheOptions<K, V> {
  maxSize: number
  ttl?: number
  onEvict?: (key: K, value: V) => void
}

export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; timestamp: number }>()
  private readonly maxSize: number
  private readonly ttl: number | undefined
  private readonly onEvict: ((key: K, value: V) => void) | undefined

  constructor(options: LRUCacheOptions<K, V>) {
    this.maxSize = options.maxSize
    this.ttl = options.ttl
    this.onEvict = options.onEvict
  }

  /**
   * Get a value from the cache
   */
  get(key: K): V | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      return undefined
    }

    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return undefined
    }

    // Move to end (most recently used)
    this.cache.delete(key)
    this.cache.set(key, entry)

    return entry.value
  }

  /**
   * Set a value in the cache
   */
  set(key: K, value: V): void {
    // Delete existing key to update position
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }

    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey !== undefined) {
        this.delete(firstKey)
      }
    }

    this.cache.set(key, { value, timestamp: Date.now() })
  }

  /**
   * Delete a key from the cache
   */
  delete(key: K): boolean {
    const entry = this.cache.get(key)
    const deleted = this.cache.delete(key)

    if (deleted && entry && this.onEvict) {
      this.onEvict(key, entry.value)
    }

    return deleted
  }

  /**
   * Check if a key exists
   */
  has(key: K): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false

    // Check TTL
    if (this.ttl && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key)
      return false
    }

    return true
  }

  /**
   * Clear all entries
   */
  clear(): void {
    if (this.onEvict) {
      for (const [key, entry] of this.cache.entries()) {
        this.onEvict(key, entry.value)
      }
    }
    this.cache.clear()
  }

  /**
   * Get cache size
   */
  get size(): number {
    return this.cache.size
  }

  /**
   * Get all keys
   */
  keys(): K[] {
    return Array.from(this.cache.keys())
  }

  /**
   * Get all values
   */
  values(): V[] {
    return Array.from(this.cache.values()).map(entry => entry.value)
  }

  /**
   * Get all entries
   */
  entries(): [K, V][] {
    return Array.from(this.cache.entries()).map(([key, entry]) => [key, entry.value])
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    if (!this.ttl) return 0

    const now = Date.now()
    let removed = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.delete(key)
        removed++
      }
    }

    return removed
  }
}
