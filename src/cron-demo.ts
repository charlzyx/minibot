#!/usr/bin/env node

/**
 * 定时任务系统示例程序
 * 演示如何使用定时任务系统的所有功能
 */

import { CronScheduler } from './cron/scheduler'
import { WorkspaceManager, WorkspaceConfig } from './cron/workspace'
import { SubagentManager, SubagentConfig } from './cron/subagent'
import { ErrorHandler, TaskPriority } from './cron/error-handler'
import { CronParser } from './cron/parser'
import { ShellExecutor } from './cron/executor'
import fs from 'fs'
import path from 'path'

async function main() {
  console.log('🚀 定时任务系统示例程序')
  console.log('='.repeat(50))

  try {
    await demoCronParser()
    await demoShellExecutor()
    await demoWorkspaceManager()
    await demoSubagentManager()
    await demoCronScheduler()
    
    console.log('\n✅ 所有示例执行完成！')
  } catch (error) {
    console.error('\n❌ 示例执行失败:', error)
    process.exit(1)
  }
}

async function demoCronParser() {
  console.log('\n📅 Cron表达式解析器演示')
  console.log('-'.repeat(50))

  const expressions = [
    '0 2 * * *',
    '*/5 * * * *',
    '0 0 * * 0',
    '0 0 1 * *',
    '0 9-17 * * 1-5',
    '0 */30 * * * *'
  ]

  for (const expr of expressions) {
    try {
      const schedule = CronParser.parse(expr)
      const nextRun = CronParser.getNextRunTime(schedule)
      console.log(`表达式: ${expr}`)
      console.log(`  下次执行: ${nextRun.toLocaleString('zh-CN')}`)
      console.log(`  应该现在执行: ${CronParser.shouldRunNow(schedule)}`)
      console.log()
    } catch (error) {
      console.error(`解析失败: ${expr}`, error)
    }
  }
}

async function demoShellExecutor() {
  console.log('\n🐚 Shell脚本执行器演示')
  console.log('-'.repeat(50))

  const testScript = `#!/bin/bash
echo "Hello from shell script!"
echo "Current directory: $(pwd)"
echo "Environment variable TEST_VAR: $TEST_VAR"
exit 0
`

  const scriptPath = path.join(process.cwd(), 'test-script.sh')
  fs.writeFileSync(scriptPath, testScript, 'utf8')
  fs.chmodSync(scriptPath, '755')

  try {
    const result = await ShellExecutor.execute({
      command: 'bash',
      args: [scriptPath],
      env: {
        TEST_VAR: 'test-value'
      },
      timeout: 5000
    })

    console.log('执行结果:')
    console.log(`  退出码: ${result.exitCode}`)
    console.log(`  成功: ${result.success}`)
    console.log(`  耗时: ${result.duration}ms`)
    console.log(`  标准输出:\n${result.stdout}`)
    if (result.stderr) {
      console.log(`  标准错误:\n${result.stderr}`)
    }
  } finally {
    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath)
    }
  }
}

async function demoWorkspaceManager() {
  console.log('\n🏠 工作区管理器演示')
  console.log('-'.repeat(50))

  const workspaceManager = new WorkspaceManager('./workspaces')

  try {
    const workspaceConfig: WorkspaceConfig = {
      id: 'demo-workspace',
      maxFileSize: 1024 * 1024,
      maxTotalSize: 10 * 1024 * 1024,
      allowedCommands: ['bash', 'echo', 'ls'],
      deniedCommands: ['rm', 'del'],
      resourceLimits: {
        maxCpu: 1,
        maxMemory: 512,
        maxProcesses: 5
      }
    }

    console.log('创建工作区...')
    const workspace = await workspaceManager.createWorkspace(workspaceConfig)
    console.log(`  工作区ID: ${workspace.id}`)
    console.log(`  工作区路径: ${workspace.path}`)
    console.log(`  创建时间: ${workspace.createdAt.toLocaleString('zh-CN')}`)

    console.log('\n在工作区中执行任务...')
    const result = await workspaceManager.executeInWorkspace(
      'demo-workspace',
      async (workspacePath) => {
        const testFile = path.join(workspacePath, 'test.txt')
        fs.writeFileSync(testFile, 'Hello from workspace!', 'utf8')
        
        const files = fs.readdirSync(workspacePath)
        return {
          files,
          testFileContent: fs.readFileSync(testFile, 'utf8')
        }
      }
    )

    console.log(`  工作区文件: ${result.files.join(', ')}`)
    console.log(`  测试文件内容: ${result.testFileContent}`)

    console.log('\n列出所有工作区...')
    const workspaces = await workspaceManager.listWorkspaces()
    console.log(`  工作区数量: ${workspaces.length}`)
    for (const ws of workspaces) {
      console.log(`    - ${ws.id}: ${ws.path}`)
    }

    console.log('\n删除工作区...')
    await workspaceManager.deleteWorkspace('demo-workspace')
    console.log('  工作区已删除')

    await workspaceManager.close()
  } catch (error) {
    console.error('工作区演示失败:', error)
  }
}

