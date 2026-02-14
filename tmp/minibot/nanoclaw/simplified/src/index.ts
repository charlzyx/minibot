#!/usr/bin/env node

/**
 * NanoClaw - Simplified Claude Assistant
 * A lightweight AI assistant that runs in containers
 */

import Anthropic from '@anthropic-ai/sdk';

// Configuration
const ASSISTANT_NAME = process.env.ASSISTANT_NAME || 'NanoClaw';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || '4096', 10);
const MODEL = process.env.MODEL || 'claude-3-5-sonnet-20241022';
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: API_KEY || '',
  dangerouslyAllowBrowser: true,
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Skill {
  name: string;
  description: string;
  execute: (args: any) => Promise<string>;
}

// Simple memory store
class Memory {
  private messages: Message[] = [];

  add(role: Message['role'], content: string): void {
    this.messages.push({ role, content });
  }

  getRecent(limit: number = 10): Message[] {
    return this.messages.slice(-limit);
  }

  clear(): void {
    this.messages = [];
  }
}

// Built-in skills
const skills: Skill[] = [
  {
    name: 'echo',
    description: 'Echo back the input',
    execute: async (args: { text: string }) => {
      return `Echo: ${args.text}`;
    },
  },
  {
    name: 'help',
    description: 'List available skills',
    execute: async () => {
      return skills.map(s => `- ${s.name}: ${s.description}`).join('\n');
    },
  },
  {
    name: 'time',
    description: 'Get current time',
    execute: async () => {
      return new Date().toISOString();
    },
  },
];

// Parse command from user input
function parseCommand(input: string): { skill: string; args: any } | null {
  const match = input.match(/^(\w+)(?:\s+(.+))?$/);
  if (!match) return null;

  return {
    skill: match[1],
    args: match[2] ? { text: match[2] } : {},
  };
}

// Main agent loop
async function runAgent() {
  const memory = new Memory();
  
  console.log(`🤖 ${ASSISTANT_NAME} initialized`);
  console.log(`📝 Available skills: ${skills.map(s => s.name).join(', ')}`);
  console.log(`\nType your message or 'exit' to quit:\n`);

  // Add system message
  memory.add('user', `You are ${ASSISTANT_NAME}, a helpful AI assistant. 
You can use these skills: ${skills.map(s => s.name).join(', ')}.
Be concise and helpful.`);

  while (true) {
    try {
      // Read input
      const input = await readInput();

      if (input.toLowerCase() === 'exit') {
        console.log('👋 Goodbye!');
        break;
      }

      if (!input.trim()) continue;

      // Check for direct skill invocation
      const command = parseCommand(input);
      if (command) {
        const skill = skills.find(s => s.name === command.skill);
        if (skill) {
          console.log(`\n🔧 Executing skill: ${skill.name}`);
          const result = await skill.execute(command.args);
          console.log(`\n${result}\n`);
          continue;
        }
      }

      // Process with Claude
      memory.add('user', input);

      const recentMessages = memory.getRecent(20);

      console.log('🤔 Thinking...');

      const response = await anthropic.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        messages: recentMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      });

      const responseText = response.content[0].type === 'text' 
        ? response.content[0].text 
        : '';

      memory.add('assistant', responseText);

      console.log(`\n💬 ${ASSISTANT_NAME}: ${responseText}\n`);

    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
    }
  }
}

// Simple input reader
async function readInput(): Promise<string> {
  return new Promise((resolve) => {
    process.stdin.once('data', (data) => {
      resolve(data.toString().trim());
    });
  });
}

// Start the agent
if (API_KEY) {
  runAgent().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  console.error('❌ ANTHROPIC_API_KEY environment variable is required');
  process.exit(1);
}
