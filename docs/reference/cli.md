# CLI 命令参考

## 命令列表

### minibot dev

启动开发服务器。

```bash
minibot dev [options]
```

选项：
- `--workspace <path>` - 工作空间目录
- `--port <number>` - 服务器端口

### minibot start

启动生产服务器。

```bash
minibot start [options]
```

选项：
- `--workspace <path>` - 工作空间目录
- `--port <number>` - 服务器端口

### minibot build

构建项目。

```bash
minibot build
```

### minibot test

运行测试。

```bash
minibot test [options]
```

选项：
- `--coverage` - 生成覆盖率报告
- `--watch` - 监听模式

### minibot code

在容器中运行 Claude Code。

```bash
minibot code <task> [options]
```

参数：
- `task` - 代码任务描述

选项：
- `--project <path>` - 项目目录路径
- `--model <name>` - Claude 模型
- `--timeout <ms>` - 超时时间（毫秒）

示例：

```bash
minibot code "重构这个文件"
minibot code "添加测试" --project ./src
minibot code "代码审查" --model claude-sonnet-4
```

### minibot container

容器管理命令。

```bash
minibot container <command>
```

子命令：
- `build` - 构建容器镜像
- `stop` - 停止所有运行的容器
- `list` - 列出运行的容器

### minibot doctor

系统健康检查。

```bash
minibot doctor
```

检查项：
- Node.js 版本
- 配置文件
- Docker 安装
- 工作空间目录

## 全局选项

- `-h, --help` - 显示帮助
- `-v, --version` - 显示版本

## 退出码

- `0` - 成功
- `1` - 错误
