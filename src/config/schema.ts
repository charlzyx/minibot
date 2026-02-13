import { z } from 'zod'

// Provider Configuration
export const ProviderSchema = z.object({
  name: z.enum(['openai', 'deepseek', 'dashscope', 'qwen', 'zhipu', 'moonshot']),
  apiKey: z.string().min(1),
  apiBase: z.string().url().optional(),
  baseUrl: z.string().url().optional(),
})

// Model Configuration
export const ModelSchema = z.object({
  name: z.string(),
  maxTokens: z.number().min(1).max(128000),
  temperature: z.number().min(0).max(2),
})

// Feishu Channel Configuration
export const FeishuSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().default(''),
  appSecret: z.string().default(''),
  encryptKey: z.string().default(''),
  verificationToken: z.string().default(''),
  allowFrom: z.array(z.string()).default([]),
})

// WeChat Channel Configuration
export const WeChatSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().default(''),
  appSecret: z.string().default(''),
})

// DingTalk Channel Configuration
export const DingTalkSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  allowFrom: z.array(z.string()).default([]),
})

// QQ Channel Configuration
export const WeiboSchema = z.object({
  enabled: z.boolean().default(false),
  appId: z.string().default(''),
  secret: z.string().default(''),
  allowFrom: z.array(z.string()).default([]),
})

// Discord Channel Configuration
export const DiscordSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
  appToken: z.string().default(''),
  groupPolicy: z.enum(['mention', 'open', 'allowlist']),
  dm: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
})

// Slack Channel Configuration
export const SlackSchema = z.object({
  enabled: z.boolean().default(false),
  botToken: z.string().default(''),
  appToken: z.string().default(''),
  groupPolicy: z.enum(['mention', 'open', 'allowlist']),
})

// Tool Configuration
export const ToolSchema = z.object({
  shell: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
  web: z.object({
    enabled: z.boolean().default(true),
  }).optional(),
  file: z.object({
    enabled: z.boolean().default(true),
    workspace: z.string().default(process.env.HOME + '/minibot'),
  }).optional(),
})

// Security Configuration
export const SecuritySchema = z.object({
  restrictToWorkspace: z.boolean().default(false),
})

// Complete Config Schema
export const ConfigSchema = z.object({
  provider: ProviderSchema,
  model: ModelSchema,
  channels: z.object({
    feishu: FeishuSchema,
    wechat: WeChatSchema,
    dingtalk: DingTalkSchema,
    qq: WeiboSchema,
    discord: DiscordSchema,
    slack: SlackSchema,
  }),
  tools: ToolSchema,
  security: SecuritySchema,
})

export type Config = z.infer<typeof ConfigSchema>
