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
