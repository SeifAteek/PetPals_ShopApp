import path from 'path'
import { fileURLToPath } from 'url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/PetPals_ShopApp/' : './',
  plugins: [react()],
  build: {
    cssMinify: false,
  },
  resolve: {
    alias: {
      '@petpals/theme': path.resolve(__dirname, './shared-web-theme'),
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 5176,
    open: false,
  },
})
