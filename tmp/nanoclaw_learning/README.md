# NanoClaw 完整学习文档

## 📚 项目简介

NanoClaw 是一个轻量级的 Claude AI 助手，设计在 Apple 容器中运行，提供安全的 AI 对话体验。

### 核心特性
- 🔒 **安全隔离**: 在容器中运行，保护主机安全
- 💬 **WhatsApp 集成**: 通过 WhatsApp 进行交互
- 🧠 **内存管理**: 持久化存储和检索对话记忆
- ⏰ **任务调度**: 支持定时任务和提醒
- 🛠️ **可扩展**: 基于 Anthropic Agents SDK 构建

---

## 🏗️ 架构设计

### 1. 核心模块

#### `src/index.ts` - 主入口
- 初始化应用
- 加载配置
- 启动服务

#### `src/container-runner.ts` - 容器运行器 (20KB+)
- 管理容器生命周期
- 处理容器通信
- 安全隔离

#### `src/db.ts` - 数据库管理 (16KB)
- SQLite 数据库操作
- 消息存储
- 记忆管理

#### `src/task-scheduler.ts` - 任务调度
- 定时任务执行
- Cron 表达式支持
- 任务队列管理

#### `src/mount-security.ts` - 挂载安全
- 文件系统隔离
- 权限控制
- 安全挂载点

#### `src/ipc.ts` - 进程间通信
- 主进程与容器通信
- 消息路由
- 认证机制

#### `src/whatsapp-auth.ts` - WhatsApp 认证
- WhatsApp 登录
- 二维码生成
- 会话管理

### 2. 目录结构
```
nanoclaw/
├── src/
│   ├── index.ts              # 主入口
│   ├── container-runner.ts  # 容器运行器
│   ├── db.ts                 # 数据库
│   ├── task-scheduler.ts     # 任务调度
│   ├── ipc.ts                # 进程通信
│   ├── router.ts             # 消息路由
│   ├── types.ts              # 类型定义
│   ├── logger.ts             # 日志工具
│   ├── whatsapp-auth.ts      # WhatsApp 认证
│   └── channels/             # 通信渠道
│       ├── whatsapp.ts       # WhatsApp 集成
│       └── ...
├── container/
│   ├── Dockerfile            # Docker 镜像
│   ├── build.sh              # 构建脚本
│   ├── agent-runner/         # Agent 运行器
│   └── skills/               # 技能定义
├── config-examples/          # 配置示例
├── docs/                     # 文档
└── package.json
```

---

## 🐳 Docker 容器化部署

### 快速开始

#### 1. 克隆仓库
```bash
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 构建项目
```bash
npm run build
```

#### 4. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，填入 ANTHROPIC_API_KEY 等
```

#### 5. 运行容器
```bash
chmod +x deploy.sh
./deploy.sh
```

### 手动部署

#### 构建 Docker 镜像
```bash
docker build -t nanoclaw:latest .
```

#### 运行容器
```bash
docker run -d \
  --name nanoclaw \
  --restart unless-stopped \
  -e ANTHROPIC_API_KEY=your_key_here \
  -v nanoclaw-data:/app/data \
  -v nanoclaw-logs:/app/logs \
  nanoclaw:latest
```

### 使用 Docker Compose
```bash
docker-compose up -d
```

### 查看日志
```bash
docker-compose logs -f nanoclaw
```

### 停止容器
```bash
docker-compose down
```

---

## ⚙️ 配置说明

### 必需配置
- `ANTHROPIC_API_KEY`: Anthropic API 密钥
- `WHATSAPP_PHONE_NUMBER`: WhatsApp 手机号码

### 可选配置
- `LOG_LEVEL`: 日志级别 (error/warn/info/debug)
- `TZ`: 时区 (默认: Asia/Shanghai)
- `DB_PATH`: 数据库路径
- `ENABLE_SCHEDULER`: 启用任务调度
- `READ_ONLY_MODE`: 只读模式

---

## 🔧 核心功能详解

### 1. 容器安全
- 使用 Apple 容器技术
- 文件系统隔离
- 网络隔离
- 权限限制

### 2. WhatsApp 集成
- 基于 Baileys 库
- 支持消息收发
- 二维码登录
- 会话管理

### 3. 数据持久化
- SQLite 数据库
- 消息历史存储
- 用户记忆管理
- 定期备份

### 4. 任务调度
- Cron 表达式支持
- 定时提醒
- 周期性任务
- 任务队列

### 5. 进程间通信
- 主进程与 Agent 通信
- 安全认证
- 消息路由
- 错误处理

---

## 📊 监控和运维

### 健康检查
```bash
docker ps --filter "name=nanoclaw"
```

### 查看资源使用
```bash
docker stats nanoclaw
```

### 进入容器
```bash
docker exec -it nanoclaw sh
```

### 备份数据
```bash
docker run --rm -v nanoclaw-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/nanoclaw-backup-$(date +%Y%m%d).tar.gz /data
```

### 恢复数据
```bash
docker run --rm -v nanoclaw-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/nanoclaw-backup-YYYYMMDD.tar.gz -C /
```

---

## 🚀 高级用法

### 1. 自定义技能
在 `container/skills/` 目录下创建自定义技能文件。

### 2. 多实例部署
```yaml
# docker-compose.override.yml
services:
  nanoclaw-1:
    container_name: nanoclaw-1
    environment:
      - WHATSAPP_PHONE_NUMBER=+8613800138000
      
  nanoclaw-2:
    container_name: nanoclaw-2
    environment:
      - WHATSAPP_PHONE_NUMBER=+8613800138001
```

### 3. 日志聚合
使用 ELK Stack 或 Grafana 进行日志分析和可视化。

---

## 🐛 故障排查

### 常见问题

#### 1. 容器无法启动
```bash
# 检查日志
docker-compose logs nanoclaw

# 检查配置
docker-compose config
```

#### 2. WhatsApp 连接失败
- 检查网络连接
- 验证手机号码格式
- 查看认证日志

#### 3. 数据库错误
- 检查数据卷权限
- 验证数据库路径
- 检查磁盘空间

---

## 📝 开发指南

### 本地开发
```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 运行测试
npm test

# 类型检查
npm run typecheck

# 代码格式化
npm run format
```

### 构建
```bash
npm run build
```

### 添加新功能
1. 在 `src/` 目录下创建新模块
2. 在 `src/index.ts` 中注册
3. 编写测试
4. 更新文档

---

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request

---

## 📄 许可证

MIT License

---

## 🔗 相关链接

- GitHub: https://github.com/qwibitai/nanoclaw
- Discord: https://discord.gg/VGWXrf8x
- Anthropic: https://www.anthropic.com

---

## 📞 支持

如有问题，请提交 Issue 或加入 Discord 社区。
