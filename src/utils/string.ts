/**
 * String utility functions for Minibot
 */

/**
 * Truncate string to max length
 */
export function truncate(str: string, maxLength: number, suffix = '...'): string {
  if (str.length <= maxLength) {
    return str
  }
  return str.substring(0, maxLength - suffix.length) + suffix
}

/**
 * Escape special characters for Markdown
 */
export function escapeMarkdown(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\*/g, '\\*')
    .replace(/_/g, '\\_')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/</g, '<')
    .replace(/>/g, '>')
}

/**
 * Format bytes to human readable size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Format milliseconds to human readable duration
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }
  return `${seconds}s`
}

/**
 * Extract code blocks from markdown
 */
export function extractCodeBlocks(markdown: string): Array<{ language: string | null; code: string }> {
  const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g
  const blocks: Array<{ language: string | null; code: string }> = []

  let match
  while ((match = codeBlockRegex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || null,
      code: match[2]
    })
  }

  return blocks
}

/**
 * Strip markdown formatting
 */
export function stripMarkdown(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, '') // Code blocks
    .replace(/`[^`]+`/g, '') // Inline code
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/~~([^~]+)~~/g, '$1') // Strikethrough
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/\n{3,}/g, '\n\n') // Multiple newlines
    .trim()
}

/**
 * Parse command arguments
 */
export function parseCommandArgs(input: string): { command: string; args: string[] } {
  const parts = input.trim().split(/\s+/)
  const command = parts[0]?.toLowerCase() || ''
  const args = parts.slice(1)

  return { command, args }
}

/**
 * Split text into chunks
 */
export function chunkText(text: string, maxChunkSize: number, overlap = 0): string[] {
  const chunks: string[] = []
  let index = 0

  while (index < text.length) {
    const endIndex = Math.min(index + maxChunkSize, text.length)
    chunks.push(text.substring(index, endIndex))
    index = endIndex - overlap
  }

  return chunks
}

/**
 * Generate a random string
 */
export function randomString(length: number, chars = 'abcdefghijklmnopqrstuvwxyz0123456789'): string {
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * Sanitize filename by removing invalid characters
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
}

/**
 * Check if a string is a valid URL
 */
export function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Extract URLs from text
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/g
  return text.match(urlRegex) || []
}

/**
 * Normalize whitespace
 */
export function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim()
}

/**
 * Count words in a string
 */
export function countWords(str: string): number {
  return normalizeWhitespace(str).split(' ').length
}

/**
 * Detect language from text (simple heuristic)
 */
export function detectLanguage(text: string): 'zh' | 'en' | 'unknown' {
  const chineseChars = text.match(/[\u4e00-\u9fa5]/g)
  const totalChars = text.length

  if (chineseChars && chineseChars.length / totalChars > 0.3) {
    return 'zh'
  }

  const englishWords = text.match(/[a-zA-Z]+/g)
  if (englishWords && englishWords.length / countWords(text) > 0.6) {
    return 'en'
  }

  return 'unknown'
}
