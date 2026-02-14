#!/bin/bash

# NanoClaw 构建和部署脚本
set -e

echo "🚀 NanoClaw 构建和部署脚本"
echo "=============================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装，请先安装 Docker${NC}"
    exit 1
fi

# 检查 Docker Compose 是否安装
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装，请先安装 Docker Compose${NC}"
    exit 1
fi

# 检查 .env 文件
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  未找到 .env 文件，从 .env.example 复制...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  请编辑 .env 文件并填入正确的配置${NC}"
    read -p "按 Enter 继续..."
fi

# 检查环境变量
source .env

if [ -z "$ANTHROPIC_API_KEY" ]; then
    echo -e "${RED}❌ ANTHROPIC_API_KEY 未设置${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 环境检查通过${NC}"

# 构建 Docker 镜像
echo -e "${YELLOW}🔨 构建 Docker 镜像...${NC}"
if docker compose version &> /dev/null; then
    docker compose build
else
    docker-compose build
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker 镜像构建成功${NC}"
else
    echo -e "${RED}❌ Docker 镜像构建失败${NC}"
    exit 1
fi

# 启动容器
echo -e "${YELLOW}🚀 启动 NanoClaw 容器...${NC}"
if docker compose version &> /dev/null; then
    docker compose up -d
else
    docker-compose up -d
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ NanoClaw 容器启动成功${NC}"
else
    echo -e "${RED}❌ NanoClaw 容器启动失败${NC}"
    exit 1
fi

# 显示容器状态
echo -e "${YELLOW}📊 容器状态:${NC}"
if docker compose version &> /dev/null; then
    docker compose ps
else
    docker-compose ps
fi

# 显示日志
echo -e "${GREEN}📝 查看实时日志:${NC}"
if docker compose version &> /dev/null; then
    echo "  docker compose logs -f nanoclaw"
else
    echo "  docker-compose logs -f nanoclaw"
fi

# 显示停止命令
echo -e "${GREEN}🛑 停止容器:${NC}"
if docker compose version &> /dev/null; then
    echo "  docker compose down"
else
    echo "  docker-compose down"
fi

echo -e "${GREEN}✅ 部署完成！${NC}"
