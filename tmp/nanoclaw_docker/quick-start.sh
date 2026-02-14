#!/bin/bash

# NanoClaw 快速启动脚本
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${GREEN}🚀 NanoClaw 快速启动${NC}"
echo "=============================="

# 函数: 显示菜单
show_menu() {
    echo ""
    echo "请选择操作:"
    echo "1) 安装依赖并构建"
    echo "2) 配置环境变量"
    echo "3) 启动容器"
    echo "4) 停止容器"
    echo "5) 查看日志"
    echo "6) 重启容器"
    echo "7) 备份数据"
    echo "8) 恢复数据"
    echo "9) 查看状态"
    echo "0) 退出"
    echo -n "请输入选项 (0-9): "
}

# 函数: 安装依赖
install_deps() {
    echo -e "${YELLOW}📦 安装依赖...${NC}"
    npm install
    npm run build
    echo -e "${GREEN}✅ 安装完成${NC}"
}

# 函数: 配置环境
setup_env() {
    if [ ! -f .env ]; then
        echo -e "${YELLOW}⚙️  创建环境配置...${NC}"
        cp .env.example .env
        echo "已创建 .env 文件，请编辑并填入配置"
        read -p "按 Enter 继续编辑 .env 文件..."
        ${EDITOR:-nano} .env
    else
        echo -e "${GREEN}✅ .env 文件已存在${NC}"
        read -p "是否重新编辑? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            ${EDITOR:-nano} .env
        fi
    fi
}

# 函数: 启动容器
start_container() {
    echo -e "${YELLOW}🚀 启动容器...${NC}"
    if [ ! -f .env ]; then
        echo -e "${YELLOW}⚠️  .env 文件不存在，先配置环境${NC}"
        setup_env
    fi
    
    docker-compose up -d
    echo -e "${GREEN}✅ 容器已启动${NC}"
}

# 函数: 停止容器
stop_container() {
    echo -e "${YELLOW}🛑 停止容器...${NC}"
    docker-compose down
    echo -e "${GREEN}✅ 容器已停止${NC}"
}

# 函数: 查看日志
view_logs() {
    echo -e "${GREEN}📝 查看日志 (Ctrl+C 退出)${NC}"
    docker-compose logs -f nanoclaw
}

# 函数: 重启容器
restart_container() {
    echo -e "${YELLOW}🔄 重启容器...${NC}"
    docker-compose restart
    echo -e "${GREEN}✅ 容器已重启${NC}"
}

# 函数: 备份数据
backup_data() {
    BACKUP_DIR="./backups"
    mkdir -p "$BACKUP_DIR"
    BACKUP_FILE="$BACKUP_DIR/nanoclaw-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    echo -e "${YELLOW}💾 备份数据到 $BACKUP_FILE...${NC}"
    
    docker run --rm \
        -v nanoclaw-data:/data \
        -v nanoclaw-logs:/logs \
        -v "$(pwd)/$BACKUP_DIR":/backup \
        alpine tar czf "/backup/$(basename $BACKUP_FILE)" /data /logs
    
    echo -e "${GREEN}✅ 备份完成${NC}"
}

# 函数: 恢复数据
restore_data() {
    BACKUP_DIR="./backups"
    
    echo "可用的备份:"
    ls -lh "$BACKUP_DIR"/*.tar.gz 2>/dev/null || echo "没有找到备份文件"
    
    read -p "请输入备份文件名: " BACKUP_FILE
    
    if [ -f "$BACKUP_DIR/$BACKUP_FILE" ]; then
        echo -e "${YELLOW}⚠️  这将覆盖现有数据，确认继续? (y/n)${NC}"
        read -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}📥 恢复数据...${NC}"
            docker run --rm \
                -v nanoclaw-data:/data \
                -v nanoclaw-logs:/logs \
                -v "$(pwd)/$BACKUP_DIR":/backup \
                alpine sh -c "cd / && tar xzf /backup/$BACKUP_FILE"
            echo -e "${GREEN}✅ 恢复完成，请重启容器${NC}"
        fi
    else
        echo -e "${YELLOW}⚠️  文件不存在${NC}"
    fi
}

# 函数: 查看状态
check_status() {
    echo -e "${GREEN}📊 容器状态${NC}"
    docker-compose ps
    echo ""
    echo -e "${GREEN}📈 资源使用${NC}"
    docker stats nanoclaw --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
}

# 主循环
while true; do
    show_menu
    read -r choice
    
    case $choice in
        1) install_deps ;;
        2) setup_env ;;
        3) start_container ;;
        4) stop_container ;;
        5) view_logs ;;
        6) restart_container ;;
        7) backup_data ;;
        8) restore_data ;;
        9) check_status ;;
        0) 
            echo -e "${GREEN}👋 再见！${NC}"
            exit 0
            ;;
        *) 
            echo -e "${YELLOW}⚠️  无效选项${NC}"
            ;;
    esac
done
