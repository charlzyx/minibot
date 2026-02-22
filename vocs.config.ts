import { defineConfig } from 'vocs'

// Base path for GitHub Pages deployment
// Repository: https://github.com/charlzyx/minibot
// GitHub Pages: https://charlzyx.github.io/minibot/
export default defineConfig({
  basePath: '/minibot',
  title: 'Minibot',
  description: '轻量级 AI 助手 - 基于 Hono + TypeScript + Node.js',
  lang: 'zh-CN',
  theme: {
    logo: {
      text: 'Minibot',
      image: '/minibot/logo.svg'
    },
    header: {
      actions: [
        {
          text: 'GitHub',
          link: 'https://github.com/charlzyx/minibot'
        }
      ]
    },
    sidebar: {
      '/': [
        {
          text: '开始',
          items: [
            {
              text: '简介',
              link: '/'
            },
            {
              text: '快速开始',
              link: '/guide/getting-started'
            },
            {
              text: '5分钟上手',
              link: '/guide/quick-start'
            },
            {
              text: '配置指南',
              link: '/guide/configuration'
            },
            {
              text: '部署指南',
              link: '/guide/deployment'
            }
          ]
        },
        {
          text: '功能指南',
          items: [
            {
              text: '代码助手',
              link: '/guide/code-assistant'
            }
          ]
        },
        {
          text: 'API 参考',
          items: [
            {
              text: 'Agent',
              link: '/api/agent'
            },
            {
              text: 'Commands',
              link: '/api/commands'
            },
            {
              text: 'Session',
              link: '/api/session'
            },
            {
              text: 'Tools',
              link: '/api/tools'
            }
          ]
        },
        {
          text: '参考',
          items: [
            {
              text: 'CLI 命令',
              link: '/reference/cli'
            },
            {
              text: '环境变量',
              link: '/reference/env'
            }
          ]
        }
      ]
    },
    footer: {
      message: '基于 MIT 许可证发布',
      copyright: 'Copyright © 2024 charlzyx'
    }
  },
  head: [
    {
      tag: 'link',
      attrs: {
        rel: 'icon',
        href: '/minibot/favicon.ico'
      }
    }
  ]
})
