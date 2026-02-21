/**
 * Container Module Exports
 *
 * This module provides container isolation for code execution.
 * Uses Docker to run Claude Code in isolated environments.
 */

export { ClaudeCodeRunner, runClaudeCode, cleanupClaudeCodeContainers, getClaudeCodeRunner } from './claude-runner'
export type { ClaudeCodeOptions, ClaudeCodeResult, ClaudeCodeRequest } from './claude-runner'

// Re-export legacy runner for backward compatibility
export { DockerContainerRunner, runCodeAssistant, cleanupCodeContainers } from '../container-runner-docker'
export type {
  ContainerOptions,
  ContainerOutput,
  RunContainerOptions,
  RunCodeAssistantOptions
} from '../container-runner-docker'
