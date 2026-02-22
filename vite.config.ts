/// <reference types="vite/client" />
import { defineConfig } from 'vite'

// Override Vite base path for GitHub Pages deployment
// Repository: https://github.com/charlzyx/minibot
// GitHub Pages: https://charlzyx.github.io/minibot/
export default defineConfig({
  base: '/minibot/'
})
