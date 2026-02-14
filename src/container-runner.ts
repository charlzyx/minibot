import { execSync, spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { getWorkspace } from './config/manager';
import { logger } from './logger';

interface ContainerOutput {
  status: 'success' | 'error';
  result?: string;
  error?: string;
  newSessionId?: string;
}

interface ContainerRunnerOptions {
  group: any;
  params: {
    prompt: string;
    sessionId?: string;
    groupFolder: string;
    chatJid: string;
    isMain: boolean;
  };
  onRegisterProcess: (proc: ChildProcess, containerName: string, groupFolder: string) => void;
  onOutput?: (output: ContainerOutput) => Promise<void>;
}

interface AvailableGroup {
  jid: string;
  name: string;
  lastActivity: number;
  isRegistered: boolean;
}

export class ContainerRunner {
  private dataDir: string;

  constructor() {
    this.dataDir = getWorkspace();
  }

  async runContainerAgent(options: ContainerRunnerOptions): Promise<ContainerOutput> {
    const { group, params, onRegisterProcess, onOutput } = options;
    const { prompt, sessionId, groupFolder, chatJid, isMain } = params;

    // 确保目录存在
    const ipcDir = path.join(this.dataDir, 'ipc', groupFolder);
    const inputDir = path.join(ipcDir, 'input');
    const outputDir = path.join(ipcDir, 'output');
    fs.mkdirSync(inputDir, { recursive: true });
    fs.mkdirSync(outputDir, { recursive: true });

    // 写入输入文件
    const inputFile = path.join(inputDir, 'prompt.json');
    fs.writeFileSync(inputFile, JSON.stringify({
      prompt,
      sessionId,
      groupFolder,
      chatJid,
      isMain
    }));

    // 生成容器名称
    const containerName = `minibot-${groupFolder}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    try {
      // 检查容器系统是否运行
      this.ensureContainerSystemRunning();

      // 启动容器
      const proc = this.startContainer(containerName, groupFolder);

      // 注册进程
      onRegisterProcess(proc, containerName, groupFolder);

      // 监控输出
      return await this.monitorContainerOutput(outputDir, onOutput);
    } catch (error) {
      logger.error({ error, containerName }, 'Container agent error');
      return {
        status: 'error',
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private ensureContainerSystemRunning(): void {
    try {
      execSync('container system status', { stdio: 'pipe' });
      logger.debug('Container system already running');
    } catch {
      logger.info('Starting Container system...');
      try {
        execSync('container system start', { stdio: 'pipe', timeout: 30000 });
        logger.info('Container system started');
      } catch (error) {
        logger.error({ error }, 'Failed to start Container system');
        throw new Error('Container system is required but failed to start');
      }
    }
  }

  private startContainer(containerName: string, groupFolder: string): ChildProcess {
    // 这里需要根据实际的容器配置来启动容器
    // 暂时使用一个模拟的容器启动命令
    const proc = spawn('node', [
      '-e',
      `
      const fs = require('fs');
      const path = require('path');
      const ipcDir = path.join(process.cwd(), 'ipc', '${groupFolder}');
      const inputDir = path.join(ipcDir, 'input');
      const outputDir = path.join(ipcDir, 'output');
      
      // 读取输入
      const inputFile = path.join(inputDir, 'prompt.json');
      const input = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
      
      // 模拟处理
      console.log('Processing prompt:', input.prompt.substring(0, 100));
      
      // 生成输出
      const outputFile = path.join(outputDir, 'result.json');
      fs.writeFileSync(outputFile, JSON.stringify({
        status: 'success',
        result: 'This is a simulated container response',
        newSessionId: 'session-' + Date.now()
      }));
      
      console.log('Container finished processing');
      `
    ], {
      stdio: 'inherit',
      cwd: this.dataDir
    });

    return proc;
  }

  private async monitorContainerOutput(outputDir: string, onOutput?: (output: ContainerOutput) => Promise<void>): Promise<ContainerOutput> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        const resultFile = path.join(outputDir, 'result.json');
        if (fs.existsSync(resultFile)) {
          clearInterval(checkInterval);
          try {
            const content = fs.readFileSync(resultFile, 'utf8');
            const output = JSON.parse(content) as ContainerOutput;
            if (onOutput) {
              onOutput(output);
            }
            resolve(output);
          } catch (error) {
            const output: ContainerOutput = {
              status: 'error',
              error: error instanceof Error ? error.message : String(error)
            };
            if (onOutput) {
              onOutput(output);
            }
            resolve(output);
          }
        }
      }, 1000);

      // 超时处理
      setTimeout(() => {
        clearInterval(checkInterval);
        const output: ContainerOutput = {
          status: 'error',
          error: 'Container execution timed out'
        };
        if (onOutput) {
          onOutput(output);
        }
        resolve(output);
      }, 60000); // 60秒超时
    });
  }

  writeGroupsSnapshot(groupFolder: string, isMain: boolean, availableGroups: AvailableGroup[], registeredJids: Set<string>): void {
    const snapshotDir = path.join(this.dataDir, 'snapshots', groupFolder);
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(path.join(snapshotDir, 'groups.json'), JSON.stringify({
      groups: isMain ? availableGroups : availableGroups.filter(g => registeredJids.has(g.jid)),
      timestamp: Date.now()
    }));
  }

  writeTasksSnapshot(groupFolder: string, isMain: boolean, tasks: any[]): void {
    const snapshotDir = path.join(this.dataDir, 'snapshots', groupFolder);
    fs.mkdirSync(snapshotDir, { recursive: true });
    fs.writeFileSync(path.join(snapshotDir, 'tasks.json'), JSON.stringify({
      tasks: isMain ? tasks : tasks.filter(t => t.groupFolder === groupFolder),
      timestamp: Date.now()
    }));
  }
}

// 导出函数
export async function runContainerAgent(
  group: any,
  params: {
    prompt: string;
    sessionId?: string;
    groupFolder: string;
    chatJid: string;
    isMain: boolean;
  },
  onRegisterProcess: (proc: ChildProcess, containerName: string, groupFolder: string) => void,
  onOutput?: (output: ContainerOutput) => Promise<void>
): Promise<ContainerOutput> {
  const runner = new ContainerRunner();
  return runner.runContainerAgent({
    group,
    params,
    onRegisterProcess,
    onOutput
  });
}

export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  availableGroups: AvailableGroup[],
  registeredJids: Set<string>
): void {
  const runner = new ContainerRunner();
  runner.writeGroupsSnapshot(groupFolder, isMain, availableGroups, registeredJids);
}

export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: any[]
): void {
  const runner = new ContainerRunner();
  runner.writeTasksSnapshot(groupFolder, isMain, tasks);
}
