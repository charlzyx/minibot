/**
 * Cron表达式解析器
 * 支持标准的5段和6段cron表达式
 */

export interface CronSchedule {
  minute: number[]
  hour: number[]
  dayOfMonth: number[]
  month: number[]
  dayOfWeek: number[]
  second?: number[]
}

export class CronParser {
  private static readonly MONTHS = [
    'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
    'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'
  ]

  private static readonly DAYS = [
    'SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'
  ]

  static parse(cronExpression: string): CronSchedule {
    const parts = cronExpression.trim().split(/\s+/)
    
    if (parts.length < 5 || parts.length > 6) {
      throw new Error(`Invalid cron expression: ${cronExpression}`)
    }

    const is6Field = parts.length === 6

    return {
      second: is6Field ? this.parseField(parts[0], 0, 59) : undefined,
      minute: this.parseField(parts[is6Field ? 1 : 0], 0, 59),
      hour: this.parseField(parts[is6Field ? 2 : 1], 0, 23),
      dayOfMonth: this.parseField(parts[is6Field ? 3 : 2], 1, 31),
      month: this.parseField(parts[is6Field ? 4 : 3], 1, 12),
      dayOfWeek: this.parseField(parts[is6Field ? 5 : 4], 0, 6)
    }
  }

  private static parseField(field: string, min: number, max: number): number[] {
    if (field === '*') {
      return Array.from({ length: max - min + 1 }, (_, i) => min + i)
    }

    const values: number[] = []
    const parts = field.split(',')

    for (const part of parts) {
      if (part.includes('/')) {
        const [base, step] = part.split('/')
        const baseValues = base === '*' 
          ? Array.from({ length: max - min + 1 }, (_, i) => min + i)
          : this.parseSingleValue(base, min, max)
        const stepNum = parseInt(step)
        
        for (let i = 0; i < baseValues.length; i += stepNum) {
          values.push(baseValues[i])
        }
      } else if (part.includes('-')) {
        const [start, end] = part.split('-')
        const startNum = this.parseSingleValue(start, min, max)[0]
        const endNum = this.parseSingleValue(end, min, max)[0]
        
        for (let i = startNum; i <= endNum; i++) {
          values.push(i)
        }
      } else {
        values.push(...this.parseSingleValue(part, min, max))
      }
    }

    return [...new Set(values)].sort((a, b) => a - b)
  }

  private static parseSingleValue(value: string, min: number, max: number): number[] {
    const num = parseInt(value)
    if (isNaN(num)) {
      throw new Error(`Invalid cron value: ${value}`)
    }
    if (num < min || num > max) {
      throw new Error(`Cron value ${num} out of range [${min}, ${max}]`)
    }
    return [num]
  }

  static getNextRunTime(schedule: CronSchedule, from: Date = new Date()): Date {
    const now = new Date(from.getTime() + 1000)
    
    for (let year = now.getFullYear(); year < now.getFullYear() + 10; year++) {
      for (const month of schedule.month) {
        if (month - 1 !== now.getMonth() && month - 1 < now.getMonth()) {
          continue
        }
        
        const daysInMonth = new Date(year, month, 0).getDate()
        for (const day of schedule.dayOfMonth) {
          if (day > daysInMonth) continue
          if (day < now.getDate() && month - 1 === now.getMonth()) continue
          
          for (const hour of schedule.hour) {
            if (hour < now.getHours() && day === now.getDate() && month - 1 === now.getMonth()) continue
            
            for (const minute of schedule.minute) {
              if (minute < now.getMinutes() && hour === now.getHours() && day === now.getDate() && month - 1 === now.getMonth()) continue
              
              if (schedule.second) {
                for (const second of schedule.second) {
                  if (second < now.getSeconds() && minute === now.getMinutes() && hour === now.getHours() && day === now.getDate() && month - 1 === now.getMonth()) continue
                  
                  const nextTime = new Date(year, month - 1, day, hour, minute, second)
                  if (nextTime > now) {
                    return nextTime
                  }
                }
              } else {
                const nextTime = new Date(year, month - 1, day, hour, minute, 0)
                if (nextTime > now) {
                  return nextTime
                }
              }
            }
          }
        }
      }
    }
    
    throw new Error('Cannot find next run time')
  }

  static shouldRunNow(cronSchedule: CronSchedule): boolean {
    const now = new Date()
    const second = now.getSeconds()
    const minute = now.getMinutes()
    const hour = now.getHours()
    const dayOfMonth = now.getDate()
    const month = now.getMonth() + 1
    const dayOfWeek = now.getDay()

    if (cronSchedule.second && !cronSchedule.second.includes(second)) {
      return false
    }
    if (!cronSchedule.minute.includes(minute)) {
      return false
    }
    if (!cronSchedule.hour.includes(hour)) {
      return false
    }
    if (!cronSchedule.dayOfMonth.includes(dayOfMonth)) {
      return false
    }
    if (!cronSchedule.month.includes(month)) {
      return false
    }
    if (!cronSchedule.dayOfWeek.includes(dayOfWeek)) {
      return false
    }

    return true
  }
}
