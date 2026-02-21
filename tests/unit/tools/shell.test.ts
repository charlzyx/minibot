import { describe, it, expect, beforeEach } from 'vitest'
import { ShellTool } from '@/tools/shell'
import { SecurityError } from '@/errors'

describe('ShellTool', () => {
  let shellTool: ShellTool

  beforeEach(() => {
    shellTool = new ShellTool(['echo', 'ls', 'pwd', 'cat', 'grep'])
  })

  describe('command validation', () => {
    it('should allow whitelisted commands', async () => {
      const result = await shellTool.execute({ command: 'echo', args: ['hello'] })
      expect(result.success).toBe(true)
      expect(result.data?.stdout).toContain('hello')
    })

    it('should reject non-whitelisted commands', async () => {
      const result = await shellTool.execute({ command: 'rm', args: ['-rf', '/'] })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not allowed')
    })

    it('should reject dangerous patterns', async () => {
      const result = await shellTool.execute({
        command: 'sudo',
        args: ['ls']
      })
      expect(result.success).toBe(false)
    })
  })

  describe('command execution', () => {
    it('should execute simple commands', async () => {
      const result = await shellTool.execute({ command: 'echo', args: ['test'] })
      expect(result.success).toBe(true)
      expect(result.data?.stdout).toBe('test')
    })

    it('should handle command failures', async () => {
      const result = await shellTool.execute({
        command: 'ls',
        args: ['/nonexistent/path/that/does/not/exist']
      })
      expect(result.success).toBe(true)
      expect(result.data?.code).toBeGreaterThan(0)
    })

    it('should support custom working directory', async () => {
      const result = await shellTool.execute({
        command: 'pwd',
        args: [],
        cwd: '/tmp'
      })
      expect(result.success).toBe(true)
      expect(result.data?.stdout).toContain('/tmp')
    })

    it('should support timeout', async () => {
      const result = await shellTool.execute({
        command: 'sleep',
        args: ['10'],
        timeout: 100
      })
      // Should timeout and return an error
      expect(result.success).toBe(false)
    }, 10000)
  })

  describe('result format', () => {
    it('should return formatted results', async () => {
      const result = await shellTool.execute({ command: 'echo', args: ['test'] })
      expect(result).toMatchObject({
        success: true,
        timestamp: expect.any(Number)
      })
    })
  })
})
