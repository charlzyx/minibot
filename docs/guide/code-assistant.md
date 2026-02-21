# 代码助手

Minibot 的 `/code` 命令可以在隔离的 Docker 容器中运行 Claude Code，执行复杂的代码工程任务。

## 功能特性

- 🚀 **完全隔离** - 每个任务在独立的容器中运行
- 🔒 **安全挂载** - 只挂载指定的项目目录
- ⏱️ **超时控制** - 防止任务无限期运行
- 💾 **会话持久** - 支持跨任务的会话保持
- 📊 **结果解析** - 自动提取和格式化输出

## 快速使用

### 在飞书中使用

```
/code 帮我重构 src/utils.ts 文件
```

### 使用命令行

```bash
minibot code "帮我优化这个函数"
minibot code "添加单元测试" --project ./src
minibot code "代码审查" --model claude-sonnet-4
```

## 容器镜像

Minibot 使用专门的 Docker 镜像运行 Claude Code：

```dockerfile
FROM node:18-alpine
RUN npm install -g @anthropic-ai/claude-code
# ... 其他配置
```

### 构建镜像

```bash
minibot container build
# 或
npm run container:build
```

### 查看运行的容器

```bash
minibot container list
# 或
docker ps | grep claude-code
```

### 停止所有容器

```bash
minibot container stop
```

## 配置选项

在 `.env` 或配置文件中：

```env
# Claude Code API Key
ANTHROPIC_API_KEY=your_key_here

# 默认模型
CLAUDE_MODEL=claude-sonnet-4-20250514

# 容器资源限制
CONTAINER_MEMORY_LIMIT=2g
CONTAINER_CPU_LIMIT=2
CONTAINER_TIMEOUT=300000

# 工作空间
MINIBOT_WORKSPACE=$HOME/minibot
```

## 高级用法

### 指定项目目录

```
/code /path/to/project 添加错误处理
```

### 使用不同的模型

```
/code --model claude-opus-4 重构整个模块
```

### 超时设置

```
/code --timeout 600000 运行长时间任务
```

## 工作原理

1. **容器创建** - 为每个任务创建独立的 Docker 容器
2. **目录挂载** - 只挂载指定的项目目录
3. **Claude Code 执行** - 在容器内运行 Claude Code CLI
4. **结果解析** - 通过 sentinel markers 解析输出
5. **容器清理** - 任务完成后自动清理容器

## 输出格式

```
🤖 **代码助手已启动**

📦 任务: 重构 utils.ts

🚀 正在启动独立容器...

✅ 执行成功！

📦 输出:
```
# 重构结果...
```

## 故障排查

### Docker 未安装

```bash
# macOS
brew install docker

# Ubuntu
sudo apt-get install docker.io
```

### 权限问题

```bash
# 将用户添加到 docker 组
sudo usermod -aG docker $USER
newgrp docker
```

### 镜像构建失败

```bash
# 手动构建
cd container
docker build -f Dockerfile.claude -t minibot-claude-code:latest .
```

## 安全注意事项

- ⚠️ 代码助手可以访问挂载目录中的所有文件
- ⚠️ 建议在临时目录中测试新功能
- ⚠️ 不要在容器中执行不信任的代码
- ⚠️ 定期清理容器镜像

## 相关文档

- [Claude Code 官方文档](https://docs.anthropic.com/en/docs/build-with-claude/claude-for-developers)
- [Docker 容器配置](/guide/docker)
- [配置选项](/guide/configuration)
