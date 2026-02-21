/**
 * Mount Security Module for Minibot
 *
 * Validates additional mounts against an allowlist to prevent
 * container agents from accessing sensitive files.
 *
 * Inspired by nanoclaw's mount security implementation.
 *
 * Allowlist location: ~/.config/minibot/mount-allowlist.json
 */

import fs from 'fs'
import path from 'path'
import { createLogger } from './utils'

const logger = createLogger('MountSecurity')

// Allowlist location (outside project root for security)
export const MOUNT_ALLOWLIST_PATH = path.join(
  process.env.HOME || '~',
  '.config',
  'minibot',
  'mount-allowlist.json'
)

/**
 * Default blocked patterns - paths that should never be mounted
 */
const DEFAULT_BLOCKED_PATTERNS = [
  '.ssh',
  '.gnupg',
  '.gpg',
  '.aws',
  '.azure',
  '.gcloud',
  '.kube',
  '.docker',
  'credentials',
  '.env',
  '.env.local',
  '.netrc',
  '.npmrc',
  '.pypirc',
  'id_rsa',
  'id_ed25519',
  'private_key',
  '.secret',
  'token',
]

/**
 * Mount allowlist configuration
 */
export interface MountAllowlist {
  allowedRoots: AllowedRoot[]
  blockedPatterns: string[]
  nonMainReadOnly: boolean
}

/**
 * Allowed root configuration
 */
export interface AllowedRoot {
  path: string
  allowReadWrite: boolean
  description?: string
}

/**
 * Additional mount request
 */
export interface AdditionalMount {
  hostPath: string
  containerPath: string
  readonly?: boolean
}

// Cache the allowlist in memory
let cachedAllowlist: MountAllowlist | null = null
let allowlistLoadError: string | null = null

/**
 * Load the mount allowlist from the external config location.
 * Returns null if the file doesn't exist or is invalid.
 * Result is cached in memory for the lifetime of the process.
 */
export function loadMountAllowlist(): MountAllowlist | null {
  if (cachedAllowlist !== null) {
    return cachedAllowlist
  }

  if (allowlistLoadError !== null) {
    return null
  }

  try {
    if (!fs.existsSync(MOUNT_ALLOWLIST_PATH)) {
      allowlistLoadError = `Mount allowlist not found at ${MOUNT_ALLOWLIST_PATH}`
      logger.warn({ path: MOUNT_ALLOWLIST_PATH },
        'Mount allowlist not found - additional mounts will be BLOCKED. ' +
        'Create the file to enable additional mounts.')
      return null
    }

    const content = fs.readFileSync(MOUNT_ALLOWLIST_PATH, 'utf8')
    const allowlist = JSON.parse(content) as MountAllowlist

    // Validate structure
    if (!Array.isArray(allowlist.allowedRoots)) {
      throw new Error('allowedRoots must be an array')
    }

    if (!Array.isArray(allowlist.blockedPatterns)) {
      throw new Error('blockedPatterns must be an array')
    }

    if (typeof allowlist.nonMainReadOnly !== 'boolean') {
      throw new Error('nonMainReadOnly must be a boolean')
    }

    // Merge with default blocked patterns
    const mergedBlockedPatterns = [
      ...new Set([...DEFAULT_BLOCKED_PATTERNS, ...allowlist.blockedPatterns])
    ]
    allowlist.blockedPatterns = mergedBlockedPatterns

    cachedAllowlist = allowlist
    logger.info({
      path: MOUNT_ALLOWLIST_PATH,
      allowedRoots: allowlist.allowedRoots.length,
      blockedPatterns: allowlist.blockedPatterns.length
    }, 'Mount allowlist loaded successfully')

    return cachedAllowlist
  } catch (err) {
    allowlistLoadError = err instanceof Error ? err.message : String(err)
    logger.error({
      path: MOUNT_ALLOWLIST_PATH,
      error: allowlistLoadError
    }, 'Failed to load mount allowlist - additional mounts will be BLOCKED')
    return null
  }
}

/**
 * Expand ~ to home directory and resolve to absolute path
 */
function expandPath(p: string): string {
  const homeDir = process.env.HOME || '/Users/user'
  if (p.startsWith('~/')) {
    return path.join(homeDir, p.slice(2))
  }
  if (p === '~') {
    return homeDir
  }
  return path.resolve(p)
}

/**
 * Get the real path, resolving symlinks.
 * Returns null if the path doesn't exist.
 */
function getRealPath(p: string): string | null {
  try {
    return fs.realpathSync(p)
  } catch {
    return null
  }
}

/**
 * Check if a path matches any blocked pattern
 */
function matchesBlockedPattern(realPath: string, blockedPatterns: string[]): string | null {
  const pathParts = realPath.split(path.sep)

  for (const pattern of blockedPatterns) {
    // Check if any path component matches the pattern
    for (const part of pathParts) {
      if (part === pattern || part.includes(pattern)) {
        return pattern
      }
    }

    // Also check if the full path contains the pattern
    if (realPath.includes(pattern)) {
      return pattern
    }
  }

  return null
}

/**
 * Check if a real path is under an allowed root
 */
