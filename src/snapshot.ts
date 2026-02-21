/**
 * Snapshot System for Minibot
 *
 * Provides snapshot files for containers to read current state.
 * Inspired by nanoclaw's snapshot implementation.
 *
 * Snapshots are written to: snapshots/{groupFolder}/
 * - groups.json - Available groups
 * - tasks.json - Scheduled tasks
 */

import fs from 'fs'
import path from 'path'
import { getWorkspace } from './config/manager'
import { createLogger } from './utils'

const logger = createLogger('Snapshot')

export interface AvailableGroup {
  jid: string
  name: string
  lastActivity: number
  isRegistered: boolean
}

export interface TaskSnapshot {
  id: string
  groupFolder: string
  prompt: string
  schedule_type: string
  schedule_value: string
  status: string
  next_run: string
}

export interface GroupsSnapshot {
  groups: AvailableGroup[]
  timestamp: number
}

export interface TasksSnapshot {
  tasks: TaskSnapshot[]
  timestamp: number
}

/**
 * Write groups snapshot for a group
 */
export function writeGroupsSnapshot(
  groupFolder: string,
  isMain: boolean,
  availableGroups: AvailableGroup[],
  registeredJids: Set<string>
): void {
  try {
    const dataDir = getWorkspace()
    const snapshotDir = path.join(dataDir, 'snapshots', groupFolder)
    fs.mkdirSync(snapshotDir, { recursive: true })

    const snapshot: GroupsSnapshot = {
      groups: isMain
        ? availableGroups
        : availableGroups.filter(g => registeredJids.has(g.jid)),
      timestamp: Date.now()
    }

    fs.writeFileSync(
      path.join(snapshotDir, 'groups.json'),
      JSON.stringify(snapshot, null, 2),
      'utf8'
    )

    logger.debug({ groupFolder, count: snapshot.groups.length }, 'Groups snapshot written')
  } catch (err) {
    logger.error({ groupFolder, error: err }, 'Failed to write groups snapshot')
  }
}

/**
 * Write tasks snapshot for a group
 */
export function writeTasksSnapshot(
  groupFolder: string,
  isMain: boolean,
  tasks: any[]
): void {
  try {
    const dataDir = getWorkspace()
    const snapshotDir = path.join(dataDir, 'snapshots', groupFolder)
    fs.mkdirSync(snapshotDir, { recursive: true })

    const snapshot: TasksSnapshot = {
      tasks: isMain
        ? tasks.map(t => ({
            id: t.id,
            groupFolder: t.group_folder,
            prompt: t.prompt,
            schedule_type: t.schedule_type,
            schedule_value: t.schedule_value,
            status: t.status,
            next_run: t.next_run
          }))
        : tasks
            .filter(t => t.group_folder === groupFolder)
            .map(t => ({
              id: t.id,
              groupFolder: t.group_folder,
              prompt: t.prompt,
              schedule_type: t.schedule_type,
              schedule_value: t.schedule_value,
              status: t.status,
              next_run: t.next_run
            })),
      timestamp: Date.now()
    }

    fs.writeFileSync(
      path.join(snapshotDir, 'tasks.json'),
      JSON.stringify(snapshot, null, 2),
      'utf8'
    )

    logger.debug({ groupFolder, count: snapshot.tasks.length }, 'Tasks snapshot written')
  } catch (err) {
    logger.error({ groupFolder, error: err }, 'Failed to write tasks snapshot')
  }
}

/**
 * Read groups snapshot for a group
 */
export function readGroupsSnapshot(groupFolder: string): GroupsSnapshot | null {
  try {
    const dataDir = getWorkspace()
    const snapshotPath = path.join(dataDir, 'snapshots', groupFolder, 'groups.json')

    if (!fs.existsSync(snapshotPath)) {
      return null
    }

    const content = fs.readFileSync(snapshotPath, 'utf8')
    return JSON.parse(content) as GroupsSnapshot
  } catch (err) {
    logger.error({ groupFolder, error: err }, 'Failed to read groups snapshot')
    return null
  }
}

/**
 * Read tasks snapshot for a group
 */
export function readTasksSnapshot(groupFolder: string): TasksSnapshot | null {
  try {
    const dataDir = getWorkspace()
    const snapshotPath = path.join(dataDir, 'snapshots', groupFolder, 'tasks.json')

    if (!fs.existsSync(snapshotPath)) {
      return null
    }

    const content = fs.readFileSync(snapshotPath, 'utf8')
    return JSON.parse(content) as TasksSnapshot
  } catch (err) {
    logger.error({ groupFolder, error: err }, 'Failed to read tasks snapshot')
    return null
  }
}

/**
 * Clean up old snapshots
 */
export function cleanupSnapshots(maxAge: number = 24 * 60 * 60 * 1000): void {
  const now = Date.now()
  const dataDir = getWorkspace()
  const snapshotsDir = path.join(dataDir, 'snapshots')

  try {
    if (!fs.existsSync(snapshotsDir)) {
      return
    }

    const groupFolders = fs.readdirSync(snapshotsDir)

    for (const groupFolder of groupFolders) {
      const groupDir = path.join(snapshotsDir, groupFolder)
      const stat = fs.statSync(groupDir)

      if (!stat.isDirectory()) {
        continue
      }

      const files = fs.readdirSync(groupDir)

      for (const file of files) {
        const filePath = path.join(groupDir, file)
        const fileStat = fs.statSync(filePath)

        if (fileStat.isFile() && now - fileStat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath)
          logger.debug({ groupFolder, file }, 'Cleaned up old snapshot')
        }
      }
    }
  } catch (err) {
    logger.error({ error: err }, 'Failed to cleanup snapshots')
  }
}
