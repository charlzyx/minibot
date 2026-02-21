# 快速入门

## 5 分钟上手 Minibot

### 第一步：安装

```bash
git clone https://github.com/charlzyx/minibot.git
cd minibot
npm install
```

### 第二步：配置

复制示例配置并编辑：

```bash
cp .env.example .env
nano .env
```

最少需要配置 API Key：

```env
# 选择一个 LLM 提供商
ZHIPU_API_KEY=your_key_here
# 或
ANTHROPIC_API_KEY=your_key_here
```

### 第三步：启动

```bash
npm run dev
```

### 第四步：测试

访问健康检查：

```bash
curl http://localhost:18790/health
```

或发送测试消息：

```bash
curl -X POST http://localhost:18790/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
```

## 基本使用

### 命令行

```bash
# 查看帮助
minibot --help

# 开发模式
minibot dev

# 生产模式
minibot start

# 运行测试
minibot test

# 系统诊断
minibot doctor
```

### 代码助手

```bash
# 在容器中运行 Claude Code
minibot code "帮我重构这个文件"

# 指定项目目录
minibot code "添加测试" --project ./src

# 指定模型
minibot code "代码审查" --model claude-sonnet-4
```

### 飞书集成

在飞书中配置机器人后，可以直接发送消息：

- `/help` - 查看帮助
- `/status` - 查看状态
- `/code <任务>` - 启动代码助手

## 配置文件

你也可以使用配置文件而不是环境变量：

**minibot.config.ts**:
```typescript
export default defineConfig({
  provider: {
    name: 'anthropic',
    apiKey: process.env.ANTHROPIC_API_KEY!,
    model: 'claude-sonnet-4-20250514'
  },
  server: {
    port: 18790,
    host: '0.0.0.0'
  }
})
```

## 下一步

- [完整配置指南](/guide/configuration)
- [部署指南](/guide/deployment)
- [API 文档](/api/agent)
