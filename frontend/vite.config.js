import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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

