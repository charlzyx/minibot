# Minibot 测试指南

## 🧪 测试概述

Minibot 使用 Vitest 作为测试框架，支持单元测试和集成测试。

## 📋 测试命令

```bash
# 运行所有测试
npm test

# 运行单元测试
npm run test:unit

# 运行集成测试
npm run test:integration

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm run test:watch
```

## 🔧 测试前准备

### 1. 安装依赖

```bash
npm install
```

### 2. 创建测试环境配置

创建 `.env.test` 文件用于测试：

```bash
cp .env .env.test
```

### 3. 编译项目

```bash
npm run build
```

## 📁 测试结构

```
tests/
├── unit/                  # 单元测试
│   ├── commands/          # 命令模块测试
│   ├── memory/            # 记忆管理测试
│   ├── session/           # 会话管理测试
│   ├── tools/             # 工具系统测试
│   └── utils/             # 工具函数测试
├── integration/           # 集成测试
└── vitest.config.ts       # Vitest 配置
```

## 🧪 运行特定测试

```bash
# 运行所有测试
npm test

# 只运行单元测试
npm run test:unit

# 只运行集成测试
npm run test:integration

# 运行特定测试文件
npx vitest tests/unit/tools/shell.test.ts

# 运行匹配模式的测试
npx vitest --testNamePattern="ShellTool"
```

## 📊 测试覆盖率

```bash
# 生成覆盖率报告
npm run test:coverage

# 覆盖率报告将生成在 coverage/ 目录
open coverage/index.html
```

## 🐛 调试测试

### 使用 VSCode 调试

1. 在 VSCode 中安装 Vitest 扩展
2. 在测试文件左侧点击 "Debug" 按钮
3. 或使用 F5 启动调试

### 命令行调试

```bash
# 监听模式下运行测试
npm run test:watch

# 只运行失败的测试
npx vitest --reporter=verbose --run
```

## 📝 编写测试

### 单元测试示例

```typescript
import { describe, it, expect, beforeEach } from 'vitest'
import { ShellTool } from '@/tools/shell'

describe('ShellTool', () => {
  let shellTool: ShellTool

  beforeEach(() => {
    shellTool = new ShellTool(['echo', 'ls', 'pwd'])
  })

  it('should execute echo command', async () => {
    const result = await shellTool.execute({ command: 'echo', args: ['test'] })
    expect(result.success).toBe(true)
    expect(result.data?.stdout).toBe('test')
  })

  it('should handle errors', async () => {
    const result = await shellTool.execute({ command: 'ls', args: ['/nonexistent'] })
    expect(result.success).toBe(true) // 命令执行成功，但退出码非0
  })
})
```

### 集成测试示例

```typescript
import { describe, it, expect, beforeAll } from 'vitest'
import { Agent } from '@/agent'

describe('Agent Integration', () => {
  let agent: Agent

  beforeAll(() => {
    // 初始化测试环境
    agent = new Agent()
  })

  it('should process simple message', async () => {
    const context = {
      platform: 'test',
      userId: 'test-user',
      userMessage: 'hello',
      sessionId: 'test-session'
    }

    const response = await agent.process(context)
    expect(response).toBeTruthy()
  })
})
```

## 🧪 测试容器功能

### 1. 构建容器镜像

```bash
npm run container:build
```

### 2. 测试容器运行

```bash
# 直接运行容器
docker run --rm minibot-code:latest

# 在容器中执行命令
docker run --rm minibot-code:latest node -e "console.log('test')"
```

### 3. 测试 /code 命令

```bash
# 启动服务器
npm run dev

# 在另一个终端发送测试消息（需要配置 Feishu）
# 或者使用 curl 测试 API
```

## 🔧 手动测试检查清单

### 基础功能测试

- [ ] 服务器启动 (`npm run dev`)
- [ ] 健康检查 API (`GET /api/health`)
- [ ] 聊天 API (`POST /api/chat`)
- [ ] 记忆 API (`GET /api/memory`)

### 命令测试

- [ ] `/help` - 显示帮助
- [ ] `/status` - 显示状态
- [ ] `/skills` - 列出技能
- [ ] `/reset` - 重置会话
- [ ] `/code info` - 代码助手
- [ ] `/monitor` - 监控信息
- [ ] `/health` - 健康检查
- [ ] `/mounts` - 挂载状态

### 容器功能测试

- [ ] 容器构建成功
- [ ] 容器可以运行
- [ ] /code 命令返回结果
- [ ] 容器资源限制生效

### 监控测试

- [ ] `/monitor` 显示系统指标
- [ ] `/health` 显示健康状态
- [ ] 内存使用正常
- [ ] 队列状态正常

## 🐛 已知问题

### TypeScript 编译错误

部分 `src/agent/index.ts` 的错误是预存在的，不影响新模块功能：

```typescript
// 这些错误不影响测试运行
src/agent/index.ts(1,53): error TS6196: 'ToolCall' is declared but never used
src/agent/index.ts(6,33): error TS2307: Cannot find module '../skills'
```

### 跳过构建步骤

如果只想运行测试而不编译：

```bash
# 使用 tsx 直接运行测试
npx vitest run
```

## 📝 添加新测试

### 为新模块添加测试

1. 创建测试文件 `tests/unit/<module>/<file>.test.ts`
2. 导入要测试的模块
3. 编写测试用例
4. 运行测试验证

```bash
# 例如：为监控模块添加测试
npx vitest --watch
```

### 测试覆盖率目标

- 单元测试覆盖率目标: 80%
- 关键模块覆盖率目标: 90%

## 🚀 CI/CD 集成

### GitHub Actions

创建 `.github/workflows/test.yml`:

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: npm test
```

## 📚 相关文档

- [Vitest 文档](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergy/nano-bot#testing)
- [Test Driven Development](https://en.wikipedia.org/wiki/Test-driven_development)
