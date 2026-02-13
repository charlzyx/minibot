/**
 * 子代理系统
 * 支持任务的分布式执行和负载均衡
 */

import { EventEmitter } from 'events'
import { v4 as uuidv4 } from 'uuid'

export interface SubagentConfig {
  id: string
  name: string
  capabilities: string[]
  maxConcurrentTasks: number
  priority: number
}

export interface SubagentState {
  id: string
  name: string
  status: 'idle' | 'busy' | 'offline' | 'error'
  currentTask: string | null
  tasksCompleted: number
  tasksFailed: number
  lastHeartbeat: Date
  load: number
}

export interface Task {
  id: string
  type: string
  payload: any
  priority: number
  timeout: number
  retries: number
  createdAt: Date
  assignedTo: string | null
  status: 'pending' | 'running' | 'completed' | 'failed'
  result?: any
  error?: string
  startedAt?: Date
  completedAt?: Date
}

export interface TaskDistribution {
  subagentId: string
  taskId: string
  load: number
}

export class SubagentManager extends EventEmitter {
  private subagents: Map<string, SubagentState> = new Map()
  private tasks: Map<string, Task> = new Map()
  private taskQueue: Task[] = []
  private heartbeatInterval: NodeJS.Timeout | null = null
  private loadBalanceInterval: NodeJS.Timeout | null = null
  private readonly HEARTBEAT_TIMEOUT = 30000
  private readonly LOAD_BALANCE_INTERVAL = 5000

  constructor() {
    super()
    this.startHeartbeatCheck()
    this.startLoadBalance()
  }

  registerSubagent(config: SubagentConfig): void {
    const subagent: SubagentState = {
      id: config.id,
      name: config.name,
      status: 'idle',
      currentTask: null,
      tasksCompleted: 0,
      tasksFailed: 0,
      lastHeartbeat: new Date(),
      load: 0
    }

    this.subagents.set(config.id, subagent)
    this.emit('subagent:registered', subagent)
  }

  unregisterSubagent(id: string): void {
    const subagent = this.subagents.get(id)
    
    if (subagent && subagent.currentTask) {
      this.failTask(subagent.currentTask, 'Subagent unregistered')
    }

    this.subagents.delete(id)
    this.emit('subagent:unregistered', id)
  }

  updateHeartbeat(id: string): void {
    const subagent = this.subagents.get(id)
    
    if (subagent) {
      subagent.lastHeartbeat = new Date()
      
      if (subagent.status === 'offline') {
        subagent.status = 'idle'
        this.emit('subagent:online', subagent)
      }
    }
  }

  updateStatus(id: string, status: SubagentState['status']): void {
    const subagent = this.subagents.get(id)
    
    if (subagent) {
      const oldStatus = subagent.status
      subagent.status = status
      
      if (oldStatus !== status) {
        this.emit('subagent:status:changed', subagent, oldStatus)
      }
    }
  }

  submitTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): string {
    const taskId = uuidv4()
    const fullTask: Task = {
      ...task,
      id: taskId,
      createdAt: new Date(),
      status: 'pending',
      assignedTo: null
    }

    this.tasks.set(taskId, fullTask)
    this.taskQueue.push(fullTask)
    this.sortTaskQueue()
    this.emit('task:submitted', fullTask)
    
    this.distributeTasks()
    
    return taskId
  }

  getTask(id: string): Task | null {
    return this.tasks.get(id) || null
  }

  getTaskStatus(id: string): Task['status'] | null {
    const task = this.tasks.get(id)
    return task ? task.status : null
  }

  completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId)
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.status = 'completed'
    task.completedAt = new Date()
    task.result = result

    if (task.assignedTo) {
      const subagent = this.subagents.get(task.assignedTo)
      
      if (subagent) {
        subagent.currentTask = null
        subagent.tasksCompleted++
        subagent.load = Math.max(0, subagent.load - 1)
      }
    }

    this.emit('task:completed', task)
    this.distributeTasks()
  }

  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId)
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`)
    }

    task.status = 'failed'
    task.completedAt = new Date()
    task.error = error

    if (task.assignedTo) {
      const subagent = this.subagents.get(task.assignedTo)
      
      if (subagent) {
        subagent.currentTask = null
        subagent.tasksFailed++
        subagent.load = Math.max(0, subagent.load - 1)
      }
    }

    if (task.retries > 0) {
      task.retries--
      task.status = 'pending'
      task.assignedTo = null
      this.taskQueue.push(task)
      this.sortTaskQueue()
    }

    this.emit('task:failed', task)
    this.distributeTasks()
  }

  getSubagent(id: string): SubagentState | null {
    return this.subagents.get(id) || null
  }

  getSubagentStatus(id: string): SubagentState['status'] | null {
    const subagent = this.subagents.get(id)
    return subagent ? subagent.status : null
  }

  getAvailableSubagents(): SubagentState[] {
    return Array.from(this.subagents.values()).filter(
      subagent => subagent.status === 'idle'
    )
  }

  getBusySubagents(): SubagentState[] {
    return Array.from(this.subagents.values()).filter(
      subagent => subagent.status === 'busy'
    )
  }

  getTaskDistribution(): TaskDistribution[] {
    const distribution: TaskDistribution[] = []

    for (const [id, subagent] of this.subagents) {
      distribution.push({
        subagentId: id,
        taskId: subagent.currentTask || '',
        load: subagent.load
      })
    }

    return distribution
  }

  getSystemLoad(): {
    totalSubagents: number
    idleSubagents: number
    busySubagents: number
    offlineSubagents: number
    totalTasks: number
    pendingTasks: number
    runningTasks: number
    completedTasks: number
    failedTasks: number
    averageLoad: number
  } {
    const subagents = Array.from(this.subagents.values())
    const tasks = Array.from(this.tasks.values())

    const idleSubagents = subagents.filter(s => s.status === 'idle').length
    const busySubagents = subagents.filter(s => s.status === 'busy').length
    const offlineSubagents = subagents.filter(s => s.status === 'offline').length

    const pendingTasks = tasks.filter(t => t.status === 'pending').length
    const runningTasks = tasks.filter(t => t.status === 'running').length
    const completedTasks = tasks.filter(t => t.status === 'completed').length
    const failedTasks = tasks.filter(t => t.status === 'failed').length

    const totalLoad = subagents.reduce((sum, s) => sum + s.load, 0)
    const averageLoad = subagents.length > 0 ? totalLoad / subagents.length : 0

    return {
      totalSubagents: subagents.length,
      idleSubagents,
      busySubagents,
      offlineSubagents,
      totalTasks: tasks.length,
      pendingTasks,
      runningTasks,
      completedTasks,
      failedTasks,
      averageLoad
    }
  }

  private distributeTasks(): void {
    const availableSubagents = this.getAvailableSubagents()
    const pendingTasks = this.taskQueue.filter(t => t.status === 'pending')

    if (availableSubagents.length === 0 || pendingTasks.length === 0) {
      return
    }

    for (const task of pendingTasks) {
      if (availableSubagents.length === 0) {
        break
      }

      const subagent = this.selectSubagentForTask(availableSubagents, task)
      
      if (subagent) {
        this.assignTaskToSubagent(task, subagent)
        const index = availableSubagents.indexOf(subagent)
        availableSubagents.splice(index, 1)
      }
    }
  }

  private selectSubagentForTask(
    subagents: SubagentState[],
    task: Task
  ): SubagentState | null {
    if (subagents.length === 0) {
      return null
    }

    const capableSubagents = subagents.filter(s => 
      this.isSubagentCapable(s, task)
    )

    if (capableSubagents.length === 0) {
      return null
    }

    capableSubagents.sort((a, b) => {
      if (a.load !== b.load) {
        return a.load - b.load
      }
      return (a.tasksCompleted - a.tasksFailed) - (b.tasksCompleted - b.tasksFailed)
    })

    return capableSubagents[0]
  }

  private isSubagentCapable(subagent: SubagentState, task: Task): boolean {
    return true
  }

  private assignTaskToSubagent(task: Task, subagent: SubagentState): void {
    task.status = 'running'
    task.startedAt = new Date()
    task.assignedTo = subagent.id

    subagent.currentTask = task.id
    subagent.status = 'busy'
    subagent.load++

    this.emit('task:assigned', task, subagent)
  }

  private sortTaskQueue(): void {
    this.taskQueue.sort((a, b) => {
      if (a.priority !== b.priority) {
        return b.priority - a.priority
      }
      return a.createdAt.getTime() - b.createdAt.getTime()
    })
  }

  private startHeartbeatCheck(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now()
      
      for (const [id, subagent] of this.subagents) {
        const timeSinceHeartbeat = now - subagent.lastHeartbeat.getTime()
        
        if (timeSinceHeartbeat > this.HEARTBEAT_TIMEOUT && subagent.status !== 'offline') {
          const oldStatus = subagent.status
          subagent.status = 'offline'
          
          if (subagent.currentTask) {
            this.failTask(subagent.currentTask, 'Subagent offline')
          }
          
          this.emit('subagent:offline', subagent, oldStatus)
        }
      }
    }, this.HEARTBEAT_TIMEOUT / 3)
  }

  private startLoadBalance(): void {
    this.loadBalanceInterval = setInterval(() => {
      this.distributeTasks()
      this.emit('system:load:balanced', this.getSystemLoad())
    }, this.LOAD_BALANCE_INTERVAL)
  }

  stop(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval)
      this.heartbeatInterval = null
    }

    if (this.loadBalanceInterval) {
      clearInterval(this.loadBalanceInterval)
      this.loadBalanceInterval = null
    }

    this.removeAllListeners()
  }
}