function findAllowedRoot(realPath: string, allowedRoots: AllowedRoot[]): AllowedRoot | null {
  for (const root of allowedRoots) {
    const expandedRoot = expandPath(root.path)
    const realRoot = getRealPath(expandedRoot)

    if (realRoot === null) {
      // Allowed root doesn't exist, skip it
      continue
    }

    // Check if realPath is under realRoot
    const relative = path.relative(realRoot, realPath)
    if (!relative.startsWith('..') && !path.isAbsolute(relative)) {
      return root
    }
  }

  return null
}

/**
 * Validate the container path to prevent escaping /workspace/extra/
 */
function isValidContainerPath(containerPath: string): boolean {
  // Must not contain .. to prevent path traversal
  if (containerPath.includes('..')) {
    return false
  }

  // Must not be absolute (it will be prefixed with /workspace/extra/)
  if (containerPath.startsWith('/')) {
    return false
  }

  // Must not be empty
  if (!containerPath || containerPath.trim() === '') {
    return false
  }

  return true
}

export interface MountValidationResult {
  allowed: boolean
  reason: string
  realHostPath?: string
  effectiveReadonly?: boolean
}

/**
 * Validate a single additional mount against the allowlist.
 * Returns validation result with reason.
 */
export function validateMount(
  mount: AdditionalMount,
  isMain: boolean
): MountValidationResult {
  const allowlist = loadMountAllowlist()

  // If no allowlist, block all additional mounts
  if (allowlist === null) {
    return {
      allowed: false,
      reason: `No mount allowlist configured at ${MOUNT_ALLOWLIST_PATH}`
    }
  }

  // Validate container path first (cheap check)
  if (!isValidContainerPath(mount.containerPath)) {
    return {
      allowed: false,
      reason: `Invalid container path: "${mount.containerPath}" - must be relative, non-empty, and not contain ".."`
    }
  }

  // Expand and resolve the host path
  const expandedPath = expandPath(mount.hostPath)
  const realPath = getRealPath(expandedPath)

  if (realPath === null) {
    return {
      allowed: false,
      reason: `Host path does not exist: "${mount.hostPath}" (expanded: "${expandedPath}")`
    }
  }

  // Check against blocked patterns
  const blockedMatch = matchesBlockedPattern(realPath, allowlist.blockedPatterns)
  if (blockedMatch !== null) {
    return {
      allowed: false,
      reason: `Path matches blocked pattern "${blockedMatch}": "${realPath}"`
    }
  }

  // Check if under an allowed root
  const allowedRoot = findAllowedRoot(realPath, allowlist.allowedRoots)
  if (allowedRoot === null) {
    return {
      allowed: false,
      reason: `Path "${realPath}" is not under any allowed root. Allowed roots: ${
        allowlist.allowedRoots.map(r => expandPath(r.path)).join(', ')
      }`
    }
  }

  // Determine effective readonly status
  const requestedReadWrite = mount.readonly === false
  let effectiveReadonly = true // Default to readonly

  if (requestedReadWrite) {
    if (!isMain && allowlist.nonMainReadOnly) {
      // Non-main groups forced to read-only
      effectiveReadonly = true
      logger.info({
        mount: mount.hostPath
      }, 'Mount forced to read-only for non-main group')
    } else if (!allowedRoot.allowReadWrite) {
      // Root doesn't allow read-write
      effectiveReadonly = true
      logger.info({
        mount: mount.hostPath,
        root: allowedRoot.path
      }, 'Mount forced to read-only - root does not allow read-write')
    } else {
      // Read-write allowed
      effectiveReadonly = false
    }
  }

  return {
    allowed: true,
    reason: `Allowed under root "${allowedRoot.path}"${allowedRoot.description ? ` (${allowedRoot.description})` : ''}`,
    realHostPath: realPath,
    effectiveReadonly
  }
}

/**
 * Generate a template allowlist file for users to customize
 */
export function generateAllowlistTemplate(): string {
  const template: MountAllowlist = {
    allowedRoots: [
      {
        path: '~/projects',
        allowReadWrite: true,
        description: 'Development projects'
      },
      {
        path: '~/repos',
        allowReadWrite: true,
        description: 'Git repositories'
      },
      {
        path: '~/Documents',
        allowReadWrite: false,
        description: 'Documents (read-only)'
      }
    ],
    blockedPatterns: [
      // Additional patterns beyond defaults
      'password',
      'secret',
    ],
    nonMainReadOnly: true
  }

  return JSON.stringify(template, null, 2)
}

/**
 * Initialize mount allowlist with default template
 */
export function initializeMountAllowlist(): void {
  const dir = path.dirname(MOUNT_ALLOWLIST_PATH)
  fs.mkdirSync(dir, { recursive: true })

  if (!fs.existsSync(MOUNT_ALLOWLIST_PATH)) {
    const template = generateAllowlistTemplate()
    fs.writeFileSync(MOUNT_ALLOWLIST_PATH, template, 'utf8')
    logger.info({ path: MOUNT_ALLOWLIST_PATH }, 'Mount allowlist initialized with defaults')
  }
}
