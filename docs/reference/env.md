# 环境变量参考

## LLM 配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `ZHIPU_API_KEY` | 智谱 AI API 密钥 | - |
| `ZHIPU_BASE_URL` | 智谱 API 地址 | `https://open.bigmodel.cn/api/coding/paas/v4` |
| `ANTHROPIC_API_KEY` | Anthropic API 密钥 | - |
| `OPENAI_API_KEY` | OpenAI API 密钥 | - |
| `OPENAI_BASE_URL` | OpenAI API 地址 | `https://api.openai.com/v1` |
| `LLM_PROVIDER` | 默认 LLM 提供商 | `zhipu` |
| `LLM_MODEL` | 默认模型 | - |
| `LLM_MAX_TOKENS` | 最大 token 数 | `4096` |
| `LLM_TEMPERATURE` | 温度参数 | `0.7` |

## 服务器配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `PORT` | 服务器端口 | `18790` |
| `HOST` | 服务器地址 | `0.0.0.0` |
| `CORS` | 启用 CORS | `true` |
| `LOG_LEVEL` | 日志级别 | `info` |

## 飞书配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `FEISHU_ENABLED` | 启用飞书 | `false` |
| `FEISHU_APP_ID` | 飞书应用 ID | - |
| `FEISHU_APP_SECRET` | 飞书应用密钥 | - |
| `FEISHU_ENCRYPT_KEY` | 飞书加密密钥 | - |
| `FEISHU_VERIFICATION_TOKEN` | 飞书验证令牌 | - |

## 容器配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `MINIBOT_WORKSPACE` | 工作空间路径 | `$HOME/minibot` |
| `CONTAINER_MEMORY_LIMIT` | 容器内存限制 | `2g` |
| `CONTAINER_CPU_LIMIT` | 容器 CPU 限制 | `2` |
| `CONTAINER_TIMEOUT` | 容器超时（毫秒） | `300000` |

## 环境配置

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `NODE_ENV` | 运行环境 | `development` |
| `MINIBOT_CONFIG` | 配置文件路径 | - |

## .env 文件示例

```env
# LLM 配置
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
LLM_MODEL=claude-sonnet-4-20250514

# 服务器配置
PORT=18790
HOST=0.0.0.0
LOG_LEVEL=info

# 飞书配置
FEISHU_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxx

# 容器配置
MINIBOT_WORKSPACE=$HOME/minibot
CONTAINER_MEMORY_LIMIT=2g
CONTAINER_TIMEOUT=300000
```
