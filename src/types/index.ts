/**
 * Core type definitions for Minibot
 */

// ============================================================================
// Tool Types
// ============================================================================

export type ToolResult<T = unknown> = {
  success: boolean
  data?: T
  error?: string
  timestamp: number
}

export interface ToolParameterSchema {
  type: string
  properties?: Record<string, unknown>
  required?: string[]
  items?: unknown
  enum?: unknown[]
  description?: string
}

export interface BaseTool<TParams = unknown, TResult = unknown> {
  readonly name: string
  readonly description: string
  readonly parameters: ToolParameterSchema
  execute(params: TParams, context?: ToolExecutionContext): Promise<ToolResult<TResult>>
}

export interface ToolExecutionContext {
  sessionId: string
  userId: string
  platform: string
  workspace: string
  timestamp?: number
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: ToolParameterSchema
  }
}

// ============================================================================
// Session Types
// ============================================================================

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface SessionMessage {
  role: MessageRole
  content: string
  timestamp: number
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface ToolCall {
  id: string
  type: string
  function: {
    name: string
    arguments: string
  }
}

export interface SessionMetadata {
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
}

export interface Session {
  key: string
  messages: SessionMessage[]
  createdAt: number
  updatedAt: number
  metadata: Record<string, unknown>
  activeSkill?: string | null
  state?: Record<string, unknown>
}

// ============================================================================
// Agent Types
// ============================================================================

export interface AgentContext {
  userMessage: string
  userId: string
  platform: string
  messageId: string
  sessionId?: string
  history: ChatMessage[]
  metadata: Record<string, unknown>
}

export interface Intent {
  type: 'chat' | 'search' | 'tool' | 'schedule' | 'memory'
  action: string
  confidence: number
  params?: Record<string, unknown>
}

// ============================================================================
// Memory Types
// ============================================================================

export interface Memory {
  id: number
  content: string
  embedding?: number[]
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export interface MemoryRow {
  id: number
  content: string
  embedding?: Buffer
  tags: string
  createdAt: number
  updatedAt: number
}

// ============================================================================
// Command Types
// ============================================================================

export interface Command {
  name: string
  description: string
  usage: string
  handler: (args: string[], context: CommandContext) => Promise<string>
}

export interface CommandContext {
  sessionId: string
  userId: string
  platform: string
  messageId: string
  metadata: Record<string, unknown>
}

// ============================================================================
// LLM Types
// ============================================================================

export type LLMMessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface LLMMessage {
  role: LLMMessageRole
  content: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface LLMResponse {
  content: string
  model: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  finishReason?: string
  toolCalls?: ToolCall[]
}

export interface LLMProvider {
  name: string
  apiKey: string
  apiBase?: string
}

export interface LLMModel {
  name: string
  maxTokens?: number
  temperature?: number
}

// ============================================================================
// Config Types
// ============================================================================

export interface Config {
  provider: LLMProvider
  model: LLMModel
  channels: ChannelConfig
  tools: ToolConfig
  security: SecurityConfig
}

export interface ChannelConfig {
  feishu?: FeishuConfig
  wechat?: WechatConfig
  dingtalk?: DingTalkConfig
  qq?: QQConfig
  discord?: DiscordConfig
  slack?: SlackConfig
}

export interface FeishuConfig {
  enabled: boolean
  appId: string
  appSecret: string
  encryptKey?: string
  verificationToken?: string
  allowFrom?: string[]
}

export interface WechatConfig {
  enabled: boolean
  appId: string
  appSecret: string
}

export interface DingTalkConfig {
  enabled: boolean
  clientId: string
  clientSecret: string
  allowFrom?: string[]
}

export interface QQConfig {
  enabled: boolean
  appId: string
  secret: string
  allowFrom?: string[]
}

export interface DiscordConfig {
  enabled: boolean
  botToken: string
  appToken: string
  groupPolicy: string
}

export interface SlackConfig {
  enabled: boolean
  botToken: string
  appToken: string
  groupPolicy: string
}

export interface ToolConfig {
  shell: { enabled: boolean }
  web: { enabled: boolean }
  file: { enabled: boolean; workspace?: string }
  llm: { enabled: boolean }
  memory: { enabled: boolean }
}

export interface SecurityConfig {
  restrictToWorkspace: boolean
  maxSessionCache?: number
  allowedShellCommands?: string[]
}

// ============================================================================
// Shell Types
// ============================================================================

export interface ShellResult {
  stdout: string
  stderr: string
  code: number | null
  success: boolean
}

export interface ShellOptions {
  cwd?: string
  env?: Record<string, string>
  timeout?: number
}

// ============================================================================
// File Types
// ============================================================================

export type FileAction = 'read' | 'write' | 'delete' | 'list' | 'mkdir' | 'append'

export interface FileResult {
  status: number
  message: string
  path?: string
  data?: unknown
}

export interface FileParams {
  action: FileAction
  path: string
  content?: string
  workspace?: string
}

// ============================================================================
// Web Types
// ============================================================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

export interface WebResult {
  status: number
  statusText: string
  headers: Record<string, string>
  data: unknown
}

export interface WebRequestOptions {
  method?: HttpMethod
  headers?: Record<string, string>
  body?: unknown
  timeout?: number
}

// ============================================================================
// Cron Types
// ============================================================================

export interface CronJob {
  id: string
  name: string
  cronExpression: string
  command: string
  args: string[]
  enabled: boolean
  priority: number
  timeout: number
  maxRetries: number
  lastRun?: number
  nextRun?: number
  runCount?: number
  errorCount?: number
}

export interface CronExecutionResult {
  success: boolean
  stdout?: string
  stderr?: string
  code?: number
  error?: string
  duration: number
}
