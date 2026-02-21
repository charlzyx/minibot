# 快速开始

## 安装

```bash
git clone https://github.com/charlzyx/minibot.git
cd minibot
npm install
```

## 配置

创建 `.env` 文件：

```env
# 智谱 AI (默认)
ZHIPU_API_KEY=your_api_key
ZHIPU_BASE_URL=https://open.bigmodel.cn/api/coding/paas/v4

# 或者使用 Anthropic Claude
ANTHROPIC_API_KEY=your_api_key

# 飞书集成
FEISHU_APP_ID=your_app_id
FEISHU_APP_SECRET=your_app_secret

# 服务器配置
PORT=18790
HOST=0.0.0.0
LOG_LEVEL=info

# 容器配置
MINIBOT_WORKSPACE=$HOME/minibot
```

## 运行

### 开发模式

```bash
npm run dev
# 或使用 CLI
minibot dev
```

### 生产模式

```bash
npm run build
npm start
# 或使用 CLI
minibot start
```

## 验证安装

```bash
# 健康检查
curl http://localhost:18790/health

# 或使用 CLI
minibot doctor
```

## 下一步

- [配置 LLM 提供商](/guide/llm)
- [配置消息通道](/guide/channels)
- [使用代码助手](/guide/code-assistant)
