# Channels 模块设计说明

## 概述

Channels 模块负责与外部消息平台集成，实现多渠道消息收发功能。

## 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                   Channels Manager                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │  统一消息接口                                 │  │
│  │  - 消息格式标准化                               │  │
│  │  - 事件分发                                   │  │
│  │  - 错误处理                                   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
    ┌─────────┐        ┌─────────┐        ┌─────────┐
    │  Feishu  │        │ Telegram│        │ Discord  │
    └─────────┘        └─────────┘        └─────────┘
```

## 核心功能

### 1. 消息接收

- WebSocket 实时消息接收
- 消息去重处理
- 消息格式标准化

### 2. 消息发送

- 文本消息发送
- 卡片消息发送
- 回复引用支持
- 表情反应添加

### 3. 事件处理

- 消息接收事件
- 连接状态事件
- 错误处理事件

## Feishu 集成

### 功能特性

- ✅ WebSocket 实时通信
- ✅ 消息去重
- ✅ 自动表情回复
- ✅ 回复引用
- ✅ 卡片消息
- ✅ 私聊和群聊支持

### 消息流程

```
用户消息 → WebSocket → 消息解析 → 去重检查 → 添加表情 → 处理器 → 回复
```

### 核心类

```typescript
class FeishuChannel {
  sendMessage(content, receiveId, parentId?)
  sendCardMessage(content, receiveId, parentId?)
  addReaction(messageId, emojiType)
  getConfig()
}

function startFeishuWS(config, onMessage)
function stopFeishuWS()
function getFeishuChannel(config)
```

## 消息格式

### 标准化消息接口

```typescript
interface FeishuMessage {
  message_id: string
  msg_type: string
  chat_id: string
  content: string
  sender_id?: {
    open_id?: string
    user_id?: string
  }
}
```

## 配置

```typescript
interface FeishuConfig {
  appId: string
  appSecret: string
  encryptKey?: string
  verificationToken?: string
  allowFrom?: string[]
}
```

## 使用示例

```typescript
import { startFeishuWS, FeishuChannel } from './channels/feishu'

// 启动 WebSocket
startFeishuWS({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET
}, async (message) => {
  console.log('收到消息:', message.content)
  
  const channel = new FeishuChannel(config)
  await channel.sendCardMessage('回复内容', message.sender_id?.open_id, message.message_id)
})

// 直接使用 Channel
const channel = new FeishuChannel(config)
await channel.sendMessage('Hello', 'user_open_id')
await channel.addReaction('message_id', 'THUMBSUP')
```

## 设计原则

1. **统一接口**：所有渠道使用相同的消息格式
2. **事件驱动**：基于事件的异步处理
3. **错误隔离**：单个渠道错误不影响其他渠道
4. **可扩展**：易于添加新的消息渠道

## 未来扩展

- Telegram 机器人集成
- Discord 机器人集成
- Slack 机器人集成
- 邮件渠道
- 短信渠道
- 统一的消息路由和分发
