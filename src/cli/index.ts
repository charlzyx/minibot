#!/usr/bin/env node
/**
 * Minibot CLI - Built with citty
 *
 * Usage:
 *   minibot dev          - Start development server
 *   minibot start        - Start production server
 *   minibot build        - Build the project
 *   minibot test         - Run tests
 *   minibot code <task>  - Run Claude Code in container
 *   minibot container build - Build container images
 *   minibot doctor       - Check system health
 */

import { defineCommand, runMain } from 'citty'
import { consola } from 'consola'
import { loadMinibotConfig } from '../config'

const PACKAGE_VERSION = '2.1.0'

// Dev command
const devCommand = defineCommand({
  meta: {
    name: 'dev',
    description: 'Start development server'
  },
  args: {
    workspace: {
      type: 'string',
      description: 'Workspace directory path',
      required: false
    },
    port: {
      type: 'string',
      description: 'Server port',
      required: false
    }
  },
  async run({ args }) {
    consola.info('Starting Minibot development server...')

    // Set environment variables from args
    if (args.workspace) {
      process.env.MINIBOT_WORKSPACE = args.workspace
    }
    if (args.port) {
      process.env.PORT = args.port
    }

    // Import and run the dev server
    const { dev } = await import('../index')
    await dev()
  }
})

// Start command
const startCommand = defineCommand({
  meta: {
    name: 'start',
    description: 'Start production server'
  },
  args: {
    workspace: {
      type: 'string',
      description: 'Workspace directory path',
      required: false
    },
    port: {
      type: 'string',
      description: 'Server port',
      required: false
    }
  },
  async run({ args }) {
    consola.info('Starting Minibot production server...')

    // Set environment variables from args
    if (args.workspace) {
      process.env.MINIBOT_WORKSPACE = args.workspace
    }
    if (args.port) {
      process.env.PORT = args.port
    }

    // Import and run the production server
    const { start } = await import('../index')
    await start()
  }
})

// Build command
const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Build the project'
  },
  async run() {
    consola.info('Building Minibot...')

    const { spawn } = await import('child_process')

    return new Promise((resolve, reject) => {
      const proc = spawn('npx', ['tsc'], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

      proc.on('close', (code) => {
        if (code === 0) {
          consola.success('Build completed successfully')
          resolve(void 0)
        } else {
          consola.error('Build failed')
          reject(new Error(`Build failed with exit code ${code}`))
        }
      })

      proc.on('error', reject)
    })
  }
})

// Test command
const testCommand = defineCommand({
  meta: {
    name: 'test',
    description: 'Run tests'
  },
  args: {
    coverage: {
      type: 'boolean',
      description: 'Generate coverage report',
      required: false
    },
    watch: {
      type: 'boolean',
      description: 'Watch mode',
      required: false
    }
  },
  async run({ args }) {
    consola.info('Running tests...')

    const { spawn } = await import('child_process')

    return new Promise((resolve, reject) => {
      const testArgs = ['run']
      if (args.coverage) testArgs.push('--coverage')
      if (args.watch) testArgs.splice(0, 1, '--watch')

      const proc = spawn('npx', ['vitest', ...testArgs], {
        cwd: process.cwd(),
        stdio: 'inherit'
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(void 0)
        } else {
          reject(new Error(`Tests failed with exit code ${code}`))
        }
      })

      proc.on('error', reject)
    })
  }
})

// Code command - Run Claude Code in container
const codeCommand = defineCommand({
  meta: {
    name: 'code',
    description: 'Run Claude Code in container'
  },
  args: {
    task: {
      type: 'string',
      description: 'Code task to execute',
      required: true
    },
    project: {
      type: 'string',
      description: 'Project directory path',
      required: false
    },
    model: {
      type: 'string',
      description: 'Claude model to use',
      required: false
    },
    timeout: {
      type: 'string',
      description: 'Timeout in milliseconds',
      required: false
    }
  },
  async run({ args }) {
    consola.info('Running Claude Code in container...')

    const { runClaudeCode } = await import('../container/claude-runner')

    const result = await runClaudeCode({
      task: args.task,
      projectPath: args.project,
      options: {
        model: args.model,
        timeout: args.timeout ? parseInt(args.timeout) : undefined,
        apiKey: process.env.ANTHROPIC_API_KEY
      }
    })

    if (result.status === 'success') {
      consola.success('Claude Code completed successfully')
      if (result.output) {
        console.log(result.output)
      }
    } else {
      consola.error('Claude Code failed:', result.error)
      process.exit(1)
    }
  }
})

