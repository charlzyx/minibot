#!/usr/bin/env node

import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

interface CommandLineOptions {
  workspace?: string
  port?: number
  help?: boolean
  version?: boolean
}

function parseArgs(): { command: string | null; options: CommandLineOptions } {
  const args = process.argv.slice(2)
  const options: CommandLineOptions = {}
  let command: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    
    if (arg.startsWith('--')) {
      const [key, value] = arg.split('=')
      const optionName = key.slice(2)
      
      if (optionName === 'workspace') {
        options.workspace = value
      } else if (optionName === 'port') {
        options.port = parseInt(value, 10)
      } else if (optionName === 'help') {
        options.help = true
      } else if (optionName === 'version') {
        options.version = true
      }
    } else if (!command) {
      command = arg
    }
  }

  return { command, options }
}

function showHelp() {
  console.log('Minibot CLI')
  console.log('')
  console.log('Usage: minibot <command> [options]')
  console.log('')
  console.log('Commands:')
  console.log('  start    Start the minibot server')
  console.log('  build    Build the project')
  console.log('  dev      Start development server')
  console.log('  help     Show this help message')
  console.log('  version  Show version information')
  console.log('')
  console.log('Options:')
  console.log('  --workspace=<path>  Set custom workspace directory')
  console.log('  --port=<number>     Set server port')
  console.log('  --help              Show this help message')
  console.log('  --version           Show version information')
  console.log('')
  console.log('Examples:')
  console.log('  minibot start')
  console.log('  minibot start --workspace=/path/to/workspace')
  console.log('  minibot start --port=3000')
  console.log('  minibot dev --workspace=/path/to/workspace')
}

function showVersion() {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../package.json'), 'utf8'))
  console.log(`Minibot version ${packageJson.version}`)
}

function checkBuild() {
  if (!fs.existsSync(path.join(__dirname, '../dist'))) {
    console.log('Building project...')
    execSync('npm run build', { stdio: 'inherit' })
  }
}

function main() {
  const { command, options } = parseArgs()

  if (options.help) {
    showHelp()
    return
  }

  if (options.version) {
    showVersion()
    return
  }

  if (!command) {
    showHelp()
    return
  }

  switch (command) {
    case 'start':
      checkBuild()
      
      let startCommand = 'node dist/index.js'
      if (options.workspace) {
        startCommand += ` --workspace=${options.workspace}`
      }
      if (options.port) {
        startCommand += ` --port=${options.port}`
      }
      
      console.log(`Starting Minibot server...`)
      execSync(startCommand, { stdio: 'inherit' })
      break

    case 'build':
      console.log('Building project...')
      execSync('npm run build', { stdio: 'inherit' })
      break

    case 'dev':
      let devCommand = 'npm run dev'
      if (options.workspace) {
        devCommand += ` -- --workspace=${options.workspace}`
      }
      if (options.port) {
        devCommand += ` -- --port=${options.port}`
      }
      
      console.log('Starting development server...')
      execSync(devCommand, { stdio: 'inherit' })
      break

    case 'help':
      showHelp()
      break

    case 'version':
      showVersion()
      break

    default:
      console.log(`Unknown command: ${command}`)
      showHelp()
      break
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}

export { main }
