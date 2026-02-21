/**
 * Monitoring and Statistics Module for Minibot
 *
 * Provides system monitoring, metrics collection, and diagnostics.
 */

import fs from 'fs'
import path from 'path'
import { getWorkspace } from '../config/manager'
import { createLogger } from '../utils'
import { getGroupQueueManager } from '../group-queue'
import { getSessionManager } from '../session'
import { getMemoryManager } from '../memory'
import { getContainerOrchestrator } from '../container-orchestrator'

const logger = createLogger('Monitoring')

export interface SystemMetrics {
  timestamp: number
  uptime: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  queue: {
    totalQueued: number
    totalRunning: number
    byGroup: Record<string, { queued: number; running: number }>
  }
  sessions: {
    total: number
    active: number
  }
}

export interface PerformanceMetrics {
  averageResponseTime: number
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  successRate: number
}

/**
 * Monitoring Manager
 */
export class MonitoringManager {
  private dataDir: string
  private startTime: number
  private metrics: {
    responseTimes: number[]
    totalRequests: number
    successfulRequests: number
    failedRequests: number
  }

  constructor() {
    this.dataDir = getWorkspace()
    this.startTime = Date.now()
    this.metrics = {
      responseTimes: [],
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0
    }
  }

  /**
   * Get current system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const memoryUsage = process.memoryUsage()
    const queueManager = getGroupQueueManager()
    const sessionManager = getSessionManager()
    const queueStats = queueManager.getStats()

    const sessions = sessionManager.getAllSessions()
    const activeSessions = sessions.filter(s => {
      const lastActivity = s.lastMessageTime || 0
      return Date.now() - lastActivity < 30 * 60 * 1000 // 30 minutes
    })

    return {
      timestamp: Date.now(),
      uptime: Date.now() - this.startTime,
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      },
      queue: queueStats,
      sessions: {
        total: sessions.length,
        active: activeSessions.length
      }
    }
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const avgResponseTime = this.metrics.responseTimes.length > 0
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0

    return {
      averageResponseTime: avgResponseTime,
      totalRequests: this.metrics.totalRequests,
      successfulRequests: this.metrics.successfulRequests,
      failedRequests: this.metrics.failedRequests,
      successRate: this.metrics.totalRequests > 0
        ? (this.metrics.successfulRequests / this.metrics.totalRequests) * 100
        : 0
    }
  }

  /**
   * Record a request
   */
  recordRequest(responseTime: number, success: boolean): void {
    this.metrics.responseTimes.push(responseTime)
    this.metrics.totalRequests++

    if (success) {
      this.metrics.successfulRequests++
    } else {
      this.metrics.failedRequests++
    }

    // Keep only last 1000 response times
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift()
    }
  }

  /**
   * Get health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    checks: Record<string, boolean>
  } {
    const checks: Record<string, boolean> = {}
    let unhealthyCount = 0

    // Check memory usage
    const metrics = this.getSystemMetrics()
    checks.memory = metrics.memory.percentage < 90
    if (!checks.memory) unhealthyCount++

    // Check queue
    checks.queue = metrics.queue.totalRunning < 10
    if (!checks.queue) unhealthyCount++

    // Check sessions
    checks.sessions = metrics.sessions.total < 1000
    if (!checks.sessions) unhealthyCount++

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (unhealthyCount === 0) {
      status = 'healthy'
    } else if (unhealthyCount <= 1) {
      status = 'degraded'
    } else {
      status = 'unhealthy'
    }

    return { status, checks }
  }

  /**
   * Format metrics for display
   */
  formatMetrics(): string {
    const systemMetrics = this.getSystemMetrics()
    const performanceMetrics = this.getPerformanceMetrics()
    const healthStatus = this.getHealthStatus()

    const uptime = Math.floor(systemMetrics.uptime / 1000)
    const uptimeStr = uptime > 3600
      ? `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`
      : uptime > 60
      ? `${Math.floor(uptime / 60)}m ${uptime % 60}s`
      : `${uptime}s`

    let output = '📊 **系统监控**\n\n'

    // Health status
    const statusEmoji = healthStatus.status === 'healthy' ? '✅' : healthStatus.status === 'degraded' ? '⚠️' : '❌'
    output += `${statusEmoji} 状态: ${healthStatus.status}\n\n`

    // Uptime
    output += `⏱️ 运行时间: ${uptimeStr}\n\n`

    // Memory
    const memoryMB = (systemMetrics.memory.used / 1024 / 1024).toFixed(2)
    output += `💾 内存: ${memoryMB}MB (${systemMetrics.memory.percentage.toFixed(1)}%)\n\n`

    // Queue
    output += `📦 队列: ${systemMetrics.queue.totalRunning} 运行中, ${systemMetrics.queue.totalQueued} 等待中\n\n`

    // Sessions
    output += `👥 会话: ${systemMetrics.sessions.active}/${systemMetrics.sessions.total} 活跃\n\n`

    // Performance
    output += `⚡ 性能:\n`
    output += `  总请求数: ${performanceMetrics.totalRequests}\n`
    output += `  成功率: ${performanceMetrics.successRate.toFixed(1)}%\n`
    if (performanceMetrics.averageResponseTime > 0) {
      output += `  平均响应: ${performanceMetrics.averageResponseTime.toFixed(0)}ms\n`
    }

    return output
  }

  /**
   * Write metrics to file for external monitoring
   */
  writeMetrics(): void {
    const metricsDir = path.join(this.dataDir, 'metrics')
    fs.mkdirSync(metricsDir, { recursive: true })

    const metrics = {
      system: this.getSystemMetrics(),
      performance: this.getPerformanceMetrics(),
      health: this.getHealthStatus()
    }

    fs.writeFileSync(
      path.join(metricsDir, 'current.json'),
      JSON.stringify(metrics, null, 2),
      'utf8'
    )
  }

  /**
   * Cleanup old metrics files
   */
  cleanup(maxAge: number = 7 * 24 * 60 * 60 * 1000): void {
    const metricsDir = path.join(this.dataDir, 'metrics')

    try {
      if (!fs.existsSync(metricsDir)) {
        return
      }

      const files = fs.readdirSync(metricsDir)
      const now = Date.now()

      for (const file of files) {
        if (file === 'current.json') continue

        const filepath = path.join(metricsDir, file)
        const stat = fs.statSync(filepath)

        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filepath)
          logger.debug('Cleaned up old metrics file', { file })
        }
      }
    } catch (err) {
      logger.error('Failed to cleanup metrics', { error: err })
    }
  }
}

// Global monitoring instance
let monitoringManager: MonitoringManager | null = null

/**
 * Get the global monitoring manager instance
 */
export function getMonitoringManager(): MonitoringManager {
  if (!monitoringManager) {
    monitoringManager = new MonitoringManager()
  }
  return monitoringManager
}
