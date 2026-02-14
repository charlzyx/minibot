import pino from 'pino';
import path from 'path';

// 使用硬编码的目录作为日志目录
const logDir = '/tmp/minibot-logs';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    targets: [
      {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
      {
        target: 'pino/file',
        options: {
          destination: path.join(logDir, 'app.log'),
          mkdir: true,
        },
      },
    ],
  },
});

export { logger };