async function demoSubagentManager() {
  console.log('\n🤖 子代理管理器演示')
  console.log('-'.repeat(50))

  const subagentManager = new SubagentManager()

  try {
    const subagentConfig: SubagentConfig = {
      id: 'demo-subagent',
      name: 'Demo Subagent',
      capabilities: ['shell', 'file', 'web'],
      maxConcurrentTasks: 3,
      priority: 100
    }

    console.log('注册子代理...')
    subagentManager.registerSubagent(subagentConfig)
    console.log(`  子代理ID: ${subagentConfig.id}`)
    console.log(`  子代理名称: ${subagentConfig.name}`)

    console.log('\n获取子代理状态...')
    const subagent = subagentManager.getSubagent('demo-subagent')
    if (subagent) {
      console.log(`  状态: ${subagent.status}`)
      console.log(`  当前任务: ${subagent.currentTask || '无'}`)
      console.log(`  已完成任务: ${subagent.tasksCompleted}`)
      console.log(`  失败任务: ${subagent.tasksFailed}`)
    }

    console.log('\n提交测试任务...')
    const taskId = subagentManager.submitTask({
      type: 'test',
      payload: { message: 'Hello from subagent!' },
      priority: 100,
      timeout: 5000,
      retries: 2,
      assignedTo: null
    })
    console.log(`  任务ID: ${taskId}`)

    console.log('\n获取任务状态...')
    const task = subagentManager.getTask(taskId)
    if (task) {
      console.log(`  状态: ${task.status}`)
      console.log(`  优先级: ${task.priority}`)
    }

    console.log('\n获取系统负载...')
    const load = subagentManager.getSystemLoad()
    console.log(`  总子代理数: ${load.totalSubagents}`)
    console.log(`  空闲子代理: ${load.idleSubagents}`)
    console.log(`  忙碌子代理: ${load.busySubagents}`)
    console.log(`  总任务数: ${load.totalTasks}`)
    console.log(`  待处理任务: ${load.pendingTasks}`)
    console.log(`  运行中任务: ${load.runningTasks}`)
    console.log(`  平均负载: ${load.averageLoad.toFixed(2)}`)

    subagentManager.stop()
  } catch (error) {
    console.error('子代理演示失败:', error)
  }
}

async function demoCronScheduler() {
  console.log('\n⏰ 定时任务调度器演示')
  console.log('-'.repeat(50))

  const scheduler = new CronScheduler({
    checkInterval: 1000,
    workspaceBasePath: './workspaces',
    enableSubagent: true,
    subagentConfigs: [
      {
        id: 'demo-subagent-1',
        name: 'Demo Subagent 1',
        capabilities: ['shell', 'file'],
        maxConcurrentTasks: 3,
        priority: 100
      },
      {
        id: 'demo-subagent-2',
        name: 'Demo Subagent 2',
        capabilities: ['shell'],
        maxConcurrentTasks: 2,
        priority: 50
      }
    ]
  })

  try {
    console.log('启动调度器...')
    await scheduler.start()
    console.log('  调度器已启动')

    console.log('\n添加示例任务...')
    
    const testScript = `#!/bin/bash
echo "Task executed at $(date)"
echo "Task name: $TASK_NAME"
echo "Task priority: $TASK_PRIORITY"
exit 0
`

    const scriptPath = path.join(process.cwd(), 'demo-task.sh')
    fs.writeFileSync(scriptPath, testScript, 'utf8')
    fs.chmodSync(scriptPath, '755')

    const jobs = [
      {
        name: 'High Priority Task',
        cronExpression: '*/30 * * * * *',
        command: 'bash',
        args: [scriptPath],
        env: {
          TASK_NAME: 'High Priority Task',
          TASK_PRIORITY: 'high'
        },
        enabled: true,
        priority: ErrorHandler.getPriority('high'),
        timeout: 10000,
        maxRetries: 2
      },
      {
        name: 'Normal Priority Task',
        cronExpression: '*/45 * * * * *',
        command: 'bash',
        args: [scriptPath],
        env: {
          TASK_NAME: 'Normal Priority Task',
          TASK_PRIORITY: 'normal'
        },
        enabled: true,
        priority: ErrorHandler.getPriority('normal'),
        timeout: 10000,
        maxRetries: 1
      }
    ]

    for (const jobConfig of jobs) {
      const job = await scheduler.addJob(jobConfig)
      console.log(`  任务添加: ${job.name}`)
      console.log(`    Cron表达式: ${job.cronExpression}`)
      console.log(`    下次执行: ${job.nextRun?.toLocaleString('zh-CN')}`)
    }

    console.log('\n监听任务事件...')
    scheduler.on('job:started', (job) => {
      console.log(`\n📋 任务开始: ${job.name}`)
    })

    scheduler.on('job:completed', (job, result) => {
      console.log(`✅ 任务完成: ${job.name}`)
      console.log(`   耗时: ${result.duration}ms`)
    })

    scheduler.on('job:failed', (job, error) => {
      console.log(`❌ 任务失败: ${job.name}`)
      console.log(`   错误: ${error.error}`)
    })

    console.log('\n获取调度器统计信息...')
    const stats = scheduler.getStats()
    console.log(`  总任务数: ${stats.totalJobs}`)
    console.log(`  启用任务: ${stats.enabledJobs}`)
    console.log(`  禁用任务: ${stats.disabledJobs}`)
    console.log(`  总执行次数: ${stats.totalRuns}`)
    console.log(`  成功次数: ${stats.totalSuccesses}`)
    console.log(`  失败次数: ${stats.totalFailures}`)
    console.log(`  成功率: ${(stats.successRate * 100).toFixed(2)}%`)

    console.log('\n列出所有任务...')
    const allJobs = scheduler.getAllJobs()
    for (const job of allJobs) {
      console.log(`  - ${job.name} (${job.enabled ? '启用' : '禁用'})`)
      console.log(`    执行次数: ${job.runCount}`)
      console.log(`    成功次数: ${job.successCount}`)
      console.log(`    失败次数: ${job.failureCount}`)
    }

    console.log('\n等待任务执行 (10秒)...')
    await new Promise(resolve => setTimeout(resolve, 10000))

    console.log('\n停止调度器...')
    await scheduler.stop()
    console.log('  调度器已停止')

    if (fs.existsSync(scriptPath)) {
      fs.unlinkSync(scriptPath)
    }
  } catch (error) {
    console.error('调度器演示失败:', error)
    await scheduler.stop()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
