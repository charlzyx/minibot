#!/bin/bash

# NanoClaw 容器化快速启动脚本

set -e

echo "====================================="
echo "   NanoClaw 容器化部署脚本"
echo "====================================="

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    echo "   访问: https://docs.docker.com/get-docker/"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    echo "   访问: https://docs.docker.com/compose/install/"
    exit 1
fi

echo "✅ Docker 环境检查通过"

# 检查 .env 文件
if [ ! -f .env ]; then
    echo ""
    echo "📝 首次运行，创建配置文件..."
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "✅ 已创建 .env 文件"
        echo ""
        echo "⚠️  重要：请编辑 .env 文件并配置以下变量："
        echo "   - ANTHROPIC_API_KEY (必需)"
        echo "   - WHATSAPP_ACCESS_TOKEN (如果使用 WhatsApp)"
        echo ""
        read -p "是否现在编辑 .env 文件？(y/n): " edit_env
        if [ "$edit_env" = "y" ] || [ "$edit_env" = "Y" ]; then
            ${EDITOR:-nano} .env
        fi
    else
        echo "❌ 找不到 .env.example 文件"
        exit 1
    fi
fi

# 验证必需的环境变量
echo ""
echo "🔍 验证配置..."

if grep -q "^ANTHROPIC_API_KEY=.*your_anthropic_api_key_here" .env; then
    echo "⚠️  警告: ANTHROPIC_API_KEY 未配置"
    read -p "是否继续？(y/n): " continue_anyway
    if [ "$continue_anyway" != "y" ] && [ "$continue_anyway" != "Y" ]; then
        echo "已取消部署"
        exit 1
    fi
fi

echo "✅ 配置验证完成"

# 创建必要的目录
echo ""
echo "📁 创建数据目录..."
mkdir -p data logs groups config
echo "✅ 目录创建完成"

# 构建镜像
echo ""
echo "🔨 构建 Docker 镜像..."
docker-compose build

# 启动服务
echo ""
echo "🚀 启动 NanoClaw 服务..."
docker-compose up -d

# 等待服务启动
echo ""
echo "⏳ 等待服务启动..."
sleep 5

# 检查服务状态
if docker ps | grep -q nanoclaw; then
    echo "✅ NanoClaw 服务已成功启动！"
    echo ""
    echo "📊 查看日志:"
    echo "   docker-compose logs -f nanoclaw"
    echo ""
    echo "🔧 管理命令:"
    echo "   停止服务: docker-compose stop"
    echo "   重启服务: docker-compose restart"
    echo "   查看状态: docker-compose ps"
    echo ""
    echo "📚 更多信息: https://github.com/qwibitai/nanoclaw"
    echo "💬 社区支持: https://discord.gg/VGWXrf8x"
else
    echo "❌ 服务启动失败，请查看日志："
    echo "   docker-compose logs nanoclaw"
    exit 1
fi
