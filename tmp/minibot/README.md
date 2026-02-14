# NanoClaw 容器化部署方案

这是 NanoClaw 项目的完整容器化部署方案，包括学习文档、部署脚本和管理工具。

## 📁 项目文件说明

### 文档文件
- **NanoClaw学习文档.md** - 完整的项目学习和架构文档
- **部署指南.md** - 详细的 Docker 部署和管理指南
- **README.md** - 本文件，项目总览

### 配置文件
- **Dockerfile.nanoclaw** - NanoClaw 的 Docker 镜像定义
- **docker-compose.yml** - Docker Compose 编排配置
- **.env.example** - 环境变量配置示例

### 脚本文件
- **容器化启动脚本.sh** - 一键部署启动脚本

## 🚀 快速开始

### 方式一：使用一键脚本（推荐）

```bash
# 克隆 NanoClaw 项目
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw

# 复制容器化文件
cp /path/to/容器化启动脚本.sh .
cp /path/to/Dockerfile.nanoclaw .
cp /path/to/docker-compose.yml .
cp /path/to/.env.example .

# 运行一键脚本
./容器化启动脚本.sh
```

### 方式二：手动部署

```bash
# 1. 安装 Docker 和 Docker Compose
# (如果尚未安装)

# 2. 克隆项目
git clone https://github.com/qwibitai/nanoclaw.git
cd nanoclaw

# 3. 配置环境变量
cp .env.example .env
nano .env  # 编辑配置文件

# 4. 启动服务
docker-compose up -d

# 5. 查看日志
docker-compose logs -f nanoclaw
```

## 📖 学习路径

1. **阅读架构文档**
   - 查看 `NanoClaw学习文档.md` 了解项目架构
   - 学习核心模块和文件结构

2. **理解容器化方案**
   - 阅读 `部署指南.md` 了解容器配置
   - 学习 Docker Compose 编排方式

3. **实践部署**
   - 使用 `容器化启动脚本.sh` 进行部署
   - 通过管理命令熟悉容器操作

## 🔧 核心特性

### NanoClaw 项目特性
- ✅ 轻量级：代码库小，易于理解和定制
- ✅ 安全：容器隔离，文件系统保护
- ✅ 简单：无配置文件，代码即配置
- ✅ AI 原生：集成 Claude Agent SDK
- ✅ 支持多个隔离组，每组独立记忆和文件系统

### 容器化方案特性
- ✅ 开箱即用：一键脚本快速部署
- ✅ 持久化存储：数据卷管理
- ✅ 资源限制：CPU 和内存控制
- ✅ 健康检查：自动监控服务状态
- ✅ 日志管理：自动轮转和备份
- ✅ 可扩展：支持水平扩展

## 📊 系统要求

### 最低要求
- Docker 20.10+
- Docker Compose 2.0+
- 1 CPU 核心
- 512MB 内存
- 2GB 磁盘空间

### 推荐配置
- Docker 24.0+
- Docker Compose 2.20+
- 2+ CPU 核心
- 2GB+ 内存
- 10GB+ 磁盘空间

### 软件依赖
- Node.js 20+（容器内）
- Anthropic API Key
- WhatsApp Business API（可选）

## 🛠️ 常用命令

### 容器管理
```bash
# 启动服务
docker-compose up -d

# 停止服务
docker-compose stop

# 重启服务
docker-compose restart

# 查看日志
docker-compose logs -f nanoclaw

# 查看状态
docker-compose ps

# 进入容器
docker exec -it nanoclaw /bin/bash
```

### 数据管理
```bash
# 备份数据
./backup.sh

# 恢复数据
./restore.sh <backup-file>

# 清理数据（危险！）
docker-compose down -v
```

### 更新升级
```bash
# 拉取最新代码
git pull

# 重新构建
docker-compose build

# 重启服务
docker-compose up -d
```

## 🔒 安全建议

1. **保护敏感信息**
   - 不要将 `.env` 文件提交到版本控制
   - 使用 Docker Secrets 存储密钥
   - 定期轮换 API 密钥

2. **网络安全**
   - 使用私有 Docker 网络
   - 配置防火墙规则
   - 启用 HTTPS（如暴露 Webhook）

3. **容器安全**
   - 以非 root 用户运行
   - 使用只读文件系统
   - 定期更新基础镜像

## 📈 性能优化

### 资源调整
编辑 `docker-compose.yml` 中的资源配置：
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 2G
```

### 日志管理
配置日志轮转以节省磁盘空间：
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
```

## 🐛 故障排查

### 容器无法启动
```bash
# 查看详细日志
docker logs nanoclaw

# 检查容器状态
docker inspect nanoclaw

# 进入容器调试
docker exec -it nanoclaw /bin/bash
```

### API 认证失败
- 检查 `.env` 文件中的 API 密钥是否正确
- 验证 Anthropic API Key 是否有效
- 确认网络连接正常

### 资源不足
```bash
# 查看资源使用情况
docker stats nanoclaw

# 调整资源限制
# 编辑 docker-compose.yml
```

## 📚 相关文档

- [NanoClaw 官方文档](https://github.com/qwibitai/nanoclaw)
- [Docker 文档](https://docs.docker.com/)
- [Docker Compose 文档](https://docs.docker.com/compose/)
- [Anthropic API 文档](https://docs.anthropic.com/)

## 🤝 社区和支持

- **GitHub Issues**: https://github.com/qwibitai/nanoclaw/issues
- **Discord 社区**: https://discord.gg/VGWXrf8x
- **项目文档**: https://github.com/qwibitai/nanoclaw

## 📝 许可证

MIT License - 详见项目 LICENSE 文件

## 🙏 致谢

感谢 NanoClaw 项目团队和所有贡献者。

---

**最后更新**: 2026-02-14
**版本**: 1.0.0
