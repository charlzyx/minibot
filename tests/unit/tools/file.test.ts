import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { FileTool } from '@/tools/file'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'

describe('FileTool', () => {
  let fileTool: FileTool
  let testDir: string

  beforeEach(async () => {
    fileTool = new FileTool()
    testDir = `/tmp/minibot-test-${Date.now()}`
    await mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true })
  })

  describe('write operation', () => {
    it('should write a file', async () => {
      const result = await fileTool.execute({
        action: 'write',
        path: join(testDir, 'test.txt'),
        content: 'Hello, World!',
        workspace: testDir
      })

      expect(result.status).toBe(200)
      expect(result.message).toContain('successfully')
    })

    it('should create intermediate directories', async () => {
      const result = await fileTool.execute({
        action: 'write',
        path: join(testDir, 'subdir', 'test.txt'),
        content: 'test',
        workspace: testDir
      })

      expect(result.status).toBe(200)
    })
  })

  describe('read operation', () => {
    it('should read an existing file', async () => {
      await fileTool.execute({
        action: 'write',
        path: 'test.txt',
        content: 'Hello, World!',
        workspace: testDir
      })

      const result = await fileTool.execute({
        action: 'read',
        path: 'test.txt',
        workspace: testDir
      })

      expect(result.status).toBe(200)
      expect(result.data).toBe('Hello, World!')
    })

    it('should return 404 for non-existent file', async () => {
      const result = await fileTool.execute({
        action: 'read',
        path: 'nonexistent.txt',
        workspace: testDir
      })

      expect(result.status).toBe(404)
    })
  })

  describe('delete operation', () => {
    it('should delete an existing file', async () => {
      await fileTool.execute({
        action: 'write',
        path: 'test.txt',
        content: 'test',
        workspace: testDir
      })

      const result = await fileTool.execute({
        action: 'delete',
        path: 'test.txt',
        workspace: testDir
      })

      expect(result.status).toBe(200)
    })

    it('should return 404 for non-existent file', async () => {
      const result = await fileTool.execute({
        action: 'delete',
        path: 'nonexistent.txt',
        workspace: testDir
      })

      expect(result.status).toBe(404)
    })
  })

  describe('list operation', () => {
    it('should list directory contents', async () => {
      await fileTool.execute({
        action: 'write',
        path: 'file1.txt',
        content: 'test1',
        workspace: testDir
      })
      await fileTool.execute({
        action: 'write',
        path: 'file2.txt',
        content: 'test2',
        workspace: testDir
      })

      const result = await fileTool.execute({
        action: 'list',
        path: '.',
        workspace: testDir
      })

      expect(result.status).toBe(200)
      expect(result.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ name: 'file1.txt' }),
        expect.objectContaining({ name: 'file2.txt' })
      ]))
    })
  })

  describe('mkdir operation', () => {
    it('should create a directory', async () => {
      const result = await fileTool.execute({
        action: 'mkdir',
        path: 'newdir',
        workspace: testDir
      })

      expect(result.status).toBe(201)
    })

    it('should return 409 for existing directory', async () => {
      await fileTool.execute({
        action: 'mkdir',
        path: 'existing',
        workspace: testDir
      })

      const result = await fileTool.execute({
        action: 'mkdir',
        path: 'existing',
        workspace: testDir
      })

      expect(result.status).toBe(409)
    })
  })

  describe('append operation', () => {
    it('should append content to file', async () => {
      await fileTool.execute({
        action: 'write',
        path: 'test.txt',
        content: 'Line 1\n',
        workspace: testDir
      })

      const result = await fileTool.execute({
        action: 'append',
        path: 'test.txt',
        content: 'Line 2\n',
        workspace: testDir
      })

      expect(result.status).toBe(200)

      const readResult = await fileTool.execute({
        action: 'read',
        path: 'test.txt',
        workspace: testDir
      })

      expect(readResult.data).toBe('Line 1\nLine 2\n')
    })
  })

  describe('path traversal protection', () => {
    it('should reject path traversal attempts', async () => {
      const result = await fileTool.execute({
        action: 'read',
        path: '../../../etc/passwd',
        workspace: testDir
      })

      expect(result.success).toBe(false)
      expect(result.error).toContain('traversal')
    })
  })
})
