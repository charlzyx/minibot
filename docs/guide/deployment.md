# 部署指南

## 系统要求

- Node.js >= 18
- Docker (用于代码助手)
- 2GB+ 内存
- Linux / macOS

## 部署方式

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 18790
CMD ["npm", "start"]
```

构建和运行：

```bash
docker build -t minibot .
docker run -p 18790:18790 --env-file .env minibot
```

### systemd 服务

创建 `/etc/systemd/system/minibot.service`：

```ini
[Unit]
Description=Minibot AI Assistant
After=network.target

[Service]
Type=simple
User=minibot
WorkingDirectory=/opt/minibot
Environment="NODE_ENV=production"
EnvironmentFile=/opt/minibot/.env
ExecStart=/usr/bin/node /opt/minibot/dist/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启用和启动：

```bash
sudo systemctl enable minibot
sudo systemctl start minibot
sudo systemctl status minibot
```

### macOS LaunchAgent

创建 `~/Library/LaunchAgents/com.github.charlzyx.minibot.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.github.charlzyx.minibot</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>/opt/minibot/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/opt/minibot</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
    </dict>
</dict>
</plist>
```

加载服务：

```bash
launchctl load ~/Library/LaunchAgents/com.github.charlzyx.minibot.plist
launchctl start com.github.charlzyx.minibot
```

## 反向代理

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:18790;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Caddy

```
your-domain.com {
    reverse_proxy localhost:18790
}
```

## 监控和日志

### 日志位置

- **systemd**: `journalctl -u minibot -f`
- **应用日志**: `$HOME/minibot/logs/`

### 健康检查

```bash
curl http://localhost:18790/health
```

### 监控命令

在飞书中发送：

```
/monitor
/health
```

## 更新部署

```bash
cd /opt/minibot
git pull
npm install
npm run build
sudo systemctl restart minibot
```

## 故障排查

### 服务无法启动

```bash
# 查看日志
sudo journalctl -u minibot -n 50

# 检查配置
minibot doctor
```

### 容器权限问题

```bash
sudo usermod -aG docker $USER
newgrp docker
```

### 端口冲突

```bash
# 查看占用端口
lsof -i :18790

# 修改端口
export PORT=8080
minibot start
```

## 相关文档

- [配置指南](/guide/configuration)
- [快速开始](/guide/getting-started)
