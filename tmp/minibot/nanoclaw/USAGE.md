# NanoClaw 使用指南

## 📁 项目结构

```
/tmp/minibot/nanoclaw/
├── README.md                    # 完整项目文档
├── USAGE.md                     # 本文件 - 使用指南
├── nanoclaw-dockerfile.txt      # 原始 Dockerfile 参考
├── nanoclaw-config.txt          # 原始配置参考
└── simplified/                  # 简化实现
    ├── src/
    │   └── index.ts            # 主程序 (TypeScript)
    ├── Dockerfile              # Docker 镜像定义
    ├── docker-compose.yml      # Docker Compose 配置
    ├── package.json            # 项目依赖
    ├── tsconfig.json           # TypeScript 配置
    ├── build.sh               # 构建脚本
    ├── run.sh                 # 运行脚本
    └── .dockerignore          # Docker 忽略文件
```

## 🎯 快速开始

### 步骤 1: 准备环境

确保你有 Docker 和 Anthropic API Key:

```bash
# 检查 Docker
docker --version

# 设置 API Key (可选，也可以在运行时提供)
export ANTHROPIC_API_KEY=sk-ant-xxxxx
```

### 步骤 2: 构建镜像

```bash
cd /tmp/minibot/nanoclaw/simplified

# 赋予执行权限
chmod +x build.sh run.sh

# 构建 Docker 镜像
./build.sh
```

### 步骤 3: 运行

```bash
# 方法 1: 使用 run.sh 脚本
./run.sh

# 方法 2: 使用 docker-compose
echo "ANTHROPIC_API_KEY=sk-ant-xxxxx" > .env
docker-compose up -d

# 方法 3: 直接使用 docker run
docker run -it --rm \
    -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
    -e ASSISTANT_NAME="MyBot" \
    nanoclaw-agent:latest
```

## 💬 交互示例

### 基础对话

```
🤖 NanoClaw initialized
📝 Available skills: echo, help, time

Type your message or 'exit' to quit:

> 你好，请介绍一下你自己
🤔 Thinking...
💬 NanoClaw: 你好! 我是 NanoClaw, 一个轻量级的 AI 助手。我可以使用内置技能与你交互，或者通过 Claude 模型回答你的问题。
```

### 使用技能

```
> help
🔧 Executing skill: help
- echo: Echo back input
- help: List available skills
- time: Get current time

> time
🔧 Executing skill: time
2024-02-14T12:34:56.789Z

> echo Hello World
🔧 Executing skill: echo
Echo: Hello World
```

### 复杂对话

```
> 用 Python 写一个冒泡排序
🤔 Thinking...
💬 NanoClaw: 以下是一个简单的冒泡排序实现:

```python
def bubble_sort(arr):
    n = len(arr)
    for i in range(n):
        for j in range(0, n-i-1):
            if arr[j] > arr[j+1]:
                arr[j], arr[j+1] = arr[j+1], arr[j]
    return arr

# 使用示例
numbers = [64, 34, 25, 12, 22, 11, 90]
sorted_numbers = bubble_sort(numbers.copy())
print(sorted_numbers)
```

这个算法的时间复杂度是 O(n²)。
```

## 🔧 自定义配置

### 修改助手名称

```bash
# 方法 1: 环境变量
docker run -it --rm \
    -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
    -e ASSISTANT_NAME="ClaudeBot" \
    nanoclaw-agent:latest

# 方法 2: 修改 docker-compose.yml
services:
  nanoclaw:
    environment:
      - ASSISTANT_NAME=ClaudeBot
```

### 使用不同的模型

```bash
docker run -it --rm \
    -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
    -e MODEL=claude-3-haiku-20240307 \
    nanoclaw-agent:latest
```

### 调整输出长度

```bash
docker run -it --rm \
    -e ANTHROPIC_API_KEY=sk-ant-xxxxx \
    -e MAX_TOKENS=8192 \
    nanoclaw-agent:latest
```

