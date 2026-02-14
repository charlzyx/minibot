import { getConfigManager } from './config/manager';
import { ChatMessage } from './session';

interface Channel {
  ownsJid: (jid: string) => boolean;
  isConnected: () => boolean;
  sendMessage: (jid: string, text: string) => Promise<void>;
  prefixAssistantName?: boolean;
}

export function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function formatMessages(messages: ChatMessage[]): string {
  const lines = messages.map((m) =>
    `<message sender="${escapeXml(m.role)}" time="${m.timestamp}">${escapeXml(m.content)}</message>`,
  );
  return `<messages>\n${lines.join('\n')}\n</messages>`;
}

export function stripInternalTags(text: string): string {
  return text.replace(/<internal>[\s\S]*?<\/internal>/g, '').trim();
}

export function formatOutbound(channel: Channel, rawText: string): string {
  const text = stripInternalTags(rawText);
  if (!text) return '';
  const assistantName = 'Minibot';
  const prefix = channel.prefixAssistantName !== false ? `${assistantName}: ` : '';
  return `${prefix}${text}`;
}

export function routeOutbound(
  channels: Channel[],
  jid: string,
  text: string,
): Promise<void> {
  const channel = channels.find((c) => c.ownsJid(jid) && c.isConnected());
  if (!channel) throw new Error(`No channel for JID: ${jid}`);
  return channel.sendMessage(jid, text);
}

export function findChannel(
  channels: Channel[],
  jid: string,
): Channel | undefined {
  return channels.find((c) => c.ownsJid(jid));
}

export function getTriggerPattern(): RegExp {
  const assistantName = 'Minibot';
  return new RegExp(`^@${escapeRegExp(assistantName)}\b`, 'i');
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 检查消息是否包含触发词
export function hasTrigger(message: string): boolean {
  const triggerPattern = getTriggerPattern();
  const trimmedMessage = message.trim();
  
  // 检查是否以 @Minibot 开头，或者以 / 开头的命令
  return triggerPattern.test(trimmedMessage) || trimmedMessage.startsWith('/');
}

// 移除触发词
export function removeTrigger(message: string): string {
  const triggerPattern = getTriggerPattern();
  return message.replace(triggerPattern, '').trim();
}
