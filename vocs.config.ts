import { defineConfig } from 'vocs'

export default defineConfig({
  title: 'Minibot Documentation',
  description: 'Lightweight AI assistant with Hono + TypeScript',
  theme: {
    sidebar: {
      items: [
        {
          text: 'Introduction',
          link: '/',
        },
        {
          text: 'Guide',
          items: [
            {
              text: 'Getting Started',
              link: '/guide/usage',
            },
            {
              text: 'Cron Guide',
              link: '/guide/cron-guide',
            },
            {
              text: 'Cron Deployment',
              link: '/guide/cron-deployment',
            },
          ],
        },
        {
          text: 'API Reference',
          items: [
            {
              text: 'Agent',
              link: '/api/agent',
            },
            {
              text: 'Commands',
              link: '/api/commands',
            },
            {
              text: 'Session',
              link: '/api/session',
            },
            {
              text: 'Tools',
              link: '/api/tools',
            },
          ],
        },
        {
          text: 'Tutorials',
          items: [
            {
              text: 'Basic Usage',
              link: '/tutorials/basic',
            },
            {
              text: 'Advanced Features',
              link: '/tutorials/advanced',
            },
          ],
        },
        {
          text: 'Reference',
          items: [
            {
              text: 'Configuration',
              link: '/reference/config',
            },
            {
              text: 'Environment Variables',
              link: '/reference/env',
            },
            {
              text: 'CLI Commands',
              link: '/reference/cli',
            },
          ],
        },
      ],
    },
  },
  head:
    [
      {
        tag: 'link',
        attrs: {
          rel: 'icon',
          href: '/favicon.ico',
        },
      },
    ],
})
