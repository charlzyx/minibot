import { GroupQueue } from './group-queue';
import { getSessionManager, ChatMessage } from './session';
import { hasTrigger, removeTrigger, formatMessages } from './router';
import { logger } from './logger';
import { Agent } from './agent';

interface MessageProcessorOptions {
  sendMessage: (jid: string, text: string) => Promise<void>;
  registeredGroups: () => Record<string, any>;
  getSessions: () => Record<string, string>;
  queue: GroupQueue;
  onProcess: (groupJid: string, proc: any, containerName: string, groupFolder: string) => void;
}

interface ProcessMessageOptions {
  userMessage: string;
  userId: string;
  platform: string;
  messageId: string;
  sessionId?: string;
  history: ChatMessage[];
  metadata: Record<string, any>;
}

export class MessageProcessor {
  private queue: GroupQueue;
  private options: MessageProcessorOptions;
  private lastAgentTimestamp: Record<string, number> = {};

  constructor(options: MessageProcessorOptions) {
    this.options = options;
    this.queue = options.queue;
    this.queue.setProcessMessagesFn(this.processGroupMessages.bind(this));
  }

  async processMessage(options: ProcessMessageOptions): Promise<string> {
    const { userMessage, userId, platform, messageId, sessionId, history, metadata } = options;
    const sessionManager = getSessionManager();
    const actualSessionId = sessionId || `${platform}:${userId}`;

    // 检查是否需要触发词
    const isMainGroup = metadata.isMainGroup || false;
    const needsTrigger = !isMainGroup && metadata.requiresTrigger !== false;

    if (needsTrigger && !hasTrigger(userMessage)) {
      // 存储为上下文，不立即处理
      sessionManager.addMessage(actualSessionId, 'user', userMessage);
      await sessionManager.save(sessionManager.getOrCreate(actualSessionId));
      return '';
    }

    // 获取所有上下文消息
    const sinceTimestamp = this.lastAgentTimestamp[actualSessionId] || 0;
    const contextMessages = sessionManager.getMessagesSince(actualSessionId, sinceTimestamp);
    const allMessages = [...contextMessages, { role: 'user' as const, content: removeTrigger(userMessage), timestamp: Date.now() }];

    // 更新最后处理时间戳
    this.lastAgentTimestamp[actualSessionId] = Date.now();

    // 格式化消息
    const formatted = formatMessages(allMessages);

    // 处理消息
    const agent = new Agent();
    const response = await agent.process({
      userMessage: formatted,
      userId,
      platform,
      messageId,
      sessionId: actualSessionId,
      history: allMessages,
      metadata
    });

    // 存储响应
    sessionManager.addMessage(actualSessionId, 'assistant', response);
    await sessionManager.save(sessionManager.getOrCreate(actualSessionId));

    return response;
  }

  private async processGroupMessages(groupJid: string): Promise<boolean> {
    try {
      const sessionManager = getSessionManager();
      const sinceTimestamp = this.lastAgentTimestamp[groupJid] || 0;
      const messages = sessionManager.getMessagesSince(groupJid, sinceTimestamp);

      if (messages.length === 0) {
        return true;
      }

      // 检查是否需要触发词
      const registeredGroups = this.options.registeredGroups();
      const group = registeredGroups[groupJid];
      const isMainGroup = group?.isMainGroup || false;
      const needsTrigger = !isMainGroup && group?.requiresTrigger !== false;

      if (needsTrigger) {
        const hasTriggerMessage = messages.some(msg => hasTrigger(msg.content));
        if (!hasTriggerMessage) {
          return true;
        }
      }

      // 格式化消息
      const formatted = formatMessages(messages);

      // 处理消息
      const agent = new Agent();
      const response = await agent.process({
        userMessage: formatted,
        userId: groupJid,
        platform: 'group',
        messageId: `group_${Date.now()}`,
        sessionId: groupJid,
        history: messages,
        metadata: group || {}
      });

      // 发送响应
      await this.options.sendMessage(groupJid, response);

      // 更新最后处理时间戳
      this.lastAgentTimestamp[groupJid] = Date.now();

      return true;
    } catch (error) {
      logger.error({ groupJid, error }, 'Error processing group messages');
      return false;
    }
  }

  enqueueMessage(groupJid: string, message: string): void {
    this.queue.enqueueMessageCheck(groupJid);
  }

  enqueueTask(groupJid: string, taskId: string, fn: () => Promise<void>): void {
    this.queue.enqueueTask(groupJid, taskId, fn);
  }

  async shutdown(gracePeriodMs: number): Promise<void> {
    await this.queue.shutdown(gracePeriodMs);
  }
}
