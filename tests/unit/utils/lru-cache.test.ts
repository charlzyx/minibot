import { describe, it, expect, beforeEach } from 'vitest'
import { LRUCache } from '@/utils/lru-cache'

describe('LRUCache', () => {
  let cache: LRUCache<string, number>

  beforeEach(() => {
    cache = new LRUCache({
      maxSize: 3,
      ttl: 1000
    })
  })

  describe('basic operations', () => {
    it('should store and retrieve values', () => {
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)
    })

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should have correct size', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.size).toBe(2)
    })

    it('should clear all entries', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.clear()
      expect(cache.size).toBe(0)
      expect(cache.get('a')).toBeUndefined()
    })

    it('should check if key exists', () => {
      cache.set('a', 1)
      expect(cache.has('a')).toBe(true)
      expect(cache.has('b')).toBe(false)
    })

    it('should delete entries', () => {
      cache.set('a', 1)
      expect(cache.delete('a')).toBe(true)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.delete('a')).toBe(false)
    })
  })

  describe('LRU eviction', () => {
    it('should evict oldest entry when at capacity', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.set('d', 4) // Should evict 'a'

      expect(cache.size).toBe(3)
      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBe(2)
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })

    it('should update position on get', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)
      cache.get('a') // Move 'a' to most recent
      cache.set('d', 4) // Should evict 'b'

      expect(cache.get('a')).toBe(1)
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBe(3)
      expect(cache.get('d')).toBe(4)
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      cache.set('a', 1)
      expect(cache.get('a')).toBe(1)

      await new Promise(resolve => setTimeout(resolve, 1100))

      expect(cache.get('a')).toBeUndefined()
    })

    it('should cleanup expired entries', async () => {
      cache.set('a', 1)
      cache.set('b', 2)

      await new Promise(resolve => setTimeout(resolve, 1100))

      const removed = cache.cleanup()
      expect(removed).toBe(2)
      expect(cache.size).toBe(0)
    })
  })

  describe('utility methods', () => {
    it('should get all keys', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.keys()).toEqual(expect.arrayContaining(['a', 'b']))
    })

    it('should get all values', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      expect(cache.values()).toEqual(expect.arrayContaining([1, 2]))
    })

    it('should get all entries', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      const entries = cache.entries()
      expect(entries).toEqual(expect.arrayContaining([['a', 1], ['b', 2]]))
    })
  })

  describe('eviction callback', () => {
    it('should call onEvict callback', () => {
      const evicted: Array<[string, number]> = []
      const testCache = new LRUCache<string, number>({
        maxSize: 2,
        onEvict: (key, value) => {
          evicted.push([key, value])
        }
      })

      testCache.set('a', 1)
      testCache.set('b', 2)
      testCache.set('c', 3) // Should evict 'a'

      expect(evicted).toEqual([['a', 1]])

      testCache.delete('b')
      expect(evicted).toEqual([['a', 1], ['b', 2]])

      testCache.clear()
      expect(evicted).toEqual([['a', 1], ['b', 2], ['c', 3]])
    })
  })
})
