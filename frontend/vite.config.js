import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /Rally.AI/ (the repo name).
export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react()],
  server: {
    proxy: {
      '/heatmaps': 'http://localhost:8001',
      '/analyze':  'http://localhost:8001',
      '/videos':   'http://localhost:8001',
      '/matches':  'http://localhost:8001',
    }
  }
})