## 📊 监控和调试

### 查看日志

```bash
# 使用 docker-compose
docker-compose logs -f

# 使用 docker
docker logs -f nanoclaw-agent
```

### 进入容器调试

```bash
# 运行容器后，另开一个终端
docker exec -it nanoclaw-agent sh

# 查看进程
ps aux

# 查看文件
ls -la /app
```

### 检查资源使用

```bash
# 查看容器资源使用
docker stats nanoclaw-agent

# 查看磁盘使用
docker system df
```

## 🔍 故障排除

### 问题 1: API Key 错误

```
❌ Error: 401 {"error":{"message":"Invalid API key"}}
```

**解决方法**: 检查 API Key 是否正确

```bash
# 验证 API Key
echo $ANTHROPIC_API_KEY
```

### 问题 2: 容器无法启动

```
Error: Cannot connect to the Docker daemon
```

**解决方法**: 启动 Docker 服务

```bash
# macOS/Linux
sudo service docker start

# 或
sudo systemctl start docker
```

### 问题 3: 构建失败

```
ERROR: failed to solve: ...
```

**解决方法**: 清理 Docker 缓存

```bash
# 清理构建缓存
docker builder prune -a

# 重新构建
./build.sh
```

### 问题 4: 权限错误

```
Error: EACCES: permission denied
```

**解决方法**: 确保脚本有执行权限

```bash
chmod +x build.sh run.sh
```

## 🚀 生产部署

### 使用 systemd (Linux)

创建服务文件 `/etc/systemd/system/nanoclaw.service`:

```ini
[Unit]
Description=NanoClaw AI Assistant
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/path/to/simplified
Environment=ANTHROPIC_API_KEY=sk-ant-xxxxx
ExecStart=/usr/local/bin/docker-compose up
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
sudo systemctl enable nanoclaw
sudo systemctl start nanoclaw
```

### 使用 Docker Swarm

```bash
# 初始化 Swarm
docker swarm init

# 部署栈
docker stack deploy -c docker-compose.yml nanoclaw

# 查看服务
docker service ls
```

## 📈 性能优化

### 构建优化

1. **使用构建缓存**: Dockerfile 已优化层级
2. **多阶段构建**: 减小镜像体积
3. **.dockerignore**: 排除不必要的文件

### 运行优化

1. **资源限制**: 在 docker-compose.yml 中设置
2. **日志轮转**: 配置 Docker 日志驱动
3. **健康检查**: 已内置健康检查

### 网络优化

```yaml
# docker-compose.yml
services:
  nanoclaw:
    networks:
      - nanoclaw-net
networks:
  nanoclaw-net:
    driver: bridge
```

## 🔐 安全最佳实践

1. **不要在代码中硬编码 API Key**
   ```bash
   # ❌ 错误
   export ANTHROPIC_API_KEY=sk-ant-xxx
   
   # ✅ 正确
   echo "ANTHROPIC_API_KEY=sk-ant-xxx" > .env
   # 将 .env 添加到 .gitignore
   ```

2. **使用 secrets (Docker Swarm)**
   ```bash
   echo "sk-ant-xxx" | docker secret create api_key -
   ```

3. **定期更新基础镜像**
   ```bash
   docker pull node:22-slim
   ./build.sh
   ```

4. **扫描镜像漏洞**
   ```bash
   docker scan nanoclaw-agent:latest
   ```

## 📚 更多资源

- [Docker 官方文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Anthropic API 文档](https://docs.anthropic.com/)
- [TypeScript 手册](https://www.typescriptlang.org/docs/)

## 🆘 获取帮助

1. 查看 README.md 获取完整文档
2. 检查日志文件
3. 提交 Issue 到原始项目
4. 查看 NanoClaw Discord 社区

---

**提示**: 记得定期清理未使用的资源:

```bash
# 清理未使用的镜像
docker image prune -a

# 清理未使用的容器
docker container prune

# 清理所有未使用的资源
docker system prune -a
```