// Container command
const containerCommand = defineCommand({
  meta: {
    name: 'container',
    description: 'Container management commands'
  },
  subCommands: {
    build: defineCommand({
      meta: {
        name: 'build',
        description: 'Build container images'
      },
      async run() {
        consola.info('Building container images...')

        const { spawn } = await import('child_process')

        return new Promise((resolve, reject) => {
          const scriptPath = `${process.cwd()}/scripts/build-claude-container.sh`
          const proc = spawn('bash', [scriptPath], {
            cwd: process.cwd(),
            stdio: 'inherit'
          })

          proc.on('close', (code) => {
            if (code === 0) {
              consola.success('Container images built successfully')
              resolve(void 0)
            } else {
              consola.error('Container build failed')
              reject(new Error(`Build failed with exit code ${code}`))
            }
          })

          proc.on('error', reject)
        })
      }
    }),
    stop: defineCommand({
      meta: {
        name: 'stop',
        description: 'Stop all running containers'
      },
      async run() {
        consola.info('Stopping all containers...')

        const { cleanupClaudeCodeContainers } = await import('../container/claude-runner')
        await cleanupClaudeCodeContainers()

        consola.success('All containers stopped')
      }
    }),
    list: defineCommand({
      meta: {
        name: 'list',
        description: 'List running containers'
      },
      async run() {
        const { getClaudeCodeRunner } = await import('../container/claude-runner')
        const runner = getClaudeCodeRunner()
        const containers = await runner.listContainers()

        if (containers.length === 0) {
          consola.info('No running containers')
        } else {
          consola.log('Running containers:')
          containers.forEach(c => consola.log(`  - ${c}`))
        }
      }
    })
  }
})

// Doctor command - Check system health
const doctorCommand = defineCommand({
  meta: {
    name: 'doctor',
    description: 'Check system health and configuration'
  },
  async run() {
    consola.info('Running system diagnostics...\n')

    const checks: { name: string; check: () => Promise<boolean> | boolean }[] = [
      {
        name: 'Node.js version',
        check: async () => {
          const version = process.version
          const major = parseInt(version.slice(1).split('.')[0])
          const valid = major >= 18
          if (valid) consola.success(`Node.js ${version}`)
          else consola.warn(`Node.js ${version} (recommended: 18+)`)
          return valid
        }
      },
      {
        name: 'Configuration file',
        check: async () => {
          const config = await loadMinibotConfig()
          const valid = !!config.provider.apiKey
          if (valid) consola.success('Configuration loaded')
          else consola.warn('Configuration incomplete (missing API key)')
          return valid
        }
      },
      {
        name: 'Docker',
        check: async () => {
          const { execSync } = await import('child_process')
          try {
            execSync('docker --version', { stdio: 'pipe' })
            consola.success('Docker installed')
            return true
          } catch {
            consola.warn('Docker not found (required for /code command)')
            return false
          }
        }
      },
      {
        name: 'Workspace directory',
        check: async () => {
          const { existsSync } = await import('fs')
          const { resolve } = await import('path')
          const workspace = process.env.MINIBOT_WORKSPACE || resolve(process.env.HOME || '', 'minibot')
          const valid = existsSync(workspace) || existsSync(resolve(process.cwd(), workspace))
          if (valid) consola.success(`Workspace: ${workspace}`)
          else consola.warn(`Workspace not found: ${workspace}`)
          return true
        }
      }
    ]

    let passed = 0
    for (const { name, check } of checks) {
      consola.log(`Checking ${name}...`)
      if (await check()) passed++
    }

    consola.log(`\n${passed}/${checks.length} checks passed`)
  }
})

// Main command
const mainCommand = defineCommand({
  meta: {
    name: 'minibot',
    description: 'Minibot - Lightweight AI Assistant',
    version: PACKAGE_VERSION
  },
  subCommands: {
    dev: devCommand,
    start: startCommand,
    build: buildCommand,
    test: testCommand,
    code: codeCommand,
    container: containerCommand,
    doctor: doctorCommand
  },
  async run() {
    // Show help when no subcommand is provided
    consola.log(`Minibot v${PACKAGE_VERSION}`)
    consola.log('\nUsage: minibot <command> [options]\n')
    consola.log('Commands:')
    consola.log('  dev       Start development server')
    consola.log('  start     Start production server')
    consola.log('  build     Build the project')
    consola.log('  test      Run tests')
    consola.log('  code      Run Claude Code in container')
    consola.log('  container Container management')
    consola.log('  doctor    Check system health')
    consola.log('\nOptions:')
    consola.log('  --help    Show help')
    consola.log('  --version Show version\n')
  }
})

// Run the CLI
runMain(mainCommand)
